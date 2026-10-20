# jay han

Personal homepage. Static, no build step — every glyph is rendered by a WebGL
"glyph diffusion" field (`glyph.js`) behind the page.

## Posting a day of 30 ideas

1. Put the picture in `ideas/` (e.g. `ideas/01.png`).
2. Add one entry to `ideas.js`:

   ```js
   { title: '…', summary: '…', image: 'ideas/01.png', x: 'https://x.com/thisisjaeha/status/…' },
   ```

3. Set `start` in `ideas.js` to the date of day 01 once it's fixed.
4. Push. Each idea is linkable as `/#day-01`.

## Files

- `index.html`, `styles.css` — page
- `glyph.js` — the WebGL glyph field (noise, cursor lens, ripples, image decoding)
- `main.js` — page logic, 30-day grid, idea detail view
- `ideas.js` — the daily data
