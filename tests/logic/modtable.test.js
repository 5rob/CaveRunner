const G = require('../load');
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
  // a trigger variant shares its base spell's glyph and is told apart by its corner mark
  const face = m.glyph + (m.mark || '');
  if (glyphs[face]) say('glyph clash ' + face + ': ' + id + ' vs ' + glyphs[face]);
  glyphs[face] = id;
  if (!G.FAMILY_OF[id]) say(id + ': no family');
  else if (!G.FAMILIES[G.FAMILY_OF[id]]) say(id + ': family ' + G.FAMILY_OF[id] + ' does not exist');
  if (!G.MOD_PRICE[id]) say(id + ': no shop price');
  if (!['shot', 'mod', 'passive', 'static', 'util'].includes(m.kind)) say(id + ': odd kind ' + m.kind);
}
console.log(bad ? bad + ' problems' : 'table is clean');
process.exit(bad ? 1 : 0);
