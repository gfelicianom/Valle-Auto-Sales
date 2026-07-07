# Valle Auto Sales — Website

Bilingual (Spanish default / English) website for Valle Auto Sales, Aguada, PR.
Pure static site — no build step. Host it free on Netlify, Vercel, or GitHub Pages.

## Files

- `index.html` — the single page (all sections render into it)
- `css/styles.css` — brand styles (green / cream / red / gray from the sign)
- `js/i18n.js` — every text string in Spanish and English
- `js/data.js` — inventory: Google Sheet loader + sample cars + **the two config values you need to set**
- `js/app.js` — pages, filters, routing, lead form

## 1. Connect the Google Sheet (inventory)

1. Create a Google Sheet. Name the first tab **Inventory**.
2. Put these headers in row 1 (exact spelling, lowercase):

   `id | make | model | year | color | mileage | price | body_type | origin | registration_fee | condition_tags | photo_urls | featured | sold | notes`

3. One row per car. Values to use:
   - `body_type`: `sedan`, `suv_small`, `suv_mid`, `suv_large`, `pickup`, `hatchback`, `van`, `coupe`, `other`
   - `origin`: `local` or `imported`
   - `color`: `blanco`, `negro`, `gris`, `plata`, `rojo`, `azul`, `verde`, `marron`, `dorado`, `amarillo`, `anaranjado`, `vino`
   - `condition_tags` (comma-separated): `clean`, `accident_repaired`, `engine_replaced`, `body_repair`, `reconditioned`
   - `photo_urls`: comma-separated image links (e.g. from Google Drive shared images or any photo host)
   - `featured` / `sold`: `yes` or `no`
   - `registration_fee`: e.g. `$350` (leave empty to show "Consulte por el costo…")
4. Share → **Anyone with the link → Viewer**.
5. Copy the sheet ID from its URL (`docs.google.com/spreadsheets/d/`**`THIS_LONG_CODE`**`/edit`) and paste it into `SHEET_ID` at the top of `js/data.js`.

Until `SHEET_ID` is set, the site shows built-in sample cars.

**Family workflow:** edit the sheet → the site updates on next page load. Mark `sold` = `yes` to show the red VENDIDO tag (sold cars sink to the bottom; the "Solo disponibles" filter hides them by default).

## 2. Connect the lead form (Formspree)

1. Create a free account at formspree.io with **valleauto@yahoo.com** as the destination email.
2. Create a form, copy its ID (the code after `formspree.io/f/`).
3. Paste it into `FORMSPREE_ID` at the top of `js/data.js`.

Until then, the form falls back to opening the visitor's email app addressed to valleauto@yahoo.com — it still works, just less smooth.

The form deliberately has **no** SSN or bank-account fields, and shows a privacy note telling clients never to send those.

## 3. Real photos

- Hero/building photo: drop it in `img/` and we can wire it into the hero.
- Per-car photos: paste links into the sheet's `photo_urls` column.

## Run locally

Any static server works, e.g.: `python3 -m http.server 8080` in this folder, then open http://localhost:8080
