# Changelog

Development history for the Valle Auto Sales website.

## 2026-08-24

### Changed (tagline)

- Gio replaced the tagline "Familia sirviendo a Aguada desde 1992" with "Familia de Aguada sirviendo a Puerto Rico desde 1992", and its English counterpart with "An Aguada family serving Puerto Rico since 1992". The old line described the business as serving a single town. It has always sold to the whole west of the island and beyond, and a buyer searching from another town found nothing in the wording that spoke to them. The new line keeps Aguada as the origin rather than the limit.
- The wording was chosen over "Familia sirviendo a Puerto Rico desde Aguada", which had been the first instinct. That version collides with the year: "desde Aguada desde 1992" uses the same word for a place and for a date in one breath, and the sentence trips. Changing "desde Aguada" to "de Aguada" keeps the rhythm and removes the collision.
- All eight copies were updated — both languages of `family_line`, the four meta and schema descriptions in `index.html`, the generated `/historia/` heading in `scripts/build-seo-pages.mjs`, and the text drawn into the shared image by `scripts/build-social-preview.mjs`. The generated history page and social preview image were refreshed, and the live site was verified after deployment.
- Codex aligned the public Facebook Page presentation with the website while preserving the useful sales details: `Familia de Aguada sirviendo a Puerto Rico desde 1992. Autos usados. Financiamiento disponible, incluso con crédito afectado. Garantía en el 99% de las unidades. | An Aguada family serving Puerto Rico since 1992.`

### Fixed (GitHub Pages deployment)

- The tagline commit accidentally included the local `outputs/` audit folder and its absolute `node_modules` symbolic link. GitHub Pages could not resolve that Mac-only path, so the tests passed but deployment #161 failed and the live site stayed on the previous version.
- Codex removed `outputs/` from Git tracking without deleting the local audit files, added `/outputs/` to `.gitignore`, and pushed commit `1c00d6d`. Tests and GitHub Pages deployment #162 completed successfully, and the visible tagline, search/social metadata, and published preview image were verified on `valleautosales.com`.

### Added (documentation)

- Claude documented in `README.md` the eight places the tagline lives and the two generators that must be rerun after changing it. The tagline is the only string in the project repeated that widely, and half its copies are generated, so a partial edit leaves no visible trace on the site itself.

## 2026-08-12

### Added (permanent Airtable photo storage tooling)

- Claude brought the July photo tooling back as a supported pair of scripts, after full-resolution photos reappeared in the base through ordinary re-uploads. July's cleanup was written as a one-off and deleted on purpose; the thing that turned out to be recurring is not the migration but the *drift*, so what came back is an audit, with the replacer as its second step.
- Claude added `scripts/audit-airtable-photos.mjs`, read-only and needing nothing beyond the existing `data.records:read` token. It sorts every car into what should happen to it — full-resolution photos worth replacing, sold cars still holding a gallery, galleries the website has not downloaded yet, active cars with no photos at all — estimates the storage each would return by comparing against the published copies, and prints the exact command for the next step.
- Claude added `--save` / `--compare` snapshots to the audit, which turns July's hand-checked verification into a repeatable one. The check that matters is per-position aspect ratio: a gallery can keep its photo count and order and still have the wrong picture in slot three, and a resize never changes a photo's shape.
- Claude restored the migration script as `scripts/optimize-airtable-photos.mjs` with its nine safety tests, and moved the shared base ID, naming rule, and 1600px ceiling into `scripts/photo-storage.mjs`. Preview is still the default, car IDs are still explicit, and there is still no "do everything" mode. It now also reports the storage each car returns.
- Claude restored `.github/workflows/optimize-airtable-photos.yml`, the manual preview-first dispatch Codex designed in July, unchanged apart from the script names. July removed it on the grounds that a bulk photo replacer behind a button is a standing hazard; Chelsea's call is that the greater hazard is a cleanup nobody can run without a terminal and a write token in it. The guards that make the button safe are the ones already in the script: explicit car IDs, no "do everything" mode, preview by default, the whole batch checked before the first write, and a refusal to touch any gallery that has changed since the last website sync.
- Claude kept the two Airtable tokens separate. The monthly check runs on the existing read-only `AIRTABLE_TOKEN`; only the manual workflow uses `AIRTABLE_MIGRATION_TOKEN`, so the workflow that runs on a schedule cannot write to the base.
- Claude added `.github/workflows/audit-airtable-photos.yml`, a read-only button that publishes the audit to the run summary. It takes an optional `fail_over_mb` and fails the run once that much storage is reclaimable.
- Claude turned on the monthly schedule once Chelsea had exercised both workflows by hand. It runs at 8:15 AM Puerto Rico time on the 1st and carries a 150 MB threshold, so a red run means "worth a batch" rather than "something is broken". Hand-started runs still report without failing unless a threshold is typed in.
- Claude corrected the audit's advice about cars that are off the site. It had told the reader to clear those galleries and counted them as reclaimable storage, which is wrong: Mary keeps a couple of photos of each sold car for the family's records, and with no website copy left to point Airtable at, the optimizer could not touch them anyway. They are now listed with their Estado, under a heading that says there is nothing to do automatically, and their size is reported on its own line instead of inside "recoverable now".
- Claude added `scripts/audit-airtable-photos.test.mjs` and wired both photo test suites into `.github/workflows/tests.yml`. One test asserts the audit's width ceiling still equals the width `scripts/sync-inventory.mjs` publishes, since the audit calls a photo oversized by comparing against it.

