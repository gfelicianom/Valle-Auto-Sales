#!/usr/bin/env node

import path from "node:path";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const WIDTH = 1200;
const HEIGHT = 630;

const photoPath = path.join(ROOT, "img", "dealership.jpg");
const logoPath = path.join(ROOT, "img", "brand", "valle-auto-sales-logo.svg");
const outputPath = path.join(ROOT, "img", "brand", "valle-auto-sales-social-preview.jpg");

// The source logo includes generous black space for flexible placement on the
// site. Remove its two background rectangles and crop to the wordmark here so
// it blends into the card and stays readable at link-preview sizes.
const transparentLogoSvg = (await readFile(logoPath, "utf8")).replace(
  /<rect x="-150"[^>]*fill="#(?:ffffff|000000)"[^>]*\/>/g,
  "",
);
const logo = await sharp(Buffer.from(transparentLogoSvg), { density: 96 })
  .extract({ left: 80, top: 210, width: 2520, height: 860 })
  .resize({ width: 540 })
  .png()
  .toBuffer();

const photo = await sharp(photoPath)
  .resize(820, HEIGHT, { fit: "cover", position: "center" })
  .jpeg({ quality: 91, chromaSubsampling: "4:4:4" })
  .toBuffer();

const branding = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0e0e0e" stop-opacity="1"/>
        <stop offset="0.40" stop-color="#0e0e0e" stop-opacity="0.98"/>
        <stop offset="0.66" stop-color="#0e0e0e" stop-opacity="0.48"/>
        <stop offset="0.86" stop-color="#0e0e0e" stop-opacity="0.06"/>
        <stop offset="1" stop-color="#0e0e0e" stop-opacity="0"/>
      </linearGradient>
      <pattern id="carbon" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1.3" fill="#ffffff" fill-opacity="0.035"/>
      </pattern>
    </defs>
    <rect x="300" width="660" height="${HEIGHT}" fill="url(#shade)"/>
    <rect width="625" height="${HEIGHT}" fill="url(#carbon)"/>
    <rect x="58" y="280" width="7" height="170" rx="3.5" fill="#e01f26"/>
    <text x="88" y="326" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="700" letter-spacing="0.8">USADOS E IMPORTADOS</text>
    <text x="88" y="382" fill="#d8dce2" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" letter-spacing="0.4">AGUADA, PUERTO RICO</text>
    <text x="88" y="440" fill="#d8dce2" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">Familia sirviendo a Aguada desde 1992.</text>
    <rect x="0" y="612" width="${WIDTH}" height="18" fill="#e01f26"/>
  </svg>
`);

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: "#0e0e0e",
  },
})
  .composite([
    { input: photo, left: 380, top: 0 },
    { input: branding, left: 0, top: 0 },
    { input: logo, left: 43, top: 38 },
  ])
  .jpeg({ quality: 91, chromaSubsampling: "4:4:4" })
  .toFile(outputPath);

console.log(`Wrote ${path.relative(ROOT, outputPath)} (${WIDTH}x${HEIGHT})`);
