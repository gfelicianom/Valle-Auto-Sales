#!/usr/bin/env node
/* ============================================================
   Valle Auto Sales — Airtable photo storage optimizer
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

   Run scripts/audit-airtable-photos.mjs first — it is read-only,
   it names the cars worth doing, and it can save a baseline that
   proves afterwards that no gallery was damaged.

   Usage:
     # Preview only (the safe default):
     AIRTABLE_TOKEN=pat… node scripts/optimize-airtable-photos.mjs v-053 v-055

     # Replace photos only after the preview passes:
     AIRTABLE_TOKEN=pat… node scripts/optimize-airtable-photos.mjs --apply v-053 v-055

   Normally this is run from GitHub rather than a terminal:
   Actions → "Optimize Airtable photos (manual)" → Run workflow.
   Nobody has to hold a write token to use it.

   Car IDs are required. There is deliberately no "do everything"
   mode: a bulk photo replacer that can be pointed at the whole
   base with one word is how a good day becomes a bad one. The
   dispatch button is safe only because of that, because preview
   is the default, and because the preflight below refuses any
   gallery that has changed since the last website sync.
   ============================================================ */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  API,
  CARS_DIR,
  CAR_ID_PATTERN,
  MANIFEST_PATH,
  SITE,
  createAuthedFetch,
  fetchRecords,
  formatBytes,
  localPhotoSizes,
  sleep,
  totalBytes
} from "./photo-storage.mjs";

/* Airtable allows 5 req/sec per base; attachment ingestion is stricter
   still (attachmentUploadRateIsTooHigh). One car per second is plenty. */
const PAUSE_BETWEEN_CARS_MS = 1000;
/* Attachment ingestion is asynchronous: Airtable has to fetch each file from
   valleautosales.com and generate its own derivatives before the attachment
   reports a size. Six photos have been observed taking longer than 12s, so
   allow a full minute before treating slowness as a failure. */
const READ_BACK_ATTEMPTS = 20;
const READ_BACK_INTERVAL_MS = 3000;

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
    throw new Error("name at least one car ID, e.g. v-053 v-055 v-056");
  }

  const invalid = carIds.filter((id) => !CAR_ID_PATTERN.test(id));
  if (invalid.length) {
    throw new Error(`invalid car ID: ${invalid.join(", ")} (expected format: v-053)`);
  }

  const duplicates = carIds.filter((id, i) => carIds.indexOf(id) !== i);
  if (duplicates.length) {
    throw new Error(`duplicate car ID: ${[...new Set(duplicates)].join(", ")}`);
  }

  const apply = args.includes("--apply");
  return { apply, dryRun: !apply, carIds };
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(`could not read ${MANIFEST_PATH}: ${error.message}`);
  }
}

/*
 * The local images and manifest must describe the exact Airtable gallery that
 * the last successful website sync downloaded. If a family member added,
 * removed, or reordered a photo after that sync, refuse to replace anything.
 *
 * This is the check that makes re-uploads safe. A re-uploaded photo gets a new
 * attachment ID, so a gallery replaced before the next sync would push the OLD
 * pictures back over the new ones. Stopping here is what prevents that.
 *
 * Returns { current, alreadyMigrated }. A car that is already optimized is not
 * an error — reporting it lets the caller skip that car, so re-running the
 * same batch after a partial failure picks up where it left off instead of
 * aborting on the cars that already succeeded.
 */
