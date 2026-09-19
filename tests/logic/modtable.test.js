const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w*h*4); } }\n';
const G = new Function('React', shim + upto + 'return { MODS, FAMILY_OF, FAMILIES, MOD_PRICE, ALL_IDS, SHOT_IDS };')({ createElement: () => {} });
const ids = Object.keys(G.MODS);
let bad = 0;
const say = (m) => { bad++; console.log('  ' + m); };
console.log(ids.length + ' mods');
const glyphs = {};
for (const id of ids) {
  const m = G.MODS[id];
  if (!m.name) say(id + ': no name');
  if (!m.info) say(id + ': no info');
  if (!m.glyph) say(id + ': no glyph');
  if (glyphs[m.glyph]) say('glyph clash ' + m.glyph + ': ' + id + ' vs ' + glyphs[m.glyph]);
  glyphs[m.glyph] = id;
  if (!G.FAMILY_OF[id]) say(id + ': no family');
  else if (!G.FAMILIES[G.FAMILY_OF[id]]) say(id + ': family ' + G.FAMILY_OF[id] + ' does not exist');
  if (!G.MOD_PRICE[id]) say(id + ': no shop price');
  if (!['shot', 'mod', 'passive', 'static', 'util'].includes(m.kind)) say(id + ': odd kind ' + m.kind);
}
console.log(bad ? bad + ' problems' : 'table is clean');
process.exit(bad ? 1 : 0);
