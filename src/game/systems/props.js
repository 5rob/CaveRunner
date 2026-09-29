// The level's props (see DECOR in data/themes.js): what happens when one is blown up.

import { SFX } from '../../audio/sfx.js';
import { burst } from './particles.js';
import { explode } from './terrain.js';

export function blowProp(W, G, pr) {
  if (pr.gone) return;
  pr.gone = true;                          // first, so a chain of blasts can't loop
  if (pr.k === 'barrel') { explode(W, G, pr.x, pr.y - 6, 105, undefined, 1); SFX.debris(pr.x, pr.y - 6); }
  else if (pr.k === 'pod') {
    SFX.pop(pr.x, pr.y - 6);
    W.clouds.push({ x: pr.x, y: pr.y - 8, r: 34, life: 4.5, max: 4.5, tick: 0 });
    burst(W, pr.x, pr.y - 6, 14, '#b6e36a');
  }
}
