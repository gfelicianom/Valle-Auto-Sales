#!/usr/bin/env node
/* ============================================================
   Valle Auto Sales — Airtable → website sync
   ------------------------------------------------------------
   Reads the "Inventario Valle Auto Sales" Airtable base and:
     1. writes js/inventory.json (the data the site renders)
     2. downloads each car's Fotos attachments into img/cars/
        as <ID>-<n>.jpg, resized to max 1600px wide
     3. prunes photos of cars that were removed or hidden

   Airtable attachment URLs expire (~2h), which is why photos
   must be downloaded here rather than hotlinked by the site.

   Cars appear on the site only while Estado is "Activo".
   "Vendido", "Borrador", or empty = off the site.

   Usage:  AIRTABLE_TOKEN=pat… node scripts/sync-inventory.mjs
   Needs:  Node 20+, `npm install --no-save sharp`
   Run from the repo root (the GitHub Action does all this).
   ============================================================ */

import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_ID = "app9Rj2rqXxh1QSTy";
const TABLE_ID = "tblt7l3jOV8Rvk91K"; // Vehículos
const CARS_DIR = "img/cars";
const JSON_PATH = "js/inventory.json";
const MANIFEST_PATH = path.join(CARS_DIR, "manifest.json");
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;

const token = process.env.AIRTABLE_TOKEN;
if (!token) {
  console.error("AIRTABLE_TOKEN is not set.");
  process.exit(1);
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed — run: npm install --no-save sharp");
  process.exit(1);
}

/* "Marrón" → "marron", "Vendido" → "vendido" — the site's internal keys */
const key = (s) =>
  String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const BODY_MAP = {
  sedan: "sedan", suv: "suv", pickup: "pickup",
  hatchback: "hatchback", van: "van", coupe: "coupe"
};

/* Keep the Airtable labels friendly for the family while publishing stable,
   language-neutral keys for the bilingual website. */
const DRIVETRAIN_MAP = {
  fwd: "fwd", delantera: "fwd", "traccion delantera": "fwd",
  rwd: "rwd", trasera: "rwd", "traccion trasera": "rwd",
  awd: "awd", integral: "awd", "traccion integral": "awd",
  "4wd": "4wd", "4x4": "4wd", "cuatro por cuatro": "4wd"
};

const FUEL_MAP = {
  gasolina: "gasoline", gas: "gasoline", gasoline: "gasoline",
  diesel: "diesel",
  hibrido: "hybrid", hybrid: "hybrid",
  "hibrido enchufable": "plug_in_hybrid", "plug-in hybrid": "plug_in_hybrid",
  electrico: "electric", electric: "electric"
};

async function fetchRecords() {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable API ${res.status}: ${await res.text()}`);
    const page = await res.json();
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

function toCar(rec) {
  const f = rec.fields;
  const estado = key(f["Estado"]);
  /* Family decision 2026-07-15: sold cars come OFF the site entirely,
     so only Activo is published. Vendido/Borrador/empty = hidden. */
  if (estado !== "activo") return null;
  const id = String(f["ID"] || "").trim();
  if (!id) return null;
  const trim = String(f["Trim"] || "").trim();
  return {
    id,
    status: "active",
    make: String(f["Marca"] || "").trim(),
    model: (String(f["Modelo"] || "").trim() + (trim ? " " + trim : "")).trim(),
    year: Number(f["Año"]) || 0,
    color: key(f["Color"]),
    mileage: Number(f["Millaje"]) || 0,
    price: Number(f["Precio"]) || 0,
    body_type: BODY_MAP[key(f["Tipo"])] || (f["Tipo"] ? "other" : "other"),
    engine_liters: Number(f["Motor (L)"]) || 0,
    cylinders: Number(f["Cilindros"]) || 0,
    drivetrain: DRIVETRAIN_MAP[key(f["Tracción"])] || "",
    fuel_type: FUEL_MAP[key(f["Combustible"])] || "",
    /* Airtable "Origen" stays Spanish (Local/Importado); the site code uses
       internal keys "local"/"imported" and i18n.js shows the right language. */
    origin: f["Origen"] ? (key(f["Origen"]) === "importado" ? "imported" : "local") : "",
    registration_fee: "",
    condition_tags: [],
    notes: String(f["Notas"] || "").trim(),
    featured: !!f["Destacado"],
    sold: false,
    _created: rec.createdTime,
    _fotos: Array.isArray(f["Fotos"]) ? f["Fotos"] : []
  };
}

async function main() {
  await mkdir(CARS_DIR, { recursive: true });

  const cars = (await fetchRecords()).map(toCar).filter(Boolean);

  /* Site order: featured first, then newest arrivals. */
  cars.sort((a, b) => {
    if (a.featured !== b.featured) return b.featured - a.featured;
    return b._created.localeCompare(a._created);
  });

  /* manifest: filename → Airtable attachment id, so unchanged photos
     aren't re-downloaded on every run */
  let manifest = {};
  try { manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")); } catch {}
  const nextManifest = {};

  for (const car of cars) {
    car.photo_urls = [];
    for (let i = 0; i < car._fotos.length; i++) {
      const att = car._fotos[i];
      const file = `${car.id}-${i + 1}.jpg`;
      const dest = path.join(CARS_DIR, file);
      car.photo_urls.push(`img/cars/${file}`);
      nextManifest[file] = att.id;
      if (manifest[file] === att.id) continue; // already downloaded
      console.log(`downloading ${file} (${att.filename})`);
      const res = await fetch(att.url);
      if (!res.ok) throw new Error(`photo download ${res.status} for ${file}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const jpeg = await sharp(buf)
        .rotate() // honor EXIF orientation from phone cameras
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      await writeFile(dest, jpeg);
    }
  }

  /* prune photos whose car/attachment no longer exists */
  for (const existing of await readdir(CARS_DIR)) {
    if (!/\.jpe?g$/i.test(existing)) continue;
    if (!(existing in nextManifest)) {
      console.log(`removing stale ${existing}`);
      await unlink(path.join(CARS_DIR, existing));
    }
  }
  await writeFile(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + "\n");

  const out = cars.map(({ _created, _fotos, ...car }) => car);
  await writeFile(JSON_PATH, JSON.stringify({ cars: out }, null, 2) + "\n");
  console.log(`wrote ${JSON_PATH}: ${out.length} cars, ${Object.keys(nextManifest).length} photos`);
}

main().catch((e) => { console.error(e); process.exit(1); });
