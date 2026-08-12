import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSourceMatchesAirtable,
  inspectStoredAttachments,
  parseArgs
} from "./optimize-airtable-photos.mjs";

const recordWith = (ids) => ({
  fields: {
    Fotos: ids.map((id, i) => ({
      id,
      filename: `phone-original-${i + 1}.jpg`
    }))
  }
});

test("preview mode is the default and car IDs must be explicit", () => {
  assert.deepEqual(parseArgs(["v-002", "v-005"]), {
    apply: false,
    dryRun: true,
    carIds: ["v-002", "v-005"]
  });
});

test("--apply is required for write mode", () => {
  assert.deepEqual(parseArgs(["--apply", "v-002"]), {
    apply: true,
    dryRun: false,
    carIds: ["v-002"]
  });
});

test("unsafe or confusing arguments are rejected", () => {
  assert.throws(() => parseArgs([]), /name at least one car ID/);
  assert.throws(() => parseArgs(["v002"]), /invalid car ID/);
  assert.throws(() => parseArgs(["v-002", "v-002"]), /duplicate car ID/);
  assert.throws(() => parseArgs(["--apply", "--dry-run", "v-002"]), /choose either/);
  assert.throws(() => parseArgs(["--everything", "v-002"]), /unknown option/);
});

test("preflight accepts the exact gallery downloaded by the last sync", () => {
  const files = ["v-002-1.jpg", "v-002-2.jpg"];
  const manifest = {
    "v-002-1.jpg": "att-one",
    "v-002-2.jpg": "att-two"
  };
  const { current, alreadyMigrated } = assertSourceMatchesAirtable(
    "v-002",
    recordWith(["att-one", "att-two"]),
    files,
    manifest
  );
  assert.equal(current.length, 2);
  assert.equal(alreadyMigrated, false);
});

test("preflight stops if photo count changed after the last sync", () => {
  assert.throws(
    () =>
      assertSourceMatchesAirtable(
        "v-002",
        recordWith(["att-one", "att-two", "att-three"]),
        ["v-002-1.jpg", "v-002-2.jpg"],
        {
          "v-002-1.jpg": "att-one",
          "v-002-2.jpg": "att-two"
        }
      ),
    /SAFETY STOP: Airtable has 3 photo/
  );
});

test("preflight stops if an attachment changed or was reordered", () => {
  assert.throws(
    () =>
      assertSourceMatchesAirtable(
        "v-002",
        recordWith(["att-two", "att-one"]),
        ["v-002-1.jpg", "v-002-2.jpg"],
        {
          "v-002-1.jpg": "att-one",
          "v-002-2.jpg": "att-two"
        }
      ),
    /Airtable changed since the last website sync/
  );
});

test("preflight skips a record that already has the resized filenames", () => {
  const files = ["v-001-1.jpg", "v-001-2.jpg"];
  const record = {
    fields: {
      Fotos: [
        { id: "att-one", filename: files[0] },
        { id: "att-two", filename: files[1] }
      ]
    }
  };

  /* The manifest still holds the pre-migration attachment IDs, which is exactly
     the state after a batch replaced photos but before the next website sync.
     That must read as "already done", not as tampering. */
  const { alreadyMigrated } = assertSourceMatchesAirtable("v-001", record, files, {
    "v-001-1.jpg": "stale-pre-migration-id",
    "v-001-2.jpg": "another-stale-id"
  });

  assert.equal(alreadyMigrated, true);
});

test("an already-migrated car whose photo count changed still stops", () => {
  const files = ["v-001-1.jpg", "v-001-2.jpg"];
  const record = {
    fields: {
      Fotos: [
        { id: "att-one", filename: files[0] },
        { id: "att-two", filename: files[1] },
        { id: "att-three", filename: "added-later.jpg" }
      ]
    }
  };

  assert.throws(
    () => assertSourceMatchesAirtable("v-001", record, files, {}),
    /SAFETY STOP: Airtable has 3 photo/
  );
});

test("read-back requires the complete ordered and ready gallery", () => {
  const files = ["v-002-1.jpg", "v-002-2.jpg"];
  const ready = [
    { id: "new-one", filename: files[0], url: "https://example.test/1", size: 100 },
    { id: "new-two", filename: files[1], url: "https://example.test/2", size: 200 }
  ];

  assert.equal(inspectStoredAttachments(files, ready).ok, true);
  assert.equal(inspectStoredAttachments(files, ready.toReversed()).ok, false);
  assert.equal(
    inspectStoredAttachments(files, [{ ...ready[0], size: 0 }, ready[1]]).ok,
    false
  );
});
