// @ts-check
// The owner's audit of mods and perks (LIST3 #6): on a mod or perk card, a pin (keep) or a trash
// (remove) mark and free notes. Kept in localStorage under AUDIT_KEY, across runs and deaths, never
// cleared by the game. The Dev panel's "Copy audit" turns it into Markdown for a Claude Code session.
// Shape: { 'mod:bolt': { mark: 'keep' | 'trash' | null, notes: string }, 'perk:fireimm': … }.

import { PERKS } from '../data/perks.js';
import { MODS } from '../spells/mods.js';

export const AUDIT_KEY = 'caverunner-audit';

/** @typedef {{ mark: 'keep' | 'trash' | null, notes: string }} AuditEntry */
/** @typedef {Record<string, AuditEntry>} Audit */

/** @param {any} raw @returns {Audit} — drops anything malformed */
export function cleanAudit(raw) {
  /** @type {Audit} */
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(raw)) {
    const e = raw[k];
    if (!/^(mod|perk):/.test(k) || !e || typeof e !== 'object') continue;
    const mark = e.mark === 'keep' || e.mark === 'trash' ? e.mark : null;
    const notes = typeof e.notes === 'string' ? e.notes : '';
    if (mark || notes.trim()) out[k] = { mark, notes };
  }
  return out;
}

/** @returns {Audit} */
export function loadAudit() {
  try { return cleanAudit(JSON.parse(localStorage.getItem(AUDIT_KEY) || 'null')); } catch (_) { return {}; }
}

/** @param {Audit} a */
export function saveAudit(a) {
  try { localStorage.setItem(AUDIT_KEY, JSON.stringify(cleanAudit(a))); } catch (_) {}
}

/** @param {Audit} a @param {string} key @returns {AuditEntry} */
export const auditGet = (a, key) => a[key] || { mark: null, notes: '' };

/** A new audit with `key`'s mark toggled: tapping the set mark clears it; keep and trash exclude each other.
 * @param {Audit} a @param {string} key @param {'keep' | 'trash'} mark @returns {Audit} */
export function auditToggle(a, key, mark) {
  const e = auditGet(a, key);
  return cleanAudit(Object.assign({}, a, { [key]: { mark: e.mark === mark ? null : mark, notes: e.notes } }));
}

/** @param {Audit} a @param {string} key @param {string} notes @returns {Audit} */
export function auditNotes(a, key, notes) {
  const e = auditGet(a, key);
  return cleanAudit(Object.assign({}, a, { [key]: { mark: e.mark, notes } }));
}

/** @param {string} key @returns {string} */
const auditName = key => {
  const [kind, id] = key.split(':');
  const it = kind === 'mod' ? MODS[id] : PERKS[id];
  return it ? it.name : id + ' (no longer in the game)';
};

/** The Markdown "Copy audit" puts on the clipboard; '' when nothing is audited.
 * @param {Audit} a @returns {string} */
export function auditText(a) {
  const keys = Object.keys(cleanAudit(a)).sort();
  if (!keys.length) return '';
  /** @param {string} k */
  const line = k => {
    const [kind, id] = k.split(':');
    const n = a[k].notes.trim().replace(/\s*\n\s*/g, ' / ');
    return '- [' + kind + '] ' + auditName(k) + ' (`' + id + '`)' + (n ? ' — ' + n : '');
  };
  const sec = (/** @type {string} */ title, /** @type {string[]} */ ks) => ks.length ? ['', '## ' + title, ...ks.map(line)] : [];
  return ['CaveRunner audit — work through these one at a time; ask me before deleting anything.',
    ...sec('Remove (trash)', keys.filter(k => a[k].mark === 'trash')),
    ...sec('Keep (pinned)', keys.filter(k => a[k].mark === 'keep')),
    ...sec('Notes', keys.filter(k => !a[k].mark && a[k].notes.trim())),
  ].join('\n') + '\n';
}
