const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
// the size constants come from index.html, so the suite follows the map when it grows
const game = new Function('React', shim + upto +
  'return { makeLevel, CW, CH, CELL, SHOP_FLOOR, SHOP_TOP, SHOP_ROOF, MOD_DROPS, GUN_DROPS };')(
  { createElement: () => {} });
const { makeLevel, CW, CH, CELL, SHOP_FLOOR, SHOP_TOP, SHOP_ROOF, MOD_DROPS, GUN_DROPS } = game;
const pw = 6, ph = 11;

let reach = 0, sealed = 0, roomOk = 0, n = 0;
let mods = 0, guns = 0, foes = 0, pkReach = 0, pkTotal = 0, foeReach = 0, spread = 0;
for (let seed = 1; seed <= 20; seed++) {
  const lv = makeLevel(seed, 1);
  const { mat, shopExit, stock, start, pickups, enemies } = lv;
  n++;
  // ok[i]: the pw x ph box with its top-left here is all empty, i.e. the player fits.
  // Done as two running counts rather than a 66-cell probe per pixel - the map is four
  // times the area it used to be and the naive version made this suite take 8 seconds.
  const free = new Uint8Array(CW * CH);     // the ph cells from here down are all empty
  for (let x = 0; x < CW; x++) {
    let run = 0;
    for (let y = CH - 1; y >= 0; y--) {
      run = mat[y * CW + x] ? 0 : run + 1;
      if (run >= ph) free[y * CW + x] = 1;
    }
  }
  const ok = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++) {
    let run = 0;
    for (let x = CW - 1; x >= 0; x--) {
      run = free[y * CW + x] ? run + 1 : 0;
      if (run >= pw) ok[y * CW + x] = 1;
    }
  }
  const sx = Math.round(start.x / CELL), sy = Math.round(start.y / CELL);
  const seen = new Uint8Array(CW * CH);
  if (!ok[sy * CW + sx]) { console.log(`seed ${seed}: SPAWN IS INSIDE ROCK`); continue; }
  const q = [[sx, sy]]; seen[sy * CW + sx] = 1;
  let minY = sy;
  while (q.length) {
    const [x, y] = q.pop();
    if (y < minY) minY = y;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, i = ny * CW + nx;
      if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || seen[i] || !ok[i]) continue;
      seen[i] = 1; q.push([nx, ny]);
    }
  }
  if (minY <= 40) reach++;
  // the map is four times the area it was, so count what actually got scattered on it
  // and how much of it you can walk or fly to from the shop
  mods += pickups.filter(q => q.kind === 'mod').length;
  guns += pickups.filter(q => q.kind === 'gun').length;
  foes += enemies.length;
  const near = (x, y) => {                 // reachable within a couple of cells
    const bx = Math.round(x / CELL), by = Math.round(y / CELL);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const i = (by + dy) * CW + bx + dx;
      if (i >= 0 && i < CW * CH && seen[i]) return true;
    }
    return false;
  };
  for (const q of pickups) { pkTotal++; if (near(q.x, q.y)) pkReach++; }
  for (const e of enemies) if (near(e.x, e.y)) foeReach++;
  // how far apart the handful of pickups ended up, as a share of the map's height
  let far = 0;
  for (const q of pickups) far = Math.max(far, Math.abs(q.y - start.y));
  spread += far / (CH * CELL);
  // the room must be a sealed box apart from the roof hole
  let holes = 0;
  for (let cx = 0; cx < CW; cx++) {
    let open = true;
    for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++) if (mat[cy * CW + cx]) { open = false; break; }
    if (open) holes++;
  }
  const holeOk = holes >= 15 && holes <= 23;     // one ~19px opening, nothing else
  if (holeOk) sealed++;
  // the room itself is clear, full width, and the stock sits on the floor
  let blocked = 0;
  for (let cy = SHOP_TOP; cy < SHOP_FLOOR; cy++) for (let cx = 4; cx < CW - 4; cx++) if (mat[cy * CW + cx]) blocked++;
  const stockOk = stock.length === 5 && stock[0].kind === 'heal' &&
    stock.slice(1).every(it => it.kind === 'mod' && it.price > 0) &&
    new Set(stock.slice(1).map(i => i.id)).size === 4 &&
    stock.every(it => it.y / CELL > SHOP_TOP && it.y / CELL < SHOP_FLOOR);
  if (!blocked && stockOk) roomOk++;
  if (seed <= 3) console.log(`seed ${seed}: exit x=${shopExit} roofOpening=${holes}px roomBlocked=${blocked} top=${minY} stock=${stock.map(i=>i.kind==='heal'?'heal':i.id+'/'+i.price).join(' ')}`);
}
console.log(`\nmap ${CW}x${CH} cells (${CW * CELL}x${CH * CELL} world units)`);
console.log(`per level, averaged over ${n} seeds: ${(mods / n).toFixed(1)} mods (want ${MOD_DROPS}), ` +
  `${(guns / n).toFixed(1)} guns (want ${GUN_DROPS}), ${(foes / n).toFixed(1)} enemies`);
console.log(`${pkReach}/${pkTotal} pickups and ${foeReach} enemies sit in the region you can reach from the shop; ` +
  `the furthest pickup is ${(spread / n * 100).toFixed(0)}% of the map's height up`);
console.log(`\n${reach}/${n} reach the exit, ${sealed}/${n} have exactly one roof opening, ${roomOk}/${n} have a clear room with valid stock`);
