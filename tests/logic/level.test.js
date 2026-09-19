const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const makeLevel = new Function('React', shim + upto + 'return makeLevel;')({ createElement: () => {} });
const CW = 320, CH = 800, pw = 6, ph = 11, CELL = 2;
const SHOP_FLOOR = CH - 10, SHOP_H = 48, SHOP_TOP = SHOP_FLOOR - SHOP_H, SHOP_ROOF = 6;

let reach = 0, sealed = 0, roomOk = 0, n = 0;
for (let seed = 1; seed <= 20; seed++) {
  const lv = makeLevel(seed, 1);
  const { mat, shopExit, stock, start } = lv;
  n++;
  const fits = (x, y) => {
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const cx = x + i, cy = y + j;
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx]) return false;
    }
    return true;
  };
  const ok = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (fits(x, y)) ok[y * CW + x] = 1;
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
console.log(`\n${reach}/${n} reach the exit, ${sealed}/${n} have exactly one roof opening, ${roomOk}/${n} have a clear room with valid stock`);
