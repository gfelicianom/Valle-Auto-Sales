/* ============================================================
   Valle Auto Sales — shared photo-storage helpers
   ------------------------------------------------------------
   Used by two tools:

     scripts/audit-airtable-photos.mjs    (read-only report)
     scripts/optimize-airtable-photos.mjs (replaces photos)

   They live in one place so the two cannot drift apart on the
   base, the photo naming rule, or the 1600px ceiling.

   MAX_WIDTH must stay equal to the MAX_WIDTH in
   scripts/sync-inventory.mjs — that is the width the website
   actually publishes, and the audit calls a photo oversized by
   comparing against it. A test asserts the two agree.
   ============================================================ */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const BASE_ID = "app9Rj2rqXxh1QSTy";
export const TABLE_ID = "tblt7l3jOV8Rvk91K"; // Vehículos
export const API = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
export const SITE = "https://valleautosales.com";
export const CARS_DIR = "img/cars";
export const MANIFEST_PATH = path.join(CARS_DIR, "manifest.json");
export const MAX_WIDTH = 1600;
export const CAR_ID_PATTERN = /^v-\d{3}$/;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const createAuthedFetch = (token) => (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

export async function fetchRecords(authed) {
  const records = [];
  let offset;
  do {
    const url = new URL(API);
    if (offset) url.searchParams.set("offset", offset);
    const res = await authed(url);
    if (!res.ok) throw new Error(`Airtable API ${res.status}: ${await res.text()}`);
    const page = await res.json();
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

export const carIdOf = (record) => String(record.fields?.["ID"] || "").trim();

export const estadoOf = (record) => String(record.fields?.["Estado"] || "").trim();

/* Only "Activo" cars are published. Anything else is off the site — which is
   not the same as "its photos are waste": the family keeps two photos of each
   sold car for their own records. */
export const isActive = (record) =>
  String(record.fields?.["Estado"] || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") === "activo";

export const attachmentsOf = (record) =>
  Array.isArray(record.fields?.["Fotos"]) ? record.fields["Fotos"] : [];

export const labelOf = (record) => {
  const f = record.fields || {};
  return [f["Año"], f["Marca"], f["Modelo"]].filter(Boolean).join(" ").trim();
};

/* img/cars/v-002-10.jpg must sort after v-002-2.jpg, so sort on the
   numeric suffix rather than the string. */
export async function localPhotos(carId) {
  const all = await readdir(CARS_DIR);
  const re = new RegExp(`^${carId}-(\\d+)\\.jpg$`);
  return all
    .map((name) => ({ name, n: Number((name.match(re) || [])[1]) }))
    .filter((f) => Number.isInteger(f.n))
    .sort((a, b) => a.n - b.n)
    .map((f) => f.name);
}

export async function localPhotoSizes(carId) {
  const names = await localPhotos(carId);
  return Promise.all(
    names.map(async (name) => ({
      name,
      size: (await stat(path.join(CARS_DIR, name))).size
    }))
  );
}

/* A migrated gallery holds the website's own filenames in position order.
   A phone upload does not (IMG_4821.jpg), which is what makes this a
   reliable "has this car been optimized yet" signal. */
export const galleryIsNormalized = (carId, filenames) =>
  filenames.length > 0 &&
  filenames.every((name, i) => name === `${carId}-${i + 1}.jpg`);

/* Airtable reports width/height at the top level for images, but older
   attachments and non-image files may only carry thumbnail dimensions. */
export function attachmentDimensions(attachment = {}) {
  const full = attachment.thumbnails?.full || {};
  const width = Number(attachment.width) || Number(full.width) || 0;
  const height = Number(attachment.height) || Number(full.height) || 0;
  return { width, height };
}

export const totalBytes = (items) =>
  items.reduce((sum, item) => sum + (Number(item.size) || 0), 0);

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
