#!/usr/bin/env node
/* ============================================================
   ONE-OFF — Airtable attachment migration (July 2026)
   ------------------------------------------------------------
   Replaces a car's full-resolution Airtable photos with the
   already-resized copies the site serves from img/cars/.

   Airtable fetches each file from valleautosales.com itself, so
   nothing is uploaded from this machine. The Fotos cell is
   replaced in a single PATCH and is never left empty.

   Photo ORDER is the thing that matters: the sync renames purely
   by position, so whatever sits first becomes <id>-1.jpg. This
   script sends files in numeric order and then reads the record
   back to prove the order survived.

   Usage:
     # Preview only (the safe default):
     AIRTABLE_TOKEN=pat… node scripts/migrate-airtable-photos.mjs v-002 v-005 v-006

     # Replace photos only after the preview passes:
     AIRTABLE_TOKEN=pat… node scripts/migrate-airtable-photos.mjs --apply v-002 v-005 v-006

   Car IDs are required. There is deliberately no "do everything"
   mode. Delete this file, its test, and the manual migration
   workflow once the migration is finished.
   ============================================================ */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_ID = "app9Rj2rqXxh1QSTy";
const TABLE_ID = "tblt7l3jOV8Rvk91K"; // Vehículos
const SITE = "https://valleautosales.com";
const CARS_DIR = "img/cars";
const MANIFEST_PATH = path.join(CARS_DIR, "manifest.json");
const API = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

/* Airtable allows 5 req/sec per base; attachment ingestion is stricter
   still (attachmentUploadRateIsTooHigh). One car per second is plenty. */
const PAUSE_BETWEEN_CARS_MS = 1000;
/* Attachment ingestion is asynchronous, so read back more than once if needed. */
const READ_BACK_ATTEMPTS = 6;
const READ_BACK_INTERVAL_MS = 2000;
const CAR_ID_PATTERN = /^v-\d{3}$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(args) {
  const knownFlags = new Set(["--apply", "--dry-run"]);
  const unknownFlags = args.filter((a) => a.startsWith("--") && !knownFlags.has(a));
  if (unknownFlags.length) {
    throw new Error(`unknown option: ${unknownFlags.join(", ")}`);
  }
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new Error("choose either --apply or --dry-run, not both");
  }

  const carIds = args.filter((a) => !a.startsWith("--"));
  if (carIds.length === 0) {
    throw new Error("name at least one car ID, e.g. v-002 v-005 v-006");
  }

  const invalid = carIds.filter((id) => !CAR_ID_PATTERN.test(id));
  if (invalid.length) {
    throw new Error(`invalid car ID: ${invalid.join(", ")} (expected format: v-002)`);
  }

  const duplicates = carIds.filter((id, i) => carIds.indexOf(id) !== i);
  if (duplicates.length) {
    throw new Error(`duplicate car ID: ${[...new Set(duplicates)].join(", ")}`);
  }

  const apply = args.includes("--apply");
  return { apply, dryRun: !apply, carIds };
}

const createAuthedFetch = (token) => (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

async function fetchRecords(authed) {
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

async function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(`could not read ${MANIFEST_PATH}: ${error.message}`);
  }
  return manifest;
}

/* img/cars/v-002-10.jpg must sort after v-002-2.jpg, so sort on the
   numeric suffix rather than the string. */
async function localPhotos(carId) {
  const all = await readdir(CARS_DIR);
  const re = new RegExp(`^${carId}-(\\d+)\\.jpg$`);
  return all
    .map((name) => ({ name, n: Number((name.match(re) || [])[1]) }))
    .filter((f) => Number.isInteger(f.n))
    .sort((a, b) => a.n - b.n)
    .map((f) => f.name);
}

/*
 * The local images and manifest must describe the exact Airtable gallery that
 * the last successful website sync downloaded. If a family member added,
 * removed, or reordered a photo after that sync, refuse to replace anything.
 */
export function assertSourceMatchesAirtable(carId, record, files, manifest) {
  const current = Array.isArray(record.fields["Fotos"]) ? record.fields["Fotos"] : [];

  if (current.length !== files.length) {
    throw new Error(
      `SAFETY STOP: Airtable has ${current.length} photo(s), but the website copy has ` +
      `${files.length}. Run the normal inventory sync and review the gallery before retrying.`
    );
  }

  const alreadyMigrated = current.every(
    (attachment, i) => attachment.filename === files[i]
  );
  if (alreadyMigrated) {
    throw new Error(
      `SAFETY STOP: ${carId} already appears migrated (${files.join(", ")}). ` +
      "Leave it out of this batch."
    );
  }

  const missingManifestFiles = files.filter((name) => !manifest[name]);
  if (missingManifestFiles.length) {
    throw new Error(
      `SAFETY STOP: ${MANIFEST_PATH} is missing ${missingManifestFiles.join(", ")}. ` +
      "Run the normal inventory sync before retrying."
    );
  }

  const mismatches = files
    .map((name, i) => ({
      name,
      expected: manifest[name],
      current: current[i]?.id
    }))
    .filter(({ expected, current: attachmentId }) => expected !== attachmentId);

  if (mismatches.length) {
    const names = mismatches.map(({ name }) => name).join(", ");
    throw new Error(
      `SAFETY STOP: Airtable changed since the last website sync (${names}). ` +
      "Run the normal inventory sync and review the gallery before retrying."
    );
  }

  return current;
}

