/**
 * PROJEKT ALIKON - server
 * Render.com / localhost
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const { exec } = require('child_process');

const PORT      = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'alikon_dealer.html');

function fetchWithCurl(targetUrl) {
  return new Promise((resolve, reject) => {
    const cmd = `curl -s -L --max-time 20 --compressed `
      + `-H "Accept-Language: cs-CZ,cs;q=0.9" `
      + `-H "Accept: text/html,application/xhtml+xml,*/*;q=0.9" `
      + `-H "Cache-Control: no-cache" `
      + `-H "Upgrade-Insecure-Requests: 1" `
      + `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" `
      + `"${targetUrl}"`;

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error('curl chyba: ' + err.message));
      const html = stdout;
      if (!html || html.length < 1000) return reject(new Error('Prazdna odpoved'));
      resolve(html);
    });
  });
}

function isLoginPage(html) {
  return html.includes('Zapomenuté heslo') ||
         (html.includes('type="password"') && !html.includes('Cena v hotovosti'));
}

http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (parsed.pathname === '/scrape') {
    const targetUrl = parsed.query.url;
    if (!targetUrl || !targetUrl.includes('autoesa.cz')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Neplatna URL' })); return;
    }
    console.log('Nacitavam:', targetUrl);
    for (let i = 1; i <= 5; i++) {
      try {
        console.log('  pokus ' + i + '/5...');
        const html = await fetchWithCurl(targetUrl);
        if (!isLoginPage(html)) {
          console.log('  -> OK (' + html.length + ' znakov)');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html); return;
        }
        console.log('  -> login stranka, cakam ' + (i*2) + 's...');
        await new Promise(r => setTimeout(r, i * 2000));
      } catch(e) {
        console.log('  -> chyba: ' + e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Nepodarilo sa nacitat. Skuste znova.' }));
    return;
  }

  if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
    if (!fs.existsSync(HTML_FILE)) {
      res.writeHead(404); res.end('alikon_dealer.html nenajdeny'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(HTML_FILE, 'utf8'));
    return;
  }

  res.writeHead(404); res.end();

}).listen(PORT, () => {
  console.log('Server bezi na porte ' + PORT);
});
