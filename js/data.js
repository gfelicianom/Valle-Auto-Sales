/* ============================================================
   Valle Auto Sales — Inventory data
   ------------------------------------------------------------
   The inventory reads from a Google Sheet so the family can
   update it without touching code. See README.md for setup.

   1. Create a Google Sheet with a tab named "Inventory" and
      these exact column headers in row 1:
      id | make | model | year | color | mileage | price |
      body_type | origin | registration_fee | condition_tags |
      photo_urls | featured | sold | notes
   2. File → Share → "Anyone with the link" (Viewer).
   3. Paste the sheet's ID below (the long code in its URL).

   While SHEET_ID is empty, the site shows SAMPLE_CARS so you
   can see how everything looks.
   ============================================================ */

const SHEET_ID = "";          // ← paste Google Sheet ID here
const SHEET_TAB = "Inventory";

/* Formspree form ID for the financing lead form (see README).
   While empty, the form falls back to opening the visitor's
   email app addressed to valleauto@yahoo.com. */
const FORMSPREE_ID = "";      // ← paste Formspree form ID here

/* Canonical values used in the sheet:
   body_type: sedan, suv_small, suv_mid, suv_large, pickup,
              hatchback, van, coupe, other
   origin:    local | imported
   color:     blanco, negro, gris, plata, rojo, azul, verde,
              marron, dorado, amarillo, anaranjado, vino
   condition_tags (comma-separated): clean, accident_repaired,
              engine_replaced, body_repair, reconditioned
   featured / sold: yes | no                                   */

const COLOR_SWATCHES = {
  blanco: "#f5f5f2", negro: "#1c1c1e", gris: "#8e8e93", plata: "#c7c9cc",
  rojo: "#b3282d", azul: "#2b5aa7", verde: "#2e6b4f", marron: "#6b4a2f",
  dorado: "#c2a05a", amarillo: "#e8c839", anaranjado: "#d97a2b", vino: "#722f37"
};

const CONDITION_TAG_KEYS = ["clean", "accident_repaired", "engine_replaced", "body_repair", "reconditioned"];

const SAMPLE_CARS = [
  { id: "VA-001", make: "Toyota", model: "Corolla", year: 2019, color: "gris", mileage: 42000, price: 15995,
    body_type: "sedan", origin: "imported", registration_fee: "", condition_tags: ["clean"],
    photo_urls: [], featured: true, sold: false, notes: "" },
  { id: "VA-002", make: "Toyota", model: "Corolla Hatchback", year: 2023, color: "rojo", mileage: 18500, price: 24500,
    body_type: "hatchback", origin: "imported", registration_fee: "$350", condition_tags: ["reconditioned"],
    photo_urls: [], featured: true, sold: false, notes: "" },
  { id: "VA-003", make: "Hyundai", model: "Elantra", year: 2021, color: "plata", mileage: 33000, price: 17900,
    body_type: "sedan", origin: "local", registration_fee: "", condition_tags: ["clean"],
    photo_urls: [], featured: true, sold: false, notes: "" },
  { id: "VA-004", make: "Nissan", model: "Altima", year: 2020, color: "blanco", mileage: 51000, price: 16500,
    body_type: "sedan", origin: "imported", registration_fee: "", condition_tags: ["accident_repaired", "body_repair"],
    photo_urls: [], featured: false, sold: false, notes: "" },
  { id: "VA-005", make: "Mitsubishi", model: "Eclipse Cross", year: 2022, color: "blanco", mileage: 27000, price: 21900,
    body_type: "suv_small", origin: "local", registration_fee: "", condition_tags: ["reconditioned"],
    photo_urls: [], featured: false, sold: false, notes: "" },
  { id: "VA-006", make: "Kia", model: "Rio", year: 2021, color: "azul", mileage: 38000, price: 13900,
    body_type: "hatchback", origin: "imported", registration_fee: "", condition_tags: ["clean"],
    photo_urls: [], featured: false, sold: false, notes: "" },
  { id: "VA-007", make: "Toyota", model: "Tacoma", year: 2018, color: "negro", mileage: 68000, price: 27500,
    body_type: "pickup", origin: "local", registration_fee: "", condition_tags: ["engine_replaced"],
    photo_urls: [], featured: false, sold: false, notes: "" },
  { id: "VA-008", make: "Honda", model: "CR-V", year: 2019, color: "verde", mileage: 47000, price: 19900,
    body_type: "suv_mid", origin: "imported", registration_fee: "", condition_tags: ["reconditioned"],
    photo_urls: [], featured: false, sold: true, notes: "" }
];

/* ---------- Google Sheet loading (gviz JSON endpoint) ---------- */

function parseYesNo(v) {
  return /^(yes|si|sí|y|true|1|x)$/i.test(String(v || "").trim());
}

function normalizeCar(raw) {
  const tags = String(raw.condition_tags || "")
    .split(",").map(s => s.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(s => CONDITION_TAG_KEYS.includes(s));
  const photos = String(raw.photo_urls || "")
    .split(",").map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
  return {
    id: String(raw.id || "").trim(),
    make: String(raw.make || "").trim(),
    model: String(raw.model || "").trim(),
    year: parseInt(raw.year, 10) || 0,
    color: String(raw.color || "").trim().toLowerCase(),
    mileage: parseInt(String(raw.mileage).replace(/[^\d]/g, ""), 10) || 0,
    price: parseFloat(String(raw.price).replace(/[^\d.]/g, "")) || 0,
    body_type: String(raw.body_type || "other").trim().toLowerCase().replace(/\s+/g, "_"),
    origin: /import/i.test(String(raw.origin || "")) ? "imported" : "local",
    registration_fee: String(raw.registration_fee || "").trim(),
    condition_tags: tags,
    photo_urls: photos,
    featured: parseYesNo(raw.featured),
    sold: parseYesNo(raw.sold),
    notes: String(raw.notes || "").trim()
  };
}

async function loadInventory() {
  if (!SHEET_ID) return SAMPLE_CARS.map(c => normalizeCar({ ...c, condition_tags: c.condition_tags.join(","), photo_urls: c.photo_urls.join(","), featured: c.featured ? "yes" : "no", sold: c.sold ? "yes" : "no" }));
  try {
    const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
      "/gviz/tq?tqx=out:json&headers=1&sheet=" + encodeURIComponent(SHEET_TAB);
    const res = await fetch(url);
    const text = await res.text();
    const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const cols = json.table.cols.map(c => (c.label || "").trim().toLowerCase());
    const cars = json.table.rows.map(r => {
      const raw = {};
      cols.forEach((label, i) => {
        const cell = r.c[i];
        raw[label] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : "") : "";
      });
      return normalizeCar(raw);
    }).filter(c => c.id && c.make);
    return cars.length ? cars : SAMPLE_CARS.map(normalizeCar);
  } catch (e) {
    console.warn("Could not load Google Sheet, using sample data.", e);
    return SAMPLE_CARS.map(c => normalizeCar({ ...c, condition_tags: c.condition_tags.join(","), photo_urls: c.photo_urls.join(","), featured: c.featured ? "yes" : "no", sold: c.sold ? "yes" : "no" }));
  }
}
