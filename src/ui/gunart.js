// The gun skin gallery (owner's LIST4 item 2): the Bag's 🖼️ button (.artbtn) opens a dark sheet
// of every GUN_ART sprite, big and crisp with its name; the one the gun wears now is lit (its own
// pick, or the one its colour gives it: gunArtId; v0.0.161, no more Default, the drawn gun is gone).
// A tap sets the selected gun's `art` and closes (the save keeps it: save.js cleanGun).

import { GUN_ART, gunArtCanvas, gunArtId } from '../art/gunart.js';
import { h, useEffect, useRef } from './h.js';

const TW = 112, TH = 54;   // a tile's picture, CSS px

/** @param {{ id: string }} props */
function ArtTile({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(TW * dpr); c.height = Math.round(TH * dpr);
    const x = c.getContext('2d'); if (!x) return;
    x.clearRect(0, 0, c.width, c.height);
    const im = gunArtCanvas(id); if (!im) return;
    // a whole number of device pixels per art pixel, centred: crisp
    const k = Math.max(1, Math.floor(Math.min((c.width - 8) / im.width, (c.height - 8) / im.height)));
    x.imageSmoothingEnabled = false;
    x.drawImage(im, Math.round((c.width - im.width * k) / 2), Math.round((c.height - im.height * k) / 2), im.width * k, im.height * k);
  }, [id]);
  return h('canvas', { ref, className: 'arttile', style: { width: TW + 'px', height: TH + 'px' } });
}

/** @param {{ gun: Gun, onPick: () => void, close: () => void }} props */
export function GunArtPicker({ gun, onPick, close }) {
  const down = useRef(null);
  const now = gunArtId(gun);
  return h('div', { className: 'artsheet' },
    h('div', { className: 'shead' },
      h('h2', null, 'Gun look'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Close')),
    h('div', { className: 'artgrid' }, GUN_ART.map(t => h('button', {
      key: t.id, className: 'artpick' + (now === t.id ? ' on' : ''), 'data-art': t.id,
      // picked on the finger's lift, unless it moved (a scroll of the grid isn't a pick)
      onPointerDown: e => { down.current = { x: e.clientX, y: e.clientY }; },
      onPointerUp: e => {
        const d = down.current; down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
        e.preventDefault();
        gun.art = t.id;
        onPick(); close();
      },
    }, h(ArtTile, { id: t.id }), h('span', null, t.name)))));
}
