// Makes tests/build/test.html: the real game, but with React served from disk so the
// tests never depend on the network, and two hooks the browser suites drive it through.
//
//   window.__in   the App's input ref: loadout, guns, bag, prompt, found, keys, sticks
//   window.__lvl  the live level: player, enemies, bullets, fields, beams, pickups,
//                 stock, roster, theme
//
// Nothing here changes game logic. If a test needs to reach something new, add it to the
// __lvl object below rather than reaching into the game from the test.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'build');

const HOOK_LVL =
  "    window.__lvl = { get pickups(){return pickups}, get enemies(){return enemies}, " +
  "bullets, p, get mat(){return mat}, get stock(){return stock}, coins, get floor(){return floor}, " +
  "get rooms(){return rooms}, get pb(){return pb}, maxHp, " +
  "get roster(){return roster}, get theme(){return themeName}, " +
  "get arrival(){return arrival}, get start(){return start}, get portal(){return portal}, " +
  "enemyShots, fields, beams, flashes, dig, motes, get sconces(){return sconces}, get props(){return props}, dparts, amb, clouds, rings, get zfx(){return zfx}, " +
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