export function assertSourceMatchesAirtable(carId, record, files, manifest) {
  const current = Array.isArray(record.fields["Fotos"]) ? record.fields["Fotos"] : [];

  if (current.length !== files.length) {
    throw new Error(
      `SAFETY STOP: Airtable has ${current.length} photo(s), but the website copy has ` +
      `${files.length}. Run the normal inventory sync and review the gallery before retrying.`
    );
  }

  /* Checked before the manifest comparison: once a car is optimized its
     attachment IDs no longer match the pre-optimization manifest, and that is
     expected rather than a sign of tampering. */
  const alreadyMigrated = current.every(
    (attachment, i) => attachment.filename === files[i]
  );
  if (alreadyMigrated) return { current, alreadyMigrated: true };

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

  return { current, alreadyMigrated: false };
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

  const local = await localPhotoSizes(carId);
  const files = local.map((f) => f.name);
  if (files.length === 0) throw new Error(`no local photos found for ${carId} in ${CARS_DIR}/`);

  const { current, alreadyMigrated } = assertSourceMatchesAirtable(
    carId, record, files, manifest
  );

  if (alreadyMigrated) {
    console.log(`\n${carId} — already optimized (${files.length} photo(s)); skipping`);
    return { carId, skip: true };
  }

  const before = totalBytes(current);
  const after = totalBytes(local);
  const saving = Math.max(0, before - after);

  console.log(`\n${carId} — ${current.length} photo(s) in Airtable and website copy`);
  console.log(`  order: ${files.join(", ")}`);
  console.log(
    `  storage: ${formatBytes(before)} → ${formatBytes(after)} (saves ${formatBytes(saving)})`
  );

  await assertReachable(files);
  console.log("  ✓ counts, attachment IDs, order, and public image URLs passed");

  return { carId, record, files, saving };
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
  let lastInspection = { ok: false, names: [], orderMatches: false };
  for (let attempt = 1; attempt <= READ_BACK_ATTEMPTS; attempt++) {
    await sleep(READ_BACK_INTERVAL_MS);
    const check = await authed(`${API}/${record.id}`);
    if (!check.ok) throw new Error(`read-back ${check.status}: ${await check.text()}`);
    const stored = (await check.json()).fields["Fotos"] || [];
    lastInspection = inspectStoredAttachments(files, stored);
    if (lastInspection.ok) {
      console.log(`  ✓ stored and ready in order: ${lastInspection.names.join(", ")}`);
      return { carId, ok: true, saving: plan.saving };
    }
    if (attempt === 3) {
      console.log(`  …still processing ${files.length} photo(s), waiting`);
    }
  }

  const waitedSeconds = (READ_BACK_ATTEMPTS * READ_BACK_INTERVAL_MS) / 1000;

  /* Right names in the right order but no size yet means the write landed and
     Airtable is merely slow — a very different situation from a wrong gallery,
     so say so rather than implying the photos are wrong. */
  if (lastInspection.orderMatches) {
    throw new Error(
      `Airtable accepted all ${files.length} photo(s) in the correct order but had not ` +
      `finished processing them after ${waitedSeconds}s. The gallery is most likely fine. ` +
      "Re-run in preview mode to confirm before replacing anything else."
    );
  }

  throw new Error(
    "Airtable stored a different gallery than the one sent. " +
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

  const skipped = plans.filter((p) => p.skip);
  const pending = plans.filter((p) => !p.skip);
  const tally = skipped.length ? ` (${skipped.length} already optimized)` : "";
  const totalSaving = pending.reduce((sum, p) => sum + (p.saving || 0), 0);

  if (!apply) {
    console.log(
      `\nPREVIEW PASSED — ${pending.length} car(s) to replace${tally}, ` +
      `freeing about ${formatBytes(totalSaving)}; nothing was changed.`
    );
    if (pending.length) {
      console.log("Run the same command with --apply only when you are ready.");
    }
    return;
  }

  if (pending.length === 0) {
    console.log(`\nNothing to do — every requested car is already optimized.`);
    return;
  }

  const results = [];
  for (const plan of pending) {
    try {
      results.push(await migrate(plan, authed));
    } catch (e) {
      console.error(`\n${plan.carId} — FAILED: ${e.message}`);
      results.push({ carId: plan.carId, ok: false });
      console.error(
        "Stopping this batch. Review the failed record, then re-run the same " +
        "command — cars already replaced are skipped automatically."
      );
      break;
    }
    await sleep(PAUSE_BETWEEN_CARS_MS);
  }

  const bad = results.filter((r) => !r.ok);
  const freed = results.filter((r) => r.ok).reduce((sum, r) => sum + (r.saving || 0), 0);
  console.log(
    `\n${results.length - bad.length}/${pending.length} car(s) replaced${tally}, ` +
    `about ${formatBytes(freed)} freed`
  );
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
