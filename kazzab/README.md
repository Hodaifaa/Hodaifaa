# الكذّاب (The Liar) — party game

A pass-the-phone party game in Arabic: everyone sees the secret word except one
player, who has to bluff. Plain HTML, CSS and JavaScript.

- `site/` — the game
  - `js/words.js` — the word bank (edit this to add or change words)
  - `js/game.js` — rules and scoring, no UI
  - `js/app.js` — screens
  - `js/store.js`, `js/sfx.js`, `js/dom.js` — saving, sounds, UI helpers
  - `sw.js` — offline support
- `tests/` — rule and word-bank tests
- `build.mjs` — copies `site/` to `public/`, adds the fonts and PNG icons, runs the checks
- `art/wordmark.txt` — the logo outline used in the link-preview image

## Commands

    npm install
    npm test          # rules and word bank
    npm start         # build, then serve on http://localhost:8000

Vercel runs `node build.mjs` and publishes `public/`.
