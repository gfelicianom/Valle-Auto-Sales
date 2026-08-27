#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SITE = "https://valleautosales.com";
const PRIMARY_PHONE = "+1-787-233-4800";
const OFFICE_PHONE = "+1-787-868-4840";
const inventory = JSON.parse(await readFile("js/inventory.json", "utf8")).cars.filter((car) => !car.sold);
const sitemap = await readFile("sitemap.xml", "utf8");
const home = await readFile("index.html", "utf8");

function assertPhoneHierarchy(html) {
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const dealer = jsonLd
    .flatMap((entry) => entry["@graph"] || [entry])
    .find((entry) => entry["@type"] === "AutoDealer");

  assert.ok(dealer, "AutoDealer structured data is missing");
  assert.equal(dealer.telephone, PRIMARY_PHONE);
  assert.ok(dealer.contactPoint.some((point) => point.telephone === PRIMARY_PHONE));
  assert.ok(dealer.contactPoint.some((point) => point.telephone === OFFICE_PHONE));
  assert.match(html, /tel:\+17872334800/);
  assert.match(html, /wa\.me\/17872334800/);
  assert.match(html, /tel:\+17878684840/);
}

assert.match(home, /<meta name="robots" content="index,follow,max-image-preview:large">/);
// Pinned to intent, not to the exact sentence: the crawlable <h1> must still
// say what is sold and name the town, so a copy edit does not fail the build
// but deleting the location does.
assert.match(home, /<h1>Dealer de autos usados[^<]*en Aguada[^<]*<\/h1>/);
assert.match(home, /"@type": "AutoDealer"/);
assertPhoneHierarchy(home);

for (const route of ["inventario", "financiamiento", "historia", "contacto"]) {
  const html = await readFile(`${route}/index.html`, "utf8");
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${route}/">`));
  assert.match(sitemap, new RegExp(`<loc>${SITE}/${route}/</loc>`));
  assertPhoneHierarchy(html);
}

for (const car of inventory) {
  const url = `${SITE}/autos/${car.id}/`;
  const html = await readFile(`autos/${car.id}/index.html`, "utf8");
  assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
  assert.match(html, /"Vehicle","Product"/);
  assert.match(html, new RegExp(String(car.year)));
  assert.match(sitemap, new RegExp(`<loc>${url}</loc>`));
  assertPhoneHierarchy(html);
}

const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, inventory.length + 5);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length);

console.log(`SEO checks passed for ${inventory.length} vehicles and ${sitemapUrls.length} sitemap URLs.`);
