// Sound recipes: every spell, creature and floor has a voice, and the stats bend a spell's
// sound the way they should (faster = higher, bigger/heavier = lower and louder, homing warbles).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const G = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { MODS, CREATURES, THEMES, enemyFor, blankShot, shotSound, creatureSound, SPELL_VOICE, SPELL_VOICES,' +
  ' CREATURE_VOICES, AMBIENCE, AMB_EVENTS, SFX, DEV_META, DEV, rustleStep };')({ createElement: () => {} });
const { MODS, CREATURES, THEMES, enemyFor, blankShot, shotSound, creatureSound, SPELL_VOICE, SPELL_VOICES,
  CREATURE_VOICES, AMBIENCE, AMB_EVENTS, SFX, DEV_META, DEV, rustleStep } = G;

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`); };
const shot = (id, f) => { const s = blankShot(MODS[id], 0); if (f) f(s); return shotSound(s); };

// every spell that fires something has a voice of its own (not the fallback)
const casters = Object.keys(MODS).filter(id => !MODS[id].off && (MODS[id].kind === 'shot' || MODS[id].kind === 'static'));
const missing = casters.filter(id => !SPELL_VOICE[MODS[id].base || id]);
check('every shot and static spell has a voice', !missing.length, missing);
const bad = Object.values(SPELL_VOICE).filter(v => !SPELL_VOICES.includes(v));
check('every spell voice exists', !bad.length, bad);
check('trigger variants speak with their base', shot('bolt_t').v === shot('bolt').v && shot('void_d').v === 'void');
check('Black Hole is the void voice', shot('void').v === 'void');
check('Fireball is fire', shot('fball').v === 'fire');
check('Lightning is thunder', shot('zap').v === 'thunder');
check('explosions are silent on cast (their bang is the explosion)', shot('boom').v === 'none');

// the stats bend it
const b = shot('bolt');
check('Speed Up raises the pitch', shot('bolt', s => MODS.speed.f(s)).pitch > b.pitch);
const hv = shot('bolt', s => MODS.heavy.f(s));
check('Heavy Shot lowers the pitch', hv.pitch < b.pitch, [hv.pitch, b.pitch]);
check('Heavy Shot is louder', hv.vol > b.vol, [hv.vol, b.vol]);
check('Big Shot is longer', shot('bolt', s => MODS.big.f(s)).dur > b.dur);
check('Homing warbles', shot('bolt', s => MODS.homing.f(s)).wob === 1 && b.wob === 0);
check('Explosive Tip adds grit', shot('bolt', s => MODS.tip.f(s)).grit === 1 && b.grit === 0);
check('Piercing adds an edge', shot('bolt', s => MODS.pierce.f(s)).bright === 1);
check('Bouncing adds a boing', shot('bolt', s => MODS.bounce.f(s)).boing === 1);
check('Buckshot flams its pellets', shot('buck').n > 1);
check('Slug is lower than Spark', shot('slug').pitch < shot('spark').pitch);
check('Nuke is louder than Spark', shot('nuke').vol > shot('spark').vol);
for (const id of casters) {
  const r = shot(id);
  if (![r.pitch, r.vol, r.dur].every(Number.isFinite) || r.pitch <= 0 || r.vol <= 0) { check(id + ' recipe is sane', false, r); }
}
check('every recipe is finite and positive', true);

// creatures
const cm = Object.keys(CREATURES).filter(id => !CREATURE_VOICES.includes(creatureSound(enemyFor(id, 1)).v));
check('every creature has a known voice', !cm.length, cm);
check('the boulder growls', creatureSound(enemyFor('lohkare', 1)).v === 'growl');
check('bigger creatures are lower', creatureSound(enemyFor('lohkare', 1)).pitch < creatureSound(enemyFor('kobold', 1)).pitch);
check('goblins gibber', creatureSound(enemyFor('hiisi', 1)).v === 'gibber');

// floors
const am = THEMES.filter(t => !AMBIENCE[t.name]).map(t => t.name);
check('every floor theme has ambience', !am.length, am);
const ev = [];
for (const k in AMBIENCE) for (const e in AMBIENCE[k].ev) if (!AMB_EVENTS.includes(e)) ev.push(k + ':' + e);
check('every ambient event is a known kind', !ev.length, ev);

// foliage rustle limiter: two seconds at 60fps in each situation
const sim = (touching, enterEvery, speed) => {
  const st = { t: 0 }; let n = 0;
  for (let f = 0; f < 120; f++) if (rustleStep(st, 1 / 60, touching, enterEvery && f % enterEvery === 0, speed)) n++;
  return n;
};
check('no plants, no rustle', sim(false, 1, 200) === 0);
check('grabbing a vine rustles at once', rustleStep({ t: 0 }, 1 / 60, true, true, 0) > 0);
check('hanging still is silent', sim(true, 0, 0) === 0);
const clump = sim(true, 1, 250);
check('a new vine every frame still cannot spam (<= 13 in 2s)', clump >= 6 && clump <= 13, clump);
const climbN = sim(true, 0, 90), fastN = sim(true, 0, 240);
check('climbing through rustles every so often', climbN >= 3 && climbN <= 8, climbN);
check('faster through them rustles more', fastN > climbN, [climbN, fastN]);
check('a hard push rustles louder than a slow one', rustleStep({ t: 0 }, 0.016, true, false, 240) > rustleStep({ t: 0 }, 0.016, true, false, 60));

// the engine is inert under Node (no audio): calls are harmless no-ops
SFX.cast([blankShot(MODS.bolt, 0)], 0, 0); SFX.ui('coin'); SFX.tick();
check('engine does nothing without audio', SFX.ready === false && SFX.stats.errors.length === 0, SFX.stats);
check('volume knobs in the Dev panel', DEV_META.some(m => m.k === 'vol') && DEV_META.some(m => m.k === 'amb') && DEV.vol > 0);

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
