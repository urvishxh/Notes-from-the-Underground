// Mycelium Lab · text that grows like mycelium
// ------------------------------------------------------------------
// Your words become hyphae. Every growing thread is a line of your text: its tip lays down the next
// letter along a gently curving path, so the words keep reading as the thread grows.
// Three compositions:
//   unravel  a paragraph set large; each line keeps going past the margin, curves away, branches
//            and loosens until it dissolves into bare threads
//   colony   the first word sits in the centre; text-threads radiate from it like a germinating spore,
//            dense near the centre and airy at the edges
//   mat      the whole page woven from fine threads of text, like a mycelial mat
// Biology in the growth:
//   tips keep their heading and turn in gentle arcs; branches split off behind the tip (the branch
//   carries on with the next word, set smaller and lighter than its parent); tips steer away from text
//   already there and stop when they run into it (fusion); far from the source the letters shrink
//   and spread apart, and when they become too small to read the thread carries on as a bare hypha
function createTextEngine(env, S) {
  const p = env.p, HC = 14;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const text = (S.text || "mycelium").replace(/\s+/g, " ").trim() || "mycelium";
  const family = S.font, W0 = +S.fontWeight || 400, s0 = S.size || 24, style = S.style || "unravel";
  const mc = document.createElement("canvas").getContext("2d");
  const wcache = new Map();
  const adv = (ch, size, wt) => { const k = ch + wt; let w = wcache.get(k); if (w === undefined) { mc.font = `${wt} 100px "${family}", serif`; w = mc.measureText(ch).width / 100; wcache.set(k, w); } return w * size; };
  const lighter = (gen) => (gen === 0 ? W0 : Math.max(300, W0 - 200 * Math.min(2, gen)));
  let R, glyphs, threads, knots, tips, hash, tipSeq;

  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const r = {
      wander: 0.015 + 0.2 * j(S.wander ?? 0.35), branch: 0.008 + 0.06 * j(S.branching ?? 0.5),
      shrink: 0.006 + 0.06 * j(S.shrink ?? 0.55), spread: 0.004 + 0.05 * j(S.spread ?? 0.5),
      reach: Math.max(env.W, env.H) * (0.25 + 0.95 * j(S.reach ?? 0.7)), hold: 4 + Math.round(14 * Math.random()),
      bare: 30 + 120 * Math.random(),
    };
    const w = [r.wander > 0.14 ? "meandering" : r.wander < 0.06 ? "straight" : "curving", r.branch > 0.045 ? "bushy" : r.branch < 0.02 ? "sparse" : "branching",
      r.shrink > 0.045 ? "vanishing" : "lingering", r.spread > 0.035 ? "loosening" : "tight"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + style + " · " + w.join(", ");
    return r;
  }
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  function addGlyph(g) { glyphs.push(g); const k = key(g.x, g.y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(g); }
  function near(x, y, r, fn) {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const g of b) fn(g); }
  }
  const nextWord = (i) => { let k = i % text.length, n = 0; while (text[k] !== " " && n++ < text.length) k = (k + 1) % text.length; return (k + 1) % text.length; };
  function sprout(x, y, ang, i, size, o = {}) {
    const th = { pts: [[x, y]], w: o.bare ? 0.5 : Math.max(0.4, size / 30) }; threads.push(th);
    const t = { x, y, ang, i: ((i % text.length) + text.length) % text.length, size, em: o.em || 0, d: 0, gen: o.gen || 0, carry: 0, id: tipSeq++, th, turn: 0, bare: !!o.bare, bareLeft: o.bareLeft || R.bare, hold: o.hold ?? R.hold };
    t.count = 0; tips.push(t); return t;
  }
  // set a block of text (glyphs stay in place); returns line info
  function setBlock(x0, yMid, width, size, align) {
    const words = text.split(" "), sp = adv(" ", size, W0), lines = []; let line = [], lw = 0;
    for (const w of words) {
      const ww = [...w].reduce((a, c) => a + adv(c, size, W0), 0);
      if (line.length && lw + sp + ww > width) { lines.push(line); line = []; lw = 0; }
      line.push(w); lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push(line);
    const lh = size * 1.12, top = yMid - ((lines.length - 1) * lh) / 2;
    let idx = 0; const out = [];
    lines.forEach((ws, li) => {
      const str = ws.join(" "), w = [...str].reduce((a, c) => a + adv(c, size, W0), 0);
      let x = align === "center" ? x0 - w / 2 : x0; const y = top + li * lh, xs = x;
      for (const ch of str) { if (ch !== " ") addGlyph({ ch, x, y, a: 0, s: size, wt: W0, alpha: 1, own: -1 }); x += adv(ch, size, W0); idx++; }
      out.push({ xs, xe: x, y, start: idx - str.length, end: idx });
      idx++;
    });
    return out;
  }

  function setup() {
    R = recipe(); glyphs = []; threads = []; knots = []; tips = []; hash = new Map(); tipSeq = 0;
    const n = Math.round(S.sprouts ?? 16);
    if (style === "unravel") {
      // a big paragraph on the left; every line carries on past its end and unravels
      const lines = setBlock(env.W * 0.07, env.H / 2, env.W * (S.measure ?? 0.42), s0, "left");
      lines.forEach((L, k) => {
        const fan = (k - (lines.length - 1) / 2) * 0.1;   // the lines fan out from the margin
        sprout(L.xe + adv(" ", s0, W0), L.y, fan + p.random(-0.03, 0.03), L.end + 1, s0, { hold: 2 + Math.round(Math.random() * 4) });
        if (k === 0 || k === lines.length - 1) for (let m = 0; m < Math.max(1, Math.round(n / 8)); m++) {   // a few threads fray up and down from the outer lines
          const x = p.random(L.xs + s0, L.xe), up = k === 0 ? -1 : 1;
          sprout(x, L.y + up * s0 * 0.9, up * Math.PI / 2 + p.random(-0.5, 0.5), (Math.random() * text.length) | 0, s0 * 0.55, { gen: 1, hold: 2 });
        }
      });
    } else if (style === "colony") {
      // the first word large in the centre; threads radiate from around it
      const word = text.split(" ")[0], big = s0 * 2.4, ww = [...word].reduce((a, c) => a + adv(c, big, W0), 0);
      let x = env.W / 2 - ww / 2; for (const ch of word) { addGlyph({ ch, x, y: env.H / 2 + big * 0.35, a: 0, s: big, wt: W0, alpha: 1, own: -1 }); x += adv(ch, big, W0); }
      const m = Math.max(8, n * 2), rx = ww / 2 + s0 * 1.2, ry = big * 0.9;
      for (let k = 0; k < m; k++) {
        const a = (k / m) * 6.283 + p.random(-0.1, 0.1);
        sprout(env.W / 2 + Math.cos(a) * rx, env.H / 2 + Math.sin(a) * ry, a + p.random(-0.15, 0.15), word.length + 1 + k * 7, s0 * p.random(0.7, 1), { hold: 2 + Math.round(Math.random() * 4) });
      }
    } else {
      // mat: fine threads of text started all over the page
      for (let k = 0; k < n * 3; k++) sprout(p.random(env.W * 0.05, env.W * 0.95), p.random(env.H * 0.05, env.H * 0.95), p.random(6.283), (Math.random() * text.length) | 0, s0 * p.random(0.35, 0.7), { hold: 0 });
    }
  }

  function turnAway(tp, a, rad) {
    let rx = 0, ry = 0;
    near(tp.x, tp.y, rad, (g) => { if (g.own === tp.id && tp.count - g.k < 10) return; const dx = tp.x - g.x, dy = tp.y - g.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
    if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.3, Math.hypot(rx, ry) * rad * 0.25); }
    const m = Math.min(env.W, env.H) * 0.05, ex = tp.x < m ? 1 : tp.x > env.W - m ? -1 : 0, ey = tp.y < m ? 1 : tp.y > env.H - m ? -1 : 0;
    if (ex || ey) { let da = Math.atan2(ey, ex) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.15; }
    return a;
  }
  function step(dt) {
    const born = [], alive = [];
    for (const tp of tips) {
      tp.carry += dt * (tp.bare ? 70 : 55 + 25 * tp.size / s0);
      let keep = true;
      while (keep) {
        if (tp.bare) {
          // the text has dissolved: a bare hypha keeps growing, branching more, until it runs out
          if (tp.carry < 2.5) break; tp.carry -= 2.5;
          tp.ang = turnAway(tp, tp.ang + hyphaTurn(tp, R.wander * 1.6), 10);
          tp.x += Math.cos(tp.ang) * 2.5; tp.y += Math.sin(tp.ang) * 2.5; tp.bareLeft -= 2.5;
          tp.th.pts.push([tp.x, tp.y]);
          if (tp.bareLeft <= 0 || tp.x < 2 || tp.y < 2 || tp.x > env.W - 2 || tp.y > env.H - 2) { keep = false; break; }
          if (tips.length + born.length < 500 && Math.random() < 0.035) {
            const c = sprout(tp.x, tp.y, tp.ang + (Math.random() < 0.5 ? -1 : 1) * p.random(0.4, 0.9), 0, 0, { bare: true, bareLeft: tp.bareLeft * 0.6 });
            tips.pop(); born.push(c);
          }
          continue;
        }
        const ch = text[tp.i], wt = lighter(tp.gen), w = adv(ch, tp.size, wt) + tp.em * tp.size;
        if (tp.carry < w) break;
        tp.carry -= w;
        // turning is per distance travelled (so big and small letters curve alike); calmer while it holds its size
        const k = Math.min(1.6, w / 12) * (tp.hold > 0 ? 0.3 : 1);
        const a0 = tp.ang + hyphaTurn(tp, R.wander * k);
        const a = (tp.ang = tp.hold > 0 ? a0 * 0.7 + turnAway(tp, a0, tp.size * 2.5) * 0.3 : turnAway(tp, a0, tp.size * 2.5));
        let hit = false;   // ran into text (another thread's, or its own from further back)
        if (ch !== " " && tp.count > 3) near(tp.x, tp.y, tp.size, (g) => { if (!hit && (g.own !== tp.id || tp.count - g.k > 10) && Math.hypot(g.x - tp.x, g.y - tp.y) < Math.max(tp.size, g.s) * 0.6) hit = true; });
        if (hit || tp.d > R.reach || tp.x < 2 || tp.y < 2 || tp.x > env.W - 2 || tp.y > env.H - 2 || glyphs.length > 16000) { keep = false; break; }
        if (ch !== " ") addGlyph({ ch, x: tp.x, y: tp.y, a, s: tp.size, wt, alpha: S.fade ? Math.max(0.2, 1 - tp.d / R.reach) : 1, own: tp.id, k: tp.count++ });
        tp.x += Math.cos(a) * w; tp.y += Math.sin(a) * w; tp.d += w;
        tp.th.pts.push([tp.x, tp.y]);
        tp.i = (tp.i + 1) % text.length;
        // after holding its size for a few words, the thread shrinks and loosens
        if (tp.hold > 0) { if (ch === " ") tp.hold--; }
        else { tp.size *= 1 - R.shrink * (tp.gen ? 0.7 : 0.45); tp.em += R.spread * 0.4; }
        if (tp.size < 3) { tp.bare = true; tp.th = { pts: [[tp.x, tp.y]], w: 0.5 }; threads.push(tp.th); continue; }
        // branch: the new thread carries on with the next word, smaller and lighter
        if (tips.length + born.length < 500 && ch === " " && Math.random() < R.branch * 4) {
          const c = sprout(tp.x, tp.y, tp.ang + (Math.random() < 0.5 ? -1 : 1) * p.random(0.3, 0.8), nextWord(tp.i), tp.size * p.random(0.55, 0.75), { em: tp.em, gen: tp.gen + 1, hold: 1 });
          tips.pop(); c.d = tp.d; born.push(c);
          knots.push({ x: tp.x, y: tp.y, r: Math.max(1, tp.size * 0.14) });
        }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
  }

  setup();
  return {
    step,
    pointerDown(x, y) { const n = 6, o = Math.random() * 6.283; for (let k = 0; k < n; k++) sprout(x, y, o + (k / n) * 6.283, (Math.random() * text.length) | 0, s0 * 0.8, { hold: 2 }); knots.push({ x, y, r: s0 * 0.12 }); },
    command() {},
    status() { return `${R.label} · ${glyphs.length} letters${tips.length ? " · growing" : " · grown"}`; },
    render(ctx, screen, ink) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      // the hyphae: thin threads under the text, and bare threads where the text has dissolved
      const showTh = S.threads ?? true;
      for (const th of threads) {
        if (th.pts.length < 2 || (!showTh && th.w > 0.5)) continue;
        ctx.globalAlpha = th.w > 0.5 ? 0.45 : 0.8;
        ctx.beginPath(); ctx.moveTo(th.pts[0][0], th.pts[0][1]); for (let i = 1; i < th.pts.length; i++) ctx.lineTo(th.pts[i][0], th.pts[i][1]);
        ctx.lineWidth = th.w * (S.weight ?? 1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const k of knots) { ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 6.283); ctx.fill(); }
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      let lastFont = "", lastAlpha = 1;
      for (const g of glyphs) {
        const f = `${g.wt} ${Math.round(g.s * 4) / 4}px "${family}", serif`;
        if (f !== lastFont) { ctx.font = f; lastFont = f; }
        if (g.alpha !== lastAlpha) { ctx.globalAlpha = g.alpha; lastAlpha = g.alpha; }
        // letters sit on the thread: lift them by a fraction of their size
        if (g.a === 0) ctx.fillText(g.ch, g.x, g.y);
        else { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.fillText(g.ch, 0, -g.s * 0.12); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      if (screen) for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.bare ? 1 : Math.max(1, tp.size * 0.1), 0, 6.283); ctx.fill(); }
    },
  };
}
