// Mycelium Lab · SVG export
// A stand-in for a canvas 2D context that records what is drawn as SVG paths instead of pixels.
// The modes draw the same way to the screen and to this recorder, so the SVG matches the picture.
function svgRecorder(W, H) {
  const parts = [];
  let d = "";
  let T = { x: 0, y: 0, a: 0 }; const stack = [];   // translate + rotate only (all the modes need)
  const esc = (c) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const r2 = (v) => Math.round(v * 100) / 100;
  const ctx = {
    lineWidth: 1, lineCap: "round", lineJoin: "round", strokeStyle: "#000", fillStyle: "#000", globalAlpha: 1, font: "", textBaseline: "alphabetic",
    beginPath() { d = ""; },
    moveTo(x, y) { d += `M${r2(x)} ${r2(y)}`; },
    lineTo(x, y) { d += `L${r2(x)} ${r2(y)}`; },
    closePath() { d += "Z"; },
    arc(x, y, r) {   // the modes only draw full circles
      r = r2(r);
      d += `M${r2(x + r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x - r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x + r)} ${r2(y)}`;
    },
    stroke() { if (d) parts.push(`<path d="${d}" fill="none" stroke="${ctx.strokeStyle}" stroke-width="${r2(ctx.lineWidth)}" stroke-linecap="round" stroke-linejoin="round"${ctx.globalAlpha < 1 ? ` opacity="${r2(ctx.globalAlpha)}"` : ""}/>`); },
    fill() { if (d) parts.push(`<path d="${d}" fill="${ctx.fillStyle}"${ctx.globalAlpha < 1 ? ` opacity="${r2(ctx.globalAlpha)}"` : ""}/>`); },
    save() { stack.push({ ...T }); }, restore() { T = stack.pop() || { x: 0, y: 0, a: 0 }; },
    translate(x, y) { T.x += x * Math.cos(T.a) - y * Math.sin(T.a); T.y += x * Math.sin(T.a) + y * Math.cos(T.a); },
    rotate(a) { T.a += a; },
    fillText(ch, x, y) {
      const px = T.x + x * Math.cos(T.a) - y * Math.sin(T.a), py = T.y + x * Math.sin(T.a) + y * Math.cos(T.a);
      const base = { bottom: "text-after-edge", middle: "central", top: "hanging" }[ctx.textBaseline] || "alphabetic";
      const rot = T.a ? ` transform="rotate(${r2((T.a * 180) / Math.PI)} ${r2(px)} ${r2(py)})"` : "";
      parts.push(`<text x="${r2(px)}" y="${r2(py)}"${rot} dominant-baseline="${base}" style='font:${ctx.font.replace(/'/g, "")}' fill="${ctx.fillStyle}"${ctx.globalAlpha < 1 ? ` opacity="${r2(ctx.globalAlpha)}"` : ""}>${esc(ch)}</text>`);
    },
    setLineDash() {}, fillRect() {}, clearRect() {},
  };
  ctx.toString = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n` +
    (bg ? `<rect width="100%" height="100%" fill="${bg}"/>\n` : "") + parts.join("\n") + "\n</svg>\n";
  return ctx;
}
