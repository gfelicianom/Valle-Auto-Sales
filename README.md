# Valle Auto Sales — Website

Bilingual (Spanish default / English) website for Valle Auto Sales in Aguada,
Puerto Rico. It is a static website published through GitHub. Most pages can be
opened directly, while generated search-engine pages and the sitemap are rebuilt
by the inventory workflow or by running the included generator.

This README is the operating guide for future changes. Read **Quick guide** and
**Safe workflow for website changes** before editing or publishing anything.

## Quick guide

| Need to change | Where to do it | Important note |
|---|---|---|
| Add, update, feature, sell, or remove a vehicle | Airtable | Never edit generated inventory files manually |
| Change Spanish or English wording in the interactive site | `js/i18n.js` | Keep both languages current |
| Change layout or page behavior | `js/app.js` and/or `css/styles.css` | Test desktop and mobile |
| Change homepage metadata or shared page structure | `index.html` | Preserve verification and structured-data tags |
| Change content repeated on searchable static pages | `scripts/build-seo-pages.mjs` | Run the generator afterward |
| Change business phones, address, hours, or email | Search all source files first | Keep the website, metadata, Google, Bing, and Facebook consistent |
| Change vehicle photos | Airtable `Fotos` field | Best exterior photo goes first |
| Publish a prepared vehicle to Facebook | Airtable status used by the Make scenario | Do not mark it ready until the caption and gallery are final |

Current contact hierarchy:

- **Primary calls and WhatsApp:** (787) 233-4800
- **Secondary office landline, calls only:** (787) 868-4840
- **Financing-form email:** valleauto@yahoo.com

Do not reverse the two phone numbers during future edits. The mobile number is
the preferred public number; the office landline remains available as a
secondary option.

## Files

- `index.html` — the single page (all sections render into it)
- `img/brand/valle-auto-sales-logo.svg` — primary logo used in the header and footer
- `img/brand/valle-auto-sales-social-preview.jpg` — branded 1200×630 link-preview image
- `css/styles.css` — brand styles (black / red / chrome, matching the business card)
- `js/i18n.js` — every text string in Spanish and English
- `js/data.js` — inventory loader + **the config values you need to set**
- `js/app.js` — pages, filters, routing, lead form
- `js/inventory.json` — generated inventory data (**never edit by hand**)
- `img/cars/` — generated car photos (**never edit by hand**)
- `scripts/sync-inventory.mjs` — Airtable → website sync script
- `scripts/build-seo-pages.mjs` — generates crawlable inventory, vehicle, contact, history, financing, and sitemap pages
- `scripts/seo.test.mjs` — validates canonical URLs, structured data, and sitemap coverage
- `scripts/submit-indexnow.mjs` — tells participating search engines about changed URLs
- `scripts/audit-airtable-photos.mjs` — read-only report on Airtable photo storage
- `scripts/optimize-airtable-photos.mjs` — replaces full-resolution Airtable photos
  with the website's resized copies
- `.github/workflows/sync-inventory.yml` — runs the sync hourly from
  6:37 AM to 11:37 PM Puerto Rico time
- `.github/workflows/audit-airtable-photos.yml` — read-only check on where
  Airtable photo storage is going
- `.github/workflows/optimize-airtable-photos.yml` — the manual, preview-first
  button that replaces full-resolution photos for named cars
- `CHANGELOG.md` — site-development history and who made each change

Generated files and folders include `js/inventory.json`, `img/cars/`, `autos/`,
`inventario/`, `financiamiento/`, `historia/`, `contacto/`, and `sitemap.xml`.
Do not make lasting changes directly inside them. Change the source or Airtable,
then regenerate them.

## 1. The Airtable (inventory)

The inventory lives in the Airtable base **"Inventario Valle Auto Sales"**
(`app9Rj2rqXxh1QSTy`), table **Vehículos**. A GitHub Action syncs it to the
site hourly from 6:37 AM to 11:37 PM Puerto Rico time (see section 2). The
family only ever edits Airtable — from the website side it is the single
source of truth.

**Family workflow (all in the Airtable app, phone or computer):**

