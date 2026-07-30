#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const SITE_ORIGIN = "https://valleautosales.com";
const SITE_HOST = "valleautosales.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY = "cc17f3d20eeb9fafad6c07e651b58b16";
const KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const submitAll = args.has("--all");
const submitChanged = args.has("--changed");

if (submitAll === submitChanged) {
  throw new Error("Choose exactly one URL mode: --all or --changed.");
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function siteUrl(pathname) {
  const normalized = pathname === "index.html"
    ? "/"
    : `/${pathname.replace(/index\.html$/, "")}`;
  return new URL(normalized, `${SITE_ORIGIN}/`).href;
}

function urlsForPath(pathname) {
  if (pathname === "index.html") return [`${SITE_ORIGIN}/`];

  if (/^(inventario|financiamiento|historia|contacto)\/index\.html$/.test(pathname)) {
    return [siteUrl(pathname)];
  }

  if (/^autos\/[^/]+\/index\.html$/.test(pathname)) {
    return [siteUrl(pathname)];
  }

  if (pathname === "js/inventory.json") {
    return [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/inventario/`];
  }

  return [];
}

async function allSitemapUrls() {
  const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
  return [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => decodeXml(match[1].trim()));
}

function changedUrls() {
  const diff = execFileSync(
    "git",
    ["diff", "--name-status", "--find-renames", "HEAD^", "HEAD"],
    { encoding: "utf8" },
  );

  const urls = new Set();

  for (const line of diff.trim().split("\n")) {
    if (!line) continue;
    const [, ...paths] = line.split("\t");
    for (const pathname of paths) {
      for (const url of urlsForPath(pathname)) urls.add(url);
    }
  }

  return [...urls];
}

const urlList = [...new Set(submitAll ? await allSitemapUrls() : changedUrls())];

for (const url of urlList) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== SITE_HOST) {
    throw new Error(`Refusing to submit an unexpected URL: ${url}`);
  }
}

if (urlList.length === 0) {
  console.log("No changed public URLs to submit to IndexNow.");
  process.exit(0);
}

const payload = {
  host: SITE_HOST,
  key: INDEXNOW_KEY,
  keyLocation: KEY_LOCATION,
  urlList,
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

if (response.status !== 200 && response.status !== 202) {
  const responseBody = await response.text();
  throw new Error(
    `IndexNow submission failed (${response.status}): ${responseBody || response.statusText}`,
  );
}

console.log(`IndexNow accepted ${urlList.length} URL${urlList.length === 1 ? "" : "s"} (${response.status}).`);
