#!/usr/bin/env node
/* Generate crawlable HTML pages and sitemap entries from inventory.json. */

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://valleautosales.com";
const ROOT = process.cwd();
const AUTOS_DIR = path.join(ROOT, "autos");
const prDateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Puerto_Rico", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const TODAY = `${prDateParts.year}-${prDateParts.month}-${prDateParts.day}`;
const PHONE = "+17872334800";
const OFFICE = "+17878684840";
const MAP = "https://maps.app.goo.gl/Y89TvFvftSZ9DvCD8";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const xml = (value) => esc(value);
const money = (value) => Number(value) > 0 ? `$${Number(value).toLocaleString("en-US")}` : "Consulte precio";
const miles = (value) => `${Number(value || 0).toLocaleString("en-US")} millas`;
const carName = (car) => `${car.year} ${car.make} ${car.model}`.trim();
const carPath = (car) => `/autos/${encodeURIComponent(car.id)}/`;
const absImage = (src) => `${SITE}/${String(src).replace(/^\//, "")}`;
const BODY_LABELS = { sedan: "Sedán", suv: "SUV", pickup: "Pickup", hatchback: "Hatchback", van: "Van / Minivan", coupe: "Coupé", other: "Otro" };
const FUEL_LABELS = { gasoline: "Gasolina", diesel: "Diésel", hybrid: "Híbrido", plug_in_hybrid: "Híbrido enchufable", electric: "Eléctrico" };
const DRIVE_LABELS = { fwd: "FWD — delantera", rwd: "RWD — trasera", awd: "AWD — integral", "4wd": "4WD", "4x4": "4x4", "4x2": "4x2", differential_lock: "Bloqueo de diferencial" };
const COLOR_LABELS = { blanco: "Blanco", negro: "Negro", gris: "Gris", plata: "Plata", rojo: "Rojo", azul: "Azul", verde: "Verde", marron: "Marrón", dorado: "Dorado", amarillo: "Amarillo", anaranjado: "Anaranjado", vino: "Vino" };
const TRANSMISSION_LABELS = { automatic: "Automática", manual: "Manual" };

const dealerSchema = {
  "@type": "AutoDealer",
  "@id": `${SITE}/#dealer`,
  name: "Valle Auto Sales",
  url: `${SITE}/`,
  logo: `${SITE}/img/brand/valle-auto-sales-logo.svg`,
  image: `${SITE}/img/brand/valle-auto-sales-social-preview.jpg`,
  telephone: "+1-787-233-4800",
  contactPoint: [{
    "@type": "ContactPoint",
    telephone: "+1-787-233-4800",
    contactType: "sales",
    availableLanguage: ["es", "en"]
  }, {
    "@type": "ContactPoint",
    telephone: "+1-787-868-4840",
    contactType: "customer service",
    availableLanguage: ["es", "en"]
  }],
  email: "valleauto@yahoo.com",
  foundingDate: "1992-07",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Carr. #2 Km. 135.8, Bo. Naranjo",
    addressLocality: "Aguada",
    addressRegion: "PR",
    postalCode: "00602",
    addressCountry: "US"
  },
  openingHoursSpecification: [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:30",
    closes: "17:30"
  }],
  hasMap: MAP,
  sameAs: ["https://www.facebook.com/valleautosales", MAP]
};

function head({ title, description, canonical, image, schema }) {
  const shareImage = image || `${SITE}/img/brand/valle-auto-sales-social-preview.jpg`;
  return `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Valle Auto Sales">
<meta property="og:locale" content="es_PR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(shareImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(shareImage)}">
<meta name="theme-color" content="#e01f26">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
<link rel="icon" href="/img/brand/valle-auto-sales-logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<style>
  .seo-nav{display:flex;gap:1rem;flex-wrap:wrap}.seo-nav a{color:#fff;font-weight:700}
  .seo-note{max-width:780px;color:var(--gray-soft)}
  .seo-photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem;margin-top:1rem}
  .seo-photos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}
  .seo-footer-links{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
  .seo-footer-links a{color:#fff}
</style>
</head>`;
}