1. Add a row, give it the next `ID` (`v-011`, `v-012`, …).
2. Fill in the fields — everything is Spanish dropdowns and numbers.
3. Resize new photos to a maximum width of 1600px before uploading them so the
   Airtable base does not fill with unnecessary phone-resolution originals.
   Then drag them into `Fotos`, best exterior shot first (it becomes the cover).
   Suggested order: front ¾ exterior → rest of exterior → interior →
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
| `Motor (L)` | number, normally one decimal (`2.7`, `3.5`, `5.0`); enables engine-size display and filter; empty = nothing shows |
| `Cilindros` | whole number (`4`, `6`, `8`); enables cylinder display and filter; empty = nothing shows |
| `Tracción` | single select: `FWD / delantera`, `RWD`, `AWD`, `4WD`, `4x4`, `4x2`, or `Differential lock`; enables drivetrain display and filter; empty = nothing shows |
| `Combustible` | single select: `Gasolina`, `Diésel`, `Híbrido`, `Híbrido enchufable`, or `Eléctrico`; enables fuel display and filter; empty = nothing shows |
| `Transmisión` | single select: `Automática` or `Manual`; shows on the detail page; empty = the row is omitted. The transmission filter only appears once the lot holds more than one kind |
| `Notas` | free text on the detail page, shown as-is in both languages |
| `Fotos` | the gallery; attachment order = display order |

**Display order** is automatic: featured cars first, then newest first.
There is nothing to renumber.

The inventory search box matches a car's whole displayed attribute set — make,
model, trim, year, type, color, fuel, drivetrain, origin and transmission — in
**both languages at once** and ignoring accents, so `white` and `blanco` return
the same cars, and `automatica` finds the `Automática` ones. Multi-word searches
like `toyota rav4` match in any order.

Powertrain fields are optional. Add the four columns above to Airtable with
the exact field names shown; the sync, search, cards, filters, and detail page
will pick them up automatically. Every `Tracción` choice remains distinct in
the website filter. `AWD` is the always-managed all-wheel system common on
crossovers; only the exact `4x4` category receives the compact 4×4 visual badge;
`4WD`, `4x2`, and `Differential lock` display as their own unbadged options.

## 2. The sync (Airtable → website)

`scripts/sync-inventory.mjs` pulls the base through the Airtable API, writes
`js/inventory.json`, and downloads every photo into `img/cars/` resized to
1600px JPEG (Airtable's own attachment URLs expire after ~2 hours, so the
site never links to them directly). The GitHub Action commits the result.
After each inventory sync, `scripts/build-seo-pages.mjs` also creates one
indexable page per active vehicle under `/autos/<ID>/`, refreshes the static
inventory and business-information pages, and rebuilds `sitemap.xml`. This
lets search engines discover the inventory without relying on JavaScript hash
routes. Generated pages should not be edited by hand.

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

Regenerate the branded social sharing image after changing the logo or
dealership photo:

```bash
npm install --no-save sharp
node scripts/build-social-preview.mjs
```

### Keeping Airtable storage under control

The Airtable plan includes 1 GB of attachments. A full-resolution iPhone photo
is 3–5 MB and a car has about eight of them, so a base full of originals fills
up in roughly fifty cars — which is exactly what happened in July 2026.

The website republishes every photo at 1600px wide no matter what is uploaded,
so an original costs storage and changes nothing a visitor sees. Cleaning that
up is three clicks in the **Actions** tab on GitHub — no terminal, and nobody
has to hold an Airtable token.

**Step 1 — find out where storage is going.** Actions → **Airtable photo
storage check** → *Run workflow*. It is read-only and cannot change anything.
The run summary groups every car by what should happen to it: full-resolution
photos worth replacing, galleries the website has not downloaded yet, and
active cars with no photos at all. It ends with the list of car IDs for the
next step.

Sold cars are listed separately and never counted as reclaimable. The family
keeps a couple of photos of each sold car for their own records, and once a
car leaves the site there is no website copy left to point Airtable at, so
these can only be shrunk by re-uploading smaller ones by hand.

**Step 2 — preview the replacement.** Actions → **Optimize Airtable photos
(manual)** → *Run workflow*. Paste the car IDs, and **leave the "Replace"
checkbox unchecked**. Nothing is written. The run shows, per car, the photo
order it would send and the storage it would return.

