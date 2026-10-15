// @ts-check
// (v1.0.94, owner) Copy Dev settings: everything the owner can set in the Dev panel, as one text to paste to Claude, so
// it can all become the defaults and a new device plays the same. The DEV knobs (dev/knobs.js devReport, every key),
// then what's kept outside DEV: the gun presets (Dev → Presets, save/presets.js) and Grem's kit (Dev → Grem:
// player 1's exo mods and perks, the name tags, auto/grem.js), each as JSON between markers when it differs from
// the built-in default. **A new Dev setting kept anywhere else goes in here too** (src/dev/README.md).

import { DEV_DEFAULTS, devReport } from '../dev/knobs.js';
import { DEFAULT_PRESETS } from '../save/presetdefaults.js';
import { cleanPresets, loadPresets } from '../save/presets.js';
import { GREM_KIT_DEFAULT, gremKitClean, gremKitLoad } from './grem.js';

/**
 * @param {string} title @param {string} tag the markers' name @param {string} where the default's place in src/
 * @param {any} now @param {any} def @param {string} count
 * @returns {string[]}
 */
function part(title, tag, where, now, def, count) {
  const same = JSON.stringify(now) === JSON.stringify(def);
  const out = ['', title + ': ' + count + (same ? ' — the same as the default' : ' — please make these the default (' + where + ')')];
  if (!same) out.push(tag + '-BEGIN', JSON.stringify(now), tag + '-END');
  return out;
}

/** the whole Copy Dev settings text @returns {string} */
export function devCopyText() {
  const pre = loadPresets(), kit = gremKitLoad();
  const fitted = Object.values(kit.exo).flat().filter(Boolean).length + kit.perks.filter(Boolean).length;
  return [
    devReport(),
    ...part('Gun presets (Dev → Presets)', 'PRESETS-JSON', 'src/save/presetdefaults.js DEFAULT_PRESETS', pre, cleanPresets(DEFAULT_PRESETS),
      pre.length + ' gun' + (pre.length === 1 ? '' : 's') + (pre.length ? ': ' + pre.map(p => p.name).join(', ') : '')),
    ...part('Grem kit (Dev → Grem)', 'GREM-KIT-JSON', 'src/auto/grem.js GREM_KIT_DEFAULT', kit, gremKitClean(GREM_KIT_DEFAULT),
      fitted + ' exo mods and perks fitted, name tags: ' + (kit.names.filter(Boolean).join(', ') || 'none')),
    '', '(' + Object.keys(DEV_DEFAULTS).length + ' knobs, the presets and the Grem kit: everything Dev keeps.)',
  ].join('\n');
}
