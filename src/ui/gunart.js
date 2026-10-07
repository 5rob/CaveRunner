// The gun skin gallery (owner's LIST4 item 2): the Bag's 🖼️ button (.artbtn) opens a dark sheet
// of every GUN_ART sprite, big and crisp with its name; "Default" first (the drawn gun, no `art`).
// A tap sets the selected gun's `art` and closes (the save keeps it: save.js cleanGun).

import { GUN_ART, gunArtCanvas } from '../art/gunart.js';
import { drawGun } from '../art/sprites.js';
import { gunAccent } from '../spells/guns.js';
import { h, useEffect, useRef } from './h.js';

const TW = 112, TH = 54;   // a tile's picture, CSS px

/** @param {{ gun: Gun, id: string | undefined }} props */
function ArtTile({ gun, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(TW * dpr); c.height = Math.round(TH * dpr);
    const x = c.getContext('2d'); if (!x) return;
    x.clearRect(0, 0, c.width, c.height);
    const im = id ? gunArtCanvas(id) : null;
    if (im) {   // a whole number of device pixels per art pixel, centred: crisp
      const k = Math.max(1, Math.floor(Math.min((c.width - 8) / im.width, (c.height - 8) / im.height)));
      x.imageSmoothingEnabled = false;
      x.drawImage(im, Math.round((c.width - im.width * k) / 2), Math.round((c.height - im.height * k) / 2), im.width * k, im.height * k);
    } else {
      const sc = 4.2;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGun(x, TW / 2 - 3.85 * sc, TH / 2 + 1 * sc, 0, sc, gunAccent(gun));
    }
  }, [id]);
  return h('canvas', { ref, className: 'arttile', style: { width: TW + 'px', height: TH + 'px' } });
}

/** @param {{ gun: Gun, onPick: () => void, close: () => void }} props */
export function GunArtPicker({ gun, onPick, close }) {
  const down = useRef(null);
  const tiles = [{ id: undefined, name: 'Default' }].concat(GUN_ART.map(a => ({ id: a.id, name: a.name })));
  return h('div', { className: 'artsheet' },
    h('div', { className: 'shead' },
      h('h2', null, 'Gun look'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Close')),
    h('div', { className: 'artgrid' }, tiles.map(t => h('button', {
      key: t.id || 'default', className: 'artpick' + ((gun.art || undefined) === t.id ? ' on' : ''), 'data-art': t.id || '',
      // picked on the finger's lift, unless it moved (a scroll of the grid isn't a pick)
      onPointerDown: e => { down.current = { x: e.clientX, y: e.clientY }; },
      onPointerUp: e => {
        const d = down.current; down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
        e.preventDefault();
        if (t.id) gun.art = t.id; else delete gun.art;
        onPick(); close();
      },
    }, h(ArtTile, { gun, id: t.id }), h('span', null, t.name)))));
}
