# Changelog

Development history for the Valle Auto Sales website.

## 2026-07-07

### Changed

- Codex updated the inventory photo workflow so the Google Sheet uses stable repo-relative image paths like `img/cars/v-001-1.jpg` instead of expiring Facebook CDN URLs.
- Codex updated `js/data.js` to accept repo-relative `img/...` paths from the Inventory and Photos tabs, removing the temporary hardcoded local-photo override.
- Codex documented the current photo workflow in `README.md`.

### Verified

- Codex previewed the site at `http://localhost:8000/#/inventario` and confirmed all 10 inventory cards loaded photos from `img/cars/...`.