## 2026-08-06

### Added (Transmisión field)

- Claude added the Airtable `Transmisión` single select (`Automática` / `Manual`) to the sync as a new `transmission` key, mapped through `scripts/transmission.mjs` the same way `Tracción` is, so an Airtable wording change cannot silently drop the value.
- Claude added the Transmisión row to both car detail pages — the in-site page (`js/app.js`) and the generated search-engine page (`scripts/build-seo-pages.mjs`) — directly after Tracción. A car with no transmission set omits the row entirely instead of showing a blank one, and the generated page also publishes `vehicleTransmission` in its structured data.
- Claude added a Transmisión filter to the inventory page. It stays hidden while every car in stock shares one transmission (today 56 automatic, 1 manual, 1 unset) and appears on its own once the lot holds more than one kind. Cars with no transmission set stay listed until a visitor actively picks a value.
- Claude added `scripts/transmission.test.mjs`, covering the live Airtable options, common aliases, empty/unknown input, and the presence of Spanish and English labels.
- Claude added `.github/workflows/tests.yml`, which runs the mapper tests, rebuilds the search-engine pages from the inventory already in the repository, and validates them — on every push to `main` and every pull request. It never contacts Airtable and never commits; the rebuilt files are discarded with the runner, so the only purpose is catching a broken generator when it is pushed rather than at the next hourly sync. Commits that only touch generated inventory data are skipped, since the sync run already tests those.
- Claude added the mapper tests to the sync workflow. `scripts/drivetrain.test.mjs` had never run in CI, so both it and the new transmission test now execute on every sync, *before* the Airtable pull — a broken field mapper stops the run instead of writing bad values into `js/inventory.json` and committing them. The generated-page test still runs after the build, since it reads the pages the build produces.

### Fixed (inventory search returned nothing for color words)

- Claude fixed the inventory search box returning 0 results for terms like `white` even though the Color filter for White worked. The search had only ever matched make, model, year and powertrain fields, so any color, body-type or origin word matched nothing and filtered the list to empty.
- Claude rebuilt the search to index each car's full displayed attribute set — make, model, trim, year, type, color, fuel, drivetrain, origin and transmission — in **both languages simultaneously**, so `white` and `blanco` return the same cars whichever language the site is showing. Matching is accent- and case-insensitive (`automatica` finds `Automática`), and each word is matched independently so `toyota rav4` works in any order.
- Claude added `tIn(lang, key)` to `js/i18n.js` so the search can read labels in a specific language; `t()` now calls it with the current language.
- Claude updated the search placeholder, which still promised only "marca, modelo, motor o tracción".

