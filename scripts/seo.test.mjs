#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SITE = "https://valleautosales.com";
const inventory = JSON.parse(await readFile("js/inventory.json", "utf8")).cars.filter((car) => !car.sold);
const sitemap = await readFile("sitemap.xml", "utf8");
const home = await readFile("index.html", "utf8");

assert.match(home, /<meta name="robots" content="index,follow,max-image-preview:large">/);
assert.match(home, /Dealer de autos usados e importados en Aguada/);
assert.match(home, /"@type": "AutoDealer"/);

for (const route of ["inventario", "financiamiento", "historia", "contacto"]) {
  const html = await readFile(`${route}/index.html`, "utf8");
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${route}/">`));
  assert.match(sitemap, new RegExp(`<loc>${SITE}/${route}/</loc>`));
}

for (const car of inventory) {
  const url = `${SITE}/autos/${car.id}/`;
  const html = await readFile(`autos/${car.id}/index.html`, "utf8");
  assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
  assert.match(html, /"Vehicle","Product"/);
  assert.match(html, new RegExp(String(car.year)));
  assert.match(sitemap, new RegExp(`<loc>${url}</loc>`));
}

const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, inventory.length + 5);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length);

console.log(`SEO checks passed for ${inventory.length} vehicles and ${sitemapUrls.length} sitemap URLs.`);
