// The level vending machines' terminal font (src/art/pixfont.js): every character their screens
// can show has a glyph (an unknown one would draw as a gap), widths add up, and drawing fills only
// inside the glyph box.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const lines = ['BUY', 'SELL', 'lvl', '01', '1,000,000,000 G.', '*credit available', '*no biological', 'entities accepted',
  'OVERDUE', '0:59', 'BURN', 'debt defaulted', 'level', 'repossessed', 'incineration', 'sequence', 'initiated',
  'debt repayment', 'deadline', 'LVL 1', '00:59:59', '4d 23:59:59', '1234567890'];
const missing = lines.filter(s => !G.pixHas(s));
check('every character the machines show has a glyph', missing.length === 0, missing);
check('a–z, A–Z and 0–9 all there', G.pixHas('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'));

// widths: 5-wide glyphs, one pixel between, bold adds to each
check('"BUY" is 17 pixels', G.pixWidth('BUY', 1) === 17, G.pixWidth('BUY', 1));
check('bold widens every letter', G.pixWidth('BUY', 1, 0.5) === 18.5, G.pixWidth('BUY', 1, 0.5));
check('width scales with the pixel size', G.pixWidth('SELL', 2) === 2 * G.pixWidth('SELL', 1));

// drawing: every rect inside the text's box (baseline 7 rows down, 2 rows of descender)
const rects = [];
const ctx = { fillRect: (x, y, w, h) => rects.push({ x, y, w, h }) };
G.pixText(ctx, 'gy01', 10, 50, 1, 2, 0, 4);
const w = G.pixWidth('gy01', 1);
check('it draws', rects.length > 10, rects.length);
check('inside the box', rects.every(r => r.x >= 10 && r.x + r.w <= 10 + w + 1e-9 && r.y >= 50 - 14 && r.y + r.h <= 50 + 4 && r.w > 0 && r.h > 0),
  rects.find(r => !(r.x >= 10 && r.x + r.w <= 10 + w && r.y >= 36 && r.y + r.h <= 54)));
check('g and y hang below the baseline', rects.some(r => r.y >= 50));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
