import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyGallery,
  compareSnapshots,
  parseAuditArgs
} from "./audit-airtable-photos.mjs";
import { MAX_WIDTH } from "./photo-storage.mjs";

const photo = (filename, size, width = 4032, height = 3024) => ({
  id: `att-${filename}`,
  filename,
  size,
  width,
  height
});

const MB = 1024 * 1024;

test("the audit reports on every car unless told otherwise", () => {
  assert.deepEqual(parseAuditArgs([]), {
    carIds: [],
    save: null,
    compare: null,
    failOverMb: null
  });
  assert.deepEqual(parseAuditArgs(["v-053", "v-060"]), {
    carIds: ["v-053", "v-060"],
    save: null,
    compare: null,
    failOverMb: null
  });
});

test("the storage threshold must be a real size", () => {
  assert.equal(parseAuditArgs(["--fail-over", "200"]).failOverMb, 200);
  assert.throws(() => parseAuditArgs(["--fail-over"]), /needs a size in MB/);
  assert.throws(() => parseAuditArgs(["--fail-over", "lots"]), /needs a size in MB/);
  assert.throws(() => parseAuditArgs(["--fail-over", "0"]), /needs a size in MB/);
});

test("snapshot paths are required and mutually exclusive", () => {
  assert.deepEqual(parseAuditArgs(["--save", "before.json"]).save, "before.json");
  assert.deepEqual(parseAuditArgs(["--compare", "before.json"]).compare, "before.json");
  assert.throws(() => parseAuditArgs(["--save"]), /needs a file path/);
  assert.throws(() => parseAuditArgs(["--save", "--compare"]), /needs a file path/);
  assert.throws(
    () => parseAuditArgs(["--save", "a.json", "--compare", "b.json"]),
    /choose either/
  );
  assert.throws(() => parseAuditArgs(["--everything"]), /unknown option/);
  assert.throws(() => parseAuditArgs(["v53"]), /invalid car ID/);
});

test("a phone upload larger than the website copy is worth optimizing", () => {
  const result = classifyGallery({
    carId: "v-053",
    active: true,
    attachments: [photo("IMG_4821.jpg", 4 * MB), photo("IMG_4822.jpg", 4 * MB)],
    local: [{ name: "v-053-1.jpg", size: 300 * 1024 }, { name: "v-053-2.jpg", size: 300 * 1024 }]
  });

  assert.equal(result.state, "oversized");
  assert.equal(result.maxWidth, 4032);
  assert.equal(result.savings, 8 * MB - 600 * 1024);
});

test("a gallery holding the website filenames is already optimized", () => {
  const result = classifyGallery({
    carId: "v-053",
    active: true,
    attachments: [
      photo("v-053-1.jpg", 300 * 1024, MAX_WIDTH, 1200),
      photo("v-053-2.jpg", 300 * 1024, MAX_WIDTH, 1200)
    ],
    local: [{ name: "v-053-1.jpg", size: 300 * 1024 }, { name: "v-053-2.jpg", size: 300 * 1024 }]
  });

  assert.equal(result.state, "optimized");
  assert.equal(result.savings, 0);
});

/* Mary using the iPhone shortcut before uploading is the outcome we want:
   the filenames are still hers, but there is nothing left to reclaim. */
test("a hand-resized upload is left alone", () => {
  const result = classifyGallery({
    carId: "v-055",
    active: true,
    attachments: [photo("IMG_5001.jpg", 320 * 1024, MAX_WIDTH, 1200)],
    local: [{ name: "v-055-1.jpg", size: 300 * 1024 }]
  });

  assert.equal(result.state, "already-small");
});

test("a sold car still holding photos is pure waste, not a sync problem", () => {
  const result = classifyGallery({
    carId: "v-047",
    active: false,
    attachments: [photo("IMG_4700.jpg", 3 * MB)],
    local: [] // the sync deletes website copies as soon as a car leaves the site
  });

  assert.equal(result.state, "inactive-with-photos");
  assert.equal(result.savings, 3 * MB);
});