function shell({ headHtml, body, route = "" }) {
  const nav = [
    ["/", "Inicio"], ["/inventario/", "Inventario"],
    ["/financiamiento/", "Financiamiento"], ["/historia/", "Nuestra Historia"],
    ["/contacto/", "Contacto"]
  ];
  return `${headHtml}
<body>
<header class="site-header"><div class="header-inner">
  <a href="/" class="brand" aria-label="Valle Auto Sales — Inicio"><img class="brand-logo" src="/img/brand/valle-auto-sales-logo.svg" alt="Valle Auto Sales"></a>
  <nav class="seo-nav" aria-label="Principal">${nav.map(([url, label]) => `<a href="${url}"${route === url ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
</div></header>
<main>${body}</main>
<footer class="site-footer"><div class="footer-inner"><div class="footer-contact">
  <strong>Valle Auto Sales</strong>
  <a href="tel:${PHONE}">Principal — llamadas: (787) 233-4800</a>
  <a href="https://wa.me/${PHONE.slice(1)}">WhatsApp: (787) 233-4800</a>
  <a href="tel:${OFFICE}">Oficina — solo llamadas: (787) 868-4840</a>
  <a href="${MAP}" target="_blank" rel="noopener">Carr. #2 Km. 135.8, Bo. Naranjo, Aguada, PR</a>
</div></div><div class="seo-footer-links">${nav.map(([url, label]) => `<a href="${url}">${label}</a>`).join("")}</div>
<div class="footer-bottom">© ${new Date().getFullYear()} Valle Auto Sales · Aguada, Puerto Rico</div></footer>
</body></html>\n`;
}

function carCard(car) {
  const photo = car.photo_urls?.[0];
  return `<a class="car-card" href="${carPath(car)}" aria-label="Ver ${esc(carName(car))}">
    <div class="car-photo">${photo ? `<img src="/${esc(photo)}" alt="${esc(carName(car))} usado en venta en Aguada" loading="lazy">` : ""}</div>
    <div class="car-body"><h2 class="car-title">${esc(carName(car))}</h2><div class="car-price">${money(car.price)}</div>
    <div class="car-meta"><span>${miles(car.mileage)}</span><span>${esc(car.body_type || "Vehículo")}</span></div></div>
  </a>`;
}

function evergreenPage({ dir, title, description, body }) {
  const canonical = `${SITE}/${dir}/`;
  const schema = { "@context": "https://schema.org", "@graph": [dealerSchema, {
    "@type": "WebPage", "@id": `${canonical}#page`, url: canonical, name: title,
    description, inLanguage: "es-PR", isPartOf: { "@id": `${SITE}/#website` }, about: { "@id": `${SITE}/#dealer` }
  }] };
  return shell({ headHtml: head({ title, description, canonical, schema }), body, route: `/${dir}/` });
}