### Verified

- Claude confirmed against the live Airtable base that `Transmisión` (fldLa6HUAJKaLYNnt) offers exactly `Automática` and `Manual`, that v-050 (2015 Honda Civic Si) is the only Manual car, and that v-045 (2025 Toyota Corolla SE) is Automática.
- Claude previewed the site and confirmed: the Transmisión row renders after Tracción for v-050 (Manual) and v-045 (Automática) in Spanish and English; a car with no transmission omits the row with no blank cell and still appears in the unfiltered list; the filter lists only Automática/Manual, hides itself when the lot is all-automatic or all-unset, and excludes unset cars only once a value is picked.
- Claude confirmed the search fix returns 11 white cars for both `white` and `blanco` — matching the Color filter exactly, where it previously returned 0 — and that `manual` finds only v-050, `automatica` (unaccented) finds the automatics, `pickup` finds the F-150s, Tacomas, Santa Cruz and RAM, and `toyota rav4` finds the three RAV4s, identically in both languages.
- Node is not installed on this Mac, so `scripts/build-seo-pages.mjs` and the `.mjs` tests were not run locally; the hourly GitHub Action runs both. The generated-page spec logic was verified by evaluating the same expression against real inventory data.

## 2026-08-05

### Changed (future maintenance documentation)

- Codex expanded the README into a beginner-friendly operating guide covering safe website edits, generated files, bilingual content, GitHub publishing, Airtable inventory and photo practices, Facebook publishing, Google/Bing follow-up, and common troubleshooting.

## 2026-07-30

### Added (Airtable photo migration safety)

- Chelsea manually replaced the `v-001` originals with the website-sized copies as the first storage-reduction trial.
- Codex hardened Claude's one-off migration script so preview mode is the default, every selected gallery must match the last successful inventory sync, already-migrated records are skipped, the complete batch is checked before any write, and unexpected failures stop the batch.
- Codex added focused safety tests and a manual GitHub Actions workflow so the migration can be previewed and deliberately applied from GitHub without handling the token in a terminal.
- Claude changed already-migrated records from a fatal error to a skip, so a partially completed batch can be re-run with the same car list instead of aborting on the cars that already succeeded.
- Claude raised the attachment read-back budget from 12s to 60s. Airtable needs well over 12s to finish ingesting a gallery, so successful writes were being reported as failures; the error message now distinguishes "accepted but still processing" from "stored the wrong gallery".

### Changed (Airtable attachment storage)

- All 50 active vehicles now hold the website-sized copies in Airtable instead of full-resolution phone originals. Verified: 293 photos, every photo unchanged in position and dimensions, largest file-size change -1.51% from re-encoding.
- The sold vehicles `v-003`, `v-004`, `v-030`, and `v-047` were removed from the base entirely.
- Attachment storage stays at 1GB until Airtable's revision history expires (about two weeks on the Free plan), after which the base should settle near 70MB.
- Photos uploaded from now on should be resized before upload; the build already caps display width at 1600px, so full-resolution originals cost storage without improving the site.

### Removed

- The one-off migration script, its tests, and the manual migration workflow, now that every vehicle is migrated. Recoverable from git history if the base ever needs re-normalizing.

## 2026-08-03

### Added (Airtable → Facebook publishing)

- Codex standardized the Airtable `Facebook caption` formula so vehicle posts are generated automatically from inventory data, with neutral Spanish promotional text, conditional specifications, thousands separators for prices and mileage, financing, and contact details.
- Codex completed and verified the Make gallery flow: every `Fotos` attachment is aggregated into one Facebook Page post, then the Airtable record is marked `Posted` using its system record ID.
- Codex tested the full flow with `v-057` (2023 Kia Río), verified the published multi-photo Facebook gallery and status safeguard, and activated the Make scenario on its hourly schedule. Only records explicitly set to `Ready to post` are eligible.

## 2026-07-29

### Changed (contact numbers)

