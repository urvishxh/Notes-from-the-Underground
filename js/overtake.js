// Mycelium Lab · overtake (type)
// ------------------------------------------------------------------
// A network that grows into the word, then takes over the page.
//   germinate  spores land all over the page (the letters are food the colony can smell)
//   gather     tips grow toward the nearest letter (chemotropism); inside a letter the ground is rich,
//              so threads pack it densely and are drawn heavier: the word appears as the dark heart
//              of the web, while it is still being found
//   fill       the colony keeps sending threads into the parts of the letters it hasn't reached
//   overtake   once the word is full, the colony spreads out until it has covered the page,
//              more sparsely and in finer threads, so the word still reads
// Realistic growth (Growth: Realistic) drops the shortcuts:
//   local scent   a thread only senses a letter when it is close to it (Scent range); far away it forages blind
//   all at once   no phases and no gap-filling planner: colonies spread outward from their own edges all the time
//   density       letters darken because threads branch more where food is rich (plus a cottony aerial layer),
//                 not because the lines get heavier
//   ageing        the food in the letters runs out; old threads there die and break down, so the word
//                 slowly hollows from the inside while its edges keep growing (Ageing)
//   rivals        colonies from different spores refuse to fuse and leave a dark boundary line (Rival colonies)
// Letter form controls:
//   swell      treats the ground just around each letter as part of it: the letters grow fatter and softer
//   counters   keep the holes of a, o, e… free of growth so the word stays legible
function createOvertakeEngine(env, S, geo) {
  const p = env.p, W = env.W, H = env.H;
  const STEP = Math.max(1.6, geo.fontPx / 90), HC = Math.max(6, STEP * 3), MAX_NODES = 90000;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let R, nodes, adj, tips, fusions, hash, tipSeq, phase, lastFill, coverL, coverP, doneAt;
  const REAL = S.growth === "realistic";
  let fed = [], hairs = [], barrage = [], food = null, lastAge = 0, lastExplore = 0, found = new Set(), colonyAt = [];
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };

  // distance from every spot on the page to the nearest letter (a coarse grid), for smelling the food
  const G = 6, gw = Math.ceil(W / G), gh = Math.ceil(H / G), dist = new Float32Array(gw * gh).fill(1e9);
  { const q = [];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (geo.inside(x * G + G / 2, y * G + G / 2)) { dist[y * gw + x] = 0; q.push(y * gw + x); }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % gw, y = (i / gw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const j = Y * gw + X; if (dist[j] > dist[i] + G) { dist[j] = dist[i] + G; q.push(j); } } } }
  const dAt = (x, y) => { const X = Math.min(gw - 1, Math.max(0, (x / G) | 0)), Y = Math.min(gh - 1, Math.max(0, (y / G) | 0)); return dist[Y * gw + X]; };
  const swell = () => (S.swell ?? 0) * geo.fontPx * 0.12;
  const counter = (x, y) => (S.counters ?? true) && geo.inCounter(x, y);
  const inLetter = (x, y) => !counter(x, y) && (geo.inside(x, y) || (swell() > 0 && dAt(x, y) <= swell()));
  const towardLetters = (x, y) => { const d0 = dAt(x, y); let best = null, bd = d0;
    for (const [dx, dy] of [[G, 0], [-G, 0], [0, G], [0, -G], [G, G], [-G, G], [G, -G], [-G, -G]]) { const d = dAt(x + dx, y + dy); if (d < bd) { bd = d; best = Math.atan2(dy, dx); } } return best; };

  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const dens = j(S.density ?? 0.75, 0.15), page = j(S.page ?? 0.5, 0.15);
    const r = {
      branch: 0.015 + 0.05 * j(S.branching ?? 0.5), wander: 0.03 + 0.25 * j(S.wander ?? 0.35),
      crowdIn: Math.round(4 + 7 * dens), crowdOut: Math.round(1 + 3 * page), dens, page,
      gather: 0.03 + 0.2 * j(S.gather ?? 0.6), contrast: S.contrast ?? 0.7, spores: Math.round(S.spores ?? 14),
      sense: geo.fontPx * (0.08 + 0.6 * (S.scent ?? 0.35)), ageing: S.ageing ?? 0.5, rivals: !!S.rivals,
    };
    const w = [r.dens > 0.7 ? "dense" : "open", r.wander > 0.2 ? "wandering" : r.wander < 0.1 ? "straight" : "curving", r.gather > 0.14 ? "hungry" : "drifting", r.page > 0.6 ? "smothering" : "spreading"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }
  function addNode(x, y, parent, tipId, colony) {
    const n = { x, y, parent, tipId, born: env.t, id: nodes.length, inL: inLetter(x, y), colony: colony ?? (parent ? parent.colony : 0), dead: 0 };
    if (REAL && n.inL) {
      fed.push(n);
      for (const [dx, dy] of [[0, 0], [G, 0], [-G, 0], [0, G], [0, -G]]) { const fi = foodIdx(x + dx, y + dy); food[fi] = Math.max(0, food[fi] - 0.07); }   // feeding uses the food up around it
      const li = geo.letterAt(x, y); if (li >= 0) found.add(li);
      if (Math.random() < 0.14 * (0.4 + R.contrast)) {   // cottony aerial hyphae over well-fed ground
        let hx = x, hy = y, h = Math.random() * 6.283; const pts = [[hx, hy]];
        for (let k = 0; k < 4 + ((Math.random() * 6) | 0); k++) { h += (Math.random() - 0.5) * 1.1; hx += Math.cos(h) * STEP * 0.9; hy += Math.sin(h) * STEP * 0.9; pts.push([hx, hy]); }
        hairs.push({ pts, node: n });
      }
    }
    nodes.push(n); adj.push([]);
    if (parent) { adj[n.id].push(parent.id); adj[parent.id].push(n.id); }
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  const newTip = (node, ang, max, target) => ({ node, ang, id: tipSeq++, len: 0, max, carry: 0, target, turn: 0, colony: node.colony });
  const foodIdx = (x, y) => Math.min(gh - 1, Math.max(0, (y / G) | 0)) * gw + Math.min(gw - 1, Math.max(0, (x / G) | 0));
  function spore(x, y) { const col = colonyAt.length; colonyAt.push({ x, y }); const root = addNode(x, y, null, -1, col); root.root = true; const a0 = REAL ? Math.random() * 6.283 : towardLetters(x, y) ?? Math.random() * 6.283, n = REAL ? 5 + ((Math.random() * 3) | 0) : 3 + ((Math.random() * 4) | 0); for (let k = 0; k < n; k++) tips.push(newTip(root, REAL ? a0 + (k / n) * 6.283 : a0 + (k / n - 0.5) * 2.2 + p.random(-0.2, 0.2), 1e9)); }

  function setup() {
    R = recipe(); nodes = []; adj = []; tips = []; fusions = []; hash = new Map(); tipSeq = 0; phase = REAL ? "grow" : "gather"; lastFill = 0; doneAt = 0;
    fed = []; hairs = []; barrage = []; found = new Set(); colonyAt = []; lastAge = 0; lastExplore = 0;
    if (REAL) { food = new Float32Array(gw * gh); for (let i = 0; i < food.length; i++) { const x = (i % gw) * G + G / 2, y = ((i / gw) | 0) * G + G / 2; food[i] = inLetter(x, y) ? 1 : 0; } }
    // points the colony checks for gaps: inside the letters (fine) and across the page (coarser, set by "Overtake the page")
    coverL = []; const sL = Math.max(1, Math.round((STEP * 3) / geo.cell));
    for (const L of geo.letters) for (const c of L.cells) if (((c.x / geo.cell) | 0) % sL === 0 && ((c.y / geo.cell) | 0) % sL === 0 && !counter(c.x, c.y)) coverL.push({ x: c.x, y: c.y });
    if (swell() > 0) for (let y = G / 2; y < H; y += STEP * 3) for (let x = G / 2; x < W; x += STEP * 3) if (!geo.inside(x, y) && inLetter(x, y)) coverL.push({ x, y });
    coverP = []; const sp = 70 - 52 * R.page;
    for (let y = sp / 2; y < H; y += sp) for (let x = sp / 2; x < W; x += sp) { const px = x + p.random(-sp / 3, sp / 3), py = y + p.random(-sp / 3, sp / 3); if (!inLetter(px, py) && !counter(px, py)) coverP.push({ x: px, y: py }); }
    // spores land all over the page, away from the letters
    let made = 0;
    for (let k = 0; k < 400 && made < R.spores; k++) { const x = p.random(W * 0.03, W * 0.97), y = p.random(H * 0.03, H * 0.97); if (REAL || dAt(x, y) > geo.fontPx * 0.25) { spore(x, y); made++; } }
  }
  // send a thread from the nearest part of the network toward a spot
  function reach(x, y, radius) {
    let best = null, bd = radius;
    near(x, y, radius, (n) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (best && bd > STEP * 1.5) { tips.push(newTip(best, Math.atan2(y - best.y, x - best.x) + p.random(-0.3, 0.3), bd * 1.7 + 30, { x, y })); return true; }
    return !!best;
  }
  function gaps(list, r, radius, max) {
    const sample = Array.from({ length: Math.min(500, list.length) }, () => list[(Math.random() * list.length) | 0]);
    const empty = sample.filter((c) => { let hit = false; near(c.x, c.y, r, (n) => { if (!hit && Math.hypot(n.x - c.x, n.y - c.y) < r) hit = true; }); return !hit; });
    p.shuffle(empty, true); let sent = 0;
    for (const c of empty) { if (sent >= max) break; if (reach(c.x, c.y, radius)) sent++; }
    return sample.length ? empty.length / sample.length : 0;
  }

  function grow(dt) {
    const alive = [], born = [], speed = STEP * 14;
    for (const tp of tips) {
      tp.carry += dt * speed;
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node, here = tp.node.inL;
        let a = tp.ang + hyphaTurn(tp, R.wander);
        if (tp.target) {   // a thread sent to fill a gap heads for it
          const d = Math.hypot(tp.target.x - x, tp.target.y - y);
          if (d < STEP * 2) tp.target = null; else { let da = Math.atan2(tp.target.y - y, tp.target.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * 0.3; }
        } else if (REAL) {   // the letters can only be smelled close by
          const d = dAt(x, y);
          if (!here && d < R.sense) { const t = towardLetters(x, y); if (t !== null) { let da = t - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * R.gather * (1 - d / R.sense); } }
        } else if (!here && phase === "gather") {   // smell the letters
          const t = towardLetters(x, y);
          if (t !== null) { let da = t - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * R.gather; }
        }
        // avoid crowded ground
        let rx = 0, ry = 0;
        near(x, y, STEP * 5, (n) => { if (n.tipId === tp.id || n.dead) return; const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy) || 1, k = REAL && R.rivals && n.colony !== tp.colony ? 3 : 1; rx += (k * dx) / d / d; ry += (k * dy) / d / d; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(tp.target ? 0.1 : 0.22, Math.hypot(rx, ry) * STEP * 1.5); }
        let nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        // counters stay clear; while gathering, a thread inside a letter stays inside it (the outline gets drawn)
        if (counter(nx, ny) || (here && phase === "gather" && !tp.target && !inLetter(nx, ny))) {
          let found = false; const side = Math.random() < 0.5 ? -1 : 1;
          for (let k = 1; k <= 8 && !found; k++) for (const sg of [side, -side]) { const a2 = a + sg * k * 0.25, tx = x + Math.cos(a2) * STEP, ty = y + Math.sin(a2) * STEP; if (!counter(tx, ty) && (!here || phase !== "gather" || inLetter(tx, ty))) { a = a2; nx = tx; ny = ty; found = true; break; } }
          if (!found) { keep = false; break; }
        }
        tp.ang = a;
        if (nx < 2 || ny < 2 || nx > W - 2 || ny > H - 2 || nodes.length >= MAX_NODES) { keep = false; break; }
        let fuse = null;
        if (tp.len > STEP * 10 && !tp.target) near(nx, ny, STEP * 1.25, (n) => { if (!fuse && !n.dead && n.tipId !== tp.id && n !== tp.node && n !== tp.node.parent && env.t - n.born > 1.2) fuse = n; });
        if (fuse && REAL && R.rivals && fuse.colony !== tp.colony) {   // strangers don't fuse: a dark boundary line forms
          barrage.push([tp.node.x, tp.node.y, fuse.x, fuse.y]); keep = false; break;
        }
        if (fuse) { adj[tp.node.id].push(fuse.id); adj[fuse.id].push(tp.node.id); fusions.push([tp.node, fuse]); if (Math.random() < (inLetter(nx, ny) ? 0.6 : 0.8)) { keep = false; break; } }
        let crowd = 0; const inN = inLetter(nx, ny);
        near(nx, ny, STEP * (inN ? 2.7 : 3.5), (n) => { if (n.tipId !== tp.id && !n.dead) crowd++; });
        if (!tp.target && crowd > (inN ? R.crowdIn * (REAL ? 1.6 : 1) : R.crowdOut + (REAL ? 1 : 0)) && tp.len > STEP * 6) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.id);
        if (tp.node.dead) { keep = false; break; }
        tp.node = n; tp.len += STEP;
        const rich = REAL && inN ? food[foodIdx(nx, ny)] : 0;
        if (REAL && inN && !tp.node.parent.inL) for (let k = 0; k < 2; k++) born.push(newTip(n, a + p.random(-1.2, 1.2), geo.fontPx * p.random(0.5, 1.2)));   // arriving on food: a burst of branches
        if (tips.length + born.length < 420 && Math.random() < R.branch * (REAL ? (inN ? 1 + 3 * R.contrast * rich : 0.6) : inN ? 1.2 : phase === "gather" ? 0.35 : 0.8)) born.push(newTip(n, a + (Math.random() < 0.5 ? -1 : 1) * p.random(0.45, 1.1), inN ? geo.fontPx * p.random(0.6, 1.4) : 1e9));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    if (REAL) { growReal(); return; }
    // fill the gaps: first the letters, then (once they are full) the whole page
    if (env.t > 2 && env.t - lastFill > 0.6 && tips.length < 120) {
      lastFill = env.t;
      if (phase === "gather") {
        const emptyL = gaps(coverL, STEP * (3.4 - 1.4 * R.dens), geo.fontPx * 0.5, 10);
        if (emptyL < 0.05 - 0.04 * R.dens || env.t > 40) phase = "overtake";
      } else if (phase === "overtake") {
        const emptyP = gaps(coverP, (70 - 52 * R.page) * 0.55, 160, 14);
        if (emptyP < 0.04 && !tips.length) { phase = "done"; doneAt = env.t; }
      }
    }
  }

  // realistic: colonies keep spreading from their own young edges; food runs out and old threads in it die
  function growReal() {
    if (tips.length < 90 && nodes.length < MAX_NODES && env.t - lastExplore > 0.3) {
      lastExplore = env.t;
      for (let k = 0; k < 16; k++) {
        // half the effort goes where the food is (exploitation), the rest to the colony's edges (exploration)
        const n = fed.length && Math.random() < 0.5 ? fed[(Math.random() * fed.length) | 0] : nodes[(Math.random() * nodes.length) | 0];
        if (!n || n.dead || (n.inL && food[foodIdx(n.x, n.y)] < 0.1)) continue;
        let c = 0; near(n.x, n.y, STEP * 4, (m) => { if (!m.dead && m.tipId !== n.tipId) c++; });   // free ground around it (its own thread doesn't count)
        if (c > (n.inL ? R.crowdIn * 2 : R.crowdOut)) continue;
        const o = colonyAt[n.colony], out = Math.atan2(n.y - o.y, n.x - o.x);
        tips.push(newTip(n, out + p.random(-1, 1), n.inL ? geo.fontPx * p.random(0.4, 1) : p.random(60, 220)));
      }
    }
    if (R.ageing > 0 && env.t - lastAge > 0.5) {
      lastAge = env.t;
      const life = 110 - 85 * R.ageing;   // how long a thread lives on exhausted food
      for (const n of nodes) if (n.inL && !n.dead && !n.root && env.t - n.born > life && food[foodIdx(n.x, n.y)] < 0.25 && Math.random() < 0.03 + 0.12 * R.ageing) n.dead = env.t;
    }
  }

  setup();
  let drag = null;
  return {
    step(dt) { grow(dt); },
    pointerDown(x, y) { drag = { x, y }; spore(x, y); },
    pointerDrag(x, y) { if (drag && Math.hypot(x - drag.x, y - drag.y) > 30) { drag = { x, y }; spore(x, y); } },
    pointerUp() { drag = null; },
    command(c) { if (c === "fill") { phase = phase === "gather" ? "gather" : "overtake"; lastFill = 0; } },
    status() { if (REAL) return `${R.label} · realistic · found ${found.size} of ${geo.letters.length} letters${R.ageing > 0 && nodes.some((n) => n.dead) ? " · ageing" : ""}`; return `${R.label} · ${phase === "gather" ? "finding the word" : phase === "overtake" ? "overtaking the page" : "overtaken"}`; },
    render(ctx, screen, ink) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      if (screen && S.guide) { ctx.globalAlpha = 0.08; geo.drawText(ctx); ctx.globalAlpha = 1; }
      // threads in the letters are heavier; threads on the page are finer ("Word contrast")
      const base = Math.max(0.7, STEP * 0.4) * (S.weight ?? 1), wIn = REAL ? base : base * (1.2 + 2.6 * R.contrast), wOut = REAL ? base * 0.8 : base * (1 - 0.6 * R.contrast);
      if (REAL) {
        // threads that died in exhausted food fade away; cottony hyphae sit over well-fed letters
        ctx.globalAlpha = 0.5; ctx.beginPath();
        for (const h of hairs) { if (h.node.dead) continue; ctx.moveTo(h.pts[0][0], h.pts[0][1]); for (let i = 1; i < h.pts.length; i++) ctx.lineTo(h.pts[i][0], h.pts[i][1]); }
        ctx.lineWidth = base * 0.5; ctx.stroke(); ctx.globalAlpha = 1;
        const fading = new Map();
        for (const n of nodes) if (n.parent && n.dead) { const k = Math.round(Math.max(0, 1 - (env.t - n.dead) / 6) * 5) / 5; if (k > 0) { let b = fading.get(k); if (!b) fading.set(k, (b = [])); b.push(n); } }
        for (const [k, list] of fading) { ctx.globalAlpha = k; ctx.beginPath(); for (const n of list) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = base * 0.8; ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (barrage.length) { ctx.beginPath(); for (const [a, b, c, d] of barrage) { ctx.moveTo(a, b); ctx.lineTo(c, d); } ctx.lineWidth = base * 3; ctx.stroke(); }
      }
      ctx.beginPath(); for (const n of nodes) if (n.parent && !n.inL && !n.dead) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); }
      for (const [a, b] of fusions) if ((!a.inL || !b.inL) && !a.dead && !b.dead) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.lineWidth = wOut; ctx.stroke();
      ctx.beginPath(); for (const n of nodes) if (n.parent && n.inL && !n.dead) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); }
      for (const [a, b] of fusions) if (a.inL && b.inL && !a.dead && !b.dead) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.lineWidth = wIn; ctx.stroke();
      for (const n of nodes) if (n.root) { ctx.beginPath(); ctx.arc(n.x, n.y, wOut * 2.2, 0, 6.283); ctx.fill(); }
      if (screen) for (const tp of tips) { if (tp.node.dead) continue; ctx.beginPath(); ctx.arc(tp.node.x, tp.node.y, Math.max(1, wOut), 0, 6.283); ctx.fill(); }
    },
  };
}
