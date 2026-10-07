// @ts-check
// Dev mode (owner, v0.0.160): the Dev ⚙️ and the dev-only bits elsewhere (the mod/perk cards' 📌 / 🗑️ /
// Give Feedback, the Bag's 💾 preset button) show only while it's on. Hold ⏸ for DEV_HOLD_MS to
// toggle it; kept in localStorage. Off by default, on by default on the browser test page.

const KEY = 'caverunner-devshow';
export const DEV_HOLD_MS = 5000;

/** @returns {boolean} */
export function devShown() {
  let v = null;
  try { v = localStorage.getItem(KEY); } catch (_) { /* no storage: the default */ }
  return v == null ? !!window.__TEST : v === '1';
}

/** @param {boolean} on */
export function setDevShown(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* no storage: this session only */ }
}
