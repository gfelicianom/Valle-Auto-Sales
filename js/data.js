/* ============================================================
   Valle Auto Sales — Inventory data
   ------------------------------------------------------------
   The inventory reads from the "Valle Auto Sales Inventory CMS"
   Google Sheet so the family can update it without touching code.

   Sheet layout (tab "Inventory", one row per car):
     status            active | sold | draft (draft rows are hidden)
     inventory_id      unique id, e.g. v-001
     sort_order        display order (lower = first)
     featured          TRUE/FALSE — show on the home page
     website_slug      (unused by the site, kept for reference)
     title             e.g. "Nissan Versa 2021" (fallback if make/model empty)
     year / make / model / trim
     body_style        Sedan, SUV, Pickup, Hatchback, Van, Coupe…
     mileage           number
     price_usd         number
     condition         free text, shown on the detail page
     features          free text, shown on the detail page
     financing_available / warranty_available / credit_friendly  TRUE/FALSE
     headline_es / description_es   (unused — site builds its own)
     image_url         primary photo (Photos tab overrides if present)
     color / origin    OPTIONAL — add these columns to enable the
                       color swatches and Local/Importado badges.
                       color: blanco, negro, gris, plata, rojo, azul,
                              verde, marron, dorado, amarillo,
                              anaranjado, vino
                       origin: local | imported

   Tab "Photos" (one row per photo):
     inventory_id | sort_order | image_url

   The sheet must be shared "Anyone with the link — Viewer" or
   Google blocks the read and the site shows SAMPLE_CARS instead.
   ============================================================ */

/* Sheet CMS retired 2026-07 — inventory is moving to Airtable
   (base app9Rj2rqXxh1QSTy) with a sync that writes js/inventory.json.
   Leave SHEET_ID empty. */
const SHEET_ID = "";
const SHEET_TAB = "Inventory";
const PHOTOS_TAB = "Photos";

/* Formspree form ID for the financing lead form (see README).
   While empty, the form falls back to opening the visitor's
   email app addressed to valleauto@yahoo.com. */
const FORMSPREE_ID = "";      // ← paste Formspree form ID here

const COLOR_SWATCHES = {
  blanco: "#f5f5f2", negro: "#1c1c1e", gris: "#8e8e93", plata: "#c7c9cc",
  rojo: "#b3282d", azul: "#2b5aa7", verde: "#2e6b4f", marron: "#6b4a2f",
  dorado: "#c2a05a", amarillo: "#e8c839", anaranjado: "#d97a2b", vino: "#722f37"
};

const CONDITION_TAG_KEYS = ["clean", "accident_repaired", "engine_replaced", "body_repair", "reconditioned"];
const VALID_IMAGE_URL = /^(https?:\/\/|img\/)/;

/* Cleared 2026-07 for the Airtable migration — the site shows the
   "no cars" empty state until the Airtable sync lands. */
const SAMPLE_CARS = [];

/* ---------- Google Sheet loading (gviz JSON endpoint) ---------- */

function parseYesNo(v) {
  return /^(yes|si|sí|y|true|1|x)$/i.test(String(v || "").trim());
}

const BODY_STYLE_MAP = {
  sedan: "sedan", "sedán": "sedan",
  suv: "suv", suv_small: "suv_small", suv_mid: "suv_mid", suv_large: "suv_large",
  crossover: "suv", cuv: "suv",
  pickup: "pickup", truck: "pickup", camioneta: "pickup",
  hatchback: "hatchback",
  van: "van", minivan: "van",
  coupe: "coupe", "coupé": "coupe"
};

async function fetchSheetTab(tab) {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
    "/gviz/tq?tqx=out:json&headers=1&sheet=" + encodeURIComponent(tab);
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  if (!json.table) throw new Error(json.errors ? json.errors[0].reason : "no table");
  const cols = json.table.cols.map(c => (c.label || "").trim().toLowerCase());
  return json.table.rows.map(r => {
    const raw = {};
    cols.forEach((label, i) => {
      const cell = r.c && r.c[i];
      raw[label] = cell && cell.v !== null && cell.v !== undefined ? cell.v : "";
    });
    return raw;
  });
}