test("a re-upload the website has not downloaded yet cannot be judged", () => {
  const result = classifyGallery({
    carId: "v-053",
    active: true,
    attachments: [photo("IMG_9001.jpg", 4 * MB), photo("IMG_9002.jpg", 4 * MB)],
    local: [{ name: "v-053-1.jpg", size: 300 * 1024 }]
  });

  assert.equal(result.state, "out-of-sync");
  assert.equal(result.savings, 0);
});

test("an active car with no photos is reported rather than ignored", () => {
  const result = classifyGallery({
    carId: "v-061",
    active: true,
    attachments: [],
    local: []
  });

  assert.equal(result.state, "active-without-photos");
});

const snapshot = (photos) => ({
  takenAt: "2026-08-12T00:00:00.000Z",
  cars: [{ carId: "v-053", label: "2019 Toyota Corolla", active: true, photos }]
});

test("verification passes when every photo shrank in place", () => {
  const before = snapshot([
    photo("IMG_4821.jpg", 4 * MB, 4032, 3024),
    photo("IMG_4822.jpg", 4 * MB, 3024, 4032)
  ]);
  const after = snapshot([
    photo("v-053-1.jpg", 300 * 1024, 1600, 1200),
    photo("v-053-2.jpg", 300 * 1024, 1200, 1600)
  ]);

  const result = compareSnapshots(before, after);
  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
  assert.equal(result.photosChecked, 2);
  assert.equal(result.saved, 8 * MB - 600 * 1024);
});

test("verification fails when a photo is lost", () => {
  const result = compareSnapshots(
    snapshot([photo("a.jpg", MB), photo("b.jpg", MB)]),
    snapshot([photo("v-053-1.jpg", 100)])
  );

  assert.equal(result.ok, false);
  assert.match(result.findings[0].message, /had 2 photo\(s\), now has 1/);
});

/* The failure that matters most: the right number of photos in the right
   order, but one position holding a different picture. */
test("verification fails when a position changed shape", () => {
  const result = compareSnapshots(
    snapshot([photo("a.jpg", MB, 4032, 3024), photo("b.jpg", MB, 4032, 3024)]),
    snapshot([
      photo("v-053-1.jpg", 100, 1600, 1200),
      photo("v-053-2.jpg", 100, 1200, 1600) // portrait where a landscape was
    ])
  );

  assert.equal(result.ok, false);
  assert.match(result.findings[0].message, /photo 2 changed shape/);
});

test("verification warns rather than passes when dimensions are unknown", () => {
  const result = compareSnapshots(
    snapshot([{ id: "a", filename: "a.jpg", size: MB, width: 0, height: 0 }]),
    snapshot([photo("v-053-1.jpg", 100, 1600, 1200)])
  );

  assert.equal(result.ok, true);
  assert.equal(result.findings[0].level, "warn");
  assert.match(result.findings[0].message, /cannot verify/);
});

test("a car added after the baseline is flagged as unverified", () => {
  const before = snapshot([photo("a.jpg", MB)]);
  const after = {
    ...snapshot([photo("v-053-1.jpg", 100, 1600, 1200)]),
    cars: [
      ...snapshot([photo("v-053-1.jpg", 100, 1600, 1200)]).cars,
      { carId: "v-066", label: "new", active: true, photos: [photo("x.jpg", MB)] }
    ]
  };

  const result = compareSnapshots(before, after);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.findings.map((f) => [f.carId, f.level]),
    [["v-066", "info"]]
  );
});

/* The audit calls a photo oversized by comparing against the width the sync
   actually publishes. If someone changes one, this catches the other. */
test("the audit's width ceiling matches the width the sync publishes", async () => {
  const sync = await readFile(new URL("./sync-inventory.mjs", import.meta.url), "utf8");
  const declared = Number(sync.match(/const MAX_WIDTH = (\d+)/)?.[1]);

  assert.equal(declared, MAX_WIDTH);
});