- Codex made the mobile number (787) 233-4800 the primary number for calls and WhatsApp throughout the website, metadata, and dealership structured data.
- Codex retained the original office landline (787) 868-4840 as a clearly labeled secondary number for calls only.

### Changed (family history)

- Codex replaced the complete family history in Spanish and English with the owner-approved text while preserving the existing story layout and imagery.

### Added (IndexNow)

- Added IndexNow verification and automated URL notifications after inventory changes.
- Added a manual GitHub Actions option to submit the complete sitemap to IndexNow.

## 2026-07-27

### Fixed (image accessibility)

- Codex added descriptive alternative text to the homepage logo and vehicle-gallery thumbnails, resolving the missing image-alt warning reported by Bing Site Scan.

## 2026-07-22

### Added (search visibility)

- Codex added crawlable pages for inventory, financing, history, contact, and every active vehicle, with unique titles, descriptions, canonical URLs, social metadata, and Vehicle/Product structured data.
- Codex added automatic sitemap generation to the Airtable workflow so newly added and removed vehicles are reflected in search-engine discovery after every sync.
- Codex added a search-readable homepage first render and direct internal links to the new pages while preserving the interactive bilingual website.

### Changed (local SEO)

- Codex strengthened the homepage dealership metadata with WebSite and AutoDealer entities, the existing Google Maps listing, business area, logo, address, telephone, and opening hours.

## 2026-07-18

### Changed (vehicle contact buttons)

- Codex updated the vehicle and financing contact buttons so both WhatsApp and direct calls use the mobile number (787) 233-4800. The call button is now labeled “Llamar” / “Call”; the office number remains available in the footer and contact page.

### Changed (Tracción categories)

- Codex integrated all seven live Airtable `Tracción` options. The sync now preserves `4WD`, `4x4`, `4x2`, and `Differential lock` as distinct website values instead of collapsing or dropping them; the inventory filter, cards, detail view, search, and Spanish/English labels support the expanded set. Only the exact `4x4` category receives the visual 4×4 badge. Mapper tests cover every live option and common aliases.

## 2026-07-17

### Fixed (custom-domain link previews)

- Codex added a dedicated 1200×630 social-sharing image using the Valle Auto Sales logo and black/red brand palette, replaced the plain green-heavy dealership photo in Open Graph and structured metadata, and added explicit image dimensions, type, alt text, Twitter metadata, and theme color so messaging and social crawlers can build a complete preview for `valleautosales.com`.

## 2026-07-16

### Added (searchable vehicle specifications)

- Codex added optional Airtable fields for `Motor (L)`, `Cilindros`, `Tracción`, and `Combustible`. The sync publishes them as structured data, the inventory provides conditional filters and search, cards show a compact powertrain summary, and detail pages show only the specifications filled in for that vehicle. Spanish and English labels are included, with AWD kept distinct from truck-style 4WD/4x4.

### Fixed (Origen field)

- Claude fixed the sync dropping the `Origen` field: it always wrote an empty value, so the Local/Importado badge, filter, and detail-page note never appeared even when the family set it in Airtable. The sync now maps `Local`/`Importado` to the site's internal keys, and the website shows it in Spanish by default with the existing English translation.

### Changed (documentation)

- Claude documented the `Origen` field in the README field table, and made the changelog-attribution rule cover Claude, Codex, and people (it previously only named Codex).

### Changed (housekeeping)

- Giomarell stopped git from tracking macOS `.DS_Store` metadata files (added to `.gitignore`), ending the noise commits that appeared when switching between computers.

### Changed (inventory scheduler)

- Codex changed the Airtable sync to a timezone-aware hourly schedule from 6:37 AM through 11:37 PM Puerto Rico time, forcing GitHub to register a fresh schedule after the previous cron ran only twice daily.
- Codex upgraded `actions/checkout` and `actions/setup-node` from v4 to v5 so the workflow actions use the supported Node.js 24 runtime without deprecation warnings.

## 2026-07-15

### Added (lead form delivery)

