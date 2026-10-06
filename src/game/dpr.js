// @ts-check
// The game canvas's pixels per css pixel: the screen's own, capped at DEV.renderScale (owner, v0.0.148: drawn at
// 1.5× and stretched to fit, for speed: a phone is ~2.6×). Everything that turns canvas pixels into css pixels
// uses this, never window.devicePixelRatio
import { DEV } from '../dev/knobs.js';

export const gameDpr = () => Math.min(window.devicePixelRatio || 1, DEV.renderScale > 0 ? DEV.renderScale : 99);