**Step 3 — replace, once the preview looks right.** Same workflow, same car
IDs, this time with the checkbox ticked. Airtable re-fetches each photo from
valleautosales.com, one car per second, and every record is read back
afterward to prove the gallery stored in the right order.

Then re-run step 1 to confirm the cars now read as already optimized.

Safety, in short: car IDs are always explicit, there is no "do everything"
mode, preview is the default, and the whole batch is checked before the first
write. Most importantly, the optimizer refuses to touch a car whose Airtable
gallery no longer matches what the last sync downloaded. That check is what
makes re-uploads safe: a re-uploaded photo gets a new attachment ID, and
replacing the gallery before the next sync would push the old pictures back
over Mary's new ones. If a run stops with `SAFETY STOP`, let the hourly sync
run and try again — that is the system working.

You do not have to remember to check. The storage check also runs on the 1st
of each month and **fails the run** once more than 150 MB can be reclaimed,
which makes GitHub email you — earlier warning than Airtable's own "your base
is full". A red X on that workflow means "run a batch when you get a chance",
not "something is broken".

Runs you start by hand report without failing, unless you type a threshold
into `fail_over_mb` yourself.

Both workflows can also be run from a terminal if you prefer; the scripts are
`scripts/audit-airtable-photos.mjs` (read-only) and
`scripts/optimize-airtable-photos.mjs`, and each explains its own usage at the
top of the file.

**Tokens.** The storage check uses the existing read-only `AIRTABLE_TOKEN`
secret that the hourly sync already uses. The optimizer uses a separate
`AIRTABLE_MIGRATION_TOKEN` secret, which needs `data.records:write` because
replacing photos is a write. Keeping them apart is deliberate: the workflow
that runs on a schedule cannot write to the base even if something goes wrong.

The permanent fix is upstream — resizing on the phone before uploading. See
the illustrated Spanish instruction sheet in `CHANGELOG.md` (2026-07-30).

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

## 4. Updating regular website content

The interactive website uses the Spanish and English strings in `js/i18n.js`.
When changing a paragraph, heading, button, phone label, or other wording:

1. Update the Spanish value.
2. Update the matching English value.
3. Search the repository for the old wording. Some important content is also
   present in `index.html` or `scripts/build-seo-pages.mjs` for search engines.
4. If `scripts/build-seo-pages.mjs` changed, regenerate the static pages.
5. Preview both languages before committing.

The family history is a good example: its bilingual interactive text is stored
under `story_p1` through `story_p4` in `js/i18n.js`; the Spanish search-readable
history page is generated from `scripts/build-seo-pages.mjs`. Update both source
locations, then regenerate. Do not edit `historia/index.html` alone because the
next inventory sync will overwrite it.

For major JavaScript text updates, changing the query value on the corresponding
`<script src="...?...">` line in `index.html` can force browsers to download the
new file instead of displaying a cached copy.

## 5. Safe workflow for website changes

Use this sequence every time. It prevents editing an outdated copy and reduces
the chance of Git merge conflicts.

1. Open **GitHub Desktop** and confirm the current repository is
   `Valle-Auto-Sales` and the branch is `main`.
2. If GitHub Desktop shows **Pull origin**, pull before editing. If there are
   uncommitted local changes, review them before pulling.
3. Make the requested changes in the source files—not generated files.
4. Regenerate search-readable pages when necessary:

   ```bash
   node scripts/build-seo-pages.mjs
   ```

5. Run the validation:

   ```bash
   node scripts/seo.test.mjs
   git diff --check
   ```

6. Preview locally, including Spanish, English, mobile, and desktop.
7. In GitHub Desktop, review every changed file. Confirm no vehicle or photo was
   unintentionally changed.
8. Write a clear commit summary, commit to `main`, and click **Push origin**.
9. Allow GitHub a few minutes to publish, then verify the live page in an
   incognito window. A different device can still have its own cache.
10. Add a concise entry to `CHANGELOG.md` for visible or operational changes.

If Pull origin produces a conflict, do not guess or select an entire version
blindly. Preserve both the latest inventory-generated content and the intended
manual change, resolve each marked section, rerun the generator and tests, then
continue the merge.

## Run locally

Do not open `index.html` directly from Finder. Use a local server so the site behaves like it will online:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/#/inventario`.

Useful pages to check:

