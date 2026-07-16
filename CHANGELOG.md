# Changelog

Development history for the Valle Auto Sales website.

## 2026-07-16

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
