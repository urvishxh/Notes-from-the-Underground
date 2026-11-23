# Mycelium Lab

Grow mycelium through type, across a blank page, or between food sources you place.
Plain HTML + JavaScript, no build step. p5.js 1.9.4 (instance mode) runs the canvas.

## Tabs

- **Type**: type a word (up to 4 lines), pick a font or upload your own.
  - *Emerge* (default): the word writes itself (threads sprout inside each letter, left to right), then threads burst from every letter's edge and overtake the page in seconds; the word eases back to a faint presence in the web (**Word in the web**), and the web stays alive: signals stream through it toward the word (**Signals through the web**), hovering sends a wave, clicking sends a burst. Grown threads are kept on cached layers so it stays smooth.
  - *Woven*: a lab culture fills each letter. **Spill** lets threads cross the outline (0 = bound); counters can be kept open so the word reads. The culture keeps finding unreached parts of the letters and grows into them, so no gaps are left. **Drag on the canvas** to paint fresh ground: the network grows into it from its nearest threads. **Fill gaps now** forces a pass.
  - *Outgrowth*: the letters are packed dark with mycelium and threads grow out of their edges, thinning and spreading as they go. **How far it grows out** and **Thinning** shape the halo.
    **Letters reach for each other** sends cords between neighbouring letters from their closest edges: where they arrive, the route thickens into a cord and pulses cross it. **Letter spacing** gives the connections room.
  - *Overtake*: spores land all over the page; the letters are food, so threads find the word, pack it dense and dark, then spread until the page is covered in finer threads. **Hunger for the word**, **Overtake the page**, **Word contrast** (heavy threads in the letters, fine ones on the page) and **Letter swell** (letters grow fatter and softer) shape it. Click or drag to drop spores.
    **Growth → Realistic** drops the shortcuts: threads only sense a letter when close (**Scent range**), everything grows at once with no phases or gap planner, letters darken by branching more and a cottony aerial layer (not heavier lines), food runs out so old threads in the letters die and the word slowly hollows (**Ageing**), and optionally colonies from different spores refuse to fuse and leave boundary marks (**Rival colonies**). Less legible, more truthful.
  - *Roped*: food is placed along the centre line of every stroke and joined by twisted cords.
- **Network**: a fungus on a blank page. Start from scattered spores or one colony in the centre (like a petri dish). Spores, food, reach, density, branching, wander, cords, die-back. **New network** gives a new random result. Click to drop food; hover to send a signal.
- **Paths**: click to place food sources, then **Connect**.
  - *Realistic* (default): the fungus doesn't know where the food is. It forages outward, joins whatever it reaches, thickens the routes that carry food between sources into cords, then lets everything else die back from the tips inward. The efficient network emerges.
  - *Planned*: threads head straight for the shortest set of links (faster, more designed).
  - **Connections** toward *web* keeps more routes (loops). **Twist** 0 draws cords as threads bundled side by side. **Upload an image to trace** puts a sketch under the canvas as a guide (it is never exported).

Threads turn in smooth arcs (a correlated random walk, `js/hypha.js`), so they read as fairly straight hyphae rather than wiggles.

Fonts: Google Fonts (incl. Roboto, Roboto Condensed, Roboto Mono), Satoshi from Fontshare, or upload your own.

- **Text**: write a paragraph and it grows like mycelium. Every thread is a line of your text, turning in gentle arcs. Four styles: *Web* (strands of text sweep along one slow, curving current, split into thinner strands and join back together, with curved webbing in every fork and junction; **Curviness of the current** and **Strands rejoin** shape it), *Unravel* (a large paragraph whose lines keep going past the margin, fan out and fray), *Colony* (threads radiate from the first word) and *Mat* (the page woven from fine text). Branches carry on with the next word, smaller and lighter than their parent, and are marked by a small knot. Threads avoid other text and stop when they run into it. Letters hold their size for a few words, then shrink (**Letters get smaller**) and spread apart (**Letters spread apart**), and when they are too small to read the thread carries on as a bare hypha. SVG export keeps the letters as real text.

Controls are kept to the ones that change the form: each structure shows only its own few sliders.
Canvas: Fit screen, A4 portrait or landscape, or Square; ink on paper or light on dark; speed; pause. **Save PNG** (high resolution) and **Save SVG** (vector lines).
**Record a clip**: 5, 10, 15 or 30 seconds of the live canvas as a video (MP4 where the browser supports it, otherwise WebM), starting from a new growth or from where it is now. The Speed setting turns it into a time-lapse.
Keys: Space pause · N new growth · H hide controls · R record a clip.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and styles |
| `js/app.js` | Tabs, controls (their settings live in the `TABS` object), canvas loop, export |
| `js/geometry.js` | Turns the word and font into the shape the mycelium grows in |
| `js/emerge.js` | Type · Emerge |
| `js/overtake.js` | Type · Overtake |
| `js/woven.js` | Type · Woven and Outgrowth |
| `js/paths.js` | Paths · Planned, and Type · Roped |
| `js/forage.js` | Paths · Realistic (forage, then prune) |
| `js/hypha.js` | How a tip turns (smooth arcs) |
| `js/network.js` | Network |
| `js/text.js` | Text |
| `js/svg.js` | Records the drawing as SVG |
| `lib/p5.min.js` | p5.js 1.9.4 |

## Run locally

`python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Website

Deployed on Vercel from the `main` branch of this repository: every push updates the site.

## Outputs

`outputs/` holds finished images, e.g. *connection* (Type · Outgrowth, Space Grotesk Bold, letter spacing +18%, density 85%, how far it grows out 60%, letters reach for each other 90%).
