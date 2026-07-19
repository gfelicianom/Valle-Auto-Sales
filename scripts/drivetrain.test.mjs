import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { mapDrivetrain } from "./drivetrain.mjs";

test("maps every live Airtable Tracción option", () => {
  const options = new Map([
    ["FWD / delantera", "fwd"],
    ["RWD", "rwd"],
    ["AWD", "awd"],
    ["4WD", "4wd"],
    ["4x4", "4x4"],
    ["4x2", "4x2"],
    ["Differential lock", "differential_lock"]
  ]);

  for (const [label, expected] of options) {
    assert.equal(mapDrivetrain(label), expected, label);
  }
});

test("accepts common Spanish and English aliases", () => {
  assert.equal(mapDrivetrain("Tracción delantera"), "fwd");
  assert.equal(mapDrivetrain("Tracción trasera"), "rwd");
  assert.equal(mapDrivetrain("Tracción integral"), "awd");
  assert.equal(mapDrivetrain("Cuatro por cuatro"), "4x4");
  assert.equal(mapDrivetrain("Dos por cuatro"), "4x2");
  assert.equal(mapDrivetrain("Locking differential"), "differential_lock");
});

test("leaves empty and unknown labels blank", () => {
  assert.equal(mapDrivetrain(""), "");
  assert.equal(mapDrivetrain("unknown"), "");
});

test("provides Spanish and English labels for every website key", async () => {
  const source = await readFile(new URL("../js/i18n.js", import.meta.url), "utf8");
  const context = {
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: {} }
  };
  vm.runInNewContext(`${source}\nglobalThis.__I18N = I18N;`, context);

  const keys = ["fwd", "rwd", "awd", "4wd", "4x4", "4x2", "differential_lock"];
  for (const language of ["es", "en"]) {
    for (const drivetrain of keys) {
      assert.ok(context.__I18N[language][`drive_${drivetrain}`], `${language}: ${drivetrain}`);
    }
  }
});
