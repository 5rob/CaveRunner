// @ts-check
// The mod card's Edit mode (dev only; ui/cards.js ModCard's Edit button): every Dev knob of that mod's group as the Dev panel's
// sliders (DevRow), live (shots in flight read them each frame), and Copy: just that group's changed knobs in Copy Dev
// settings' shape (dev/knobs.js devReportOf) to paste back as the defaults. Generic: a mod gets an Edit button when
// TRAJ_GROUP names its group, so a new mod only adds knobs and a TRAJ_GROUP entry.

import { DEV, DEV_DEFAULTS, DEV_GROUPS, DEV_META, devReportOf, devSet } from '../dev/knobs.js';
import { DevRow } from './devpanel.js';
import { h, useState } from './h.js';

// the text onto the clipboard (the Dev panel's way: the clipboard, else a hidden textarea); true when it went
/** @param {string} text @param {(ok: boolean) => void} done */
function copyOut(text, done) {
  const fallback = () => {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
    } catch (_) { /* no clipboard: the text shows below */ }
    done(ok);
  };
  try { navigator.clipboard.writeText(text).then(() => done(true), fallback); } catch (_) { fallback(); }
}

/** @param {{ g: string, onDone: () => void }} props */
export function TrajEdit({ g, onDone }) {
  /** @type {{ ok: boolean, text: string } | null} */
  const none = null;
  const [copied, setCopied] = useState(none);
  const [gen, setGen] = useState(0);   // bumped by Reset all, so the rows show the defaults
  const name = (DEV_GROUPS.find(x => x[0] === g) || [g, g])[1];
  const rows = DEV_META.filter(m => m.g === g);
  const resetAll = () => { for (const m of rows) devSet(m.k, DEV_DEFAULTS[m.k]); setGen(gen + 1); setCopied(null); };
  const changed = rows.filter(m => DEV[m.k] !== DEV_DEFAULTS[m.k]).length;
  return h('div', { className: 'trajedit' },
    h('div', { className: 'tehead' }, h('b', null, 'Edit: ' + name), h('span', null, changed ? changed + ' changed' : 'all default')),
    h('div', { className: 'tebody', key: gen }, rows.map(m => h(DevRow, { key: m.k, meta: m }))),
    h('div', { className: 'tebtns' },
      h('button', { className: 'pact tecopy', onPointerDown: e => { e.preventDefault(); const text = devReportOf(g, name); copyOut(text, ok => setCopied({ ok, text })); } }, 'Copy'),
      h('button', { className: 'pact', onPointerDown: e => { e.preventDefault(); resetAll(); } }, 'Reset all'),
      h('button', { className: 'pact', onPointerDown: e => { e.preventDefault(); onDone(); } }, 'Done')),
    copied ? h('p', { className: 'pnote tecopied' }, copied.ok ? 'Copied — paste it to Claude.' : 'Couldn’t copy: select the text below.') : null,
    copied && !copied.ok ? h('textarea', { className: 'tetext', readOnly: true, value: copied.text }) : null);
}
