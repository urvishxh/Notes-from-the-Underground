// Mycelium Lab · emerge (type)
// ------------------------------------------------------------------
// The word writes itself, is overtaken by the network, and lives on faintly inside it.
//   write      threads sprout inside each letter (left to right) and fill it fast: the word appears
//   burst      from every letter's edge, threads race outward, branching and avoiding each other,
//              until the whole page is one web
//   fade       as the page fills, the word eases back to a faint presence in the web (Word visibility)
//   alive      signals keep streaming through the threads toward the word; hover sends a wave
//              through the network, click sends a burst of signals from that spot
// For speed, threads that are already grown are kept on two layers (word and page) and only new
// growth is drawn each frame; the export redraws everything as clean vectors.
function createEmergeEngine(env, S, geo) {
  const p = env.p, W = env.W, H = env.H;
  const STEP = Math.max(1.8, geo.fontPx / 80), HC = 8, MAX_NODES = 80000, MAX_TIPS = 1100;
  const dens = S.density ?? 0.6, branch = 0.012 + 0.05 * (S.branching ?? 0.5), wander = 0.03 + 0.3 * (S.wander ?? 0.35);
  const vis = 0.08 + 0.7 * (S.visibility ?? 0.3), signals = S.signals ?? 0.6;
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const hash = new Map(), nodes = [], kids = [];
  let tips = [], tipSeq = 0, pulses = [], waves = [], lastFill = 0, lastPulse = 0, lastWave = -9, burstAt = Infinity, coverL = [], coverP = [], letterPlan = [];
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };
  const counter = (x, y) => geo.inCounter(x, y);
  const inside = (x, y) => geo.inside(x, y);

  function addNode(x, y, parent, tipId, L) {
    const n = { x, y, parent, tipId, L, born: env.t, id: nodes.length };
    nodes.push(n); kids.push([]);
    if (parent) kids[parent.id].push(n.id);
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  const tip = (node, ang, max, o = {}) => ({ node, ang, id: tipSeq++, len: 0, max, carry: 0, turn: 0, L: o.L ?? node.L, target: o.target });

  // ---- plan: each letter starts a moment after the one before (reading order) ----
  geo.letters.forEach((Lt, i) => {
    const cells = Lt.cells.filter((c) => c.depth >= 1 && !counter(c.x, c.y));
    const at = i * 0.12;
    letterPlan.push({ at, Lt, cells: cells.length ? cells : Lt.cells, done: false, burst: at + 1.0, burstDone: false });
    const sL = Math.max(1, Math.round((STEP * 2.6) / geo.cell));
    for (const c of Lt.cells) if (((c.x / geo.cell) | 0) % sL === 0 && ((c.y / geo.cell) | 0) % sL === 0 && !counter(c.x, c.y)) coverL.push({ x: c.x, y: c.y, at });
  });
  const sp = 44 - 32 * dens;
  for (let y = sp / 2; y < H; y += sp) for (let x = sp / 2; x < W; x += sp) { const px = x + p.random(-sp / 3, sp / 3), py = y + p.random(-sp / 3, sp / 3); if (!inside(px, py) && !counter(px, py)) coverP.push({ x: px, y: py }); }
  burstAt = (letterPlan.length ? letterPlan[letterPlan.length - 1].burst : 1);

  function reach(x, y, radius, L) {
    let best = null, bd = radius;
    near(x, y, radius, (n) => { if (n.L !== L) return; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (best && bd > STEP * 1.5) { tips.push(tip(best, Math.atan2(y - best.y, x - best.x), bd * 1.7 + 20, { L, target: { x, y } })); return true; }
    return false;
  }
  function gaps(list, r, radius, max, L) {
    if (!list.length) return 0;
    const sample = Array.from({ length: Math.min(400, list.length) }, () => list[(Math.random() * list.length) | 0]);
    const empty = sample.filter((c) => (c.at === undefined || env.t > c.at + 0.4) && !(() => { let hit = false; near(c.x, c.y, r, (n) => { if (!hit && Math.hypot(n.x - c.x, n.y - c.y) < r) hit = true; }); return hit; })());
    p.shuffle(empty, true); let sent = 0;
    for (const c of empty) { if (sent >= max || tips.length >= MAX_TIPS) break; if (reach(c.x, c.y, radius, L)) sent++; }
    return empty.length / sample.length;
  }

  function grow(dt) {
    // write: seed each letter at its moment
    for (const lp of letterPlan) {
      if (!lp.done && env.t >= lp.at) {
        lp.done = true;
        for (let k = 0; k < 3; k++) { const c = lp.cells[(Math.random() * lp.cells.length) | 0]; const root = addNode(c.x, c.y, null, -1, true); root.root = true; for (let m = 0; m < 4; m++) tips.push(tip(root, (m / 4) * 6.283 + Math.random(), geo.fontPx * 0.9)); }
      }
      // burst: threads leave the letter from all around its edge
      if (lp.done && !lp.burstDone && env.t >= lp.burst) {
        lp.burstDone = true;
        const edge = nodes.filter((n) => n.L && geo.letterAt(n.x, n.y) === lp.Lt.li);
        p.shuffle(edge, true);
        let made = 0; const want = Math.round(20 + 40 * dens);
        for (const n of edge) {
          if (made >= want) break;
          let ox = 0, oy = 0;
          for (let d = 0; d < 12; d++) { const a = (d / 12) * 6.283, cx = Math.cos(a), cy = Math.sin(a), tx = n.x + cx * STEP * 3, ty = n.y + cy * STEP * 3; if (!inside(tx, ty) && !counter(tx, ty)) { ox += cx; oy += cy; } }
          if (!ox && !oy) continue;
          tips.push(tip(n, Math.atan2(oy, ox) + p.random(-0.5, 0.5), 1e9, { L: false })); made++;
        }
      }
    }
    const alive = [], born = [], speed = STEP * 26;
    for (const tp of tips) {
      tp.carry += dt * speed * (tp.L ? 1.3 : 1);
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node;
        let a = tp.ang + hyphaTurn(tp, wander);
        if (tp.target) { const d = Math.hypot(tp.target.x - x, tp.target.y - y); if (d < STEP * 2) tp.target = null; else { let da = Math.atan2(tp.target.y - y, tp.target.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.3; } }
        let rx = 0, ry = 0;
        near(x, y, STEP * 4, (n) => { if (n.tipId === tp.id) return; const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy) || 1; rx += dx / d / d; ry += dy / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(tp.target ? 0.1 : 0.25, Math.hypot(rx, ry) * STEP * 1.5); }
        let nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        // word threads stay inside their letter; page threads stay outside every letter (and out of counters)
        const ok = (tx, ty) => !counter(tx, ty) && (tp.L ? inside(tx, ty) : !inside(tx, ty) || Math.hypot(tx - tp.node.x, ty - tp.node.y) < STEP * 1.1 && tp.len < STEP * 4);
        if (!ok(nx, ny)) {
          let found = false; const side = Math.random() < 0.5 ? -1 : 1;
          for (let k = 1; k <= 8 && !found; k++) for (const sg of [side, -side]) { const a2 = a + sg * k * 0.25, tx = x + Math.cos(a2) * STEP, ty = y + Math.sin(a2) * STEP; if (ok(tx, ty)) { a = a2; nx = tx; ny = ty; found = true; break; } }
          if (!found) { keep = false; break; }
        }
        tp.ang = a;
        if (nx < 2 || ny < 2 || nx > W - 2 || ny > H - 2 || nodes.length >= MAX_NODES) { keep = false; break; }
        let crowd = 0;
        near(nx, ny, STEP * (tp.L ? 2.4 : 3.2), (n) => { if (n.tipId !== tp.id) crowd++; });
        if (!tp.target && crowd > (tp.L ? 7 : Math.round(1 + 3 * dens)) && tp.len > STEP * 5) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.id, tp.L);
        tp.node = n; tp.len += STEP;
        if (tips.length + born.length < MAX_TIPS && Math.random() < branch * (tp.L ? 2.2 : 1)) born.push(tip(n, a + (Math.random() < 0.5 ? -1 : 1) * p.random(0.4, 1.0), tp.L ? geo.fontPx * 0.6 : 1e9));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    // fill what's left: first inside the letters, then the page
    if (env.t - lastFill > 0.2 && tips.length < MAX_TIPS * 0.6) {
      lastFill = env.t;
      gaps(coverL, STEP * 2.6, geo.fontPx * 0.5, 30, true);
      if (env.t > burstAt) gaps(coverP, sp * 0.55, 140, 40, false);
    }
  }

  // ---- signals: nutrients streaming through the threads toward the word ----
  function sendPulse(from) {
    const n = from || nodes[(Math.random() * nodes.length) | 0];
    if (!n) return;
    const path = []; let m = n; while (m && path.length < 600) { path.push(m); m = m.parent; }
    if (path.length > 8) pulses.push({ path, pos: 0, speed: 70 + Math.random() * 60 });
  }
  function sendWave(x, y, big) {
    let best = null, bd = 60;
    near(x, y, 60, (n) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (!best) return;
    // walk the threads outward from that spot (both toward the tips and back toward the word)
    const hop = new Map([[best.id, 0]]), q = [best.id];
    for (let h = 0; h < q.length && q.length < (big ? 30000 : 12000); h++) {
      const n = nodes[q[h]], next = kids[n.id].slice(); if (n.parent) next.push(n.parent.id);
      for (const j of next) if (!hop.has(j)) { hop.set(j, hop.get(n.id) + 1); q.push(j); }
    }
    waves.push({ hop, t0: env.t });
    if (big) for (let k = 0; k < 25; k++) { const ids = [...hop.keys()]; sendPulse(nodes[ids[(Math.random() * ids.length) | 0]]); }
  }
  const wordAlpha = () => { const t = env.t - (burstAt + 0.6); return t <= 0 ? 1 : vis + (1 - vis) * Math.exp(-t / 2.2); };

  // ---- layers (screen only): grown threads are drawn once ----
  let layers = null;
  function layerSet(ink) {
    const d = p.pixelDensity();
    if (!layers || layers.ink !== ink || layers.d !== d) {
      const mk = () => { const c = document.createElement("canvas"); c.width = Math.round(W * d); c.height = Math.round(H * d); const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.lineCap = "round"; x.strokeStyle = ink; return { c, x }; };
      layers = { ink, d, word: mk(), page: mk(), upto: 0 };
    }
    return layers;
  }
  const base = Math.max(0.8, STEP * 0.42), wWord = () => base * 2.1 * (S.weight ?? 1), wPage = () => base * 0.75 * (S.weight ?? 1);
  function drawSegments(ctx, list, w) { ctx.beginPath(); for (const n of list) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = w; ctx.stroke(); }

  return {
    step(dt) {
      grow(dt);
      const rate = signals * 30 * Math.min(1, nodes.length / 3000);
      if (env.t > burstAt && rate > 0 && env.t - lastPulse > 1 / rate) { lastPulse = env.t; sendPulse(); }
      pulses = pulses.filter((pl) => (pl.pos += dt * pl.speed / STEP) < pl.path.length);
      if (env.pointer.active && !env.pointer.down && env.t - lastWave > 1.2) { lastWave = env.t; sendWave(env.pointer.x, env.pointer.y, false); }
      waves = waves.filter((w) => (env.t - w.t0) * 120 < 6000);
    },
    pointerDown(x, y) { sendWave(x, y, true); },
    command() {},
    status() { const t = env.t; return t < burstAt ? "the word is writing itself" : tips.length > 30 ? "the network is overtaking the page" : "alive · hover to send a wave, click to send signals"; },
    render(ctx, screen, ink) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      const wa = wordAlpha();
      if (!screen) {   // export: clean vectors
        drawSegments(ctx, nodes.filter((n) => n.parent && !n.L), wPage());
        ctx.globalAlpha = wa; drawSegments(ctx, nodes.filter((n) => n.parent && n.L), wWord()); ctx.globalAlpha = 1;
        return;
      }
      const Ls = layerSet(ink);
      if (Ls.upto < nodes.length) {
        const nw = [], np = [];
        for (let i = Ls.upto; i < nodes.length; i++) { const n = nodes[i]; if (n.parent) (n.L ? nw : np).push(n); }
        drawSegments(Ls.word.x, nw, wWord()); drawSegments(Ls.page.x, np, wPage());
        Ls.upto = nodes.length;
      }
      ctx.drawImage(Ls.page.c, 0, 0, W, H);
      ctx.globalAlpha = wa; ctx.drawImage(Ls.word.c, 0, 0, W, H); ctx.globalAlpha = 1;
      // growing tips
      ctx.beginPath(); for (const tp of tips) { ctx.moveTo(tp.node.x + base, tp.node.y); ctx.arc(tp.node.x, tp.node.y, base, 0, 6.283); } ctx.fill();
      // signals: a bright head with a fading trail and a soft halo
      for (const pl of pulses) {
        const i = Math.floor(pl.pos);
        for (let k = 6; k >= 0; k--) { const n = pl.path[i - k * 2]; if (!n) continue; ctx.globalAlpha = 0.15 + 0.85 * (1 - k / 6); ctx.beginPath(); ctx.arc(n.x, n.y, base * (0.6 + 1.1 * (1 - k / 6)), 0, 6.283); ctx.fill(); }
        const h = pl.path[i]; if (h) { ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(h.x, h.y, base * 4.5, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // hover / click waves rippling through the web
      for (const wv of waves) {
        const front = (env.t - wv.t0) * 120;
        ctx.beginPath(); for (const [id, h] of wv.hop) { const d = front - h; if (d >= 0 && d < 6) { const n = nodes[id]; if (n.parent) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } } }
        ctx.lineWidth = base * 2.6; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
      }
    },
  };
}
