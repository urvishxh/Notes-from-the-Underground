# Mycelium Lab

Grow mycelium through type, across a blank page, or between food sources you place.
Plain HTML + JavaScript, no build step. p5.js 1.9.4 (instance mode) runs the canvas.

## Tabs

- **Type**: type a word (up to 4 lines), pick a font or upload your own.
  - *Woven*: a lab culture fills each letter. **Spill** lets threads cross the outline (0 = bound); counters can be kept open so the word reads. The culture keeps finding unreached parts of the letters and grows into them, so no gaps are left. **Drag on the canvas** to paint fresh ground: the network grows into it from its nearest threads. **Fill gaps now** forces a pass.
  - *Roped*: food is placed along the centre line of every stroke and joined by twisted cords.
- **Network**: a fungus on a blank page. Spores, food, reach, density, branching, wander, cords, die-back. **New network** gives a new random result. Click to drop food; hover to send a signal.
- **Paths**: click to place food sources, then **Connect**. They are joined by the shortest network (a minimum spanning tree); **Connections** toward *web* adds loops. **Upload an image to trace** puts a sketch under the canvas as a guide (it is never exported).

Every tab has **Variation between runs**: 0 keeps your settings exactly, higher values nudge them at random on every growth.
Canvas: Fit screen, A4 portrait or landscape, or Square; ink on paper or light on dark; speed; pause. **Save PNG** (high resolution) and **Save SVG** (vector lines).
Keys: Space pause · N new growth · H hide controls.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and styles |
| `js/app.js` | Tabs, controls (their settings live in the `TABS` object), canvas loop, export |
| `js/geometry.js` | Turns the word and font into the shape the mycelium grows in |
| `js/woven.js` | Type · Woven |
| `js/paths.js` | Paths, and Type · Roped |
| `js/network.js` | Network |
| `js/svg.js` | Records the drawing as SVG |
| `lib/p5.min.js` | p5.js 1.9.4 |

## Run locally

`python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Website

Deployed on Vercel from the `main` branch of this repository: every push updates the site.
