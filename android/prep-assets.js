// Copies the canonical game (../index.html) into the app's assets, rewriting the
// two CDN <script> tags to the React files bundled beside it so the app runs
// offline. Run before `gradle assembleDebug`. Keeps the published index.html
// (artifact / LAN / GitHub Pages) untouched — only the bundled seed changes.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CDN_REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js';
const CDN_REACTDOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js';

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.split(CDN_REACT).join('react.production.min.js')
           .split(CDN_REACTDOM).join('react-dom.production.min.js');

const out = path.join(__dirname, 'app', 'src', 'main', 'assets', 'index.html');
fs.writeFileSync(out, html);
console.log('prep-assets: wrote', out, '(' + html.length + ' bytes)');