- `http://localhost:8000/` — homepage
- `http://localhost:8000/#/inventario` — interactive inventory
- `http://localhost:8000/#/historia` — bilingual family history
- `http://localhost:8000/inventario/` — static search-readable inventory
- `http://localhost:8000/historia/` — static search-readable history

## Search engines and local visibility

The site is registered with Google Search Console and Bing Webmaster Tools.
Both use `https://valleautosales.com/sitemap.xml`. Keep the Google HTML
verification file and the IndexNow key file in the repository root; deleting
either can break ownership verification or automated URL submission.

After every inventory change, the GitHub Action rebuilds the sitemap and sends
changed public URLs to IndexNow automatically. A manual workflow run includes
an optional **submit all to IndexNow** checkbox; use it only after a broad site
update or when intentionally resubmitting the complete sitemap.

Google does not use IndexNow. For important manual changes, inspect the affected
page in Google Search Console and request indexing if appropriate. The sitemap
continues to handle normal discovery, so repeated daily requests are unnecessary.

Future SEO review checklist:

- Google Search Console: Pages/Indexing, Performance, HTTPS, Core Web Vitals,
  Product snippets, and Merchant listings.
- Bing Webmaster Tools: Site Explorer, URL Inspection, Search Performance,
  Sitemaps, Recommendations, and Site Scan.
- Confirm the sitemap status is successful and its discovered-page count is
  close to the current number of public pages.
- Confirm the homepage and `/inventario/` are indexable over HTTPS.
- Search Google and Bing for the business name and a few live vehicles; indexing
  can take days or weeks and is never guaranteed merely by submitting a URL.

The Google Business Profile is managed separately from the repository. Keep its
name, address, hours, website, primary/secondary phones, service area, photos,
and business description consistent with the website. Airtable photos do not
automatically upload to the Google Business Profile.

## Facebook publishing

Vehicle information and photos originate in Airtable. A Make scenario can
publish a prepared multi-photo vehicle post to the Valle Auto Sales Facebook
Page and then mark the Airtable record as `Posted`. Only records explicitly set
to `Ready to post` are eligible. Before setting a vehicle to that status,
confirm the price, mileage, specifications, caption, photo order, and current
availability. Avoid reposting a record already marked as posted.

## Troubleshooting

### The live website still shows old wording

1. Confirm the commit was pushed to GitHub, not only committed locally.
2. Confirm GitHub Desktop no longer shows **Push origin**.
3. Wait a few minutes for publishing.
4. Open the exact live URL in an incognito window and hard-refresh it.
5. Check whether the text lives in both `js/i18n.js` and
   `scripts/build-seo-pages.mjs`.
6. If the source changed but the static page did not, rerun
   `node scripts/build-seo-pages.mjs`, commit the generated page, and push.

### Inventory changes do not appear

1. Confirm the Airtable record has a unique `ID` and `Estado = Activo`.
2. Open GitHub → **Actions** → **Sync inventory from Airtable**.
3. Check whether the scheduled or manual run completed successfully.
4. Open the failed step for its error message before rerunning it.
5. Confirm `AIRTABLE_TOKEN` still exists if the Airtable step cannot authenticate.

### Bing or Google shows little/no data

Newly verified sites and new URLs need time. First confirm the live URL test is
green, crawling is allowed, HTTPS works, and the sitemap is successful. Then
wait several days before judging indexing or search-performance reports.

## Before ending a work session

- Confirm GitHub Desktop shows **0 changed files** after the final push.
- Confirm no Pull origin is waiting.
- Check the latest GitHub Actions run if inventory or generated pages changed.
- Verify the live page—not just the local preview.
- Record unfinished follow-ups in `CHANGELOG.md`, an issue, or the active Codex
  task so the next person knows exactly where to continue.

## Development workflow

- Keep the README focused on how the site works and how to operate it.
- Keep `CHANGELOG.md` updated with visible site changes, inventory/data-flow changes, and setup decisions.
- When Claude, Codex, or a person makes a change, the changelog entry and git commit should say who, so the source of the work is traceable.
- Commit related changes together after they have been previewed locally.

## History

- Until July 2026 the inventory came from a Google Sheet read live by the
  browser (see CHANGELOG). It was replaced by the Airtable + sync setup
  above so photos could be managed by drag-and-drop without expiring URLs.
