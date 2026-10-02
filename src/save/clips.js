// @ts-check
// Saved death replays, kept in the page's IndexedDB (localStorage is far too small): a `meta` store
// of gallery cards (ClipMeta: name, date, floor, length, size, thumbnail) and a `data` store of the
// clips themselves (SavedClip, replay/clip.js, packed: gzipped JSON, clipPack), both by id. Every call resolves, never throws: no
// store (a private window, Node) just means an empty gallery and saves that come back null.

import { clipPack, clipUnpack } from '../replay/clip.js';

export const CLIP_DB = 'caverunner-clips';
/** @type {Promise<IDBDatabase | null> | null} */
let dbP = null;
/** @returns {Promise<IDBDatabase | null>} */
function db() {
  if (dbP) return dbP;
  dbP = new Promise(res => {
    try {
      const rq = indexedDB.open(CLIP_DB, 1);
      rq.onupgradeneeded = () => {
        rq.result.createObjectStore('meta', { keyPath: 'id' });
        rq.result.createObjectStore('data', { keyPath: 'id' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch (_) { res(null); }
  });
  return dbP;
}
// one transaction over the stores; `fn` makes the requests, the last one's result is the answer
/** @param {string[]} stores @param {IDBTransactionMode} mode @param {(t: IDBTransaction) => IDBRequest | void} fn @returns {Promise<any>} */
async function tx(stores, mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise(res => {
    try {
      const t = d.transaction(stores, mode);
      const rq = fn(t);
      t.oncomplete = () => res(rq ? rq.result : true);
      t.onerror = t.onabort = () => res(null);
    } catch (_) { res(null); }
  });
}

/** @returns {Promise<ClipMeta[]>} newest first */
export async function clipList() {
  const all = await tx(['meta'], 'readonly', t => t.objectStore('meta').getAll());
  return (all || []).sort((a, b) => b.date - a.date);
}
/** @param {string} id @returns {Promise<SavedClip | null>} */
export async function clipGet(id) {
  const r = await tx(['data'], 'readonly', t => t.objectStore('data').get(id));
  if (!r || !r.gz) return null;
  try { return await clipUnpack(r.gz); } catch (_) { return null; }
}
// packs the clip and stores it with its card (meta.bytes becomes the packed size)
/** @param {ClipMeta} meta @param {SavedClip} clip @returns {Promise<boolean>} */
export async function clipPut(meta, clip) {
  let gz;
  try { gz = await clipPack(clip); } catch (_) { return false; }
  meta.bytes = gz.size;
  // ask once that the browser not clear the store to free space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
  const ok = await tx(['meta', 'data'], 'readwrite', t => {
    t.objectStore('data').put({ id: meta.id, gz });
    t.objectStore('meta').put(meta);
  });
  return !!ok;
}
/** @param {string} id @param {string} name @returns {Promise<boolean>} */
export async function clipRename(id, name) {
  const m = await tx(['meta'], 'readonly', t => t.objectStore('meta').get(id));
  if (!m) return false;
  m.name = name;
  return !!(await tx(['meta'], 'readwrite', t => { t.objectStore('meta').put(m); }));
}
/** @param {string} id @returns {Promise<boolean>} */
export async function clipDelete(id) {
  return !!(await tx(['meta', 'data'], 'readwrite', t => {
    t.objectStore('meta').delete(id); t.objectStore('data').delete(id);
  }));
}
// a name for a new clip: "Floor 3 · 2 Oct 14:05"
/** @param {number} floor @param {number} date */
export function clipName(floor, date) {
  const d = new Date(date), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return 'Floor ' + floor + ' · ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
