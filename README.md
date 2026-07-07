# Valle Auto Sales — Website

Bilingual (Spanish default / English) website for Valle Auto Sales, Aguada, PR.
Pure static site — no build step. Host it free on Netlify, Vercel, or GitHub Pages.

## Files

- `index.html` — the single page (all sections render into it)
- `css/styles.css` — brand styles (black / red / chrome, matching the business card)
- `js/i18n.js` — every text string in Spanish and English
- `js/data.js` — inventory: Google Sheet loader + sample cars + **the config values you need to set**
- `js/app.js` — pages, filters, routing, lead form

## 1. The Google Sheet (inventory)

The site reads from the **"Valle Auto Sales Inventory CMS"** sheet (its ID is
already set in `js/data.js`). Two tabs matter:

**Inventory** — one row per car:

| column | what it does |
|---|---|
| `status` | `active` = shown, `sold` = shown with the red VENDIDO tag, anything else (e.g. `draft`) = hidden |
| `inventory_id` | unique id (`v-001`) — links photos to cars |
| `sort_order` | display order, lower = first |
| `featured` | `TRUE` = shows on the home page |
| `title` | used as fallback if make/model are empty |
| `year` / `make` / `model` / `trim` | shown on cards and the detail page |
| `body_style` | `Sedan`, `SUV`, `Pickup`, `Hatchback`, `Van`, `Coupe`… (drives the type filter) |
| `mileage` / `price_usd` | numbers |
| `condition` / `features` | free text, shown in the "Notas" card on the detail page |
| `image_url` | main photo (the Photos tab overrides this when it has rows for the car) |

Optional columns you can add anytime (the site picks them up automatically):
- `color`: `blanco`, `negro`, `gris`, `plata`, `rojo`, `azul`, `verde`, `marron`, `dorado`, `amarillo`, `anaranjado`, `vino` — enables the color swatch + color filter
- `origin`: `local` or `imported` — enables the Local/Importado badge, origin filter, and the tablilla/registro info card
- `registration_fee`: e.g. `$350`
- `condition_tags` (comma-separated): `clean`, `accident_repaired`, `engine_replaced`, `body_repair`, `reconditioned` — shows the "Condición y transparencia" checklist

**Photos** — one row per photo: `inventory_id | sort_order | image_url`.
All rows for a car become its gallery, ordered by `sort_order`.

⚠️ **Photo links**: URLs copied from Facebook (`scontent.…fbcdn.net`) **expire
after a while** — the site hides broken photos gracefully, but the car then
shows the placeholder. For permanent photos, upload the images to this repo's
`img/` folder (e.g. `img/cars/v-001-1.jpg`) and use those URLs instead.

**Required once:** the sheet must be shared **Anyone with the link → Viewer**
(Share button → General access). Without this, Google blocks the site from
reading it and visitors see the built-in sample cars.

**Family workflow:** edit the sheet → the site updates on the next page load.

## 2. Connect the lead form (Formspree)

1. Create a free account at formspree.io with **valleauto@yahoo.com** as the destination email.
2. Create a form, copy its ID (the code after `formspree.io/f/`).
3. Paste it into `FORMSPREE_ID` at the top of `js/data.js`.

Until then, the form falls back to opening the visitor's email app addressed to valleauto@yahoo.com — it still works, just less smooth.

The form deliberately has **no** SSN or bank-account fields, and shows a privacy note telling clients never to send those.

## 3. Real photos

- Hero/building photo: drop it in `img/` and we can wire it into the hero.
- Per-car photos: the beginner-friendly workflow is:
  1. Save the photo file into this repo at `img/cars/<inventory_id>-<n>.jpg`
     (e.g. `img/cars/v-011-1.jpg`, `v-011-2.jpg`…) — on GitHub.com you can do
     this with **Add file → Upload files** inside the `img/cars` folder.
  2. In the sheet's **Photos** tab, put that same path (`img/cars/v-011-1.jpg`)
     in `image_url`. Relative paths work — no photo host needed, and the
     links never expire.
- **Current state:** the Facebook photos for v-001 – v-010 were downloaded
  into `img/cars/` and the site uses those local copies via the
  `LOCAL_PHOTOS` list at the top of `js/data.js` (it overrides the sheet's
  expiring Facebook links). Once the sheet's Photos tab is updated to the
  `img/cars/…` paths, that list can be deleted.

## Run locally

Any static server works, e.g.: `npx serve .` in this folder, then open the printed URL.