async function writePage(relativeDir, html) {
  const dir = path.join(ROOT, relativeDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
}

async function main() {
  const rootEntries = await readdir(ROOT);
  if (!rootEntries.includes("CNAME") || !rootEntries.includes("index.html")) {
    throw new Error("Run this script from the Valle Auto Sales repository root.");
  }
  const data = JSON.parse(await readFile(path.join(ROOT, "js/inventory.json"), "utf8"));
  const cars = (Array.isArray(data.cars) ? data.cars : []).filter((car) => car && car.id && !car.sold);

  await rm(AUTOS_DIR, { recursive: true, force: true });
  await mkdir(AUTOS_DIR, { recursive: true });

  const inventoryDescription = `${cars.length} autos usados disponibles en Valle Auto Sales, Aguada, Puerto Rico. Vea fotos, precios, millaje y detalles de cada vehículo.`;
  await writePage("inventario", evergreenPage({
    dir: "inventario",
    title: "Inventario de autos usados en Aguada, PR | Valle Auto Sales",
    description: inventoryDescription,
    body: `<section class="section"><div class="section-inner"><h1 class="section-title">Autos usados disponibles en Aguada</h1>
      <p class="seo-note">Explore el inventario actual de Valle Auto Sales. Tenemos autos, SUV y pickups usados — unidades locales e importadas — en el Barrio Naranjo de Aguada, y le vendemos a clientes de todo Puerto Rico.</p>
      <p><a class="btn btn-red" href="/#/inventario">Abrir inventario con filtros</a></p>
      <div class="car-grid">${cars.map(carCard).join("")}</div></div></section>`
  }));

  await writePage("financiamiento", evergreenPage({
    dir: "financiamiento",
    title: "Financiamiento de autos en Aguada, PR | Valle Auto Sales",
    description: "Opciones de compra al contado y financiamiento de autos usados en Valle Auto Sales, Aguada. Hable con nuestra familia para comenzar.",
    body: `<section class="section"><div class="section-inner"><h1 class="section-title">Financiamiento de autos en Aguada</h1>
      <p class="seo-note">Puede comprar su auto al contado o mediante financiamiento. Trabajamos con usted y con su banco para encontrar una opción conveniente.</p>
      <div class="contact-btns"><a class="btn btn-red" href="/#/financiamiento">Solicitar información</a><a class="btn btn-silver" href="https://wa.me/${PHONE.slice(1)}">WhatsApp</a></div>
    </div></section>`
  }));

  await writePage("historia", evergreenPage({
    dir: "historia",
    title: "Nuestra historia | Valle Auto Sales en Aguada desde 1992",
    description: "Conozca la historia de Valle Auto Sales, negocio familiar de autos en el Barrio Naranjo de Aguada, Puerto Rico, desde julio de 1992.",
    body: `<section class="section"><div class="section-inner"><h1 class="section-title">Familia de Aguada sirviendo a Puerto Rico desde 1992</h1>
      <figure class="story-photo"><img src="/img/family.jpg" alt="Eligio y Giovanni Feliciano de Valle Auto Sales" loading="lazy"><figcaption>Dos generaciones al frente de Valle Auto Sales.</figcaption></figure>
      <div class="story-body"><p>Valle Auto Sales comenzó como un sueño. Eligio Feliciano Valle pasó años trabajando dentro de una atunera, en el área de producción, y con el tiempo llegó a ser ayudante del supervisor. Aun entonces siempre estaba imaginando el futuro: pensando cómo esta persona podría vender autos, cómo aquella otra podría lavarlos. Soñaba con tener su propio dealer.</p>
      <p>Ese sueño respiró por primera vez en julio de 1992, cuando Eligio abrió un pequeño dealer en un local alquilado en el Barrio Naranjo de Aguada. Según el negocio fue creciendo, compró un terreno grande y construyó sobre él un dealer más amplio.</p>
      <p>El tiempo siguió su marcha. El hijo mayor de Eligio, Giovanni Feliciano, crecía y se integraba al negocio. Con los años, y según el negocio se afianzaba, Eligio construyó en concreto sólido el primer hogar permanente de Valle Auto Sales, el nombre que el negocio llevaba desde aquel primer local alquilado.</p>
      <p>Hasta el día de hoy, Valle Auto Sales es de Eligio Feliciano Valle. Y si se fija bien, su segundo apellido, Valle, es el mismo nombre que el dealer ha llevado desde el principio. Su hijo Giovanni Feliciano Méndez trabaja junto a él, en compañía de la esposa de Giovanni, Maritza García Soto. Sigue siendo, como siempre fue, un negocio de familia.</p>
      <p><a class="btn btn-red" href="/#/historia">Leer la historia completa</a></p></div>
    </div></section>`
  }));

  await writePage("contacto", evergreenPage({
    dir: "contacto",
    title: "Contacto y dirección | Valle Auto Sales, Aguada, PR",
    description: "Visite Valle Auto Sales en Carr. #2 Km. 135.8, Bo. Naranjo, Aguada. Horario lunes a sábado 8:30 a. m.–5:30 p. m. Llamadas y WhatsApp: 787-233-4800.",
    body: `<section class="section"><div class="section-inner"><h1 class="section-title">Contacto y cómo llegar</h1><div class="contact-grid"><div class="contact-card">
      <h2>Valle Auto Sales</h2><p>Carr. #2 Km. 135.8, Bo. Naranjo<br>Aguada, Puerto Rico 00602</p>
      <p><strong>Horario:</strong><br>Lunes a sábado: 8:30 a. m.–5:30 p. m.<br>Domingo: cerrado</p>
      <p><a href="tel:${PHONE}">Principal — llamadas: (787) 233-4800</a><br><a href="https://wa.me/${PHONE.slice(1)}">WhatsApp: (787) 233-4800</a><br><a href="tel:${OFFICE}">Oficina — solo llamadas: (787) 868-4840</a><br><a href="mailto:valleauto@yahoo.com">valleauto@yahoo.com</a></p>
      <a class="btn btn-green" href="${MAP}" target="_blank" rel="noopener">Abrir en Google Maps</a>
    </div><div class="map-wrap"><iframe src="https://www.google.com/maps?q=9R3Q%2B93%20Aguada%2C%20Puerto%20Rico&output=embed" loading="lazy" allowfullscreen title="Valle Auto Sales en Google Maps"></iframe></div></div></div></section>`
  }));

  for (const car of cars) {
    const name = carName(car);
    const canonical = `${SITE}${carPath(car)}`;
    const description = `${name} usado en venta en Valle Auto Sales, Aguada, Puerto Rico. ${money(car.price)}, ${miles(car.mileage)}. Vea fotos y detalles.`;
    const images = (car.photo_urls || []).map(absImage);
    const vehicleSchema = {
      "@type": ["Vehicle", "Product"], "@id": `${canonical}#vehicle`, name,
      url: canonical, description, image: images, sku: car.id,
      brand: { "@type": "Brand", name: car.make }, model: car.model,
      vehicleModelDate: String(car.year), mileageFromOdometer: {
        "@type": "QuantitativeValue", value: Number(car.mileage || 0), unitCode: "SMI"
      }, itemCondition: "https://schema.org/UsedCondition",
      color: COLOR_LABELS[car.color] || car.color || undefined,
      fuelType: FUEL_LABELS[car.fuel_type] || car.fuel_type || undefined,
      vehicleConfiguration: DRIVE_LABELS[car.drivetrain] || car.drivetrain || undefined,
      vehicleTransmission: TRANSMISSION_LABELS[car.transmission] || car.transmission || undefined,
      offers: Number(car.price) > 0 ? {
        "@type": "Offer", priceCurrency: "USD", price: Number(car.price),
        availability: "https://schema.org/InStock", url: canonical,
        seller: { "@id": `${SITE}/#dealer` }
      } : undefined
    };
    const schema = { "@context": "https://schema.org", "@graph": [dealerSchema, vehicleSchema] };
    const specs = [
      ["Año", car.year], ["Marca", car.make], ["Modelo", car.model],
      ["Millaje", miles(car.mileage)], ["Precio", money(car.price)],
      ["Tipo", BODY_LABELS[car.body_type] || car.body_type], ["Color", COLOR_LABELS[car.color] || car.color],
      ["Combustible", FUEL_LABELS[car.fuel_type] || car.fuel_type], ["Tracción", DRIVE_LABELS[car.drivetrain] || car.drivetrain],
      ["Transmisión", TRANSMISSION_LABELS[car.transmission] || car.transmission]
    ].filter(([, value]) => value !== "" && value != null);
    const body = `<section class="section"><div class="section-inner"><p><a class="back-link" href="/inventario/">← Volver al inventario</a></p>
      <div class="detail-grid"><div>${images[0] ? `<div class="gallery-main"><img src="${esc(images[0])}" alt="${esc(name)} usado en venta en Aguada"></div>` : ""}
      ${images.length > 1 ? `<div class="seo-photos">${images.slice(1).map((src, index) => `<img src="${esc(src)}" alt="${esc(name)} — foto ${index + 2}" loading="lazy">`).join("")}</div>` : ""}</div>
      <div class="detail-info"><h1>${esc(name)} usado en venta</h1><div class="detail-price">${money(car.price)}</div>
      <table class="spec-table"><tbody>${specs.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join("")}</tbody></table>
      ${car.notes ? `<div class="info-card"><h2>Detalles</h2><p>${esc(car.notes)}</p></div>` : ""}
      <div class="contact-btns"><a class="btn btn-red" href="/#/financiamiento?car=${encodeURIComponent(`${car.id} — ${name}`)}">Me interesa este auto</a>
      <a class="btn btn-silver" href="https://wa.me/${PHONE.slice(1)}?text=${encodeURIComponent(`Hola, me interesa el ${name} que vi en su página web.`)}">WhatsApp</a>
      <a class="btn btn-silver" href="tel:${PHONE}">Llamar</a></div></div></div></div></section>`;
    await writePage(path.join("autos", car.id), shell({
      // The title's budget is ~60 characters before Google truncates, and the car
      // name alone can eat 35 of them. The dealer name is already on the result
      // twice — in the domain line above the title and in the description below —
      // so the space goes to the car and the location instead.
      headHtml: head({ title: `${name} usado en Aguada, Puerto Rico`, description, canonical, image: images[0], schema }),
      body
    }));
  }

  const urls = ["/", "/inventario/", "/financiamiento/", "/historia/", "/contacto/", ...cars.map(carPath)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${xml(SITE + url)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  await writeFile(path.join(ROOT, "sitemap.xml"), sitemap);
  console.log(`Generated 4 evergreen pages, ${cars.length} vehicle pages, and sitemap.xml.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
