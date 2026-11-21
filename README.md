# Mycelium Lab

Grow mycelium through type, across a blank page, or between food sources you place.
Plain HTML + JavaScript, no build step. p5.js 1.9.4 (instance mode) runs the canvas.

## Tabs

- **Type**: type a word (up to 4 lines), pick a font or upload your own.
  - *Woven*: a lab culture fills each letter. **Spill** lets threads cross the outline (0 = bound); counters can be kept open so the word reads. The culture keeps finding unreached parts of the letters and grows into them, so no gaps are left. **Drag on the canvas** to paint fresh ground: the network grows into it from its nearest threads. **Fill gaps now** forces a pass.
  - *Outgrowth*: the letters are packed dark with mycelium and threads grow out of their edges, thinning and spreading as they go. **How far it grows out** and **Thinning** shape the halo.
    **Letters reach for each other** sends cords between neighbouring letters from their closest edges: where they arrive, the route thickens into a cord and pulses cross it. **Letter spacing** gives the connections room.
  - *Roped*: food is placed along the centre line of every stroke and joined by twisted cords.
- **Network**: a fungus on a blank page. Start from scattered spores or one colony in the centre (like a petri dish). Spores, food, reach, density, branching, wander, cords, die-back. **New network** gives a new random result. Click to drop food; hover to send a signal.
- **Paths**: click to place food sources, then **Connect**.
  - *Realistic* (default): the fungus doesn't know where the food is. It forages outward, joins whatever it reaches, thickens the routes that carry food between sources into cords, then lets everything else die back from the tips inward. The efficient network emerges.
  - *Planned*: threads head straight for the shortest set of links (faster, more designed).
  - **Connections** toward *web* keeps more routes (loops). **Twist** 0 draws cords as threads bundled side by side. **Upload an image to trace** puts a sketch under the canvas as a guide (it is never exported).

Threads turn in smooth arcs (a correlated random walk, `js/hypha.js`), so they read as fairly straight hyphae rather than wiggles.

Fonts: Google Fonts (incl. Roboto, Roboto Condensed, Roboto Mono), Satoshi from Fontshare, or upload your own.

Every tab has **Variation between runs**: 0 keeps your settings exactly, higher values nudge them at random on every growth.
Canvas: Fit screen, A4 portrait or landscape, or Square; ink on paper or light on dark; speed; pause. **Save PNG** (high resolution) and **Save SVG** (vector lines).
**Record a clip**: 5, 10, 15 or 30 seconds of the live canvas as a video (MP4 where the browser supports it, otherwise WebM), starting from a new growth or from where it is now. The Speed setting turns it into a time-lapse.
Keys: Space pause · N new growth · H hide controls · R record a clip.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and styles |
| `js/app.js` | Tabs, controls (their settings live in the `TABS` object), canvas loop, export |
| `js/geometry.js` | Turns the word and font into the shape the mycelium grows in |
| `js/woven.js` | Type · Woven and Outgrowth |
| `js/paths.js` | Paths · Planned, and Type · Roped |
| `js/forage.js` | Paths · Realistic (forage, then prune) |
| `js/hypha.js` | How a tip turns (smooth arcs) |
| `js/network.js` | Network |
| `js/svg.js` | Records the drawing as SVG |
| `lib/p5.min.js` | p5.js 1.9.4 |

## Run locally

`python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Website

Deployed on Vercel from the `main` branch of this repository: every push updates the site.

## Outputs

`outputs/` holds finished images, e.g. *connection* (Type · Outgrowth, Space Grotesk Bold, letter spacing +18%, density 85%, how far it grows out 60%, letters reach for each other 90%).
