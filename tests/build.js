// Makes tests/build/test.html: the real game, but with React served from disk so the
// tests never depend on the network, and two hooks the browser suites drive it through.
//
//   window.__in   the App's input ref: loadout, guns, bag, prompt, found, keys, sticks
//   window.__lvl  the live level: player, enemies, bullets, fields, beams, pickups,
//                 stock, roster, theme; rec / rt: the death replay's recorder and player
//
//   __lvl.sandbox(o)     wipes a box of the live level into a clean test room: open air, a
//                        flat floor, nothing else (no enemies, props, loot, shots), fog
//                        lifted, the player standing on the floor. Returns { x, y, l, r }:
//                        the centre x, the floor's top y, and the room's left/right edges.
//                        o: { w, h } room size in world units (default 300 x 200);
//                        o.roof: a solid brick roof over the room (something to hang things off).
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
  "      const cx = Math.round((W.portal.x + W.portal.w / 2 < WW / 2 ? WW * 0.72 : WW * 0.28) / CELL) * CELL;" +
  "      const fy = (SHOP_TOP - SHOP_ROOF) * CELL - 160;   /* SHOP_* are cell rows */" +
  "      const x0 = Math.max(2, Math.floor((cx - w / 2) / CELL)), x1 = Math.min(CW - 3, Math.ceil((cx + w / 2) / CELL));" +
  "      const y0 = Math.max(2, Math.floor((fy - h) / CELL)), fr = fy / CELL, y1 = Math.min(CH - 3, fr + 6);" +
  "      const d = W.img.data, dd = W.dimg.data;" +
  "      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {" +
  "        const i = y * CW + x, k = i * 4;" +
  "        dd[k + 3] = 0; if (W.ore) W.ore[i] = 0; fire.fuel[i] = 0; fire.t[i] = 0;" +
  "        if (y < fr) { W.mat[i] = 0; d[k + 3] = 0; }" +
  "        else { W.mat[i] = BRICK; d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255; } }" +
  "      if (o.roof) for (let y = Math.max(0, y0 - 6); y < y0; y++) for (let x = x0; x <= x1; x++) {" +
  "        const i = y * CW + x, k = i * 4; W.mat[i] = BRICK; d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255; dd[k + 3] = 0; }" +
  "      tctx.putImageData(W.img, 0, 0, x0, Math.max(0, y0 - 6), x1 - x0 + 1, y1 - y0 + 7);" +
  "      dctx.putImageData(W.dimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);" +
  "      W.enemies.length = 0; W.props.length = 0; W.pickups.length = 0; bullets.length = 0;" +
  "      enemyShots.length = 0; webs.length = 0; silk.length = 0; strings.length = 0; fields.length = 0; dparts.length = 0; amb.length = 0;" +
  "      for (let y = Math.floor(y0 * CELL / FOG_U); y <= Math.floor(y1 * CELL / FOG_U); y++)" +
  "        for (let x = Math.floor(x0 * CELL / FOG_U); x <= Math.floor(x1 * CELL / FOG_U); x++) W.seen[y * FW + x] = 2;" +
  "      paintFog();" +
  "      p.x = cx - PW / 2; p.y = fy - PH - 0.5; p.vx = 0; p.vy = 0; p.hp = 9999; p.dead = false;" +
  "      return { x: cx, y: fy, l: x0 * CELL, r: x1 * CELL }; };\n" +
  "    const __placeProp = (pr, x, y) => { const q = Object.assign({}, pr, { x, y, gone: false, fall: false, vy: 0," +
  "      anc: [Math.floor(x / CELL), Math.floor(y / CELL)] }); W.props.push(q); return q; };\n";

