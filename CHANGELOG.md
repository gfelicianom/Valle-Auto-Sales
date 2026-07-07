# Changelog

Development history for the Valle Auto Sales website.

## 2026-07-07

### Added

- Codex added the supplied `ValleAuto.svg` logo as `img/brand/valle-auto-logo.svg` and integrated it into the site header and footer.

### Changed

- Codex updated the inventory photo workflow so the Google Sheet uses stable repo-relative image paths like `img/cars/v-001-1.jpg` instead of expiring Facebook CDN URLs.
- Codex updated `js/data.js` to accept repo-relative `img/...` paths from the Inventory and Photos tabs, removing the temporary hardcoded local-photo override.
- Codex documented the current photo workflow in `README.md`.

### Verified

- Codex previewed the logo integration at desktop and mobile widths, confirming the header has no horizontal overflow and the SVG loads in the header/footer.
- Codex previewed the site at `http://localhost:8000/#/inventario` and confirmed all 10 inventory cards loaded photos from `img/cars/...`.
