// Dev → Zones (owner, after v1.0.77; art/zonelab.js, art/titlescene.js zoneMay / titleZoneForce): the zone variants (heavy
// vegetation, spider web filled) as per-zone allow flags (DEV.zv_<variant>_<zone>), and the page's preview strip: one zone with
// a variant forced, made whole up front so it pans both ways.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;

// the defaults keep the levels as they were: only the spider zone's vines look, only mines taken over by spiders
check('defaults: heavy vegetation only the spider zone', G.TITLE_ZONES.filter(z => G.zoneMay(z, 'veg')).join() === 'spider');
check('defaults: spider web filled only mines (and the spider zone, always)', G.TITLE_ZONES.filter(z => G.zoneMay(z, 'spid')).join() === 'timber,spider');
const roll = () => {
  const veg = new Set(), spid = new Set();
  for (let s = 1; s < 120; s++) for (const Z of G.levelPlan(s, undefined, 0).zp.z) { if (Z.flat) continue; if (Z.veg) veg.add(Z.z); if (Z.spid) spid.add(Z.z); }
  return { veg: [...veg].sort().join(), spid: [...spid].sort().join() };
};
const r0 = roll();
check('levels roll them only where allowed', r0.veg === 'spider' && r0.spid === 'timber', r0);
// a box ticked: that zone kind rolls it; unticked: never
Object.assign(D, { zv_veg_moss: 1, zv_veg_spider: 0, zv_spid_timber: 0, zv_spid_webs: 1 });
const r1 = roll();
check('ticked and unticked boxes change what levels roll', r1.veg === 'moss' && r1.spid === 'webs', r1);
let vinesLook = 0;
for (let s = 1; s < 120; s++) for (const Z of G.levelPlan(s, undefined, 0).zp.z) if (Z.sv === 'vines') vinesLook++;
check('the spider zone\'s vines look goes with its box', vinesLook === 0, vinesLook);
Object.assign(D, { zv_veg_moss: 0, zv_veg_spider: 1, zv_spid_timber: 1, zv_spid_webs: 0 });

// the preview: each zone, plain and with each variant forced
const vines = S => S.props.filter(p => p.k === 'climb' && !p.arc && !p.host).length;
for (const z of G.TITLE_ZONES) {
  const plain = G.zoneLabScene(260, 5, z, {}), veg = G.zoneLabScene(260, 5, z, { veg: true }), spid = G.zoneLabScene(260, 5, z, { spid: true });
  const P = plain.S, Zs = P.zp.z.filter(q => !q.flat && q.x0 < plain.w);
  check(z + ': one zone of its kind, flat either side, nothing alive', Zs.length === 1 && Zs[0].z === z && !P.runners.length && !P.foes.length && P.lab, Zs.map(q => q.z));
  // made whole: the strip's last column is made with the view still at its start
  check(z + ': the whole strip made up front', P.gen * G.TCELL >= plain.w && P.scroll === 0, { gen: P.gen * G.TCELL, w: plain.w });
  check(z + ': heavy vegetation hangs more vines', vines(veg.S) > vines(P) + 10, { plain: vines(P), veg: vines(veg.S) });
  if (z !== 'spider') check(z + ': spider web filled strings orb webs, spiders its creatures', spid.S.webs.filter(L => L.orb).length > 0 && spid.Z.spid && G.zoneHome(spid.Z) === G.zoneHome({ z: 'spider' }), spid.S.webs.filter(L => L.orb).length);
}
// it pans back over what it made: the start is still there after looking at the end
{
  const L = G.zoneLabScene(260, 9, 'timber', {});
  const at = () => { let n = 0; for (let c = 0; c < 40; c++) for (let r = 0; r < L.S.rows; r++) n += G.titleCell(L.S, c, r); return n; };
  const a = at();
  L.S.scroll = G.zoneLabClamp(L, 1e6);
  for (let i = 0; i < 10; i++) G.titleStep(L.S, 1 / 30);
  L.S.scroll = 0;
  for (let i = 0; i < 10; i++) G.titleStep(L.S, 1 / 30);
  check('panned to the end and back, the start is unchanged', at() === a && G.zoneLabClamp(L, -5) === 0 && G.zoneLabClamp(L, 1e6) === L.w - G.TITLE_VW);
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
