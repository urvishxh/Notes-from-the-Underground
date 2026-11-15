# Mycelium Lab: working rules

## Always push changes to GitHub
- After any change to files in this repository, commit it and push to `origin main` in the same turn, without asking.
- Write a short, plain commit message that says what changed.
- If a push fails, say so plainly and explain why. Never claim a change is on GitHub unless the push succeeded.
- End your reply with the commit link: https://github.com/urvishxh/Notes-from-the-Underground/commit/<sha>

## Website
Deployed by Vercel from `main` (every push redeploys). Plain static site, no build step.

## Project notes
- See README.md. Tabs and their controls are defined in the `TABS` object in `js/app.js`.
- p5.js 1.9.4 lives at `lib/p5.min.js`, used in instance mode only.
- When publishing a claude.ai artifact preview, inline `lib/p5.min.js` and every `js/*.js` into one self-contained HTML file.
- The owner is a designer. Explain decisions in plain language and give them design control where possible.
