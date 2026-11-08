# Midnight Video

A phone-first web app that deals one "so bad it's good" movie at a time for Ken and his sister. The catalog in `movies.json` is final content: do not rewrite headlines, blurbs or tags unless asked.

## Budget rules (Claude Pro plan)
- Use Sonnet. Keep the app to `index.html` (inline CSS/JS) + `movies.json` + `scripts/resolve.js` + `tests/`.
- Don't web-search for posters or ratings. OMDb handles that (below).
- Review: run the Playwright tests, take ONE screenshot at 390px and ONE at 1280px, self-review design and function, fix the top 3 issues, rerun tests, stop. Ask Ken before any second round.

## Data step: scripts/resolve.js (run locally, once)
- Reads `OMDB_API_KEY` from `.env` (never commit it; add `.env` to `.gitignore`).
- For each movie, query OMDb by `omdbTitle || title` + `year`. Write back into `movies.json`: `imdbId`, `poster`, `runtime`, `imdbRating`, `ratingAsOf` (YYYY-MM).
- Print a short list of misses (not found, wrong year, no poster) for Ken to fix by hand. Never guess an IMDb ID.
- Rerun anytime to refresh ratings.

## App behavior
- On open: show one featured pick immediately.
- Card: poster (large, room to shine), title, year, runtime, IMDb rating labeled "IMDb 5.2 · as of Nov 2026", 3 tags, marquee headline, "Why it's a good bad movie" blurb, IMDb link (`https://www.imdb.com/title/{imdbId}/`, opens new tab).
- Primary button: **Deal Me Another**. Shuffle without repeats within the current filtered pool; when exhausted, show a "Rewind the tape?" reshuffle message.
- Secondary: **Back** (one step through history), **Seen It** (removes from future deals, stored in localStorage, with a "Reset seen" option in a small settings sheet).
- Mood chips (single-select + "Any"), labels from `moods` in movies.json. Plus a Classics / Deep Cuts / Both toggle. Changing filters re-deals from the new pool.
- Fallbacks: if poster fails to load, show a styled VHS-spine card with the title. If rating or runtime is missing, show "Rating unavailable", never a made-up number. If imdbId is missing, hide the link.

## Art direction
Late-night cable creature-feature host meets after-hours VHS rental store. Deep blacks, warm amber marquee lettering, a touch of red neon, subtle scanline/grain texture (CSS only, low opacity, never over the poster or title). Original identity: no real store logos, no real host likeness. Title and Deal button must stay high-contrast and thumb-reachable on a phone. Respect safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`). Add a web app manifest + icon so it installs to the iPhone home screen.

## Tests (Playwright, 390px and 1280px)
First pick renders; 30 deals with no repeats; filter change re-deals from the right pool; Back returns the previous pick; Seen It persists across reload; every poster URL in movies.json returns 200 (report failures); every IMDb link is well-formed.

## Deploy
GitHub Pages from the repo root. Only static files ship; the API key stays local.
