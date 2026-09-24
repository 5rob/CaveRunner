// The jetpack coughs near empty (short random cut-outs, more often the drier it gets) and
// its roar climbs in pitch the longer it's held, capped at 3 seconds.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const G = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { sputterStep, jetPitch, SPUTTER_FUEL, DEV, DEV_META };')({ createElement: () => {} });
const { sputterStep, jetPitch, SPUTTER_FUEL, DEV, DEV_META } = G;

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`); };

// run 10 seconds at a fixed fuel level; count cut-outs and time spent cut out
function run(fuel, secs = 10) {
  const st = {}, dt = 1 / 60;
  let starts = 0, cutT = 0, longest = 0, cur = 0;
  for (let f = 0; f < secs * 60; f++) {
    const c = sputterStep(st, dt, fuel, true);
    if (st.start) starts++;
    if (c) { cutT += dt; cur += dt; longest = Math.max(longest, cur); } else cur = 0;
  }
  return { starts, cutT, longest };
}

check('a healthy tank never coughs', run(0.8).starts === 0 && run(SPUTTER_FUEL + 0.01).starts === 0);
const low = run(SPUTTER_FUEL * 0.6), dry = run(0.01);
check('a low tank coughs now and then', low.starts >= 3, low);
check('a nearly dry tank coughs more', dry.cutT > low.cutT, [low, dry]);
check('cut-outs are short bursts (< 0.2s)', dry.longest < 0.2 && low.longest < 0.2, [low.longest, dry.longest]);
check('it still mostly runs, even nearly dry', dry.cutT < 5, dry.cutT);

const st = { cut: 0.1, onT: 2 };
check('letting go clears the cough and the held clock', sputterStep(st, 1 / 60, 0.01, false) === false && st.onT === 0 && st.cut === 0);

check('pitch starts at 1', jetPitch(0) === 1);
check('pitch climbs while held', jetPitch(1.5) > jetPitch(0.5));
check('pitch stops climbing at 3s', jetPitch(3) === jetPitch(10) && jetPitch(3) > jetPitch(2.9));
check('sputter drop is a Dev knob', DEV_META.some(m => m.k === 'sputDip') && DEV.sputDip > 0);
check('jetpack volume is a Dev knob in Sound', DEV_META.some(m => m.k === 'jetVol' && m.g === 'sound') && DEV.jetVol === 1);

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
