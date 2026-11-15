// Mycelium Lab · paths engine
// ------------------------------------------------------------------
// Food sources (chips of wood) are colonised and joined by mycelium. It behaves like mycelium,
// not slime mould: a mass of fine hyphae growing only at their tips, building permanent ropes.
//   plan       which foods to join: the shortest network that connects them all (a minimum
//              spanning tree), plus a few extra links when "Connections" is set toward "web"
//   colonise   every food grows a cottony mat of fine aerial hyphae and a few exploring threads
//   seek       for every planned link, a thread sets out from each end toward the other
//              (chemotropism); they wander, branch and avoid crowded ground on the way
//   fuse       when the two threads meet they fuse (anastomosis) and the route becomes a rope:
//              several strands twisted together (a rhizomorph), with fine fuzz along it
//   tidy       once every link is made, many exploring threads that led nowhere withdraw
//   signal     pulses travel along the ropes; hovering sends a wave through the web
// Used by the Paths tab (you place the food) and by the Type tab's "Roped" style
// (food is placed along the centre line of every letter, links follow the strokes).
function createPathsEngine(env, S, opts = {}) {
  const p = env.p, geo = opts.word || null;
  const STEP = 2.2, HC = 8, MAX_NODES = 34000;
  let R, foods, nodes, adj, tips, bridges, hairs, pulses, waves, hash, tipSeq, links, planned, pairs, lastRetry, doneAt, lastPulse, lastWave, grown, wGap;
  const key = (x, y) => ((x / HC) | 0) + "," + ((y / HC) | 0);
  const near = (x, y, r, fn) => {
    const c0 = ((x - r) / HC) | 0, c1 = ((x + r) / HC) | 0, r0 = ((y - r) / HC) | 0, r1 = ((y + r) / HC) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const b = hash.get(cx + "," + cy); if (b) for (const n of b) fn(n); }
  };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const pk = (a, b) => Math.min(a, b) + "-" + Math.max(a, b);

  function reset() {
    foods = []; nodes = []; adj = []; tips = []; bridges = []; hairs = []; pulses = []; waves = []; hash = new Map(); tipSeq = 0;
    links = []; planned = new Set(); pairs = new Set(); lastRetry = 0; doneAt = 0; lastPulse = 0; lastWave = -9; grown = false; wGap = 0;
  }
  function makeFood(x, y, li) {
    const shape = []; for (let k = 0; k < 9; k++) shape.push(p.random(0.7, 1.25));
    return { x, y, li, id: foods.length, shape, r: p.random(5, 8), rot: p.random(Math.PI * 2), space: 99 };
  }

  // ---------- a recipe: your settings, nudged at random by "Variation" ----------
  function recipe() {
    const v = S.variation ?? 0.5, j = (x, s = 0.25) => clamp(x + (Math.random() * 2 - 1) * s * v);
    const r = {
      wander: 0.06 + 0.32 * j(S.wander ?? 0.5), branch: 0.012 + 0.045 * j(S.branching ?? 0.5),
      fluff: 0.15 + 1.45 * j(S.fluff ?? 0.5), explore: j(S.explore ?? 0.5),
      strands: Math.max(1, Math.round((S.strands ?? 3) + (Math.random() * 2 - 1) * v)), twist: 0.04 + 0.2 * j(S.twist ?? 0.5),
      crowd: Math.round(3 + 3 * Math.random()), curl: 0.15 + 0.35 * Math.random(), speed: 0.85 + 0.4 * Math.random(),
    };
    r.seek = 0.06 + 0.12 * (1 - r.wander / 0.38);
    const w = [r.fluff > 1.1 ? "cottony" : r.fluff < 0.6 ? "fine" : "downy", r.wander > 0.26 ? "meandering" : r.wander < 0.14 ? "direct" : "searching",
      r.strands >= 4 ? "thick-roped" : r.strands <= 2 ? "thin-corded" : "roped", r.branch > 0.04 ? "bushy" : "spare"];
    r.label = "#" + Math.floor(1000 + Math.random() * 9000) + " · " + w.join(", ");
    return r;
  }

  // ---------- which foods to link ----------
  function planLinks() {
    links = []; planned = new Set();
    const add = (a, b) => { const k = pk(a.id, b.id); if (planned.has(k) || a === b) return; planned.add(k); links.push({ a, b, k, tries: 0 }); };
    if (geo) {
      // word: neighbours along a stroke (the straight line between them stays inside the letter)
      for (const f of foods) for (const g of foods) {
        if (g.id <= f.id || g.li !== f.li) continue;
        const d = Math.hypot(g.x - f.x, g.y - f.y); if (d > wGap * 2.1) continue;
        let ok = true; for (const u of [0.25, 0.5, 0.75]) if (!geo.inside(f.x + (g.x - f.x) * u, f.y + (g.y - f.y) * u)) ok = false;
        if (ok) add(f, g);
      }
      return;
    }
    // the shortest network joining every food (Prim's minimum spanning tree)
    const n = foods.length; if (n < 2) return;
    const inT = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1);
    best[0] = 0; const lens = [];
    for (let it = 0; it < n; it++) {
      let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i;
      inT[u] = true; if (from[u] >= 0) { add(foods[from[u]], foods[u]); lens.push(best[u]); }
      for (let i = 0; i < n; i++) if (!inT[i]) { const d = Math.hypot(foods[i].x - foods[u].x, foods[i].y - foods[u].y); if (d < best[i]) { best[i] = d; from[i] = u; } }
    }
    // extra links make loops, like a real foraging network ("Connections" toward web)
    const web = S.web ?? 0.3; lens.sort((a, b) => a - b);
    const med = lens[lens.length >> 1] || 100;
    for (const f of foods) {
      const others = foods.filter((g) => g !== f).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y)).slice(0, 3);
      for (const g of others) if (Math.random() < web * 0.7 && Math.hypot(g.x - f.x, g.y - f.y) < med * 2.4) add(f, g);
    }
  }
  function linkNew(f) {   // a food added after growing joins the nearest one (and maybe a second)
    const others = foods.filter((g) => g !== f).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
    const add = (g) => { const k = pk(f.id, g.id); if (planned.has(k)) return; planned.add(k); const l = { a: f, b: g, k, tries: 0 }; links.push(l); seekTip(f, g, k); seekTip(g, f, k); };
    if (others[0]) add(others[0]);
    if (others[1] && Math.random() < (S.web ?? 0.3)) add(others[1]);
  }

  // ---------- growth ----------
  function addNode(x, y, parent, colony, tipId) {
    const n = { x, y, parent, colony, tipId, born: env.t, id: nodes.length, cord: false, dieAt: 0 };
    nodes.push(n); adj.push([]);
    if (parent) { adj[n.id].push(parent.id); adj[parent.id].push(n.id); }
    const k = key(x, y); let b = hash.get(k); if (!b) hash.set(k, (b = [])); b.push(n);
    return n;
  }
  function tip(node, ang, max, target, bound) { return { node, ang, colony: node.colony, id: tipSeq++, len: 0, max, carry: 0, target, bound }; }
  function seekTip(f, g, k) {
    const t = tip(f.root, Math.atan2(g.y - f.y, g.x - f.x) + p.random(-0.4, 0.4), Math.hypot(g.x - f.x, g.y - f.y) * 1.8 + 20, g, !!geo && f.li >= 0 && g.li >= 0);
    t.k = k; tips.push(t);
  }
  function hypha(x, y, h, len, out) {   // one fine aerial hypha: nearly straight, sometimes forking
    const pts = [[x, y]];
    for (let s = 0; s < len; s++) {
      h += p.random(-R.curl, R.curl); x += Math.cos(h) * 1.8; y += Math.sin(h) * 1.8; pts.push([x, y]);
      if (s > 2 && len - s > 3 && p.random() < 0.08) hypha(x, y, h + (p.random() < 0.5 ? -1 : 1) * p.random(0.5, 1), Math.round((len - s) * 0.6), out);
    }
    out.push(pts);
  }
  function spacing(f) { let d = 220; for (const g of foods) if (g !== f && g.li === f.li) d = Math.min(d, Math.hypot(g.x - f.x, g.y - f.y)); return d; }
  function colonise(f) {
    const root = addNode(f.x, f.y, null, f.id, -1); root.root = true; f.root = root;
    const sp = (f.space = spacing(f)), room = Math.min(1, sp / 120);
    // exploring threads (not aimed at anything): they make the network look foraging rather than drawn
    const n = geo ? Math.round(4 * R.explore) : Math.round((3 + 10 * R.explore) * Math.min(1, sp / 70));
    for (let k = 0; k < n; k++) tips.push(tip(root, p.random(Math.PI * 2), geo ? wGap * p.random(0.4, 1.1) : sp < 120 ? p.random(0.6, 1.6) * sp : p.random(50, 200), null, false));
    // cottony mat: fine aerial hyphae around the food, appearing over a few seconds
    const m = Math.max(3, Math.round(110 * R.fluff * room * room)), spread = Math.min(9 + 9 * R.fluff, sp * 0.3);
    for (let k = 0; k < m; k++) {
      const a = p.random(Math.PI * 2), d = Math.abs(p.randomGaussian(0, spread)), out = [];
      hypha(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, a + p.random(-0.5, 0.5), Math.round(p.random(4, 6 + 10 * room)), out);
      for (const pts of out) hairs.push({ pts, born: env.t + p.random(0, 5) });
    }
  }
  function chain(n) { const out = []; while (n) { out.push(n); n = n.parent; } return out; }
  function bridge(a, b) {
    const k = pk(a.colony, b.colony);
    if (a.colony === b.colony || !planned.has(k) || pairs.has(k)) return false;
    pairs.add(k);
    const pts = chain(a).reverse().concat(chain(b));
    for (const n of pts) n.cord = true;
    bridges.push({ pts, t0: env.t, strands: R.strands + (p.random() < 0.35 ? 1 : 0), phase: p.random(Math.PI * 2) });
    for (let i = 2; i < pts.length - 2; i += 4) {   // a little fuzz along the new rope
      if (p.random() > 0.55 * (0.4 + R.fluff)) continue;
      const q = pts[i], out = [];
      hypha(q.x, q.y, p.random(Math.PI * 2), Math.round(p.random(3, 9)), out);
      for (const hp of out) hairs.push({ pts: hp, born: env.t + p.random(0.5, 4) });
    }
    return true;
  }

  function grow(dt) {
    const alive = [], born = [];
    for (const tp of tips) {
      if (tp.node.dieAt) continue;
      tp.carry += dt * 42 * R.speed;
      let keep = true;
      while (tp.carry >= STEP && keep) {
        tp.carry -= STEP;
        const { x, y } = tp.node;
        let a = tp.ang + p.random(-R.wander, R.wander);
        // chemotropism: an aimed thread bends toward its partner food, more firmly as it gets close
        if (tp.target) {
          const g = tp.target, d = Math.hypot(g.x - x, g.y - y);
          let da = Math.atan2(g.y - y, g.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
          a += da * (geo ? 0.22 : R.seek * (1 + 2 * Math.max(0, 1 - d / 60)));
        }
        // avoid its own crowded ground
        let rx = 0, ry = 0;
        near(x, y, 12, (n) => { if (n.tipId === tp.id || n.colony !== tp.colony) return; const dx = x - n.x, dy = y - n.y, dd = Math.hypot(dx, dy) || 1; rx += dx / dd / dd; ry += dy / dd / dd; });
        if (rx || ry) { let da = Math.atan2(ry, rx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += da * Math.min(0.2, Math.hypot(rx, ry) * 2); }
        // threads that build a letter stay inside it: at the edge they turn by the smallest angle that keeps them in
        if (tp.bound && !geo.inside(x + Math.cos(a) * STEP, y + Math.sin(a) * STEP)) {
          let ok = false;
          for (let d = 0.3; d <= 2.1 && !ok; d += 0.3) for (const sg of [1, -1]) if (!ok && geo.inside(x + Math.cos(a + sg * d) * STEP, y + Math.sin(a + sg * d) * STEP)) { a += sg * d; ok = true; }
          if (!ok) { keep = false; break; }
        }
        tp.ang = a;
        const nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
        if (nx < 4 || ny < 4 || nx > env.W - 4 || ny > env.H - 4 || nodes.length >= MAX_NODES) { keep = false; break; }
        // anastomosis: an aimed thread fuses only with its partner's threads; others mesh with anything
        let fuse = null;
        if (tp.len > 12) near(nx, ny, tp.target ? 3.4 : 2.6, (n) => { if (!fuse && (!tp.target || n.colony === tp.target.id) && n.tipId !== tp.id && n !== tp.node && n !== tp.node.parent && !n.dieAt && env.t - n.born > 0.6) fuse = n; });
        if (fuse) {
          adj[tp.node.id].push(fuse.id); adj[fuse.id].push(tp.node.id);
          if (bridge(tp.node, fuse) || p.random() < 0.6) { keep = false; break; }
        }
        let crowd = 0;
        near(nx, ny, 6, (n) => { if (n.tipId !== tp.id && !n.dieAt) crowd++; });
        if (crowd > R.crowd + (tp.target ? 4 : 0) && tp.len > 16) { keep = false; break; }
        const n = addNode(nx, ny, tp.node, tp.colony, tp.id);
        tp.node = n; tp.len += STEP;
        if (tips.length + born.length < 420 && p.random() < R.branch) born.push(tip(n, a + (p.random() < 0.5 ? -1 : 1) * p.random(0.4, 1.0), (tp.target ? Math.min(80, (wGap || 60) * 0.9) : tp.max) * p.random(0.4, 0.85), null, false));
        if (tp.len > tp.max) { keep = false; break; }
      }
      if (keep) alive.push(tp);
    }
    tips = alive.concat(born);
    // a link that failed is tried again (up to 3 times), so no connection goes missing
    const active = new Set(tips.map((t) => t.k));
    if (env.t - lastRetry > 1.5) {
      lastRetry = env.t;
      for (const l of links) if (!pairs.has(l.k) && !active.has(l.k) && l.tries < 3) { l.tries++; seekTip(l.a, l.b, l.k); seekTip(l.b, l.a, l.k); active.add(l.k); }
    }
    const done = links.length && links.every((l) => pairs.has(l.k) || (l.tries >= 3 && !active.has(l.k)));
    // all joined: many exploring threads that led nowhere withdraw (ropes, food mats and the rest stay)
    if (done && !doneAt) {
      doneAt = env.t;
      const sps = foods.map((f) => f.space).sort((a, b) => a - b), gap = Math.min(30, sps[sps.length >> 1] * 0.45);
      for (const n of nodes) {
        if (n.cord || n.root) continue;
        let df = Infinity; for (const f of foods) df = Math.min(df, Math.hypot(f.x - n.x, f.y - n.y));
        if (df > gap && p.random() < 0.55) n.dieAt = env.t + 6 + p.random(0, 10);
      }
    }
  }

  // ---------- public ----------
  function save() { if (!geo) env.store.foods = foods.map((f) => [f.x / env.W, f.y / env.H]); }
  function start() {   // grow from the current foods with a new recipe
    const pts = foods.map((f) => [f.x, f.y, f.li]), g = wGap;
    reset(); wGap = g; R = recipe();
    for (const [x, y, li] of pts) foods.push(makeFood(x, y, li));
    for (const f of foods) colonise(f);
    planLinks();
    for (const l of links) { seekTip(l.a, l.b, l.k); seekTip(l.b, l.a, l.k); }
    grown = true; env.store.grown = true;
  }
  function wordFoods() {   // food along the centre line (the ridge) of every letter
    const out = [];
    geo.letters.forEach((L, li) => {
      const cs = L.cells, g = geo.cell;
      const m = new Map(), hk = (x, y) => Math.floor(x / (g * 2)) + "," + Math.floor(y / (g * 2));
      for (const c of cs) { const k = hk(c.x, c.y); if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
      let md = 0; for (const c of cs) md = Math.max(md, c.depth);
      const ridge = cs.filter((c) => {
        if (c.depth < 1 && md >= 2) return false;
        const bx = Math.floor(c.x / (g * 2)), by = Math.floor(c.y / (g * 2));
        for (let yy = by - 1; yy <= by + 1; yy++) for (let xx = bx - 1; xx <= bx + 1; xx++) for (const n of m.get(xx + "," + yy) || []) if (n.depth > c.depth && Math.hypot(n.x - c.x, n.y - c.y) < g * 1.6) return false;
        return true;
      });
      const gap = Math.max(geo.fontPx * 0.045, (md + 1) * g * 1.5);
      wGap = Math.max(wGap, gap);
      p.shuffle(ridge, true);
      const mine = [];
      for (const c of ridge) if (mine.every((q) => Math.hypot(q[0] - c.x, q[1] - c.y) > gap)) mine.push([c.x, c.y, li]);
      out.push(...mine);
    });
    return out;
  }

  reset(); R = recipe();
  if (geo) { for (const [x, y, li] of wordFoods()) foods.push(makeFood(x, y, li)); start(); }
  else if (env.store.foods && env.store.foods.length) { for (const [fx, fy] of env.store.foods) foods.push(makeFood(fx * env.W, fy * env.H)); if (env.store.grown) start(); }
  else { // first visit: an example, so the page is never empty
    for (let k = 0; k < 6; k++) foods.push(makeFood(p.random(env.W * 0.15, env.W * 0.85), p.random(env.H * 0.15, env.H * 0.85)));
    save(); start();
  }

  return {
    step(dt) {
      if (!grown) return;
      grow(dt);
      if (env.t - lastPulse > 0.3 && bridges.length) { lastPulse = env.t; pulses.push({ b: p.random(bridges), pos: 0, dir: p.random() < 0.5 ? 1 : -1 }); }
      pulses = pulses.filter((pl) => (pl.pos += dt * 60) < pl.b.pts.length);
      if (env.pointer.active && env.t - lastWave > 1.4) { lastWave = env.t; sendWave(); }
      waves = waves.filter((w) => (env.t - w.t0) * 90 < 4000);
    },
    command(c) {
      if (c === "connect") { if (foods.length) start(); }
      if (c === "clear") { reset(); R = recipe(); env.store.grown = false; save(); }
      if (c === "undo") { const pts = foods.slice(0, -1).map((f) => [f.x, f.y]); const was = grown; reset(); R = recipe(); for (const [x, y] of pts) foods.push(makeFood(x, y)); save(); env.store.grown = was && foods.length > 0; if (env.store.grown) start(); }
    },
    pointerDown(x, y) {
      const f = makeFood(x, y, geo ? -1 : undefined); foods.push(f); save();
      if (grown) { colonise(f); linkNew(f); doneAt = 0; }
    },
    status() {
      if (!grown) return foods.length ? `${foods.length} food source${foods.length > 1 ? "s" : ""} placed · press Connect` : "click the canvas to place food sources";
      if (foods.length < 2) return R.label + " · add more food to connect";
      const k = links.filter((l) => pairs.has(l.k)).length;
      return `${R.label} · ${k} of ${links.length} links roped`;
    },
    get grown() { return grown; },
    render,
  };

  function sendWave() {
    let best = null, bd = 50;
    near(env.pointer.x, env.pointer.y, 50, (n) => { if (n.dieAt) return; const d = Math.hypot(n.x - env.pointer.x, n.y - env.pointer.y); if (d < bd) { bd = d; best = n; } });
    if (!best) return;
    const hop = new Map([[best.id, 0]]), q = [best.id];
    for (let h = 0; h < q.length && q.length < 15000; h++) for (const j of adj[q[h]]) if (!hop.has(j) && !nodes[j].dieAt) { hop.set(j, hop.get(q[h]) + 1); q.push(j); }
    waves.push({ hop, t0: env.t });
  }

  // ---------- drawing ----------
  function render(ctx, screen, ink) {
    const t = env.t, wt = S.weight ?? 1;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    const fine = [], fading = [];
    for (const n of nodes) {
      if (!n.parent || n.cord) continue;
      if (n.dieAt && t > n.dieAt) { const k = 1 - (t - n.dieAt) / 5; if (k > 0) fading.push([n, k]); continue; }
      fine.push(n);
    }
    ctx.beginPath(); for (const n of fine) { ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); } ctx.lineWidth = 1 * wt; ctx.stroke();
    for (const [n, k] of fading) { ctx.beginPath(); ctx.moveTo(n.parent.x, n.parent.y); ctx.lineTo(n.x, n.y); ctx.lineWidth = Math.max(0.2, k * wt); ctx.stroke(); }
    // cottony mats and fuzz
    ctx.beginPath();
    for (const h of hairs) {
      const g = Math.min(1, (t - h.born) / 2); if (g <= 0) continue;
      const m = Math.max(2, Math.round(h.pts.length * g));
      ctx.moveTo(h.pts[0][0], h.pts[0][1]); for (let i = 1; i < m; i++) ctx.lineTo(h.pts[i][0], h.pts[i][1]);
    }
    ctx.lineWidth = 0.9 * wt; ctx.stroke();
    // ropes (rhizomorphs): strands twisted around the route, thickening as the rope matures
    for (const b of bridges) {
      const mature = Math.min(1, (t - b.t0) / 8), pts = [];
      for (let i = 0; i < b.pts.length; i += 2) pts.push(b.pts[i]);
      if (pts.length < 2) continue;
      const amp = 0.6 + 2.6 * mature;
      for (let k = 0; k < b.strands; k++) {
        ctx.beginPath(); let u = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
          const tx = c.x - a.x, ty = c.y - a.y, tl = Math.hypot(tx, ty) || 1;
          if (i > 0) u += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          const off = Math.sin(u * R.twist + (k / b.strands) * Math.PI * 2 + b.phase) * amp * Math.min(1, i / 4, (pts.length - 1 - i) / 4);
          const x = pts[i].x - (ty / tl) * off, y = pts[i].y + (tx / tl) * off;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = (1 + 0.5 * mature) * wt; ctx.stroke();
      }
    }
    if (screen) {
      for (const tp of tips) { ctx.beginPath(); ctx.arc(tp.node.x, tp.node.y, 1.1, 0, 6.283); ctx.fill(); }
      for (const pl of pulses) { const L = pl.b.pts.length, i = Math.floor(pl.pos); const n = pl.b.pts[pl.dir > 0 ? i : L - 1 - i]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, 2.4, 0, 6.283); ctx.fill(); } }
      for (const wv of waves) {
        const front = (t - wv.t0) * 90;
        ctx.beginPath(); for (const [id, h] of wv.hop) if (Math.abs(h - front) < 3) { const n = nodes[id]; ctx.moveTo(n.x + 1.6, n.y); ctx.arc(n.x, n.y, 1.6, 0, 6.283); } ctx.fill();
      }
    }
    // food: small irregular chips of wood (dotted ring while you are still placing them)
    for (const f of foods) {
      if (geo && f.li >= 0) continue;   // in a word the food stays hidden: the ropes are the letter
      const s = Math.min(1, Math.max(0.35, f.space / 60));
      ctx.beginPath();
      for (let k = 0; k <= 9; k++) { const a = f.rot + (k / 9) * Math.PI * 2, r = f.r * f.shape[k % 9] * s; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.fill();
      if (screen && !grown) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 16, f.y + Math.sin(a) * 16, 1, 0, 6.283); ctx.fill(); }
    }
  }
}
