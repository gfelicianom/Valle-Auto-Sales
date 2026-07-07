# Changelog

Development history for the Valle Auto Sales website.

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
