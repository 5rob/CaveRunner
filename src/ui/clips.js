// @ts-check
// Saved death replays: the Bag's Witness tab (WitnessGallery: thumbnails to play, rename, delete),
// and turning a replay into a video file (exportClip: record the canvas and the sound as it plays,
// convert to MP4 with ffmpeg if the device can't record MP4 itself, save it to the phone).

import { SFX } from '../audio/sfx.js';
import { DEV } from '../dev/knobs.js';
import { clipDelete, clipList, clipRename } from '../save/clips.js';
import { h, useEffect, useState } from './h.js';

/** @param {number} n */
const fmtBytes = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB');

// The Witness tab: every saved death, newest first. Tap a picture to play it full screen.
/** @param {{ input: { current: GameInput }, close: () => void, tabs: any, play: (m: ClipMeta) => void }} props */
export function WitnessGallery({ close, tabs, play }) {
  const [list, setList] = useState(null);      // ClipMeta[], once read
  const [renaming, setRenaming] = useState('');
  const [name, setName] = useState('');
  const [asking, setAsking] = useState('');
  const reload = () => clipList().then(setList);
  useEffect(() => { reload(); }, []);
  const tap = f => e => { e.preventDefault(); e.stopPropagation(); f(); };
  const card = m => h('div', { key: m.id, className: 'wclip', 'data-clip': m.id },
    h('div', { className: 'wthumbimg', role: 'button', 'aria-label': 'Play ' + m.name,
        onPointerDown: tap(() => play(m)) },
      m.thumb ? h('img', { src: m.thumb, alt: '' }) : null,
      h('span', { className: 'wplayicon' }, '▶')),
    renaming === m.id
      ? h('div', { className: 'wrename' },
          h('input', { value: name, maxLength: 40, autoFocus: true, onChange: e => setName(e.target.value),
            onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } }),
          h('div', { className: 'wcbtns' },
            h('button', { className: 'wok', onPointerDown: tap(async () => {
              const nm = name.trim() || m.name;
              setRenaming(''); await clipRename(m.id, nm); reload();
            }) }, 'Save'),
            h('button', { onPointerDown: tap(() => setRenaming('')) }, 'Cancel')))
      : asking === m.id
        ? h('div', { className: 'wrename' },
            h('b', { className: 'wname' }, 'Delete “' + m.name + '”?'),
            h('div', { className: 'wcbtns' },
              h('button', { className: 'wdel', onPointerDown: tap(async () => { setAsking(''); await clipDelete(m.id); reload(); }) }, 'Delete'),
              h('button', { onPointerDown: tap(() => setAsking('')) }, 'Keep')))
        : h('div', { className: 'wcinfo' },
            h('b', { className: 'wname' }, m.name),
            h('span', { className: 'wmeta' }, 'Floor ' + m.floor + ' · ' + m.secs + 's · ' + fmtBytes(m.bytes)),
            h('div', { className: 'wcbtns' },
              h('button', { className: 'wren', 'aria-label': 'Rename', onPointerDown: tap(() => { setName(m.name); setRenaming(m.id); setAsking(''); }) }, '✏️ Rename'),
              h('button', { className: 'wdelask', 'aria-label': 'Delete', onPointerDown: tap(() => { setAsking(m.id); setRenaming(''); }) }, '🗑️'))));
  return h('div', { className: 'sheet witnessgal' },
    h('div', { className: 'shead' },
      h('h2', null, 'Witness'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')),
    h('div', { className: 'wgal scroll' },
      list === null ? h('p', { className: 'wempty' }, 'Loading…')
        : !list.length ? h('p', { className: 'wempty' }, 'No saved deaths yet. When you die, tap WITNESS YOURSELF, then Save.')
          : list.map(card)),
    tabs);
}

// ---- the video export ----
// MP4 straight from the recorder where the device can (Android's Chrome can); anything else is
// recorded as WebM and converted by ffmpeg (ffmpeg.wasm, fetched from the CDN the first time)
export const VIDEO_MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1,opus',
  'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const VIDEO_MAX = [1080, 1920];   // the most pixels across and down (phone encoders top out round 1080p)
export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of VIDEO_MIMES) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
  return '';
}
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

