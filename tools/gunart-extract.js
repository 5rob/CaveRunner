// Re-runnable: turns the owner's picture of pixel-art guns (an upscaled, lossy screenshot on a flat
// grey) into src/art/gunart.js, one small sprite per gun at 1 px per art pixel.
//   node tools/gunart-extract.js <picture.png> [preview.png]
// 1. Chromium decodes the PNG (canvas getImageData). 2. The art-pixel pitch and phase come from the
// edges' Fourier peak (about 3.36 screen px per art px, not a whole number, so the grid is fractional).
// 3. Each cell takes its inner pixels' median colour; the background grey (and anything near it) is
// clear. 4. Guns are 8-connected blobs of cells; tiny ones are dropped. 5. Each gun's colours are
// clustered into a small palette. 6. NAMES / TURN / GRIP below are by hand, by the blob's order
// (top to bottom, then left to right, by the box's centre row band). A preview sheet with the
// numbers shows which is which.
const fs = require('fs');
const path = require('path');
const { launch } = require('../tests/chromium.js');

// by blob number: [id, name] (null drops it)
const NAMES = {
  0: ['pinkcarbine', 'Pink Carbine'], 1: ['reddrum', 'Red Drum'], 2: ['blueraider', 'Blue Raider'],
  3: ['ambershotgun', 'Amber Shotgun'], 4: ['limeblaster', 'Lime Blaster'], 5: ['irongatling', 'Iron Gatling'],
  6: ['skyrifle', 'Sky Rifle'], 7: ['redstriker', 'Red Striker'], 8: ['redsniper', 'Red Sniper'],
  9: ['shadowsmg', 'Shadow SMG'], 10: ['goldblaster', 'Gold Blaster'], 11: ['drumcannon', 'Drum Cannon'],
  12: ['steeluzi', 'Steel Uzi'], 13: ['greensquirt', 'Green Squirt'], 14: ['greenbazooka', 'Green Bazooka'],
  15: ['bluebazooka', 'Blue Bazooka'], 16: ['pinksquirt', 'Pink Squirt'], 17: ['bluepump', 'Blue Pump'],
  18: ['gatlingbeast', 'Gatling Beast'], 19: ['goldsniper', 'Gold Sniper'], 20: ['pinkpistol', 'Pink Pistol'],
  21: ['steelpistol', 'Steel Pistol'], 22: ['nightrifle', 'Night Rifle'], 23: ['toxiclauncher', 'Toxic Launcher'],
  24: ['goldpistol', 'Gold Pistol'], 25: ['redrifle', 'Red Rifle'], 26: ['redpistol', 'Red Pistol'],
};
// by blob number: quarter turns clockwise to point the barrel right (vertical guns)
const TURN = { 6: 1, 10: 1, 15: 3 };
// by blob number: mirror left-right (barrel pointing left)
const MIRROR = { 13: true, 16: true };
// by blob number: [x, y] hand point override
const GRIP = {};

const CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** @param {string} file */
async function decode(file) {
  const b = await launch(); const p = await b.newPage();
  const url = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  const r = await p.evaluate(async u => {
    const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    return { w: im.width, h: im.height, d: Array.from(x.getImageData(0, 0, im.width, im.height).data) };
  }, url);
  await b.close();
  return r;
}

function pitch(E) {
  let best = [0, 0, 0];
  for (let P = 2.5; P <= 7; P += 0.0005) {
    let re = 0, im = 0;
    for (let i = 0; i < E.length; i++) { const a = 2 * Math.PI * i / P; re += E[i] * Math.cos(a); im += E[i] * Math.sin(a); }
    const m = Math.hypot(re, im); if (m > best[1]) best = [P, m, Math.atan2(im, re)];
  }
  const [P, , ph] = best;
  return { P, off: ((ph / (2 * Math.PI)) * P + P * 10) % P };   // an edge sits at off + k P
}

