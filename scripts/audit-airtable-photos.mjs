#!/usr/bin/env node
/* ============================================================
   Valle Auto Sales — Airtable photo storage audit (READ-ONLY)
   ------------------------------------------------------------
   Answers three questions without changing anything:

     1. Which cars still hold full-resolution photos in Airtable?
     2. How much storage would optimizing them give back?
     3. Did an optimization run damage a gallery?

   The website republishes every photo at 1600px wide, so a photo
   larger than that costs storage and changes nothing a visitor
   sees. This tool finds those photos. Replacing them is a
   separate, deliberate step:

       scripts/optimize-airtable-photos.mjs

   A read-only Airtable token (data.records:read) is enough.

   Usage:
     # Report on every car:
     AIRTABLE_TOKEN=pat… node scripts/audit-airtable-photos.mjs

     # Report on specific cars:
     AIRTABLE_TOKEN=pat… node scripts/audit-airtable-photos.mjs v-053 v-061

     # Save a baseline before optimizing, then prove nothing broke:
     AIRTABLE_TOKEN=pat… node scripts/audit-airtable-photos.mjs --save before.json
     AIRTABLE_TOKEN=pat… node scripts/audit-airtable-photos.mjs --compare before.json

     # Exit non-zero once enough storage is reclaimable to be worth a batch
     # (how the monthly GitHub Action raises the alarm):
     AIRTABLE_TOKEN=pat… node scripts/audit-airtable-photos.mjs --fail-over 200
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  CAR_ID_PATTERN,
  MAX_WIDTH,
  attachmentDimensions,
  attachmentsOf,
  carIdOf,
  createAuthedFetch,
  fetchRecords,
  formatBytes,
  galleryIsNormalized,
  isActive,
  labelOf,
  localPhotoSizes,
  totalBytes
} from "./photo-storage.mjs";

/* A gallery already under the width ceiling can still be worth replacing if
   it was exported at wasteful quality, but only when the saving is real.
   Below this, the churn costs more than the bytes are worth. */
const WORTHWHILE_SAVING_BYTES = 250 * 1024;

/* Two photos of the same scene keep their shape when resized. A changed
   aspect ratio at the same position means a different picture, not a
   smaller one — the one thing a verification pass must never miss. */
const ASPECT_TOLERANCE = 0.02;

