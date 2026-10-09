// @ts-check
// The three volume sliders (v0.0.174): Master, FX (sound effects and ambience) and Music, each kept in localStorage
// by audio/sfx.js. The title's settings and the pause menu both show them.

import { SFX } from '../audio/sfx.js';
import { h, useState } from './h.js';

export function Volumes() {
  const [v, setV] = useState(() => ({ master: SFX.volume, fx: SFX.fxVolume, music: SFX.musicVolume }));
  const SET = { master: SFX.setVolume, fx: SFX.setFxVolume, music: SFX.setMusicVolume };
  /** @param {'master' | 'fx' | 'music'} k @param {string} label */
  const row = (k, label) => {
    /** @param {any} e */
    const slide = e => {
      const x = Number(e.target.value) / 100;
      SET[k](x);
      setV(o => ({ ...o, [k]: x }));
      if (k !== 'music') SFX.fx('reelTick');
    };
    return h('label', { key: k, className: 'pvol tvol', 'data-vol': k },
      h('span', null, label, h('b', null, Math.round(v[k] * 100) + '%')),
      h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(v[k] * 100), className: 'volslider', onInput: slide, onChange: slide }));
  };
  return h('div', { className: 'volumes' }, row('master', 'Master'), row('fx', 'FX'), row('music', 'Music'));
}