/* Airtable can only ingest a URL it can actually reach. Checking first
   turns a confusing partial upload into a clean refusal. */
async function assertReachable(files) {
  for (const name of files) {
    const url = `${SITE}/${CARS_DIR}/${name}`;
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) throw new Error(`${url} returned ${res.status} — not publicly reachable`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/jpeg")) {
      throw new Error(`${url} returned ${contentType || "no content type"} instead of image/jpeg`);
    }
  }
}

async function prepareMigration(carId, byCarId, manifest) {
  const record = byCarId.get(carId);
  if (!record) throw new Error(`no Airtable record with ID "${carId}"`);

  const files = await localPhotos(carId);
  if (files.length === 0) throw new Error(`no local photos found for ${carId} in ${CARS_DIR}/`);

  const current = assertSourceMatchesAirtable(carId, record, files, manifest);
  console.log(`\n${carId} — ${current.length} photo(s) in Airtable and website copy`);
  console.log(`  order: ${files.join(", ")}`);

  await assertReachable(files);
  console.log("  ✓ counts, attachment IDs, order, and public image URLs passed");

  return { carId, record, files };
}

export function inspectStoredAttachments(files, stored) {
  const names = stored.map((attachment) => attachment.filename);
  const orderMatches =
    names.length === files.length && names.every((name, i) => name === files[i]);
  const ready =
    stored.length === files.length &&
    stored.every((attachment) =>
      attachment.id &&
      attachment.url &&
      attachment.filename &&
      Number(attachment.size) > 0
    );
  return { ok: orderMatches && ready, names, orderMatches, ready };
}

async function migrate(plan, authed) {
  const { carId, record, files } = plan;
  const attachments = files.map((name) => ({
    url: `${SITE}/${CARS_DIR}/${name}`,
    filename: name
  }));

  const res = await authed(API, {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: record.id, fields: { Fotos: attachments } }] })
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);

  /* Read the record back — the PATCH response reflects what we asked for,
     not necessarily what Airtable finished storing. */
  let lastInspection = { ok: false, names: [] };
  for (let attempt = 1; attempt <= READ_BACK_ATTEMPTS; attempt++) {
    await sleep(READ_BACK_INTERVAL_MS);
    const check = await authed(`${API}/${record.id}`);
    if (!check.ok) throw new Error(`read-back ${check.status}: ${await check.text()}`);
    const stored = (await check.json()).fields["Fotos"] || [];
    lastInspection = inspectStoredAttachments(files, stored);
    if (lastInspection.ok) {
      console.log(`  ✓ stored and ready in order: ${lastInspection.names.join(", ")}`);
      return { carId, ok: true };
    }
  }

  throw new Error(
    "Airtable did not finish storing the expected gallery. " +
    `Sent: ${files.join(", ")}; read back: ${lastInspection.names.join(", ") || "(empty)"}`
  );
}

async function main() {
  const { apply, carIds } = parseArgs(process.argv.slice(2));
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    throw new Error("AIRTABLE_TOKEN is not set.");
  }

  console.log(
    apply
      ? "APPLY MODE — photos will be replaced only after every preflight check passes\n"
      : "PREVIEW MODE — no Airtable changes will be sent\n"
  );

  const authed = createAuthedFetch(token);
  const [records, manifest] = await Promise.all([fetchRecords(authed), loadManifest()]);
  const byCarId = new Map(
    records.map((r) => [String(r.fields["ID"] || "").trim(), r])
  );

  /*
   * Preflight every requested car before the first PATCH. A predictable
   * mismatch therefore stops the whole batch before Airtable is changed.
   */
  const plans = [];
  for (const carId of carIds) {
    plans.push(await prepareMigration(carId, byCarId, manifest));
  }

  if (!apply) {
    console.log(`\nPREVIEW PASSED — ${plans.length} car(s) checked; nothing was changed.`);
    console.log("Run the same command with --apply only when you are ready.");
    return;
  }

  const results = [];
  for (const plan of plans) {
    try {
      results.push(await migrate(plan, authed));
    } catch (e) {
      console.error(`\n${plan.carId} — FAILED: ${e.message}`);
      results.push({ carId: plan.carId, ok: false });
      console.error("Stopping this batch. Do not retry until the failed record is reviewed.");
      break;
    }
    await sleep(PAUSE_BETWEEN_CARS_MS);
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${plans.length} requested car(s) replaced`);
  if (bad.length) {
    console.log(`check by hand: ${bad.map((r) => r.carId).join(", ")}`);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((e) => {
    console.error(`\nSTOPPED: ${e.message}`);
    process.exitCode = 1;
  });
}