- Claude wired the financing form to FormSubmit.co (free, no account; Web3Forms rejected the Yahoo address): submissions email valleauto@yahoo.com with the car in the subject line, a honeypot field filters bots, and any send failure falls back to the visitor's email app so leads aren't lost. Needs one-time activation from the Yahoo inbox after the first submission.

### Changed (family content requests)

- Claude simplified the financing page per the family: no specific banks (Banco Popular) or cooperativas mentioned — one card now says financing is available at the dealer and we work with you and your bank. The lead form's "Banco preferido" dropdown became "Forma de pago" (Al contado/Financiamiento).
- Claude set the official founding date (July 1992) across the site: hero, footer tagline, story page, meta descriptions, and JSON-LD `foundingDate`.
- Claude updated hours to Mon–Sat 8:30 AM–5:30 PM everywhere (contact page + JSON-LD).
- Claude labeled the phone numbers — 💬 WhatsApp (787) 233-4800 now opens a chat via wa.me; 📞 Oficina (787) 868-4840 stays a tel: link — in the contact page and footer. The form-error message now points to the office number.

### Changed (later that day)

- Claude removed sold cars from the site per the family's preference: the sync now publishes only `Estado = Activo` records, so `Vendido` takes a car (and its photos) off the website while the Airtable record remains as sales history. The VENDIDO-tag display is no longer reachable.

### Added

- Claude built the Airtable → website sync: `scripts/sync-inventory.mjs` (pulls the base, writes `js/inventory.json`, downloads `Fotos` attachments to `img/cars/<ID>-<n>.jpg` resized to 1600px JPEG, prunes removed cars' photos) and `.github/workflows/sync-inventory.yml` (every 2 hours + manual run; needs the `AIRTABLE_TOKEN` repo secret, scope `data.records:read`). `js/data.js` now loads `js/inventory.json` instead of the Google Sheet; the gviz loader was removed. Display order is automatic: available → featured → newest, sold last.

### Changed

- Claude cleared the sample inventory for the Airtable migration: deleted `img/cars/v-001-1.jpg` – `v-010-1.jpg`, emptied `SAMPLE_CARS`, and disconnected the Google Sheet (`SHEET_ID = ""`) in `js/data.js`. The site shows the empty-inventory message until the Airtable ("Inventario Valle Auto Sales", base `app9Rj2rqXxh1QSTy`) → `js/inventory.json` sync is built.

## 2026-07-07

### Added

- Claude added a dealership photo (`img/dealership.jpg`) to the home hero, side by side with the intro text (stacks below 860px).
- Claude added the family photo (`img/family.jpg`) to the Nuestra Historia page with a bilingual caption.
- Claude added a Google reviews badge (4.5 ★ · 47 reseñas, hand-updated) to the home Visítenos panel, linking to the Maps listing.
- Claude added business hours (Mon–Sat 8 AM–6 PM, Sun closed) and a Facebook link to the Contact page and footer.
- Claude added Open Graph/Twitter meta tags and `AutoDealer` JSON-LD structured data to `index.html` (og:image URL assumes GitHub Pages; update when the final domain is live).

- Codex replaced the initial logo with the full-name `Valle Auto Sales long logo.svg` asset as `img/brand/valle-auto-sales-logo.svg`.
- Codex resized the header logo box and refreshed the stylesheet URL so the full wordmark and car stroke fit without clipping.

### Changed

- Codex updated the inventory photo workflow so the Google Sheet uses stable repo-relative image paths like `img/cars/v-001-1.jpg` instead of expiring Facebook CDN URLs.
- Codex updated `js/data.js` to accept repo-relative `img/...` paths from the Inventory and Photos tabs, removing the temporary hardcoded local-photo override.
- Codex documented the current photo workflow in `README.md`.

### Verified

- Codex previewed the full-name logo integration at desktop and mobile widths, confirming the header has no horizontal overflow and the SVG loads in the header/footer.
- Codex previewed the site at `http://localhost:8000/#/inventario` and confirmed all 10 inventory cards loaded photos from `img/cars/...`.
