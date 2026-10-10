// @ts-check
// The sign over the shop's way in (v0.0.136): the machine's old maker's plate, "PRINTER", with a
// plank nailed over it at a slant and "TELEPORTER" painted on by hand. The plank leaves the
// plate's top-left and its end ("ER") showing, so you can still read what it was. Hand lettering
// is brush strokes along LETTERS' lines, wobbled by fixed hashes (never Math.random: draw shares
// the simulation's stream). Drawn at world scale, before the fog.

/** @param {number} n */
const hs = n => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

// each letter: strokes of points in a 0-1 box (x across, y down), and its width
/** @type {Record<string, { w: number, s: number[][] }>} */
const LETTERS = {
  T: { w: 0.8, s: [[0, 0.02, 0.8, 0], [0.4, 0, 0.42, 1]] },
  E: { w: 0.62, s: [[0.62, 0, 0.02, 0.02, 0, 1, 0.64, 0.98], [0.02, 0.5, 0.5, 0.48]] },
  L: { w: 0.58, s: [[0.02, 0, 0, 1, 0.6, 0.98]] },
  P: { w: 0.64, s: [[0.02, 1, 0, 0, 0.5, 0.02, 0.66, 0.22, 0.6, 0.44, 0.38, 0.52, 0.02, 0.52]] },
  O: { w: 0.78, s: [[0.4, 0, 0.12, 0.1, 0, 0.5, 0.12, 0.9, 0.4, 1, 0.68, 0.9, 0.8, 0.5, 0.68, 0.1, 0.38, 0.02]] },
  R: { w: 0.66, s: [[0.02, 1, 0, 0, 0.5, 0.02, 0.66, 0.22, 0.6, 0.44, 0.38, 0.52, 0.02, 0.52], [0.3, 0.52, 0.68, 1]] },
};

// brush-painted text, left edge at x, baseline-to-top h tall, letters gap apart (in units of h)
/** @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y top @param {number} h @param {number} gap */
function paint(ctx, text, x, y, h, gap) {
  let at = x, n = 0;
  for (const ch of text) {
    const L = LETTERS[ch];
    if (!L) { at += h * 0.5; continue; }
    for (const st of L.s) {
      ctx.beginPath();
      for (let i = 0; i < st.length; i += 2, n++) {
        const px = at + st[i] * h + (hs(n * 3.1 + 1) - 0.5) * h * 0.14, py = y + st[i + 1] * h + (hs(n * 5.7 + 2) - 0.5) * h * 0.14;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    at += (L.w + gap) * h * (0.94 + 0.12 * hs(n + 0.5));
  }
  return at - x;
}

/** how wide paint() makes `text` @param {string} text @param {number} h @param {number} gap */
function paintW(text, h, gap) {
  let w = 0, n = 0;
  for (const ch of text) {
    const L = LETTERS[ch];
    if (!L) { w += h * 0.5; continue; }
    for (const st of L.s) n += st.length / 2;
    w += (L.w + gap) * h * (0.94 + 0.12 * hs(n + 0.5));
  }
  return w;
}

// the plate and the plank, centred on (cx, cy). o (CaveRunner Auto's exit pad, feedback round 2): the plate's old word
// (default PRINTER), the plank's place over it (dx, dy from the centre; rot its slant), so a second sign looks different, and
// sub: a smaller line painted under TELEPORTER (the plank a little taller for it)
/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {{ plate?: string, dx?: number, dy?: number, rot?: number, sub?: string }} [o] */
export function drawTeleSign(ctx, cx, cy, o = {}) {
  ctx.save();
  // ---- the old plate: cream enamel, a dark rim, PRINTER in heavy capitals, two screws ----
  const pw = 78, ph = 20, px = cx - pw / 2 + 6, py = cy - ph / 2 - 2;
  ctx.fillStyle = '#4a4740'; ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
  ctx.fillStyle = '#d8d0b6'; ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = '#ebe4cc'; ctx.fillRect(px, py, pw, 2);
  ctx.fillStyle = '#b5ab8f'; ctx.fillRect(px, py + ph - 2, pw, 2);
  ctx.fillStyle = '#2a2f3a';
  ctx.font = '900 15px "Arial Black", Impact, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.plate || 'PRINTER', px + pw / 2, py + ph / 2 + 1, pw - 6);
  ctx.fillStyle = '#7a7465';
  ctx.fillRect(px + 2, py + ph / 2 - 1, 2, 2); ctx.fillRect(px + pw - 4, py + ph / 2 - 1, 2, 2);
  // ---- the plank: nailed on at a slant, low on the left, leaving the plate's top-left and its end showing ----
  const bw = 72, bh = o.sub ? 24 : 17, ly = o.sub ? -3.5 : 0;
  ctx.translate(cx + (o.dx ?? -13), cy + (o.dy ?? 7));
  ctx.rotate(o.rot ?? -0.11);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-bw / 2 + 1.5, -bh / 2 + 2, bw, bh);   // its shadow on the plate
  ctx.fillStyle = '#7b5532'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  // the grain: long uneven streaks, a knot
  for (let i = 0; i < 9; i++) {
    const gy = -bh / 2 + 1 + hs(i * 4.3) * (bh - 2), gx = -bw / 2 + hs(i * 7.9) * 20, gl = 30 + hs(i * 2.2) * 45;
    ctx.fillStyle = i % 3 ? 'rgba(60,36,18,0.45)' : 'rgba(160,118,74,0.35)';
    ctx.fillRect(gx, gy, Math.min(gl, bw / 2 - gx), 0.8);
  }
  ctx.fillStyle = 'rgba(55,32,15,0.6)'; ctx.beginPath(); ctx.ellipse(bw / 2 - 16, 4, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9a6d43'; ctx.fillRect(-bw / 2, -bh / 2, bw, 1.2);                       // the lit top edge
  ctx.fillStyle = '#4e3420'; ctx.fillRect(-bw / 2, bh / 2 - 1.2, bw, 1.2);
  // the ends sawn a little rough
  ctx.fillStyle = '#5d3f24'; ctx.fillRect(-bw / 2, -bh / 2, 1.2, bh); ctx.fillRect(bw / 2 - 1.2, -bh / 2, 1.2, bh);
  // nails, one each end, bent heads catching the light
  for (const nx of [-bw / 2 + 4, bw / 2 - 4]) {
    ctx.fillStyle = '#3b3b40'; ctx.beginPath(); ctx.arc(nx, 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a9adb5'; ctx.fillRect(nx - 0.9, -0.4, 1, 1);
  }
  // TELEPORTER, painted on by hand, a touch uphill
  const lh = 10, gap = 0.18, tw = paintW('TELEPORTER', lh, gap), s = Math.min(1, (bw - 10) / tw);
  if (o.sub) {
    ctx.font = 'italic 700 6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(30,18,8,0.5)'; ctx.fillText(o.sub, 0.5, bh / 2 - 4.2);
    ctx.fillStyle = '#f1ead8'; ctx.fillText(o.sub, 0, bh / 2 - 4.7);
  }
  ctx.scale(s, 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(30,18,8,0.5)'; ctx.lineWidth = 2.6;
  paint(ctx, 'TELEPORTER', -tw / 2 + 0.6, -lh / 2 + 0.8 + ly, lh, gap);
  ctx.strokeStyle = '#f1ead8'; ctx.lineWidth = 2;
  paint(ctx, 'TELEPORTER', -tw / 2, -lh / 2 + ly, lh, gap);
  ctx.restore();
}