const HOOK_LVL = SANDBOX +
  "    window.__lvl = { sandbox: __sandbox, placeProp: __placeProp, get pickups(){return W.pickups}, get enemies(){return W.enemies}, " +
  "bullets, p, get mat(){return W.mat}, get stock(){return W.stock}, coins, get floor(){return W.floor}, get seed(){return W.levelSeed}, hurt, get bhLoops(){return bhLoops}, " +
  "get rooms(){return W.rooms}, get pb(){return pb}, maxHp, " +
  "get roster(){return W.roster}, get theme(){return W.themeName}, " +
  "get arrival(){return W.arrival}, get start(){return W.start}, get portal(){return W.portal}, " +
  "enemyShots, sparks, webs, silk, strings, fields, beams, arcs, flashes, dig, explode, get ore(){return W.ore}, motes, smoke, get sconces(){return W.sconces}, get props(){return W.props}, dparts, amb, clouds, rings, get zfx(){return zfx}, " +
  "get rec(){return REC}, get rt(){return RT}, recSample, " +
  "get fire(){return fire}, get burrow(){return W.burrow}, ignite, setAlight, youAlight, get dimg(){return W.dimg}, get zone(){return W.zone}, " +
  "world: { CW, CH, CELL, WW, WH, SHOP_FLOOR, SHOP_TOP, SHOP_Y }, " +
  "fog: { get seen(){return W.seen}, FW, FH, FOG, FOG_U, SIGHT, SHOP_TOP, SHOP_ROOF, reveal: fogReveal, paint: paintFog }, " +
  "light: { get flick(){return flick}, get r(){return torchR}, " +
  "  get cam(){return { x: camX, y: camY }}, get s(){return unitPx * (window.devicePixelRatio || 1)}, " +
  "  get embers(){return torchP.length}, get vis(){return visPts}, visPoly, losClear } };\n";

function build() {
  let s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const swap = (from, to) => {
    if (!s.includes(from)) throw new Error('build.js is out of date: could not find ' + from);
    s = s.replace(from, to);
  };
  // The suites call game names straight from page.evaluate (MODS, DEV, resetGun, makeLevel…).
  // The bundle is one iife, so its top-level names aren't globals: copy every one onto
  // window as the iife ends. Nothing at the top level is ever reassigned, so the copy is
  // the same value (objects like DEV are the same object). The names come from parsing the
  // bundle with espree, the parser ESLint (a dev dependency) ships with.
  const exposeGlobals = () => {
    const at = s.indexOf('(() => {', s.indexOf("<script>const VERSION = '"));
    const end = s.lastIndexOf('})();', s.indexOf('</script>', at));
    if (at < 0 || end < at) throw new Error('build.js is out of date: could not find the game bundle');
    const espree = require(require.resolve('espree', { paths: [path.dirname(require.resolve('eslint'))] }));
    const iife = espree.parse(s.slice(at, end + 5), { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
    const names = [];
    const bind = id => {
      if (id.type === 'Identifier') names.push(id.name);
      else if (id.type === 'ObjectPattern') for (const q of id.properties) bind(q.value);
      else if (id.type === 'ArrayPattern') for (const q of id.elements) if (q) bind(q);
    };
    for (const st of iife) {
      if (st.type === 'VariableDeclaration') for (const d of st.declarations) bind(d.id);
      else if (st.id) bind(st.id);   // function and class declarations
    }
    s = s.slice(0, end) + '  Object.assign(window, { ' + names.join(', ') + ' });\n' + s.slice(end);
  };
  swap('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
    '../lib/react.production.min.js');
  swap('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
    '../lib/react-dom.production.min.js');
  // anchors as esbuild prints them (tools/build.js bundles src/), without the indent so a
  // change of nesting depth doesn't lose them
  swap('const toast = (text) => {', HOOK_LVL + 'const toast = (text) => {');
  swap('const [size, setSize] = useState(150);',
    'window.__in = input;\n  const [size, setSize] = useState(150);');
  exposeGlobals();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'test.html'), s);
  return path.join(OUT, 'test.html');
}

if (require.main === module) console.log('built ' + build());
module.exports = build;
