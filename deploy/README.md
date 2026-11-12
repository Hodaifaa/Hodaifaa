# الكذّاب (The Liar) — party game

A pass-the-phone party game in Arabic: everyone sees the secret word except one
player, who has to bluff. Plain HTML, CSS and JavaScript — no build tools, no
dependencies.

- `game/` — the whole site (this folder is what gets published)
  - `js/words.js` — the word bank (edit this to add or change words)
  - `js/game.js` — rules and scoring, no UI
  - `js/app.js` — screens
  - `js/store.js`, `js/sfx.js`, `js/dom.js` — saving, sounds, UI helpers
  - `sw.js` — offline support
- `tests/` — rule and word-bank tests: `node --test tests/game.test.mjs`
- `deploy/` — the two files uploaded to Vercel

## Run it locally

    cd game && python3 -m http.server 8000

Then open http://localhost:8000.

## Publish

The Vercel project `game` is deployed with only `deploy/vercel.json` and
`deploy/build.sh`. At build time Vercel downloads this repository at one exact
commit and publishes its `game/` folder. To release a new version, push the
commit, replace `COMMIT_SHA` in `vercel.json` with its full hash, and deploy
those two files to production.