const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function main() {
  const src = process.argv[2], prev = process.argv[3];
  const { w, h, d } = await decode(src);
  const lum = (x, y) => { const i = (y * w + x) * 4; return d[i] + d[i + 1] + d[i + 2]; };
  const Ex = new Float64Array(w), Ey = new Float64Array(h);
  for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) {
    Ex[x] += Math.abs(lum(x, y) - lum(x - 1, y)); Ey[y] += Math.abs(lum(x, y) - lum(x, y - 1));
  }
  const gx = pitch(Ex), gy = pitch(Ey);
  console.log('pitch', gx, gy);
  const nx = Math.floor((w - gx.off) / gx.P), ny = Math.floor((h - gy.off) / gy.P);
  // the background: the commonest colour
  const cnt = new Map();
  for (let i = 0; i < w * h; i++) { const k = d[i * 4] + ',' + d[i * 4 + 1] + ',' + d[i * 4 + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const bg = [...cnt].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const cell = [];   // [ny][nx] colour or null
  for (let j = 0; j < ny; j++) {
    const row = [];
    for (let i = 0; i < nx; i++) {
      const x0 = gx.off + i * gx.P, y0 = gy.off + j * gy.P;
      const R = [], Gc = [], B = [];
      for (let y = Math.ceil(y0 + 0.7); y < y0 + gy.P - 0.7; y++) for (let x = Math.ceil(x0 + 0.7); x < x0 + gx.P - 0.7; x++) {
        const k = (y * w + x) * 4; R.push(d[k]); Gc.push(d[k + 1]); B.push(d[k + 2]);
      }
      const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
      const c = R.length ? [med(R), med(Gc), med(B)] : bg;
      row.push(dist(c, bg) < 26 ? null : c);   // the bg, and the faint light halo round each gun
    }
    cell.push(row);
  }
  // blobs
  const seen = cell.map(r => r.map(() => false)), blobs = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!cell[j][i] || seen[j][i]) continue;
    const st = [[i, j]], pts = []; seen[j][i] = true;
    while (st.length) {
      const [a, b] = st.pop(); pts.push([a, b]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = a + dx, q = b + dy;
        if (p >= 0 && q >= 0 && p < nx && q < ny && cell[q][p] && !seen[q][p]) { seen[q][p] = true; st.push([p, q]); }
      }
    }
    if (pts.length < 25) continue;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    blobs.push({ pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
  }
  blobs.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1) || a.x0 - b.x0);
  const out = [];
  blobs.forEach((bl, n) => {
    let W = bl.x1 - bl.x0 + 1, H = bl.y1 - bl.y0 + 1;
    /** @type {(number[] | null)[][]} */
    let g = Array.from({ length: H }, () => new Array(W).fill(null));
    for (const [a, b] of bl.pts) g[b - bl.y0][a - bl.x0] = cell[b][a];
    for (let t = 0; t < (TURN[n] || 0); t++) {   // a quarter turn clockwise
      const ng = Array.from({ length: W }, () => new Array(H).fill(null));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ng[x][H - 1 - y] = g[y][x];
      g = ng; [W, H] = [H, W];
    }
    if (MIRROR[n]) g = g.map(r => r.slice().reverse());
    // palette: greedy clusters by frequency
    const cols = [];
    for (const r of g) for (const c of r) if (c) cols.push(c);
    const cl = [];
    for (const c of cols) {
      let k = cl.find(q => dist(q.c, c) < 38);
      if (!k) { k = { c: c.slice(), s: [0, 0, 0], n: 0 }; cl.push(k); }
      k.s[0] += c[0]; k.s[1] += c[1]; k.s[2] += c[2]; k.n++;
    }
    for (const k of cl) k.c = k.s.map(v => v / k.n);
    const pal = cl.map(k => k.c[0] + k.c[1] + k.c[2] < 70 ? '#101114' : hex(k.c));
    const near = c => { let bi = 0, bd = 1e9; cl.forEach((k, i) => { const e = dist(k.c, c); if (e < bd) { bd = e; bi = i; } }); return bi; };
    const rows = g.map(r => r.map(c => (c ? CH[near(c)] : '.')).join(''));
    // the hand: the rear-most downward part (grip) below the body line
    const bot = [];
    for (let x = 0; x < W; x++) { let b = -1; for (let y = 0; y < H; y++) if (rows[y][x] !== '.') b = y; bot.push(b); }
    const sorted = bot.filter(b => b >= 0).sort((p, q) => p - q);
    const body = sorted[Math.floor(sorted.length * 0.35)];
    let grip = [Math.round(W * 0.35), body];
    const runs = []; let s = -1;
    for (let x = 0; x <= W; x++) {
      const deep = x < W && bot[x] > body + 2;
      if (deep && s < 0) s = x; if (!deep && s >= 0) { runs.push([s, x - 1]); s = -1; }
    }
    const maxD = Math.max(0, ...runs.map(r => Math.max(...bot.slice(r[0], r[1] + 1))));
    const cand = runs.filter(r => r[0] > W * 0.12 && r[1] - r[0] >= 1 && Math.max(...bot.slice(r[0], r[1] + 1)) >= body + (maxD - body) * 0.6);
    if (cand.length) { const r = cand[0]; grip = [Math.round((r[0] + r[1]) / 2), body]; }
    if (GRIP[n]) grip = GRIP[n];
    const nm = NAMES[n] === undefined ? ['gun' + n, 'Gun ' + n] : NAMES[n];
    if (nm) out.push({ n, id: nm[0], name: nm[1], w: W, h: H, grip, pal, px: rows.join('/') });
  });
  console.log('sprites', out.length, out.map(o => o.n + ':' + o.w + 'x' + o.h + ':' + o.pal.length).join(' '));
  const lines = out.map(o => '  { id: ' + JSON.stringify(o.id) + ', name: ' + JSON.stringify(o.name) + ', w: ' + o.w + ', h: ' + o.h +
    ', grip: [' + o.grip + '],\n    pal: ' + JSON.stringify(o.pal).replace(/,/g, ', ') + ',\n    px: ' + JSON.stringify(o.px) + ' },');
  const file = path.join(__dirname, '../src/art/gunart.js');
  const head = fs.readFileSync(file, 'utf8').split('// ---- GUN_ART (generated) ----')[0];
  const tail = fs.readFileSync(file, 'utf8').split('// ---- end GUN_ART ----')[1];
  fs.writeFileSync(file, head + '// ---- GUN_ART (generated) ----\n/** @type {GunArt[]} */\nexport const GUN_ART = [\n' + lines.join('\n') + '\n];\n// ---- end GUN_ART ----' + tail);
  if (prev) await preview(out, prev);
}

/** a numbered sheet of the sprites at 4x, the grip as a red dot */
async function preview(out, file) {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.setContent('<body style="margin:0;background:#556"><canvas id=c width=1400 height=1000></canvas></body>');
  await p.evaluate(out => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('c')), x = c.getContext('2d');
    let cx = 10, cy = 20, rowH = 0;
    for (const o of out) {
      const S = 4, rows = o.px.split('/');
      if (cx + o.w * S > 1390) { cx = 10; cy += rowH + 24; rowH = 0; }
      for (let y = 0; y < o.h; y++) for (let i = 0; i < o.w; i++) {
        const ch = rows[y][i]; if (ch === '.') continue;
        x.fillStyle = o.pal['0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(ch)]; x.fillRect(cx + i * S, cy + y * S, S, S);
      }
      x.fillStyle = 'red'; x.fillRect(cx + o.grip[0] * S, cy + o.grip[1] * S, S, S);
      x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(o.n + ' ' + o.id, cx, cy - 4);
      cx += o.w * S + 20; rowH = Math.max(rowH, o.h * S);
    }
  }, out);
  await p.screenshot({ path: file }); await b.close();
}

main().catch(e => { console.error(e); process.exit(1); });
