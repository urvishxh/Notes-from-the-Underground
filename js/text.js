// Mycelium Lab · text that grows like mycelium
// ------------------------------------------------------------------
// A paragraph you write becomes a colony. Every growing thread (hypha) is a line of your text:
// its tip lays down the next letter, then the next, so the words keep reading along the thread.
//   sprout     threads set out from the edges of the paragraph (or from one point, or where you click),
//              each one continuing the text from the word it starts at
//   grow       tips keep their heading and turn in gentle arcs; they branch now and then, and the
//              branch carries on with the next word
//   avoid      tips steer away from text that is already there (negative autotropism) and stop when
//              they run into it (like hyphae fusing)
//   thin out   the further a thread grows from its source, the smaller the letters get and the wider
//              they are spaced (and, if you like, the fainter), until it runs out
function createTextEngine(env, S) {
  const p = env.p, HC = 14;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const text = (S.text || "mycelium").replace(/\s+/g, " ").trim() || "mycelium";
  const family = S.font, weight = S.fontWeight, s0 = S.size || 18;
  const mc = document.createElement("canvas").getContext("2d");
  const widthCache = new Map();
  const adv = (ch, size) => { const k = ch; let w = widthCache.get(k); if (w === undefined) { mc.font = `${weight} 100px "${family}", sans-serif`; w = mc.measureText(ch).width / 100; widthCache.set(k, w); } return w * size; };
  let R, glyphs, threads, tips, hash, tipSeq, lastLabel;

  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const r = {
      wander: 0.02 + 0.22 * j(S.wander ?? 0.35), branch: 0.006 + 0.07 * j(S.branching ?? 0.45),
      shrink: 0.002 + 0.07 * j(S.shrink ?? 0.5), spread: 0.002 + 0.04 * j(S.spread ?? 0.5),
      reach: Math.max(env.W, env.H) * (0.15 + 0.85 * j(S.reach ?? 0.6)), speed: 0.8 + 0.4 * Math.random(),
    };
    const w = [r.wander > 0.15 ? "meandering" : r.wander < 0.07 ? "straight" : "curving", r.branch > 0.035 ? "bushy" : r.branch < 0.015 ? "sparse" : "branching",
      r.shrink > 0.035 ? "vanishing" : "lingering", r.spread > 0.028 ? "loosening" : "tight"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  function addGlyph(g) { glyphs.push(g); const k = key(g.x, g.y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(g); }
  function near(x, y, r, fn) {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const g of b) fn(g); }
  }
  function nextWord(i) { let k = i % text.length; let n = 0; while (text[k] !== " " && n < text.length) { k = (k + 1) % text.length; n++; } return (k + 1) % text.length; }
  function sprout(x, y, ang, i, size, em = 0, d = 0, gen = 0) {
    const th = { pts: [[x, y]] }; threads.push(th);
    tips.push({ x, y, ang, i: i % text.length, size, em, d, gen, carry: 0, id: tipSeq++, th, turn: 0 });
  }

  // the starting paragraph, set normally in the centre (its glyphs are part of the piece)
  function setParagraph() {
    const width = env.W * (S.measure ?? 0.42), lh = s0 * 1.35, words = text.split(" ");
    const lines = []; let line = [], lw = 0;
    for (const w of words) {
      const ww = [...w].reduce((a, c) => a + adv(c, s0), 0), sp = adv(" ", s0);
      if (line.length && lw + sp + ww > width) { lines.push(line); line = []; lw = 0; }
      line.push(w); lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push(line);
    const top = env.H / 2 - (lines.length * lh) / 2 + s0;
    let idx = 0; const placed = [];
    lines.forEach((ws, li) => {
      const str = ws.join(" "), w = [...str].reduce((a, c) => a + adv(c, s0), 0);
      let x = env.W / 2 - w / 2; const y = top + li * lh;
      for (const ch of str) { if (ch !== " ") { const g = { ch, x, y, a: 0, s: s0, alpha: 1, own: -1 }; addGlyph(g); placed.push({ g, idx, li, last: li === lines.length - 1 }); } x += adv(ch, s0); idx++; }
      idx++;   // the space between lines
    });
    return { placed, lines: lines.length, top, lh };
  }

  function setup() {
    R = recipe(); glyphs = []; threads = []; tips = []; hash = new Map(); tipSeq = 0;
    const n = Math.round(S.sprouts ?? 14), cx = env.W / 2, cy = env.H / 2;
    if (S.start === "point") {
      for (let k = 0; k < n; k++) sprout(cx, cy, (k / n) * 6.283 + p.random(-0.2, 0.2), (k * 37) % text.length, s0);
    } else if (S.start === "paragraph" || !S.start) {
      const P = setParagraph();
      // sprout from the edges: first and last letters of lines, and letters on the top and bottom lines
      const edge = P.placed.filter((q, k, a) => q.li === 0 || q.last || !a[k - 1] || a[k - 1].li !== q.li || !a[k + 1] || a[k + 1].li !== q.li);
      p.shuffle(edge, true);
      for (const q of edge.slice(0, n)) {
        const ang = Math.atan2(q.g.y - cy, (q.g.x - cx) * 0.6) + p.random(-0.5, 0.5);
        sprout(q.g.x + Math.cos(ang) * s0 * 1.8, q.g.y + Math.sin(ang) * s0 * 1.8, ang, q.idx + 1, s0 * 0.9);
      }
    }
  }

  function step(dt) {
    const born = [], alive = [];
    for (const tp of tips) {
      tp.carry += dt * 60 * R.speed * (0.6 + tp.size / s0 * 0.4);
      let keep = true;
      while (keep) {
        const ch = text[tp.i], w = adv(ch, tp.size) + tp.em * tp.size;
        if (tp.carry < w) break;
        tp.carry -= w;
        // turn gently; steer away from text already there
        let a = tp.ang + hyphaTurn(tp, R.wander);
        let rx = 0, ry = 0;
        near(tp.x, tp.y, tp.size * 3, (g) => { if (g.own === tp.id) return; const dx = tp.x - g.x, dy = tp.y - g.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.25, Math.hypot(rx, ry) * tp.size * 0.6); }
        // near the edge of the page a thread curves back in rather than running off it
        const m = Math.min(env.W, env.H) * 0.06, ex = tp.x < m ? 1 : tp.x > env.W - m ? -1 : 0, ey = tp.y < m ? 1 : tp.y > env.H - m ? -1 : 0;
        if (ex || ey) { let da = Math.atan2(ey, ex) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.12; }
        tp.ang = a;
        // ran into other text: stop (fusion)
        let hit = false;
        if (ch !== " ") near(tp.x, tp.y, tp.size * 0.75, (g) => { if (!hit && g.own !== tp.id && Math.hypot(g.x - tp.x, g.y - tp.y) < tp.size * 0.7) hit = true; });
        if (hit || tp.size < 2.2 || tp.d > R.reach || tp.x < 2 || tp.y < 2 || tp.x > env.W - 2 || tp.y > env.H - 2 || glyphs.length > 14000) { keep = false; break; }
        if (ch !== " ") addGlyph({ ch, x: tp.x, y: tp.y, a, s: tp.size, alpha: S.fade ? Math.max(0.15, 1 - tp.d / R.reach) : 1, own: tp.id });
        tp.x += Math.cos(a) * w; tp.y += Math.sin(a) * w; tp.d += w;
        tp.th.pts.push([tp.x, tp.y]);
        tp.i = (tp.i + 1) % text.length;
        // smaller and more spaced out as it goes
        tp.size *= 1 - R.shrink * 0.5; tp.em += R.spread * 0.5;
        // branch: the new thread carries on with the next word
        if (tips.length + born.length < 320 && Math.random() < R.branch) {
          const b = tp.ang + (Math.random() < 0.5 ? -1 : 1) * p.random(0.35, 0.9);
          const c = { x: tp.x, y: tp.y, ang: b, i: nextWord(tp.i), size: tp.size * 0.94, em: tp.em, d: tp.d, gen: tp.gen + 1, carry: 0, id: tipSeq++, th: { pts: [[tp.x, tp.y]] }, turn: 0 };
          threads.push(c.th); born.push(c);
        }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
  }

  setup();
  return {
    step,
    pointerDown(x, y) { const n = 5, o = Math.random() * 6.283; for (let k = 0; k < n; k++) sprout(x, y, o + (k / n) * 6.283, (Math.random() * text.length) | 0, s0 * 0.9); },
    command() {},
    status() { return `${R.label} · ${glyphs.length} letters${tips.length ? " · growing" : " · grown"}`; },
    render(ctx, screen, ink) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      if (S.threads) {   // the hyphae the text rides on
        ctx.globalAlpha = 0.35; ctx.beginPath();
        for (const th of threads) { if (th.pts.length < 2) continue; ctx.moveTo(th.pts[0][0], th.pts[0][1]); for (let i = 1; i < th.pts.length; i++) ctx.lineTo(th.pts[i][0], th.pts[i][1]); }
        ctx.lineWidth = 0.6 * (S.weight ?? 1); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.textBaseline = S.threads ? "bottom" : "middle"; ctx.textAlign = "left";
      let lastFont = "", lastAlpha = 1;
      for (const g of glyphs) {
        const size = Math.round(g.s * 4) / 4, f = `${weight} ${size}px "${family}", sans-serif`;
        if (f !== lastFont) { ctx.font = f; lastFont = f; }
        if (g.alpha !== lastAlpha) { ctx.globalAlpha = g.alpha; lastAlpha = g.alpha; }
        if (g.a === 0) ctx.fillText(g.ch, g.x, g.y);
        else { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.fillText(g.ch, 0, 0); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      if (screen) for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.x, tp.y, Math.max(1, tp.size * 0.12), 0, 6.283); ctx.fill(); }
    },
  };
}
