// Mycelium Lab · app
// Tabs, controls, the canvas loop (p5.js, instance mode), pointer input, tracing image and export.
(() => {
  const $ = (s) => document.querySelector(s);
  const FONTS = ["Space Grotesk", "Satoshi", "Inter", "Roboto", "Roboto Condensed", "Roboto Mono", "IBM Plex Sans", "IBM Plex Serif", "Fraunces", "Playfair Display", "Archivo Black", "DM Serif Display", "Syne", "Instrument Serif", "Unbounded", "Bricolage Grotesque"];
  const fontOpts = () => FONTS.map((f) => [f, f]);
  const pct = (v) => Math.round(v * 100) + "%";
  const times = (v) => v.toFixed(1) + "×";

  // ---------- the three tabs: their settings and controls ----------
  // type: text | select | range | toggle | button | section | note | font | trace
  // regrow: true means a change starts the growth again (others change the picture live)
  const TABS = {
    type: {
      name: "Type",
      about: "Type a word: mycelium grows through the letters. Woven fills each letter like a lab culture; Outgrowth packs the letters dark and grows threads out of them that thin as they go; Roped traces each stroke with cords. Drag on the canvas to grow mycelium into any space.",
      defaults: { text: "mycelium", font: "Space Grotesk", fontWeight: 700, size: 0.85, tracking: 0, structure: "woven", spill: 0.25, density: 0.7, branching: 0.5, wander: 0.35, cords: 0.5, weight: 1, variation: 0.5, counters: true, guide: false, brush: 18, fluff: 0.4, strands: 3, twist: 0.5, explore: 0.5, reach: 0.5, taper: 0.5, connect: 0.6 },
      controls: [
        { type: "button", label: "Grow again", cmd: "regrow", primary: true, hint: "Same settings, a new random growth" },
        { type: "section", label: "Word" },
        { type: "text", key: "text", label: "Word (Enter for a new line, up to 4)", regrow: true },
        { type: "font", key: "font", label: "Font", regrow: true },
        { type: "select", key: "fontWeight", label: "Font weight", options: [[300, "Light"], [400, "Regular"], [500, "Medium"], [700, "Bold"], [900, "Black"]], regrow: true },
        { type: "range", key: "size", label: "Size", min: 0.3, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "tracking", label: "Letter spacing", min: -0.1, max: 0.8, step: 0.01, fmt: (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%", regrow: true },
        { type: "section", label: "Growth" },
        { type: "select", key: "structure", label: "Structure", options: [["woven", "Woven: a culture fills each letter"], ["outgrowth", "Outgrowth: grows out of the letters"], ["roped", "Roped: cords trace each stroke"]], regrow: true },
        { type: "range", key: "spill", label: "Spill past the outline", min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.03 ? "bound" : pct(v)), regrow: true, when: (S) => S.structure === "woven" },
        { type: "range", key: "density", label: "Density", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure !== "roped" },
        { type: "range", key: "reach", label: "How far it grows out", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure === "outgrowth" },
        { type: "range", key: "connect", label: "Letters reach for each other", min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.02 ? "off" : pct(v)), regrow: true, when: (S) => S.structure === "outgrowth" },
        { type: "range", key: "taper", label: "Thinning as it grows out", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure === "outgrowth" },
        { type: "range", key: "branching", label: "Branching", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "wander", label: "Wander", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "cords", label: "Cords (thick routes)", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure === "woven" },
        { type: "range", key: "fluff", label: "Fluff", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure === "roped" },
        { type: "range", key: "strands", label: "Rope strands", min: 1, max: 6, step: 1, fmt: (v) => String(v), regrow: true, when: (S) => S.structure === "roped" },
        { type: "range", key: "twist", label: "Twist", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.structure === "roped" },
        { type: "range", key: "weight", label: "Thread weight", min: 0.4, max: 2.5, step: 0.05, fmt: times },
        { type: "range", key: "variation", label: "Variation between runs", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "toggle", key: "counters", label: "Keep counters open (a, o, e…)", regrow: true, when: (S) => S.structure !== "roped" },
        { type: "toggle", key: "guide", label: "Show a faint letter guide" },
        { type: "section", label: "Paint with mycelium", when: (S) => S.structure !== "roped" },
        { type: "note", text: "Drag on the canvas: the network grows into the area you paint, from its nearest threads.", when: (S) => S.structure !== "roped" },
        { type: "range", key: "brush", label: "Brush size", min: 6, max: 60, step: 1, fmt: (v) => v + " px", when: (S) => S.structure !== "roped" },
        { type: "button", label: "Fill gaps now", cmd: "fill", when: (S) => S.structure !== "roped" },
        { type: "button", label: "Clear painting", cmd: "regrow", when: (S) => S.structure !== "roped" },
        { type: "note", text: "Click the canvas to add food: it joins the nearest cord.", when: (S) => S.structure === "roped" },
      ],
      create: (env, S) => (S.structure === "roped" ? createPathsEngine(env, S, { word: env.geo }) : createWovenEngine(env, S, env.geo)),
    },
    network: {
      name: "Network",
      about: "A fungus on a blank page. Spores sprout, threads explore, fuse into one network, find food, thicken into cords, and idle threads die back. Click to drop food; hover to send a signal through the network.",
      defaults: { start: "spores", spores: 3, food: 7, reach: 0.5, density: 0.5, branching: 0.5, wander: 0.35, cords: 0.5, weight: 1, variation: 0.5, prune: true, showFood: true },
      controls: [
        { type: "button", label: "New network", cmd: "regrow", primary: true, hint: "New positions, new random recipe" },
        { type: "section", label: "Colony" },
        { type: "select", key: "start", label: "Start from", options: [["spores", "Scattered spores"], ["dish", "One colony in the centre (like a petri dish)"]], regrow: true },
        { type: "range", key: "spores", label: "Spores", min: 1, max: 8, step: 1, fmt: String, regrow: true, when: (S) => S.start !== "dish" },
        { type: "range", key: "food", label: "Food sources", min: 0, max: 16, step: 1, fmt: String, regrow: true },
        { type: "range", key: "reach", label: "Reach", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "density", label: "Density", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "branching", label: "Branching", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "wander", label: "Wander", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "cords", label: "Cords (thick routes)", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "weight", label: "Thread weight", min: 0.4, max: 2.5, step: 0.05, fmt: times },
        { type: "range", key: "variation", label: "Variation between runs", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "toggle", key: "prune", label: "Unused threads die back", regrow: true },
        { type: "toggle", key: "showFood", label: "Show food rings" },
      ],
      create: (env, S) => createNetworkEngine(env, S),
    },
    paths: {
      name: "Paths",
      about: "Click to place food sources, then press Connect: each one is colonised, the mycelium forages until it has joined them all, and the busy routes thicken into cords. Upload a sketch to trace your points on it.",
      defaults: { growth: "forage", web: 0.3, wander: 0.35, branching: 0.4, explore: 0.5, fluff: 0.5, strands: 3, twist: 0.5, weight: 1, variation: 0.5 },
      controls: [
        { type: "button", label: "Connect", cmd: "connect", primary: true, hint: "Grow mycelium between your food sources (a new random result each time)" },
        { type: "button", label: "Undo last point", cmd: "undo" },
        { type: "button", label: "Clear all points", cmd: "clear" },
        { type: "note", text: "Click the canvas to place food. Points added after connecting join the network on their own." },
        { type: "section", label: "Trace a sketch" },
        { type: "trace" },
        { type: "section", label: "Style" },
        { type: "select", key: "growth", label: "Growth", options: [["forage", "Realistic: forage, then prune"], ["planned", "Planned: straight to the shortest links"]], regrow: true },
        { type: "note", text: "Realistic: the fungus doesn't know where the food is. It explores, joins whatever it reaches, thickens the routes that carry food and lets the rest die back. Slower, truer.", when: (S) => S.growth === "forage" },
        { type: "range", key: "web", label: "Connections: efficient ↔ web", min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.05 ? "efficient" : pct(v)), regrow: true },
        { type: "range", key: "wander", label: "Wander", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "branching", label: "Branching", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "explore", label: "Exploring threads", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "fluff", label: "Fluff (cottony mats)", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "strands", label: "Rope strands", min: 1, max: 6, step: 1, fmt: String, regrow: true },
        { type: "range", key: "twist", label: "Twist (0 = threads bundled side by side)", min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.02 ? "bundled" : pct(v)), regrow: true },
        { type: "range", key: "weight", label: "Thread weight", min: 0.4, max: 2.5, step: 0.05, fmt: times },
        { type: "range", key: "variation", label: "Variation between runs", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
      ],
      create: (env, S) => (S.growth === "planned" ? createPathsEngine(env, S) : createForageEngine(env, S)),
    },
    text: {
      name: "Text",
      about: "Write a paragraph and it grows like mycelium: every thread is a line of your text. Branches are set smaller and lighter, letters shrink and spread apart as they grow, and finally dissolve into bare threads. Click the canvas to plant more text.",
      defaults: { text: "Beneath the forest floor a quiet network threads through the dark, joining root to root and tree to tree. It carries water, sugar, warnings and memory. Nothing here grows alone; everything that thrives is connected.", font: "Fraunces", fontWeight: 600, size: 30, measure: 0.4, style: "web", curve: 0.6, join: 0.6, sprouts: 16, branching: 0.5, wander: 0.35, shrink: 0.55, spread: 0.5, reach: 0.7, fade: false, threads: true, weight: 1, variation: 0.5 },
      controls: [
        { type: "button", label: "Grow again", cmd: "regrow", primary: true, hint: "Same settings, a new random growth" },
        { type: "section", label: "Text" },
        { type: "text", key: "text", label: "Your paragraph", rows: 5, regrow: true },
        { type: "font", key: "font", label: "Font", regrow: true },
        { type: "select", key: "fontWeight", label: "Font weight", options: [[300, "Light"], [400, "Regular"], [500, "Medium"], [700, "Bold"], [900, "Black"]], regrow: true },
        { type: "range", key: "size", label: "Text size", min: 10, max: 72, step: 1, fmt: (v) => v + " px", regrow: true },
        { type: "section", label: "Composition" },
        { type: "select", key: "style", label: "Style", options: [["web", "Web: strands sweep, split and rejoin"], ["unravel", "Unravel: the paragraph's lines grow on and fray"], ["colony", "Colony: threads radiate from the first word"], ["mat", "Mat: the page woven from fine text"]], regrow: true },
        { type: "range", key: "measure", label: "Paragraph width", min: 0.15, max: 0.7, step: 0.01, fmt: pct, regrow: true, when: (S) => S.style === "unravel" },
        { type: "range", key: "sprouts", label: "Sprouts", min: 1, max: 40, step: 1, fmt: String, regrow: true },
        { type: "range", key: "curve", label: "Curviness of the current", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.style === "web" },
        { type: "range", key: "join", label: "Strands rejoin", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true, when: (S) => S.style === "web" },
        { type: "section", label: "Growth" },
        { type: "range", key: "branching", label: "Branching", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "wander", label: "Wander", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "shrink", label: "Letters get smaller", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "spread", label: "Letters spread apart (tracking)", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "reach", label: "Reach", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "range", key: "variation", label: "Variation between runs", min: 0, max: 1, step: 0.01, fmt: pct, regrow: true },
        { type: "toggle", key: "fade", label: "Fade with distance", regrow: true },
        { type: "toggle", key: "threads", label: "Show the threads under the text", when: (S) => S.style !== "unravel" },
        { type: "note", text: "Click the canvas to plant more text: six threads sprout from where you click. When letters get too small to read, the thread carries on as a bare hypha." },
      ],
      create: (env, S) => createTextEngine(env, S),
    },
  };

  // ---------- state ----------
  const settings = {}, stores = {};
  for (const [id, T] of Object.entries(TABS)) { settings[id] = { ...T.defaults }; stores[id] = {}; }
  let tab = "type", format = "fit", theme = "paper", speed = 1, paused = false, panelOpen = true;
  const trace = { src: "", opacity: 0.45 };
  const THEMES = { paper: { bg: "#f3f0e8", ink: "#161616" }, night: { bg: "#0d0f0d", ink: "#ebe6d8" } };
  const env = { p: null, W: 800, H: 600, t: 0, dt: 0, pointer: { x: 0, y: 0, active: false, down: false }, store: null, geo: null };
  let engine = null, buildId = 0;

  // ---------- hash: remembers tab (and the word) in the address, so links open the same view ----------
  function readHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [t, w] = h.split("/");
    if (TABS[t]) tab = t;
    if (w) settings.type.text = w.replace(/\|/g, "\n");
  }
  function writeHash() { history.replaceState(null, "", "#" + tab + (tab === "type" ? "/" + encodeURIComponent(settings.type.text.replace(/\n/g, "|")) : "")); }

  // ---------- canvas size ----------
  function size() {
    const area = $("#stage").getBoundingClientRect();
    const aw = Math.max(200, area.width - 32), ah = Math.max(200, area.height - 32);
    let W = aw, H = ah;
    const ratio = { a4: 297 / 210, a4l: 210 / 297, square: 1 }[format];
    if (ratio) { W = Math.min(aw, ah / ratio); H = W * ratio; }
    return { W: Math.round(Math.min(W, 1800)), H: Math.round(Math.min(H, 1800)) };
  }

  // ---------- (re)start the current tab ----------
  async function build() {
    const id = ++buildId, T = TABS[tab], S = settings[tab];
    env.store = stores[tab]; env.t = 0;
    if (S.font) { try { await document.fonts.load(`${S.fontWeight} 100px "${S.font}"`); } catch (e) {} }
    if (id !== buildId) return;
    if (tab === "type") {
      env.geo = buildGeometry({ W: env.W, H: env.H, text: S.text, family: S.font, weight: S.fontWeight, size: S.size, tracking: S.tracking || 0 });
    } else env.geo = null;
    engine = T.create(env, S);
    updateTrace();
  }
  let regrowT;
  const regrowSoon = () => { clearTimeout(regrowT); regrowT = setTimeout(build, 250); };

  // ---------- p5: the canvas and the animation loop ----------
  new p5((p) => {
    env.p = p;
    p.setup = () => {
      const s = size(); env.W = s.W; env.H = s.H;
      const c = p.createCanvas(env.W, env.H); c.parent("canvas-host");
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      bindPointer(c.elt);
      build();
    };
    let lastStatus = 0;
    p.draw = () => {
      const dt = paused ? 0 : Math.min(0.1, p.deltaTime / 1000) * speed;
      env.dt = dt; env.t += dt;
      if (engine && dt > 0) engine.step(dt);
      p.background(THEMES[theme].bg);
      if (engine) engine.render(p.drawingContext, true, THEMES[theme].ink);
      if (p.millis() - lastStatus > 250) {
        lastStatus = p.millis();
        const s = Math.floor(env.t);
        $("#status").textContent = `${TABS[tab].name} · ${engine ? engine.status() : "…"} · ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}${paused ? " · paused" : ""}`;
      }
    };
    let rt;
    p.windowResized = () => { clearTimeout(rt); rt = setTimeout(resize, 200); };
  });
  function resize() {
    if (rec) return;   // keep the canvas size fixed while a clip is recording
    const s = size();
    if (s.W === env.W && s.H === env.H) { updateTrace(); return; }
    env.W = s.W; env.H = s.H; env.p.resizeCanvas(env.W, env.H); build();
  }

  // ---------- pointer ----------
  function bindPointer(el) {
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * env.W, y: ((e.clientY - r.top) / r.height) * env.H }; };
    el.addEventListener("pointerdown", (e) => {
      const q = pos(e); env.pointer.down = true; el.setPointerCapture(e.pointerId);
      if (engine && engine.pointerDown) engine.pointerDown(q.x, q.y);
    });
    el.addEventListener("pointermove", (e) => {
      const q = pos(e); env.pointer.x = q.x; env.pointer.y = q.y; env.pointer.active = true;
      if (env.pointer.down && engine && engine.pointerDrag) engine.pointerDrag(q.x, q.y);
    });
    const up = () => { env.pointer.down = false; if (engine && engine.pointerUp) engine.pointerUp(); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", () => { env.pointer.active = false; });
  }

  // ---------- tracing image (Paths) ----------
  const traceEl = $("#trace");
  function updateTrace() {
    const on = tab === "paths" && !!trace.src;
    traceEl.hidden = !on; if (!on) return;
    if (traceEl.getAttribute("src") !== trace.src) traceEl.src = trace.src;
    const c = $("#canvas-host canvas"); if (!c) return;
    Object.assign(traceEl.style, { width: c.style.width || c.width + "px", height: c.style.height || c.height + "px", left: c.offsetLeft + "px", top: c.offsetTop + "px", opacity: trace.opacity, mixBlendMode: theme === "night" ? "screen" : "multiply" });
  }

  // ---------- controls ----------
  function renderTabs() {
    for (const b of document.querySelectorAll("#tabs button")) { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }
    $("#about").textContent = TABS[tab].about;
  }
  function renderControls() {
    const box = $("#controls"), S = settings[tab];
    box.innerHTML = "";
    let idn = 0;
    for (const c of TABS[tab].controls) {
      if (c.when && !c.when(S)) continue;
      const id = "c" + idn++;
      if (c.type === "section") { const h = document.createElement("h3"); h.textContent = c.label; box.appendChild(h); continue; }
      if (c.type === "note") { const n = document.createElement("p"); n.className = "note"; n.textContent = c.text; box.appendChild(n); continue; }
      if (c.type === "button") {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (c.primary ? " primary" : ""); b.textContent = c.label; if (c.hint) b.title = c.hint;
        b.addEventListener("click", () => { if (c.cmd === "regrow") build(); else if (engine && engine.command) engine.command(c.cmd); });
        box.appendChild(b); continue;
      }
      if (c.type === "trace") { traceControls(box); continue; }
      const f = document.createElement("div"); f.className = "field";
      const lab = document.createElement("label"); lab.htmlFor = id; lab.textContent = c.label; f.appendChild(lab);
      const changed = () => { if (c.regrow) regrowSoon(); if (c.key === "text") writeHash(); if (c.type === "select") renderControls(); };
      if (c.type === "text") {
        const t = document.createElement("textarea"); t.id = id; t.rows = c.rows || 2; t.value = S[c.key]; t.spellcheck = false;
        t.addEventListener("input", () => { S[c.key] = c.rows ? t.value : t.value.split("\n").slice(0, 4).join("\n"); changed(); });
        f.appendChild(t);
      } else if (c.type === "select" || c.type === "font") {
        const sel = document.createElement("select"); sel.id = id;
        const opts = c.type === "font" ? fontOpts() : c.options;
        for (const [v, t] of opts) { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
        sel.value = S[c.key];
        sel.addEventListener("change", () => {
          S[c.key] = typeof S[c.key] === "number" ? +sel.value : sel.value; changed();
        });
        f.appendChild(sel);
        if (c.type === "font") fontUpload(f, c.key);
      } else if (c.type === "range") {
        const row = document.createElement("div"); row.className = "range";
        const inp = document.createElement("input"); inp.type = "range"; inp.id = id; inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.value = S[c.key];
        const out = document.createElement("output"); out.textContent = c.fmt(S[c.key]);
        inp.addEventListener("input", () => { S[c.key] = +inp.value; out.textContent = c.fmt(S[c.key]); changed(); });
        row.append(inp, out); f.appendChild(row);
      } else if (c.type === "toggle") {
        f.className = "field toggle";
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = id; cb.checked = !!S[c.key];
        cb.addEventListener("change", () => { S[c.key] = cb.checked; changed(); });
        f.insertBefore(cb, lab);
      }
      box.appendChild(f);
    }
  }
  function traceControls(box) {
    const file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true; file.id = "trace-file"; box.appendChild(file);
    const up = document.createElement("button"); up.type = "button"; up.className = "btn"; up.textContent = trace.src ? "Upload a different image" : "Upload an image to trace";
    up.addEventListener("click", () => file.click()); box.appendChild(up);
    file.addEventListener("change", () => {
      const f = file.files && file.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { trace.src = rd.result; if (engine && engine.grown) engine.command("clear"); updateTrace(); renderControls(); };
      rd.readAsDataURL(f);
    });
    if (!trace.src) { const n = document.createElement("p"); n.className = "note"; n.textContent = "The image sits faintly on the canvas like tracing paper. It's a guide only: it's never exported."; box.appendChild(n); return; }
    const f = document.createElement("div"); f.className = "field";
    f.innerHTML = '<label for="trace-op">Image strength</label><div class="range"><input id="trace-op" type="range" min="0.1" max="1" step="0.05"><output></output></div>';
    const inp = f.querySelector("input"), out = f.querySelector("output");
    inp.value = trace.opacity; out.textContent = pct(trace.opacity);
    inp.addEventListener("input", () => { trace.opacity = +inp.value; out.textContent = pct(trace.opacity); updateTrace(); });
    box.appendChild(f);
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "btn"; rm.textContent = "Remove image";
    rm.addEventListener("click", () => { trace.src = ""; updateTrace(); renderControls(); });
    box.appendChild(rm);
  }
  // Upload a font: a real button (a label for a file input in the page), so every browser opens the
  // file picker, including Safari and the claude.ai preview. You can also drop a font file on it.
  const uploaded = new Set();
  function fontUpload(field, key) {
    const id = "font-file";
    const inp = document.createElement("input"); inp.type = "file"; inp.id = id; inp.className = "visually-hidden";
    inp.accept = ".ttf,.otf,.woff,.woff2";
    const lab = document.createElement("label"); lab.htmlFor = id; lab.className = "btn upload"; lab.textContent = "Upload a font file (.ttf .otf .woff .woff2)";
    lab.tabIndex = 0; lab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
    const msg = document.createElement("p"); msg.className = "note"; msg.setAttribute("aria-live", "polite");
    if (uploaded.has(settings[tab][key])) msg.textContent = "Using your font: " + settings[tab][key];
    const use = async (file) => {
      if (!file) return;
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) { msg.textContent = "That isn't a font file. Use a .ttf, .otf, .woff or .woff2 file."; return; }
      msg.textContent = "Loading " + file.name + "…";
      let name = file.name.replace(/\.[^.]+$/, "").replace(/[^\w -]/g, " ").replace(/\s+/g, " ").trim() || "My font";
      if (FONTS.includes(name) && !uploaded.has(name)) name += " (yours)";
      try {
        const face = new FontFace(name, await file.arrayBuffer());
        await face.load(); document.fonts.add(face);
        uploaded.add(name); if (!FONTS.includes(name)) FONTS.unshift(name);
        settings[tab][key] = name; renderControls(); build();
      } catch (e) { msg.textContent = "That font file couldn't be read (" + file.name + "). Try another format: .ttf or .otf usually work best."; }
    };
    inp.addEventListener("change", () => { use(inp.files && inp.files[0]); inp.value = ""; });
    lab.addEventListener("dragover", (e) => { e.preventDefault(); lab.classList.add("drop"); });
    lab.addEventListener("dragleave", () => lab.classList.remove("drop"));
    lab.addEventListener("drop", (e) => { e.preventDefault(); lab.classList.remove("drop"); use(e.dataTransfer.files && e.dataTransfer.files[0]); });
    field.append(inp, lab, msg);
  }

  // ---------- canvas settings, export ----------
  function bindGlobal() {
    for (const b of document.querySelectorAll("#tabs button")) b.addEventListener("click", () => { if (b.dataset.tab === tab) return; tab = b.dataset.tab; writeHash(); renderTabs(); renderControls(); build(); });
    $("#format").addEventListener("change", (e) => { format = e.target.value; resize(); });
    $("#theme").addEventListener("change", (e) => { theme = e.target.value; document.body.dataset.theme = theme; updateTrace(); });
    const sp = $("#speed"), so = $("#speed-out");
    sp.addEventListener("input", () => { speed = +sp.value; so.textContent = times(speed); });
    $("#pause").addEventListener("click", () => { paused = !paused; $("#pause").textContent = paused ? "Play" : "Pause"; });
    $("#toggle").addEventListener("click", () => {
      panelOpen = !panelOpen; document.body.classList.toggle("closed", !panelOpen);
      $("#toggle").textContent = panelOpen ? "Hide controls" : "Show controls"; $("#toggle").setAttribute("aria-expanded", panelOpen);
      setTimeout(resize, 30);
    });
    $("#png").addEventListener("click", exportPNG);
    $("#rec").addEventListener("click", () => (rec ? stopClip() : recordClip()));
    $("#svg").addEventListener("click", exportSVG);
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("textarea, input, select")) return;
      if (e.key === " ") { e.preventDefault(); $("#pause").click(); }
      if (e.key === "n" || e.key === "N") build();
      if (e.key === "h" || e.key === "H") $("#toggle").click();
      if (e.key === "r" || e.key === "R") $("#rec").click();
    });
  }
  const dlCap = window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
  async function download(name, blob) {
    const note = $("#save-note"), cap = await dlCap;
    if (cap) {
      try { await cap.save({ filename: name, data: blob }); note.textContent = "Saved " + name + "."; }
      catch (e) { note.textContent = e && e.code === "declined" ? "Save cancelled." : "This view can't save files. Open the website to save."; }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    note.textContent = "Saved " + name + ".";
  }
  const fileBase = () => "mycelium-lab-" + tab + (tab === "type" ? "-" + (settings.type.text.trim() || "word").replace(/\s+/g, "-").toLowerCase() : "");
  function exportPNG() {
    if (!engine) return;
    const k = Math.max(1, Math.min(4, 6000 / Math.max(env.W, env.H)));
    const c = document.createElement("canvas"); c.width = Math.round(env.W * k); c.height = Math.round(env.H * k);
    const ctx = c.getContext("2d"); ctx.scale(k, k);
    ctx.fillStyle = THEMES[theme].bg; ctx.fillRect(0, 0, env.W, env.H);
    engine.render(ctx, false, THEMES[theme].ink);
    c.toBlob((b) => download(fileBase() + ".png", b), "image/png");
  }
  // ---------- video clips: the live canvas recorded as it grows ----------
  let rec = null;
  function pickType() {
    const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  }
  async function recordClip() {
    const canvas = $("#canvas-host canvas"), note = $("#rec-note"), btn = $("#rec");
    if (!canvas || !canvas.captureStream || !window.MediaRecorder) { note.textContent = "This browser can't record video. Try Chrome, Edge, Firefox or Safari 14.1+."; return; }
    const secs = +$("#clip-len").value, type = pickType(), ext = type.startsWith("video/mp4") ? "mp4" : "webm";
    if ($("#clip-from").value === "new") await build();
    if (paused) $("#pause").click();
    const stream = canvas.captureStream(30);
    let mr;
    try { mr = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: +$("#clip-q").value * 1e6 }); }
    catch (e) { note.textContent = "Recording couldn't start in this browser."; return; }
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      clearInterval(rec.timer); rec = null; stream.getTracks().forEach((t) => t.stop());
      btn.classList.remove("recording"); btn.textContent = "Record clip";
      const blob = new Blob(chunks, { type: (type || "video/webm").split(";")[0] });
      note.textContent = `Clip ready (${(blob.size / 1e6).toFixed(1)} MB).`;
      download(fileBase() + "-" + secs + "s." + ext, blob);
    };
    const t0 = performance.now();
    rec = { mr, timer: setInterval(() => {
      const left = Math.max(0, secs - (performance.now() - t0) / 1000);
      btn.textContent = `Recording… ${Math.ceil(left)} s (click to stop)`;
      if (left <= 0) stopClip();
    }, 200) };
    btn.classList.add("recording"); btn.textContent = `Recording… ${secs} s (click to stop)`;
    note.textContent = "Recording the canvas. Keep this tab open and visible.";
    mr.start(500);
  }
  function stopClip() { if (rec && rec.mr.state !== "inactive") rec.mr.stop(); }
  function exportSVG() {
    if (!engine) return;
    const rec = svgRecorder(env.W, env.H);
    engine.render(rec, false, THEMES[theme].ink);
    download(fileBase() + ".svg", new Blob([rec.toString(THEMES[theme].bg)], { type: "image/svg+xml" }));
  }

  readHash(); renderTabs(); renderControls(); bindGlobal();
})();
