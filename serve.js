// Serves the game to your phone. The game is one self-contained file, so this hands
// out exactly that file and nothing else.
//
//   node serve.js            the LAN address and port to type into your phone
//   node serve.js 8080       a different port
//
// Deliberately not `python -m http.server` from the project root: that would serve the
// whole folder, including .claude/settings.json, which holds an API token. This only
// ever answers for index.html, so there is nothing else to reach.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.argv[2] || 8000);
const FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/index.html') {
    const body = fs.readFileSync(FILE);            // read per request, so a reload picks up edits
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not here');
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list || [])
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  // the private ranges are the ones a phone on the same wifi can reach
  const lan = ips.filter(a => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(a));
  console.log('CaveRunner is up. On your phone, open:\n');
  for (const a of (lan.length ? lan : ips)) console.log(`   http://${a}:${PORT}`);
  console.log('\n(the phone has to be on the same wifi. Ctrl-C to stop.)');
});