function normalizeCmsRow(raw) {
  const status = String(raw.status || "").trim().toLowerCase();
  const trim = String(raw.trim || "").trim();
  const bodyRaw = String(raw.body_style || raw.body_type || "").trim().toLowerCase().replace(/\s+/g, "_");
  const tags = String(raw.condition_tags || "")
    .split(",").map(s => s.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(s => CONDITION_TAG_KEYS.includes(s));
  const notes = [String(raw.condition || "").trim(), String(raw.features || "").trim()]
    .filter(Boolean).join(" · ");
  const originRaw = String(raw.origin || "").trim();
  return {
    id: String(raw.inventory_id || raw.id || "").trim(),
    status: status || "active",
    sort_order: parseInt(raw.sort_order, 10) || 9999,
    make: String(raw.make || "").trim(),
    model: (String(raw.model || "").trim() + (trim ? " " + trim : "")).trim(),
    title: String(raw.title || "").trim(),
    year: parseInt(raw.year, 10) || 0,
    color: String(raw.color || "").trim().toLowerCase(),
    mileage: parseInt(String(raw.mileage).replace(/[^\d]/g, ""), 10) || 0,
    price: parseFloat(String(raw.price_usd || raw.price).replace(/[^\d.]/g, "")) || 0,
    body_type: BODY_STYLE_MAP[bodyRaw] || (bodyRaw ? "other" : "other"),
    /* "" = column not filled in — the UI hides the badge */
    origin: originRaw ? (/import/i.test(originRaw) ? "imported" : "local") : "",
    registration_fee: String(raw.registration_fee || "").trim(),
    condition_tags: tags,
    photo_urls: VALID_IMAGE_URL.test(String(raw.image_url || "").trim()) ? [String(raw.image_url).trim()] : [],
    featured: parseYesNo(raw.featured),
    sold: status === "sold" || status === "vendido" || parseYesNo(raw.sold),
    notes: notes
  };
}

/* Sample data uses the legacy column names — adapt then normalize */
function sampleCars() {
  return SAMPLE_CARS.map(c => normalizeCmsRow({
    inventory_id: c.id, status: c.sold ? "sold" : "active", sort_order: "",
    make: c.make, model: c.model, year: c.year, color: c.color,
    mileage: c.mileage, price_usd: c.price, body_style: c.body_type,
    origin: c.origin, registration_fee: c.registration_fee,
    condition_tags: c.condition_tags.join(","), image_url: c.photo_urls[0] || "",
    featured: c.featured ? "yes" : "no"
  }));
}

async function loadInventory() {
  if (!SHEET_ID) return sampleCars();
  try {
    const [invRows, photoRows] = await Promise.all([
      fetchSheetTab(SHEET_TAB),
      fetchSheetTab(PHOTOS_TAB).catch(() => [])
    ]);

    /* Group photos by inventory_id, ordered by sort_order.
       Accepts full URLs and repo-relative paths (img/cars/…). */
    const photosByCar = {};
    photoRows.forEach(p => {
      const id = String(p.inventory_id || "").trim();
      const url = String(p.image_url || "").trim();
      if (!id || !(/^https?:\/\//.test(url) || /^img\//.test(url))) return;
      (photosByCar[id] = photosByCar[id] || []).push({ url, order: parseInt(p.sort_order, 10) || 9999 });
    });

    const cars = invRows.map(normalizeCmsRow)
      .filter(c => c.id && (c.make || c.title))
      .filter(c => c.status === "active" || c.sold);  /* draft/hidden rows stay off the site */

    cars.forEach(c => {
      /* if make/model are blank, split them out of the title ("Nissan Versa 2021") */
      if (!c.make && c.title) {
        const words = c.title.replace(/\b(19|20)\d{2}\b/g, "").trim().split(/\s+/);
        c.make = words.shift() || "";
        c.model = words.join(" ");
        if (!c.year) { const m = c.title.match(/\b(19|20)\d{2}\b/); if (m) c.year = +m[0]; }
      }
      const gallery = (photosByCar[c.id] || []).sort((a, b) => a.order - b.order).map(p => p.url);
      if (gallery.length) c.photo_urls = gallery;
    });

    cars.sort((a, b) => a.sort_order - b.sort_order);
    return cars.length ? cars : sampleCars();
  } catch (e) {
    console.warn("Could not load Google Sheet, using sample data.", e);
    return sampleCars();
  }
}
