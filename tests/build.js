// Makes tests/build/test.html: the real game, but with React served from disk so the
// tests never depend on the network, and two hooks the browser suites drive it through.
//
//   window.__in   the App's input ref: loadout, guns, bag, prompt, found, keys, sticks
//   window.__lvl  the live level: player, enemies, bullets, fields, beams, pickups,
//                 stock, roster, theme
//
//   __lvl.sandbox(o)     wipes a box of the live level into a clean test room: open air, a
//                        flat floor, nothing else (no enemies, props, loot, shots), fog
//                        lifted, the player standing on the floor. Returns { x, y, l, r }:
//                        the centre x, the floor's top y, and the room's left/right edges.
//                        o: { w, h } room size in world units (default 300 x 200).
//   __lvl.placeProp(pr, x, y)  a copy of prop `pr` (take one off a real floor so its shape
//                        is honest) set down at (x, y), anchored to the cell below; returns it.
//   See "Test mechanics in a sandbox" in CLAUDE.md for when to use these.
//
// Nothing here changes game logic. If a test needs to reach something new, add it to the
// __lvl object below rather than reaching into the game from the test.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'build');

// A clean test room carved into the live level, far from the exit portal and above the shop.
const SANDBOX =
  "    const __sandbox = o => { o = o || {};" +
  "      const w = o.w || 300, h = o.h || 200;" +
  "      const cx = Math.round((portal.x + portal.w / 2 < WW / 2 ? WW * 0.72 : WW * 0.28) / CELL) * CELL;" +
  "      const fy = (SHOP_TOP - SHOP_ROOF) * CELL - 160;   /* SHOP_* are cell rows */" +
  "      const x0 = Math.max(2, Math.floor((cx - w / 2) / CELL)), x1 = Math.min(CW - 3, Math.ceil((cx + w / 2) / CELL));" +
  "      const y0 = Math.max(2, Math.floor((fy - h) / CELL)), fr = fy / CELL, y1 = Math.min(CH - 3, fr + 6);" +
  "      const d = img.data, dd = dimg.data;" +
  "      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {" +
  "        const i = y * CW + x, k = i * 4;" +
  "        dd[k + 3] = 0;" +
  "        if (y < fr) { mat[i] = 0; d[k + 3] = 0; }" +
  "        else { mat[i] = BRICK; d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255; } }" +
  "      tctx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);" +
  "      dctx.putImageData(dimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);" +
  "      enemies.length = 0; props.length = 0; pickups.length = 0; bullets.length = 0;" +
  "      enemyShots.length = 0; fields.length = 0; dparts.length = 0; amb.length = 0;" +
  "      for (let y = Math.floor(y0 * CELL / FOG_U); y <= Math.floor(y1 * CELL / FOG_U); y++)" +
  "        for (let x = Math.floor(x0 * CELL / FOG_U); x <= Math.floor(x1 * CELL / FOG_U); x++) seen[y * FW + x] = 2;" +
  "      paintFog();" +
  "      p.x = cx - PW / 2; p.y = fy - PH - 0.5; p.vx = 0; p.vy = 0; p.hp = 9999; p.dead = false;" +
  "      return { x: cx, y: fy, l: x0 * CELL, r: x1 * CELL }; };\n" +
  "    const __placeProp = (pr, x, y) => { const q = Object.assign({}, pr, { x, y, gone: false, fall: false, vy: 0," +
  "      anc: [Math.floor(x / CELL), Math.floor(y / CELL)] }); props.push(q); return q; };\n";

const HOOK_LVL = SANDBOX +
  "    window.__lvl = { sandbox: __sandbox, placeProp: __placeProp, get pickups(){return pickups}, get enemies(){return enemies}, " +
  "bullets, p, get mat(){return mat}, get stock(){return stock}, coins, get floor(){return floor}, get seed(){return levelSeed}, hurt, get bhLoops(){return bhLoops}, " +
  "get rooms(){return rooms}, get pb(){return pb}, maxHp, " +
  "get roster(){return roster}, get theme(){return themeName}, " +
  "get arrival(){return arrival}, get start(){return start}, get portal(){return portal}, " +
  "enemyShots, fields, beams, arcs, flashes, dig, motes, get sconces(){return sconces}, get props(){return props}, dparts, amb, clouds, rings, get zfx(){return zfx}, " +
  "world: { CW, CH, CELL, WW, WH, SHOP_FLOOR, SHOP_TOP, SHOP_Y }, " +
  "fog: { get seen(){return seen}, FW, FH, FOG, FOG_U, SIGHT, SHOP_TOP, SHOP_ROOF, reveal: fogReveal, paint: paintFog }, " +
  "light: { get flick(){return flick}, get r(){return torchR}, " +
  "  get cam(){return { x: camX, y: camY }}, get s(){return unitPx * (window.devicePixelRatio || 1)}, " +
  "  get embers(){return torchP.length}, get vis(){return visPts}, visPoly, losClear } };\n";

function build() {
  let s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const swap = (from, to) => {
    if (!s.includes(from)) throw new Error('build.js is out of date: could not find ' + from);
    s = s.replace(from, to);
  };
  swap('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
    '../lib/react.production.min.js');
  swap('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
    '../lib/react-dom.production.min.js');
  swap('    const toast = text => {', HOOK_LVL + '    const toast = text => {');
  swap('  const [size, setSize] = useState(150);',
    '  window.__in = input;\n  const [size, setSize] = useState(150);');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'test.html'), s);
  return path.join(OUT, 'test.html');
}

if (require.main === module) console.log('built ' + build());
module.exports = build;