export function parseAuditArgs(args) {
  const carIds = [];
  let save = null;
  let compare = null;
  let failOverMb = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--save" || arg === "--compare") {
      const value = args[++i];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} needs a file path`);
      }
      if (arg === "--save") save = value;
      else compare = value;
      continue;
    }
    if (arg === "--fail-over") {
      const value = Number(args[++i]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--fail-over needs a size in MB, e.g. --fail-over 200");
      }
      failOverMb = value;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    carIds.push(arg);
  }

  if (save && compare) {
    throw new Error("choose either --save or --compare, not both");
  }

  const invalid = carIds.filter((id) => !CAR_ID_PATTERN.test(id));
  if (invalid.length) {
    throw new Error(`invalid car ID: ${invalid.join(", ")} (expected format: v-053)`);
  }

  return { carIds, save, compare, failOverMb };
}

/*
 * Sorts one car into the bucket that decides what to do about it.
 *
 * `local` is what the website publishes for this car; comparing against it
 * is what turns "these photos are big" into a number of megabytes that
 * optimizing would actually return.
 */
export function classifyGallery({ carId, active, attachments, local }) {
  const airtableBytes = totalBytes(attachments);
  const localBytes = totalBytes(local);
  const filenames = attachments.map((a) => String(a.filename || ""));
  const widths = attachments.map((a) => attachmentDimensions(a).width);
  const maxWidth = widths.length ? Math.max(...widths) : 0;
  const base = { carId, airtableBytes, localBytes, maxWidth, savings: 0 };

  if (attachments.length === 0) {
    return { ...base, state: active ? "active-without-photos" : "no-photos" };
  }

  /* Checked before anything involving local files: the sync deletes the
     website copies of a car the moment it stops being Activo, so a sold car
     always looks "out of sync" and never is. Its photos are simply waste. */
  if (!active) {
    return { ...base, state: "inactive-with-photos", savings: airtableBytes };
  }

  if (galleryIsNormalized(carId, filenames)) {
    return { ...base, state: "optimized" };
  }

  /* Every check below compares Airtable against the website copies, which is
     only meaningful once the sync has downloaded this exact gallery. */
  if (local.length !== attachments.length) {
    return { ...base, state: "out-of-sync" };
  }

  const savings = Math.max(0, airtableBytes - localBytes);
  const oversized = maxWidth > MAX_WIDTH || savings >= WORTHWHILE_SAVING_BYTES;
  return { ...base, savings, state: oversized ? "oversized" : "already-small" };
}

export function snapshotGallery(record) {
  return {
    carId: carIdOf(record),
    label: labelOf(record),
    active: isActive(record),
    photos: attachmentsOf(record).map((a) => {
      const { width, height } = attachmentDimensions(a);
      return {
        id: a.id,
        filename: a.filename,
        size: Number(a.size) || 0,
        width,
        height
      };
    })
  };
}

const aspect = ({ width, height }) => (width && height ? width / height : 0);

/*
 * Compares a saved baseline against the current base. Photo count and
 * per-position identity are treated as errors because they mean a gallery
 * was damaged; shrinking sizes and widths are the point of the exercise.
 */
export function compareSnapshots(before, after) {
  const findings = [];
  const afterById = new Map(after.cars.map((c) => [c.carId, c]));
  let beforeBytes = 0;
  let afterBytes = 0;
  let photosChecked = 0;

  for (const car of before.cars) {
    const now = afterById.get(car.carId);
    beforeBytes += totalBytes(car.photos);

    if (!now) {
      findings.push({
        carId: car.carId,
        level: "error",
        message: "record is missing from the base now"
      });
      continue;
    }

    afterBytes += totalBytes(now.photos);

    if (now.photos.length !== car.photos.length) {
      findings.push({
        carId: car.carId,
        level: "error",
        message: `had ${car.photos.length} photo(s), now has ${now.photos.length}`
      });
      continue;
    }

    car.photos.forEach((was, i) => {
      const is = now.photos[i];
      photosChecked++;

      const wasAspect = aspect(was);
      const isAspect = aspect(is);
      if (!wasAspect || !isAspect) {
        findings.push({
          carId: car.carId,
          level: "warn",
          message: `photo ${i + 1}: no dimensions recorded, cannot verify it is the same picture`
        });
        return;
      }
      if (Math.abs(wasAspect - isAspect) / wasAspect > ASPECT_TOLERANCE) {
        findings.push({
          carId: car.carId,
          level: "error",
          message:
            `photo ${i + 1} changed shape (${was.width}×${was.height} → ` +
            `${is.width}×${is.height}) — that is a different picture, not a resize`
        });
        return;
      }
      if (is.width > MAX_WIDTH) {
        findings.push({
          carId: car.carId,
          level: "warn",
          message: `photo ${i + 1} is still ${is.width}px wide`
        });
      }
    });
  }

  for (const car of after.cars) {
    if (!before.cars.some((c) => c.carId === car.carId)) {
      findings.push({
        carId: car.carId,
        level: "info",
        message: "new car added since the baseline; not covered by this check"
      });
    }
  }

  return {
    findings,
    photosChecked,
    beforeBytes,
    afterBytes,
    saved: beforeBytes - afterBytes,
    ok: !findings.some((f) => f.level === "error")
  };
}

const STATE_LABELS = {
  oversized: "full-resolution photos — worth optimizing",
  "inactive-with-photos": "not on the site but still holding photos — clear the gallery",
  "out-of-sync": "Airtable and website disagree — run the inventory sync first",
  "already-small": "not normalized, but already small — little to gain",
  optimized: "already optimized",
  "active-without-photos": "on the site with no photos at all",
  "no-photos": "no photos"
};

function report(rows) {
  const byState = (state) => rows.filter((r) => r.state === state);
  const width = 9;

  for (const state of Object.keys(STATE_LABELS)) {
    const group = byState(state);
    if (!group.length) continue;

    console.log(`\n${STATE_LABELS[state]} (${group.length})`);
    for (const row of group.sort((a, b) => b.savings - a.savings)) {
      const airtable = formatBytes(row.airtableBytes).padStart(8);
      const detail =
        row.savings > 0
          ? `${airtable} in Airtable → saves ${formatBytes(row.savings)}`
          : `${airtable} in Airtable`;
      const dims = row.maxWidth ? `, widest ${row.maxWidth}px` : "";
      console.log(`  ${row.carId.padEnd(width)}${detail}${dims}`);
    }
  }

  const total = totalBytesOf(rows, "airtableBytes");
  const recoverable = rows
    .filter((r) => r.state === "oversized" || r.state === "inactive-with-photos")
    .reduce((sum, r) => sum + r.savings, 0);

  console.log(`\n${rows.length} car(s), ${formatBytes(total)} of photos in Airtable`);
  console.log(`recoverable now: ${formatBytes(recoverable)}`);

  const toOptimize = byState("oversized").map((r) => r.carId);
  if (toOptimize.length) {
    console.log(
      `\nPreview the replacement for those cars (changes nothing):\n` +
      `  node scripts/optimize-airtable-photos.mjs ${toOptimize.join(" ")}`
    );
  }

  const stale = byState("out-of-sync");
  if (stale.length) {
    console.log(
      `\n${stale.length} car(s) cannot be checked until the website sync catches up: ` +
      stale.map((r) => r.carId).join(", ")
    );
  }

  return recoverable;
}

const totalBytesOf = (rows, field) => rows.reduce((sum, r) => sum + r[field], 0);

async function main() {
  const { carIds, save, compare, failOverMb } = parseAuditArgs(process.argv.slice(2));
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error("AIRTABLE_TOKEN is not set.");

  const authed = createAuthedFetch(token);
  const records = (await fetchRecords(authed)).filter((r) =>
    CAR_ID_PATTERN.test(carIdOf(r))
  );
  const wanted = carIds.length
    ? records.filter((r) => carIds.includes(carIdOf(r)))
    : records;

  const missing = carIds.filter((id) => !wanted.some((r) => carIdOf(r) === id));
  if (missing.length) throw new Error(`no Airtable record with ID: ${missing.join(", ")}`);

  const snapshot = {
    takenAt: new Date().toISOString(),
    cars: wanted.map(snapshotGallery)
  };

  if (compare) {
    const before = JSON.parse(await readFile(compare, "utf8"));
    const result = compareSnapshots(before, snapshot);

    for (const f of result.findings) {
      console.log(`${f.level.toUpperCase().padEnd(5)} ${f.carId}: ${f.message}`);
    }
    console.log(
      `\n${result.photosChecked} photo(s) checked against ${compare}: ` +
      `${formatBytes(result.beforeBytes)} → ${formatBytes(result.afterBytes)} ` +
      `(saved ${formatBytes(result.saved)})`
    );
    console.log(
      result.ok
        ? "PASSED — every gallery kept its photo count, order, and framing."
        : "FAILED — review the errors above before touching anything else."
    );
    if (!result.ok) process.exitCode = 1;
    return;
  }

  const rows = [];
  for (const record of wanted) {
    const carId = carIdOf(record);
    rows.push(
      classifyGallery({
        carId,
        active: isActive(record),
        attachments: attachmentsOf(record),
        local: await localPhotoSizes(carId)
      })
    );
  }

  const recoverable = report(rows);

  if (save) {
    await writeFile(save, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(`\nbaseline written to ${save} (${snapshot.cars.length} car(s))`);
  }

  /* Used by the monthly check. Exiting non-zero is the whole point: GitHub
     emails a failed scheduled run, which is the earliest warning available
     short of Airtable's own "your base is full" message. */
  if (failOverMb !== null && recoverable > failOverMb * 1024 * 1024) {
    console.log(
      `\nOVER THRESHOLD — ${formatBytes(recoverable)} recoverable, limit is ${failOverMb} MB.`
    );
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
