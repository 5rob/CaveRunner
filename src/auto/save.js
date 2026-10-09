// @ts-check
// CaveRunner Auto's one save (AUTOBATTLER.md stage 1): the run as JSON under its own key, versioned.
// `storage` is optional (localStorage by default) so the logic suite can pass a fake.
// (Named loadAutoRun / saveAutoRun: `saveRun` is already the old game's, game/systems/save-run.js.)

export const AUTO_SAVE_KEY = 'caverunner-auto-run';
export const AUTO_SAVE_V = 1;

/** @returns {KVStore | null} */
function store() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
}

// the saved run, or null (none, unreadable, or another version)
/** @param {KVStore | null} [storage] @returns {AutoRun | null} */
export function loadAutoRun(storage) {
  try {
    const s = storage || store();
    const raw = s && s.getItem(AUTO_SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== AUTO_SAVE_V || !d.run || !Array.isArray(d.run.players) || !Array.isArray(d.run.bag)) return null;
    return d.run;
  } catch (e) { return null; }
}

// write the run; false if there's nowhere to write it
/** @param {AutoRun} run @param {KVStore | null} [storage] @returns {boolean} */
export function saveAutoRun(run, storage) {
  try {
    const s = storage || store();
    if (!s) return false;
    s.setItem(AUTO_SAVE_KEY, JSON.stringify({ v: AUTO_SAVE_V, run }));
    return true;
  } catch (e) { return false; }
}
