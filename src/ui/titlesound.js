// @ts-check
// The title's sound (v0.0.174, owner): the scene (art/titlescene.js) asks for sounds in S.snd as things happen,
// each the game's own (shots by their spell's voice, hits, blasts, creatures by kind, fire, gold, steps, the
// jetpack, the vines); this plays them every frame and clears the list. The ear is the camera's middle: the
// title is drawn at half the game's scale, so a screen unit counts as two of the game's, more when zoomed in.

import { Music } from '../audio/music.js';
import { SFX } from '../audio/sfx.js';
import { TCELL } from '../art/titlescene.js';
import { PH, PW } from '../core/consts.js';
import { THEMES } from '../data/themes.js';

const SCALE = 2;                        // title screen units → the game's world units (art/titlescene.js SP)

/**
 * @param {import('../art/titlescene.js').TitleScene} S @param {{ x: number, y: number, z: number }} C the camera (art/titlescene.js titleCam)
 * @param {{ jets?: any[], fire?: any }} L the loops this title keeps (one jetpack a player, the fire)
 * @param {number} dt
 */
export function titleSound(S, C, L, dt) {
  const q = S.snd;
  S.snd = [];
  if (!SFX.ready) return;
  SFX.ear(0, 0);
  SFX.tick();
  if (SFX.ambience !== THEMES[0].name) SFX.setAmbience(THEMES[0].name);
  if (!Music.playing) Music.start();            // the title's track (audio/song.js)
  SFX.ambTick(dt);
  const k = SCALE * C.z;
  /** @param {number} x */
  const wx = x => (x - C.x) * k;
  /** @param {number} y */
  const wy = y => (y - C.y) * k;
  for (const e of q) {
    const x = wx(e.x), y = wy(e.y);
    switch (e.k) {
      case 'cast': {
        const K = e.a;
        /** @type {any} the stats shotSound reads */
        const sh = { sid: K.shot, speed: K.speed, size: K.size, dmg: K.dmg, count: K.n, homing: K.homing, explode: K.explode,
          pierce: K.pierce, bounce: K.bounce };
        SFX.cast([sh], x, y);
        break;
      }
      case 'hit': SFX.hit(x, y); break;
      case 'rock': SFX.rock(x, y); break;
      case 'bounce': SFX.bounce(x, y); break;
      case 'boom': SFX.boom(x, y, e.a * 2.5); break;
      case 'debris': SFX.debris(x, y); break;
      case 'arc': SFX.arc(x, y, false); break;
      case 'lamp': SFX.fx('shatter', x, y, 'glass'); SFX.fx('whoosh', x, y); break;
      case 'rustle': SFX.rustle(x, y, e.a.v, e.a.st); break;
      case 'die': case 'hurt': case 'alert': case 'idle': case 'bite': case 'fire': SFX.creature(e.a, e.k, x, y); break;
      case 'step': SFX.fx('step', x, y); break;
      case 'land': SFX.fx('land', x, y, { v: e.a }); break;
      case 'swap': SFX.fx('switch', x, y); break;
      case 'coin': SFX.ui('coin'); break;
      default: SFX.fx(e.k, x, y);               // whoosh, drip, lash, fizzle, chainhop, coinland
    }
  }
  // the jetpacks: one roar a player, as loud as his flame (the game's: 0.35 at full), where he is
  const jets = L.jets || (L.jets = []);
  S.runners.forEach((r, i) => {
    if (!jets[i]) jets[i] = SFX.loop('jet');
    if (jets[i]) jets[i].set(Math.min(1, r.flame) * 0.3, wx(r.x + PW / 2), wy(r.y + PH / 2));
  });
  // the fire: the game's blaze loop at the burning cells' middle, louder the more is alight
  if (S.fire.length) {
    let fx = 0, fy = 0;
    for (const f of S.fire) { fx += (f.c + 0.5) * TCELL - S.scroll; fy += (f.r + 0.5) * TCELL; }
    if (!L.fire) L.fire = SFX.loop('fire');
    if (L.fire) L.fire.set(Math.min(1, 0.35 + S.fire.length / 300) * 0.7, wx(fx / S.fire.length), wy(fy / S.fire.length));
  }
}

// the title closes: its loops go (the engine keeps at most 8), the music fades out
/** @param {{ jets?: any[], fire?: any }} L */
export function titleSoundStop(L) {
  Music.stop();
  for (const h of [...(L.jets || []), L.fire]) if (h) h.stop();
  L.jets = []; L.fire = null;
}
