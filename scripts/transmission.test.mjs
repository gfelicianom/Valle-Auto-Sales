import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { mapTransmission } from "./transmission.mjs";

test("maps every live Airtable Transmisión option", () => {
  assert.equal(mapTransmission("Automática"), "automatic");
  assert.equal(mapTransmission("Manual"), "manual");
});

test("accepts common Spanish and English aliases", () => {
  assert.equal(mapTransmission("Automatica"), "automatic");
  assert.equal(mapTransmission("automatic"), "automatic");
  assert.equal(mapTransmission("CVT"), "automatic");
  assert.equal(mapTransmission("Estándar"), "manual");
  assert.equal(mapTransmission("Standard"), "manual");
});

test("leaves empty and unknown labels blank so the row is omitted", () => {
  assert.equal(mapTransmission(""), "");
  assert.equal(mapTransmission(null), "");
  assert.equal(mapTransmission(undefined), "");
  assert.equal(mapTransmission("unknown"), "");
});

test("provides Spanish and English labels for every website key", async () => {
  const source = await readFile(new URL("../js/i18n.js", import.meta.url), "utf8");
  const context = {
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: {} }
  };
  vm.runInNewContext(`${source}\nglobalThis.__I18N = I18N;`, context);

  for (const language of ["es", "en"]) {
    for (const transmission of ["automatic", "manual"]) {
      assert.ok(context.__I18N[language][`trans_${transmission}`], `${language}: ${transmission}`);
    }
    assert.ok(context.__I18N[language].d_transmission, `${language}: d_transmission`);
    assert.ok(context.__I18N[language].f_transmission, `${language}: f_transmission`);
  }
});
