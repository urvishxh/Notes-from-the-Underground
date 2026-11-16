// Mycelium Lab · letter geometry
// ------------------------------------------------------------------
// Turns a word + font into the "agar" the mycelium grows on:
//   inside(x, y)     is this point inside a letter?
//   inCounter(x, y)  is this point in an enclosed hole of a letter (inside a, o, e, B…)?
//   letters          each letter with its grid cells { x, y, depth } (depth = steps from the outline)
//   drawText(ctx)    draws the word (used for the faint letter guide on screen)
// Up to 4 lines (press Enter in the word box).
function buildGeometry({ W, H, text, family, weight, size, tracking = 0 }) {
  const lines = String(text || "").split("\n").map((s) => s.replace(/\s+$/, "")).filter((s, i, a) => s.length || a.length === 1).slice(0, 4);
  if (!lines.length || !lines.some((s) => s.trim())) lines.splice(0, lines.length, "mycelium");
  const font = (fs) => `${weight} ${fs}px "${family}", sans-serif`;
  const mc = document.createElement("canvas").getContext("2d");
  // fit the block: as large as possible inside the canvas (size = how much of it to fill)
  mc.font = font(100);
  const m100 = lines.map((s) => mc.measureText(s || " "));
  const maxW = Math.max(...m100.map((m, i) => m.width + tracking * 100 * Math.max(0, lines[i].length - 1)), 1);   // tracking: extra space between letters, in em
  const asc100 = Math.max(...m100.map((m) => m.actualBoundingBoxAscent || 72)), des100 = Math.max(...m100.map((m) => m.actualBoundingBoxDescent || 20));
  const lineH100 = asc100 + des100 + 14;
  const fs = Math.max(12, Math.min((W * 0.88 * size) / maxW, (H * 0.8 * size) / (lineH100 * lines.length - 14)) * 100);
  mc.font = font(fs);
  const k = fs / 100, asc = asc100 * k, lineH = lineH100 * k, blockH = lineH * lines.length - 14 * k;
  const top = (H - blockH) / 2;
  const placed = [];   // { ch, x, y } baseline positions, per glyph
  lines.forEach((s, li) => {
    const w = mc.measureText(s).width + tracking * fs * Math.max(0, s.length - 1), x0 = (W - w) / 2, y = top + asc + li * lineH;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; if (!ch.trim()) continue;
      placed.push({ ch, x: x0 + mc.measureText(s.slice(0, i)).width + tracking * fs * i, y });
    }
  });

  // pixel mask and which letter owns each pixel
  const mask = new Uint8Array(W * H), owner = new Int16Array(W * H).fill(-1);
  placed.forEach((g, li) => {
    const m = mc.measureText(g.ch);
    const l = Math.floor(g.x - (m.actualBoundingBoxLeft || 0)) - 2, r = Math.ceil(g.x + (m.actualBoundingBoxRight || m.width)) + 2;
    const t = Math.floor(g.y - (m.actualBoundingBoxAscent || fs)) - 2, b = Math.ceil(g.y + (m.actualBoundingBoxDescent || fs * 0.3)) + 2;
    const w = Math.max(1, r - l), h = Math.max(1, b - t);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.font = font(fs); x.fillStyle = "#fff"; x.fillText(g.ch, g.x - l, g.y - t);
    const d = x.getImageData(0, 0, w, h).data;
    for (let yy = 0; yy < h; yy++) {
      const Y = t + yy; if (Y < 0 || Y >= H) continue;
      for (let xx = 0; xx < w; xx++) {
        const X = l + xx; if (X < 0 || X >= W) continue;
        if (d[(yy * w + xx) * 4 + 3] > 127) { mask[Y * W + X] = 1; owner[Y * W + X] = li; }
      }
    }
  });
  const inside = (x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1; };

  // a coarse grid of cells inside the letters, with depth (distance from the outline in cells)
  const g = Math.max(2, Math.round(fs / 70)), gw = Math.ceil(W / g), gh = Math.ceil(H / g);
  const gl = new Int16Array(gw * gh).fill(-1);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = Math.min(W - 1, gx * g + (g >> 1)), y = Math.min(H - 1, gy * g + (g >> 1));
    if (mask[y * W + x]) gl[gy * gw + gx] = owner[y * W + x];
  }
  const depth = new Int16Array(gw * gh).fill(-1), q = [];
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx; if (gl[i] < 0) continue;
    if (N4.some(([dx, dy]) => { const X = gx + dx, Y = gy + dy; return X < 0 || Y < 0 || X >= gw || Y >= gh || gl[Y * gw + X] < 0; })) { depth[i] = 0; q.push(i); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], gx = i % gw, gy = (i / gw) | 0;
    for (const [dx, dy] of N4) { const X = gx + dx, Y = gy + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const j = Y * gw + X; if (gl[j] >= 0 && depth[j] < 0) { depth[j] = depth[i] + 1; q.push(j); } }
  }
  // counters: background that can't be reached from the canvas edge
  const reach = new Uint8Array(gw * gh), fq = [];
  for (let gx = 0; gx < gw; gx++) for (const gy of [0, gh - 1]) { const i = gy * gw + gx; if (gl[i] < 0 && !reach[i]) { reach[i] = 1; fq.push(i); } }
  for (let gy = 0; gy < gh; gy++) for (const gx of [0, gw - 1]) { const i = gy * gw + gx; if (gl[i] < 0 && !reach[i]) { reach[i] = 1; fq.push(i); } }
  for (let h = 0; h < fq.length; h++) {
    const i = fq[h], gx = i % gw, gy = (i / gw) | 0;
    for (const [dx, dy] of N4) { const X = gx + dx, Y = gy + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const j = Y * gw + X; if (gl[j] < 0 && !reach[j]) { reach[j] = 1; fq.push(j); } }
  }
  const inCounter = (x, y) => { const gx = (x / g) | 0, gy = (y / g) | 0; if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return false; const i = gy * gw + gx; return gl[i] < 0 && !reach[i]; };

  const letters = placed.map((p, li) => ({ ch: p.ch, li, cells: [], minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 }));
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx, li = gl[i]; if (li < 0) continue;
    const L = letters[li], x = gx * g + g / 2, y = gy * g + g / 2;
    L.cells.push({ x, y, depth: depth[i] });
    L.minx = Math.min(L.minx, x); L.maxx = Math.max(L.maxx, x); L.miny = Math.min(L.miny, y); L.maxy = Math.max(L.maxy, y);
  }
  const drawText = (ctx) => { ctx.font = font(fs); ctx.textBaseline = "alphabetic"; for (const p of placed) ctx.fillText(p.ch, p.x, p.y); };
  for (const L of letters) { let x = 0, y = 0; for (const c of L.cells) { x += c.x; y += c.y; } L.cx = x / (L.cells.length || 1); L.cy = y / (L.cells.length || 1); }
  // which letter a point is in (-1 = none)
  const letterAt = (x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] ? owner[y * W + x] : -1; };
  return { W, H, fontPx: fs, cell: g, inside, inCounter, letterAt, letters: letters.filter((L) => L.cells.length), drawText };
}