// Plays the replay from the start as it's set up now (where the camera is or follows, the speed,
// the fog), records the play area and the sound, and saves an MP4. onState gets the progress
// ({ phase: 'rec' | 'convert' | 'save', frac }); cancel() stops it early, saving nothing.
/** @param {ReplayView} V @param {string} name @param {(s: { phase: string, frac: number }) => void} onState @param {{ cancelled: boolean }} ctl @returns {Promise<{ ok: boolean, msg: string }>} */
export async function exportClip(V, name, onState, ctl) {
  const C = V.clip, mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) return { ok: false, msg: 'This device can’t record video.' };
  SFX.unlock();
  const keep = { loop: V.loop, playing: V.playing, t: V.t };
  const out = document.createElement('canvas'), ctx = out.getContext('2d');
  /** @type {MediaRecorder | null} */
  let rec = null;
  try {
    // the copy canvas: the play area (above the replay's panel), scaled down to what an encoder takes
    V.playing = false; V.t = C.t0; V.loop = false;
    V.onFrame = (c, playPx) => {
      if (!out.width) {
        const k = Math.min(1, VIDEO_MAX[0] / c.width, VIDEO_MAX[1] / playPx);
        out.width = Math.max(2, Math.round(c.width * k) & ~1); out.height = Math.max(2, Math.round(playPx * k) & ~1);
      }
      ctx.drawImage(c, 0, 0, c.width, playPx, 0, 0, out.width, out.height);
    };
    for (let i = 0; i < 3 && !out.width; i++) await nextFrame();
    if (!out.width) return { ok: false, msg: 'The replay isn’t drawing.' };
    const vs = out.captureStream(30), as = SFX.stream();
    const tracks = vs.getVideoTracks().concat(as ? as.getAudioTracks() : []);
    rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: DEV.witKbps * 1000, audioBitsPerSecond: 128000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start(500);
    V.t = C.t0; V.playing = true;
    const span = C.t1 - C.t0, limit = performance.now() + (span / Math.max(0.05, V.speed) + 10) * 1000;
    while (V.playing && !ctl.cancelled && performance.now() < limit) {
      onState({ phase: 'rec', frac: (V.t - C.t0) / span });
      await nextFrame();
    }
    await nextFrame();
    rec.stop(); await stopped; rec = null;
    V.onFrame = null;
    if (ctl.cancelled) return { ok: false, msg: 'Cancelled.' };
    let blob = new Blob(chunks, { type: mime.split(';')[0] });
    if (!/mp4/.test(mime)) blob = await toMp4(blob, f => onState({ phase: 'convert', frac: f }));
    onState({ phase: 'save', frac: 1 });
    return await saveVideo(blob, fileName(name) + '.mp4');
  } catch (e) {
    return { ok: false, msg: 'Export failed: ' + (e && e.message ? e.message : e) };
  } finally {
    V.onFrame = null;
    if (rec && rec.state !== 'inactive') try { rec.stop(); } catch (_) {}
    V.loop = keep.loop; V.playing = keep.playing; V.t = keep.t;
  }
}
// a name that's safe as a file name
/** @param {string} s */
export const fileName = s => ('CaveRunner ' + (s || 'death')).replace(/[^\w .·-]+/g, '').replace(/·/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);

// WebM → MP4 with ffmpeg.wasm (the single-thread build: no special page headers needed)
export const FF_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/';
export const FF_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/';
/** @param {string} url @param {string} type */
async function blobURL(url, type) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch ' + r.status);
  return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
}
/** @param {string} src @returns {Promise<void>} */
const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('could not load ffmpeg'));
  document.head.appendChild(s);
});
/** @param {Blob} blob @param {(f: number) => void} onFrac @returns {Promise<Blob>} */
export async function toMp4(blob, onFrac) {
  onFrac(0);
  if (!window.FFmpegWASM) await loadScript(FF_URL + 'ffmpeg.js');
  const ff = new window.FFmpegWASM.FFmpeg();
  ff.on('progress', p => onFrac(Math.max(0, Math.min(1, p.progress || 0))));
  await ff.load({
    classWorkerURL: await blobURL(FF_URL + '814.ffmpeg.js', 'text/javascript'),
    coreURL: await blobURL(FF_CORE + 'ffmpeg-core.js', 'text/javascript'),
    wasmURL: await blobURL(FF_CORE + 'ffmpeg-core.wasm', 'application/wasm'),
  });
  await ff.writeFile('in.webm', new Uint8Array(await blob.arrayBuffer()));
  await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', 'out.mp4']);
  const data = await ff.readFile('out.mp4');
  try { ff.terminate(); } catch (_) {}
  return new Blob([data], { type: 'video/mp4' });
}

// Onto the phone: the app's bridge writes it into Movies/CaveRunner; a browser downloads it
/** @param {Uint8Array} u */
function b64(u) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export const SAVE_CHUNK = 3 * 131072;   // bytes per bridge call
/** @param {Blob} blob @param {string} file @returns {Promise<{ ok: boolean, msg: string }>} */
export async function saveVideo(blob, file) {
  const A = window.CaveApp;
  if (A && A.videoBegin) {
    if (!A.videoBegin(file, blob.type || 'video/mp4')) return { ok: false, msg: 'Couldn’t save the video.' };
    const u = new Uint8Array(await blob.arrayBuffer());
    for (let i = 0; i < u.length; i += SAVE_CHUNK) {
      if (!A.videoChunk(b64(u.subarray(i, i + SAVE_CHUNK)))) return { ok: false, msg: 'Couldn’t save the video.' };
      await new Promise(r => setTimeout(r, 0));
    }
    const where = A.videoEnd();
    return where ? { ok: true, msg: 'Saved to ' + where } : { ok: false, msg: 'Couldn’t save the video.' };
  }
  if (/; wv\)/.test(navigator.userAgent))
    return { ok: false, msg: 'Saving videos needs the new app: reinstall it from the releases page.' };
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { ok: true, msg: 'Downloaded ' + file };
}
