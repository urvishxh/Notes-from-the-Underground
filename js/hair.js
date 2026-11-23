// Mycelium Lab · hair (type)
// ------------------------------------------------------------------
// Letters made of fine, translucent hyphae, with feathery fans of hair growing out of them.
//   felt    thousands of fine hairs wander along inside each stroke; where they overlap the letter
//           turns cottony and bright, like mycelium matted over a substrate (Density)
//   cords   a few heavier threads run through each stroke, like the cords in a mycelial mat
//   knots   at a few spots on the outline hyphae cluster into a dense, bright knot; from it fans radiate
//           outward, splitting again and again into finer, fainter hairs, so it gets sparser with
//           distance (Knots and fans, How far they reach)
//   web     long, faint loose threads tangle across the page between the letters (Loose threads)
// The letters weave themselves first (left to right), then the fans unfurl, then the web drifts in.
// Hairs that have finished growing are kept on a cached layer, so it stays smooth.
function createHairEngine(env, S, geo) {
  const p = env.p, W = env.W, H = env.H, f = geo.fontPx;
  const dens = S.density ?? 0.7, fluff = S.fluff ?? 0.6, reach = S.reach ?? 0.5, web = S.web ?? 0.3, curl = 0.02 + 0.22 * (S.wander ?? 0.35);
  const inside = (x, y) => geo.inside(x, y), counter = (x, y) => geo.inCounter(x, y);
  const hairs = [];   // { pts, w, a, born, dur }
  const STEP = Math.max(1.6, f / 110);

  // a fine hair that wanders along inside a letter, turning back at the outline (so it follows the stroke)
  function feltHair(x, y, len, w, a, born, fuzz) {
    let h = Math.random() * 6.283, turn = 0; const pts = [[x, y]];
    for (let s = 0; s < len; s++) {
      turn = turn * 0.85 + (Math.random() - 0.5) * curl; h += turn;
      let nx = x + Math.cos(h) * STEP, ny = y + Math.sin(h) * STEP;
      if (!inside(nx, ny) && Math.random() > fuzz) {
        let ok = false;
        for (let k = 1; k <= 10 && !ok; k++) for (const sg of [1, -1]) { const h2 = h + sg * k * 0.3, tx = x + Math.cos(h2) * STEP, ty = y + Math.sin(h2) * STEP; if (inside(tx, ty)) { h = h2; nx = tx; ny = ty; ok = true; break; } }
        if (!ok) break;
      }
      if (counter(nx, ny)) break;
      x = nx; y = ny; pts.push([x, y]);
    }
    if (pts.length > 3) hairs.push({ pts, w, a, born, dur: 0.6 + pts.length * 0.012 });
  }
  // a fan: one hair that grows outward and splits into finer, fainter hairs
  function fan(x, y, ang, len, w, a, born, depth) {
    const pts = [[x, y]]; let h = ang, turn = 0;
    const n = Math.max(3, Math.round(len / STEP));
    for (let s = 0; s < n; s++) {
      turn = turn * 0.8 + (Math.random() - 0.5) * curl * 0.8; h += turn;
      x += Math.cos(h) * STEP; y += Math.sin(h) * STEP;
      if (x < 0 || y < 0 || x > W || y > H || counter(x, y)) break;
      pts.push([x, y]);
    }
    const dur = 0.3 + pts.length * 0.02;
    if (pts.length > 1) hairs.push({ pts, w, a, born, dur });
    if (depth <= 0 || pts.length < 4) return;
    const kids = Math.random() < 0.35 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const at = pts[Math.max(1, Math.round(pts.length * p.random(0.45, 1)) - 1)];
      fan(at[0], at[1], h + p.random(-0.55, 0.55), len * p.random(0.55, 0.8), w * 0.75, a * 0.8, born + dur * 0.6, depth - 1);
    }
  }

  // ---- build the whole piece up front (each hair knows when it is born) ----
  const order = geo.letters.map((L, i) => ({ L, at: i * 0.1 }));
  for (const { L, at } of order) {
    const cells = L.cells.filter((c) => !counter(c.x, c.y)), area = cells.length * geo.cell * geo.cell;
    const nFelt = Math.round((area / (f * f)) * (300 + 1500 * dens));
    for (let k = 0; k < nFelt; k++) {
      const c = cells[(Math.random() * cells.length) | 0];
      feltHair(c.x, c.y, Math.round(p.random(15, 70)), p.random(0.35, 0.8), p.random(0.12, 0.35), at + Math.random() * 2.2, 0.04 + 0.1 * fluff);
    }
    // cords: a few heavier threads along each stroke
    const deep = cells.filter((c) => c.depth >= 1);
    for (let k = 0; k < 4 + Math.round(6 * dens); k++) { const c = (deep.length ? deep : cells)[(Math.random() * (deep.length || cells.length)) | 0]; feltHair(c.x, c.y, Math.round(p.random(60, 160)), p.random(1, 1.7), 0.55, at + Math.random() * 1.2, 0); }
    // knots: a few spots on the outline where hyphae cluster densely and fan outward,
    // getting finer and sparser with distance; elsewhere only a scattering of lone fans
    const edge = cells.filter((c) => c.depth === 0);
    const outward = (c) => { let ox = 0, oy = 0; for (let d = 0; d < 12; d++) { const a = (d / 12) * 6.283, cx = Math.cos(a), cy = Math.sin(a); if (!inside(c.x + cx * f * 0.03, c.y + cy * f * 0.03)) { ox += cx; oy += cy; } } return ox || oy ? Math.atan2(oy, ox) : null; };
    const nKnots = Math.max(1, Math.round((edge.length * geo.cell / f) * (0.15 + 0.6 * fluff)));
    for (let k = 0; k < nKnots && edge.length; k++) {
      const c = edge[(Math.random() * edge.length) | 0], dir = outward(c); if (dir === null) continue;
      const born = at + 1.4 + Math.random() * 2.5, big = p.random(0.6, 1.3);
      // the dense knot at the base: many short, bright hairs packed together
      for (let m = 0; m < Math.round(40 * big * (0.5 + dens)); m++) {
        const r = Math.abs(p.randomGaussian(0, f * 0.035 * big)), a = dir + p.random(-1.6, 1.6);
        fan(c.x + Math.cos(a) * r * 0.4, c.y + Math.sin(a) * r * 0.4, a, f * p.random(0.02, 0.07) * big, p.random(0.5, 1), p.random(0.35, 0.7), born + Math.random() * 0.6, 0);
      }
      // the spray: fans radiating from the knot, splitting into ever finer, fainter hairs
      for (let m = 0; m < Math.round((8 + 16 * fluff) * big); m++) {
        fan(c.x + p.random(-2, 2), c.y + p.random(-2, 2), dir + p.random(-1.1, 1.1), f * (0.08 + 0.45 * reach) * p.random(0.5, 1.1) * big, p.random(0.7, 1.2), p.random(0.4, 0.65), born + 0.3 + Math.random() * 1.2, 3 + Math.round(2 * reach));
      }
    }
    for (let k = 0; k < Math.round(edge.length * 0.015 * fluff); k++) {   // a scattering of lone fans
      const c = edge[(Math.random() * edge.length) | 0], dir = outward(c); if (dir === null) continue;
      fan(c.x, c.y, dir + p.random(-0.6, 0.6), f * (0.04 + 0.2 * reach) * p.random(0.5, 1.1), p.random(0.4, 0.7), p.random(0.25, 0.45), at + 2 + Math.random() * 3, 2 + Math.round(reach * 2));
    }
  }
  // loose threads across the page
  for (let k = 0; k < Math.round(web * 260); k++) {
    let x = Math.random() * W, y = Math.random() * H, h = Math.random() * 6.283, turn = 0; const pts = [[x, y]];
    for (let s = 0; s < 120 + Math.random() * 200; s++) { turn = turn * 0.9 + (Math.random() - 0.5) * curl * 0.6; h += turn; x += Math.cos(h) * 3; y += Math.sin(h) * 3; if (x < 0 || y < 0 || x > W || y > H) break; pts.push([x, y]); }
    hairs.push({ pts, w: p.random(0.3, 0.6), a: p.random(0.08, 0.2), born: 3 + Math.random() * 6, dur: 1.5 + Math.random() * 2 });
  }
  hairs.sort((a, b) => a.born + a.dur - (b.born + b.dur));
  const end = hairs.length ? Math.max(...hairs.map((h) => h.born + h.dur)) : 0;

  // ---- drawing ----
  let layer = null, cachedUpTo = 0;
  function strokeHair(ctx, h, frac, wt) {
    const m = Math.min(h.pts.length, Math.max(2, Math.round(h.pts.length * frac)));
    if (m < 2) return;
    ctx.globalAlpha = h.a; ctx.lineWidth = h.w * wt;
    ctx.beginPath(); ctx.moveTo(h.pts[0][0], h.pts[0][1]); for (let i = 1; i < m; i++) ctx.lineTo(h.pts[i][0], h.pts[i][1]); ctx.stroke();
  }
  let tufts = 0;
  return {
    step() {},
    pointerDown(x, y) { const t = env.t; for (let k = 0; k < 7; k++) fan(x, y, (k / 7) * 6.283 + Math.random() * 0.5, f * (0.08 + 0.3 * reach), 0.8, 0.55, t + k * 0.03, 3); hairs.sort((a, b) => a.born + a.dur - (b.born + b.dur)); cachedUpTo = 0; layer = null; tufts++; },
    pointerDrag(x, y) {},
    command() {},
    status() { return env.t < end ? (env.t < 2.5 ? "the letters are weaving themselves from hair" : "fans of hyphae unfurl from the letters") : "grown · click to plant a tuft"; },
    render(ctx, screen, ink) {
      const wt = S.weight ?? 1, t = env.t;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink;
      if (!screen) { for (const h of hairs) strokeHair(ctx, h, 1, wt); ctx.globalAlpha = 1; return; }
      const d = p.pixelDensity();
      if (!layer || layer.ink !== ink || layer.d !== d) {
        const c = document.createElement("canvas"); c.width = Math.round(W * d); c.height = Math.round(H * d);
        const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = ink;
        layer = { c, x, ink, d }; cachedUpTo = 0;
      }
      // hairs that have finished growing go onto the layer once
      while (cachedUpTo < hairs.length && hairs[cachedUpTo].born + hairs[cachedUpTo].dur <= t) { strokeHair(layer.x, hairs[cachedUpTo], 1, wt); cachedUpTo++; }
      layer.x.globalAlpha = 1;
      ctx.drawImage(layer.c, 0, 0, W, H);
      // hairs still growing are drawn up to where their tip has reached
      for (let i = cachedUpTo; i < hairs.length; i++) { const h = hairs[i]; if (t < h.born) continue; strokeHair(ctx, h, Math.min(1, (t - h.born) / h.dur), wt); }
      ctx.globalAlpha = 1;
    },
  };
}
