# Valle Auto Sales — Website

Bilingual (Spanish default / English) website for Valle Auto Sales, Aguada, PR.
Pure static site — no build step. Host it free on Netlify, Vercel, or GitHub Pages.

## Files

- `index.html` — the single page (all sections render into it)
- `img/brand/valle-auto-sales-logo.svg` — primary logo used in the header and footer
- `css/styles.css` — brand styles (black / red / chrome, matching the business card)
- `js/i18n.js` — every text string in Spanish and English
- `js/data.js` — inventory loader + **the config values you need to set**
- `js/app.js` — pages, filters, routing, lead form
- `js/inventory.json` — generated inventory data (**never edit by hand**)
- `img/cars/` — generated car photos (**never edit by hand**)
- `scripts/sync-inventory.mjs` — Airtable → website sync script
- `.github/workflows/sync-inventory.yml` — runs the sync hourly from
  6:37 AM to 11:37 PM Puerto Rico time
- `CHANGELOG.md` — site-development history and who made each change

## 1. The Airtable (inventory)

The inventory lives in the Airtable base **"Inventario Valle Auto Sales"**
(`app9Rj2rqXxh1QSTy`), table **Vehículos**. A GitHub Action syncs it to the
site hourly from 6:37 AM to 11:37 PM Puerto Rico time (see section 2). The
family only ever edits Airtable — from the website side it is the single
source of truth.

**Family workflow (all in the Airtable app, phone or computer):**

1. Add a row, give it the next `ID` (`v-011`, `v-012`, …).
2. Fill in the fields — everything is Spanish dropdowns and numbers.
3. Drag the photos into `Fotos`, best exterior shot first (it becomes the
   cover). Suggested order: front ¾ exterior → rest of exterior → interior →
   odometer/engine.
4. Set `Estado` to `Activo` when the listing is ready. Only `Activo` cars
   appear on the site — `Vendido`, `Borrador`, or empty stay off it, so
   marking a car `Vendido` removes it from the website (the record stays
   in Airtable as the sales history).
5. Wait for the next sync (normally within ~1 hour during the scheduled
   window) — or trigger it immediately from GitHub → Actions →
   "Sync inventory from Airtable" → Run workflow.

Field notes:

| field | what it does |
|---|---|
| `ID` | unique id (`v-001`) — photo files are named after it |
| `Estado` | `Activo` = on the site; `Vendido`/`Borrador`/empty = not on the site |
| `Destacado` | checked = shows in "Autos Destacados" on the home page |
| `Año` `Marca` `Modelo` `Trim` | shown on cards and the detail page |
| `Tipo` | drives the body-type filter |
| `Color` | enables the color swatch + filter (bilingual automatically) |
| `Origen` | `Local` or `Importado` — shows a badge on the card, an origin filter, and a bilingual explanation on the detail page; empty = nothing shows |
| `Millaje` / `Precio` | numbers; empty/0 price shows "Consulte precio" |
| `Notas` | free text on the detail page, shown as-is in both languages |
| `Fotos` | the gallery; attachment order = display order |

**Display order** is automatic: featured cars first, then newest first.
There is nothing to renumber.

## 2. The sync (Airtable → website)

`scripts/sync-inventory.mjs` pulls the base through the Airtable API, writes
`js/inventory.json`, and downloads every photo into `img/cars/` resized to
1600px JPEG (Airtable's own attachment URLs expire after ~2 hours, so the
site never links to them directly). The GitHub Action commits the result.

**One-time setup (needs the Airtable account owner):**

1. Create a personal access token at <https://airtable.com/create/tokens> —
   scope `data.records:read`, access limited to this base only.
2. Add it to the GitHub repo as an Actions secret named `AIRTABLE_TOKEN`
   (repo → Settings → Secrets and variables → Actions).

Run locally (optional, for testing):

```bash
npm install --no-save sharp
AIRTABLE_TOKEN=pat… node scripts/sync-inventory.mjs
```

## 3. The lead form (FormSubmit.co)

The financing form sends leads to **valleauto@yahoo.com** through
FormSubmit.co — free, no account, no monthly cap. (`FORM_ENDPOINT` in
`js/data.js`.) One-time setup: the first submission triggers an
activation email to the Yahoo inbox — click the link in it once, and
every submission after that arrives as a normal email.

If FormSubmit is ever down, the form automatically falls back to opening
the visitor's own email app pre-addressed to the dealer, so no lead is
lost. A hidden honeypot field filters basic spam bots.

The form deliberately has **no** SSN or bank-account fields, and shows a privacy note telling clients never to send those.

## Run locally

Do not open `index.html` directly from Finder. Use a local server so the site behaves like it will online:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/#/inventario`.

## Development workflow

- Keep the README focused on how the site works and how to operate it.
- Keep `CHANGELOG.md` updated with visible site changes, inventory/data-flow changes, and setup decisions.
- When Claude, Codex, or a person makes a change, the changelog entry and git commit should say who, so the source of the work is traceable.
- Commit related changes together after they have been previewed locally.

## History

- Until July 2026 the inventory came from a Google Sheet read live by the
  browser (see CHANGELOG). It was replaced by the Airtable + sync setup
  above so photos could be managed by drag-and-drop without expiring URLs.
