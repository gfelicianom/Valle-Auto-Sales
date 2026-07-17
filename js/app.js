/* ============================================================
   Valle Auto Sales — app: routing, rendering, filters, form
   ============================================================ */

let CARS = [];
const app = document.getElementById("app");

/* Filter state persists while browsing the inventory */
const FILTERS_DEFAULT = () => ({
  q: "", body: "", make: "", model: "", color: "", origin: "",
  engine: "", cylinders: "", drivetrain: "", fuel: "",
  yearMin: "", yearMax: "", priceMin: "", priceMax: "",
  mileMin: "", mileMax: "", showSold: false, sort: "price_asc", panelOpen: false
});
let FILTERS = FILTERS_DEFAULT();

/* ---------- helpers ---------- */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPrice = p => Number(p) > 0 ? "$" + Number(p).toLocaleString("en-US") : t("price_ask");
const fmtMiles = m => Number(m).toLocaleString("en-US");
const carName = c => `${c.make} ${c.model} ${c.year}`;
const colorLabel = c => t("c_" + c.color) === "c_" + c.color ? (c.color.charAt(0).toUpperCase() + c.color.slice(1)) : t("c_" + c.color);
const bodyLabel = c => t("bt_" + c.body_type) === "bt_" + c.body_type ? t("bt_other") : t("bt_" + c.body_type);
const drivetrainLabel = c => t("drive_" + c.drivetrain) === "drive_" + c.drivetrain ? c.drivetrain.toUpperCase() : t("drive_" + c.drivetrain);
const fuelLabel = c => t("fuel_" + c.fuel_type) === "fuel_" + c.fuel_type ? c.fuel_type : t("fuel_" + c.fuel_type);

function powertrainParts(c) {
  return [
    Number(c.engine_liters) > 0 ? `${Number(c.engine_liters).toLocaleString("en-US", { maximumFractionDigits: 2 })} L` : "",
    Number(c.cylinders) > 0 ? t("cylinders_short", { n: Number(c.cylinders) }) : "",
    c.drivetrain ? drivetrainLabel(c) : "",
    c.fuel_type ? fuelLabel(c) : ""
  ].filter(Boolean);
}

function colorDot(c) {
  const hex = COLOR_SWATCHES[c.color] || "#aaa";
  return `<span class="color-dot" style="background:${hex}"></span>`;
}

function carCard(c) {
  /* placeholder always renders underneath; an expired photo URL removes
     itself (onerror) and the placeholder shows through */
  const placeholder = `<span class="ph-icon">🚗</span><span class="ph-label">${t("photo_placeholder")}</span>`;
  const photo = c.photo_urls.length
    ? placeholder + `<img src="${esc(c.photo_urls[0])}" alt="${esc(carName(c))}" loading="lazy" onerror="this.remove()">`
    : placeholder;
  return `
  <a class="car-card ${c.sold ? "is-sold" : ""}" href="#/auto/${encodeURIComponent(c.id)}">
    <div class="car-photo">
      ${c.sold ? `<span class="sold-tag">${t("badge_sold")}</span>` : ""}
      ${c.featured && !c.sold ? `<span class="featured-star">★ ${t("badge_featured")}</span>` : ""}
      ${c.drivetrain === "4wd" ? `<span class="tag-4x4">4×4</span>` : ""}
      ${photo}
    </div>
    <div class="car-body">
      <div class="car-title">${esc(carName(c))}</div>
      <div class="car-price">${fmtPrice(c.price)}</div>
      ${powertrainParts(c).length ? `<div class="car-powertrain">${powertrainParts(c).map(esc).join(" · ")}</div>` : ""}
      <div class="car-meta">
        <span>${fmtMiles(c.mileage)} ${t("miles")}</span>
        ${c.color ? `<span>${colorDot(c)}${colorLabel(c)}</span>` : ""}
        <span>${bodyLabel(c)}</span>
        ${c.origin ? `<span class="badge ${c.origin === "imported" ? "badge-imported" : "badge-local"}">${t(c.origin === "imported" ? "origin_imported" : "origin_local")}</span>` : ""}
      </div>
    </div>
  </a>`;
}

/* ---------- pages ---------- */

function renderHome() {
  const featured = CARS.filter(c => c.featured && !c.sold).slice(0, 6);
  app.innerHTML = `
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <h1>${t("hero_title")}</h1>
        <p>${t("hero_sub")}</p>
        <div class="hero-ctas">
          <a href="#/inventario" class="btn btn-red">${t("hero_cta")}</a>
          <a href="#/contacto" class="btn btn-outline">${t("hero_cta2")}</a>
        </div>
      </div>
      <div class="hero-photo">
        <img src="img/dealership.jpg" alt="Valle Auto Sales, Aguada, Puerto Rico" loading="eager">
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-inner">
      <h2 class="section-title">${t("featured_title")}</h2>
      <div class="car-grid">${featured.map(carCard).join("")}</div>
      <p style="margin-top:1.2rem"><a href="#/inventario" style="font-weight:700">${t("featured_all")}</a></p>
    </div>
  </section>

  <section class="section section-alt">
    <div class="section-inner home-two">
      <div class="home-panel panel-story">
        <h2>${t("story_teaser_title")}</h2>
        <p>${t("story_teaser_text")}</p>
        <a href="#/historia">${t("story_teaser_link")}</a>
      </div>
      <div class="home-panel panel-visit">
        <h2>${t("visit_title")}</h2>
        <p>${t("visit_text")}</p>
        <div class="reviews-badge">
          <span class="reviews-stars">${t("reviews_badge")}</span>
          <span class="reviews-count">${t("reviews_count")}</span>
          <a href="${MAP_LINK}" target="_blank" rel="noopener">${t("reviews_link")}</a>
        </div>
        <a href="${MAP_LINK}" target="_blank" rel="noopener" class="btn btn-green">${t("visit_cta")}</a>
      </div>
    </div>
  </section>`;
}

function filterOptions(values, current, allLabel) {
  return `<option value="">${allLabel}</option>` +
    values.map(v => `<option value="${esc(v.value)}" ${v.value === current ? "selected" : ""}>${esc(v.label)}</option>`).join("");
}

function applyFilters() {
  let list = CARS.slice();
  const f = FILTERS;
  if (!f.showSold) list = list.filter(c => !c.sold);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter(c => [
      c.make, c.model, c.year, c.engine_liters, c.cylinders, c.drivetrain,
      c.fuel_type, c.drivetrain ? drivetrainLabel(c) : "",
      c.fuel_type ? fuelLabel(c) : "",
      Number(c.cylinders) > 0 ? t("cylinders_long", { n: Number(c.cylinders) }) : ""
    ].join(" ").toLowerCase().includes(q));
  }
  if (f.body) list = list.filter(c => c.body_type === f.body || (f.body === "suv" && c.body_type.startsWith("suv")));
  if (f.make) list = list.filter(c => c.make === f.make);
  if (f.model) list = list.filter(c => c.model === f.model);
  if (f.color) list = list.filter(c => c.color === f.color);
  if (f.origin) list = list.filter(c => c.origin === f.origin);
  if (f.engine) list = list.filter(c => Number(c.engine_liters) === +f.engine);
  if (f.cylinders) list = list.filter(c => Number(c.cylinders) === +f.cylinders);
  if (f.drivetrain) list = list.filter(c => c.drivetrain === f.drivetrain);
  if (f.fuel) list = list.filter(c => c.fuel_type === f.fuel);
  if (f.yearMin) list = list.filter(c => c.year >= +f.yearMin);
  if (f.yearMax) list = list.filter(c => c.year <= +f.yearMax);
  if (f.priceMin) list = list.filter(c => c.price >= +f.priceMin);
  if (f.priceMax) list = list.filter(c => c.price <= +f.priceMax);
  if (f.mileMin) list = list.filter(c => c.mileage >= +f.mileMin);
  if (f.mileMax) list = list.filter(c => c.mileage <= +f.mileMax);

  const sorts = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    year_desc: (a, b) => b.year - a.year,
    mileage_asc: (a, b) => a.mileage - b.mileage
  };
  list.sort(sorts[f.sort] || sorts.price_asc);
  /* sold cars always sink to the bottom */
  list.sort((a, b) => (a.sold ? 1 : 0) - (b.sold ? 1 : 0));
  return list;
}

function renderInventory() {
  const f = FILTERS;
  const makes = [...new Set(CARS.map(c => c.make))].sort();
  const models = [...new Set(CARS.filter(c => !f.make || c.make === f.make).map(c => c.model))].sort();
  const colors = [...new Set(CARS.map(c => c.color))].sort();
  const bodies = [...new Set(CARS.map(c => c.body_type))];
  const bodyOpts = ["sedan", "suv", "suv_small", "suv_mid", "suv_large", "pickup", "hatchback", "van", "coupe", "other"]
    .filter(b => bodies.includes(b)).map(b => ({ value: b, label: t("bt_" + b) }));
  if (bodies.some(b => b.startsWith("suv_"))) bodyOpts.unshift({ value: "suv", label: "SUV — " + t("f_all") });
  const hasColors = colors.some(Boolean);
  const hasOrigins = CARS.some(c => c.origin);
  const engines = [...new Set(CARS.map(c => Number(c.engine_liters)).filter(n => n > 0))].sort((a, b) => a - b);
  const cylinders = [...new Set(CARS.map(c => Number(c.cylinders)).filter(n => n > 0))].sort((a, b) => a - b);
  const drivetrainValues = new Set(CARS.map(c => c.drivetrain).filter(Boolean));
  const fuelValues = new Set(CARS.map(c => c.fuel_type).filter(Boolean));
  const drivetrains = ["fwd", "rwd", "awd", "4wd"].filter(value => drivetrainValues.has(value));
  const fuels = ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric"].filter(value => fuelValues.has(value));

  const list = applyFilters();

  app.innerHTML = `
  <section class="section">
    <div class="section-inner">
      <h1 class="section-title">${t("inv_title")}</h1>

      <div class="inv-controls">
        <input type="search" id="invSearch" class="search-box" placeholder="${t("inv_search")}" value="${esc(f.q)}">
        <button class="filters-toggle" id="filtersToggle">☰ ${t("inv_filters")}</button>
        <select class="sort-select" id="invSort" aria-label="${t("sort_label")}">
          <option value="price_asc" ${f.sort === "price_asc" ? "selected" : ""}>${t("sort_price_asc")}</option>
          <option value="price_desc" ${f.sort === "price_desc" ? "selected" : ""}>${t("sort_price_desc")}</option>
          <option value="year_desc" ${f.sort === "year_desc" ? "selected" : ""}>${t("sort_year_desc")}</option>
          <option value="mileage_asc" ${f.sort === "mileage_asc" ? "selected" : ""}>${t("sort_mileage_asc")}</option>
        </select>
      </div>

      <div class="filters-panel ${f.panelOpen ? "" : "hidden"}" id="filtersPanel">
        <div class="filter-group">
          <label>${t("f_body")}</label>
          <select class="filter-select" data-f="body">${filterOptions(bodyOpts, f.body, t("f_all"))}</select>
        </div>
        <div class="filter-group">
          <label>${t("f_make")}</label>
          <select class="filter-select" data-f="make">${filterOptions(makes.map(m => ({ value: m, label: m })), f.make, t("f_all"))}</select>
        </div>
        <div class="filter-group">
          <label>${t("f_model")}</label>
          <select class="filter-select" data-f="model">${filterOptions(models.map(m => ({ value: m, label: m })), f.model, t("f_all"))}</select>
        </div>
        ${hasColors ? `
        <div class="filter-group">
          <label>${t("f_color")}</label>
          <select class="filter-select" data-f="color">${filterOptions(colors.filter(Boolean).map(c => ({ value: c, label: t("c_" + c) === "c_" + c ? c : t("c_" + c) })), f.color, t("f_all"))}</select>
        </div>` : ""}
        ${hasOrigins ? `
        <div class="filter-group">
          <label>${t("f_origin")}</label>
          <select class="filter-select" data-f="origin">${filterOptions([
            { value: "local", label: t("origin_local") },
            { value: "imported", label: t("origin_imported") }
          ], f.origin, t("f_all"))}</select>
        </div>` : ""}
        ${engines.length ? `
        <div class="filter-group">
          <label>${t("f_engine")}</label>
          <select class="filter-select" data-f="engine">${filterOptions(engines.map(n => ({ value: String(n), label: `${n} L` })), f.engine, t("f_all"))}</select>
        </div>` : ""}
        ${cylinders.length ? `
        <div class="filter-group">
          <label>${t("f_cylinders")}</label>
          <select class="filter-select" data-f="cylinders">${filterOptions(cylinders.map(n => ({ value: String(n), label: t("cylinders_long", { n }) })), f.cylinders, t("f_all"))}</select>
        </div>` : ""}
        ${drivetrains.length ? `
        <div class="filter-group">
          <label>${t("f_drivetrain")}</label>
          <select class="filter-select" data-f="drivetrain">${filterOptions(drivetrains.map(d => ({ value: d, label: t("drive_" + d) })), f.drivetrain, t("f_all"))}</select>
        </div>` : ""}
        ${fuels.length ? `
        <div class="filter-group">
          <label>${t("f_fuel")}</label>
          <select class="filter-select" data-f="fuel">${filterOptions(fuels.map(fuel => ({ value: fuel, label: t("fuel_" + fuel) })), f.fuel, t("f_all"))}</select>
        </div>` : ""}
        <div class="filter-group">
          <label>${t("f_year")}</label>
          <div class="range-row">
            <input class="filter-input" type="number" inputmode="numeric" data-f="yearMin" placeholder="${t("f_min")}" value="${f.yearMin}">
            <input class="filter-input" type="number" inputmode="numeric" data-f="yearMax" placeholder="${t("f_max")}" value="${f.yearMax}">
          </div>
        </div>
        <div class="filter-group">
          <label>${t("f_price")} ($)</label>
          <div class="range-row">
            <input class="filter-input" type="number" inputmode="numeric" data-f="priceMin" placeholder="${t("f_min")}" value="${f.priceMin}">
            <input class="filter-input" type="number" inputmode="numeric" data-f="priceMax" placeholder="${t("f_max")}" value="${f.priceMax}">
          </div>
        </div>
        <div class="filter-group">
          <label>${t("f_mileage")}</label>
          <div class="range-row">
            <input class="filter-input" type="number" inputmode="numeric" data-f="mileMin" placeholder="${t("f_min")}" value="${f.mileMin}">
            <input class="filter-input" type="number" inputmode="numeric" data-f="mileMax" placeholder="${t("f_max")}" value="${f.mileMax}">
          </div>
        </div>
        <div class="filter-group">
          <label>${t("f_availability")}</label>
          <select class="filter-select" data-f="showSold">
            <option value="" ${!f.showSold ? "selected" : ""}>${t("f_available_only")}</option>
            <option value="1" ${f.showSold ? "selected" : ""}>${t("f_show_sold")}</option>
          </select>
        </div>
        <div class="filter-group" style="align-self:end">
          <button class="clear-filters" id="clearFilters">✕ ${t("inv_clear")}</button>
        </div>
      </div>

      <div class="inv-count">${list.length === 1 ? t("inv_results_one") : t("inv_results", { n: list.length })}</div>
      ${list.length ? `<div class="car-grid">${list.map(carCard).join("")}</div>` : `<div class="inv-empty">${t("inv_none")}</div>`}
    </div>
  </section>`;

  document.getElementById("invSearch").addEventListener("input", e => { FILTERS.q = e.target.value; refreshInventory(); });
  document.getElementById("invSort").addEventListener("change", e => { FILTERS.sort = e.target.value; renderInventory(); });
  document.getElementById("filtersToggle").addEventListener("click", () => {
    FILTERS.panelOpen = !FILTERS.panelOpen;
    document.getElementById("filtersPanel").classList.toggle("hidden", !FILTERS.panelOpen);
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    FILTERS = FILTERS_DEFAULT(); FILTERS.panelOpen = true; renderInventory();
  });
  app.querySelectorAll("[data-f]").forEach(el => {
    el.addEventListener("change", () => {
      const k = el.dataset.f;
      if (k === "showSold") FILTERS.showSold = !!el.value;
      else FILTERS[k] = el.value;
      if (k === "make") FILTERS.model = "";
      renderInventory();
    });
  });
}

/* Re-render only the results while typing in search (keeps focus) */
function refreshInventory() {
  const list = applyFilters();
  const count = app.querySelector(".inv-count");
  if (count) count.textContent = list.length === 1 ? t("inv_results_one") : t("inv_results", { n: list.length });
  const grid = app.querySelector(".car-grid, .inv-empty");
  if (grid) grid.outerHTML = list.length ? `<div class="car-grid">${list.map(carCard).join("")}</div>` : `<div class="inv-empty">${t("inv_none")}</div>`;
}

function renderCarDetail(id) {
  const c = CARS.find(x => x.id === id);
  if (!c) {
    app.innerHTML = `<section class="section"><div class="section-inner">
      <a class="back-link" href="#/inventario">${t("d_back")}</a>
      <div class="inv-empty">${t("d_not_found")}</div></div></section>`;
    return;
  }

  const photos = c.photo_urls;
  const galleryPlaceholder = `<span class="ph-icon" style="font-size:4rem">🚗</span><p>${t("photo_placeholder")}</p>`;
  const galleryNav = photos.length > 1
    ? `<button class="gallery-nav prev" aria-label="${t("gal_prev")}">‹</button>
       <button class="gallery-nav next" aria-label="${t("gal_next")}">›</button>
       <div class="gallery-count" id="galleryCount">1 / ${photos.length}</div>`
    : "";
  const mainPhoto = photos.length
    ? galleryPlaceholder + `<img id="galleryMain" src="${esc(photos[0])}" alt="${esc(carName(c))}" onerror="this.remove()">` + galleryNav
    : galleryPlaceholder;
  const thumbs = photos.length > 1
    ? `<div class="gallery-thumbs">${photos.map((p, i) =>
        `<button data-idx="${i}" class="${i === 0 ? "active" : ""}"><img src="${esc(p)}" alt="" onerror="this.closest('button').remove()"></button>`).join("")}</div>`
    : "";

  const interestHref = `#/financiamiento?car=${encodeURIComponent(c.id + " — " + carName(c) + " (" + colorLabel(c) + ")")}`;

  app.innerHTML = `
  <section class="section">
    <div class="section-inner">
      <a class="back-link" href="#/inventario">${t("d_back")}</a>
      ${c.sold ? `<div class="sold-banner">◆ ${t("d_sold_banner")}</div>` : ""}
      <div class="detail-grid">
        <div>
          <div class="gallery-main">${mainPhoto}</div>
          ${thumbs}
          ${photos.length === 0 ? `<p class="photos-soon">${t("d_photos_soon")}</p>` : ""}
        </div>
        <div class="detail-info">
          <h1>${esc(carName(c))}</h1>
          <div class="detail-price">${fmtPrice(c.price)}</div>

          <table class="spec-table">
            <tr><td>${t("d_year")}</td><td>${c.year}</td></tr>
            ${c.color ? `<tr><td>${t("d_color")}</td><td>${colorDot(c)} ${colorLabel(c)}</td></tr>` : ""}
            <tr><td>${t("d_mileage")}</td><td>${fmtMiles(c.mileage)} ${t("miles")}</td></tr>
            <tr><td>${t("d_body")}</td><td>${bodyLabel(c)}</td></tr>
            ${Number(c.engine_liters) > 0 ? `<tr><td>${t("d_engine")}</td><td>${Number(c.engine_liters).toLocaleString("en-US", { maximumFractionDigits: 2 })} L</td></tr>` : ""}
            ${Number(c.cylinders) > 0 ? `<tr><td>${t("d_cylinders")}</td><td>${t("cylinders_long", { n: Number(c.cylinders) })}</td></tr>` : ""}
            ${c.drivetrain ? `<tr><td>${t("d_drivetrain")}</td><td>${c.drivetrain === "4wd" ? `<span class="badge badge-4x4">${drivetrainLabel(c)}</span>` : drivetrainLabel(c)}</td></tr>` : ""}
            ${c.fuel_type ? `<tr><td>${t("d_fuel")}</td><td>${fuelLabel(c)}</td></tr>` : ""}
            ${c.origin ? `<tr><td>${t("f_origin")}</td><td><span class="badge ${c.origin === "imported" ? "badge-imported" : "badge-local"}">${t(c.origin === "imported" ? "origin_imported" : "origin_local")}</span></td></tr>` : ""}
          </table>

          ${c.condition_tags.length ? `
          <div class="info-card">
            <h3>${t("d_condition_title")}</h3>
            <ul class="condition-tags">
              ${c.condition_tags.map(tag => `<li>${t("ct_" + tag)}</li>`).join("")}
            </ul>
            <p class="condition-note">${t("d_condition_note")}</p>
          </div>` : ""}

          ${c.notes ? `<div class="info-card"><h3>${t("d_notes")}</h3><p>${esc(c.notes)}</p></div>` : ""}

          ${!c.sold ? `<a href="${interestHref}" class="btn btn-red interest-btn">${t("d_interested")}</a>` : ""}

          <div class="contact-btns">
            <a href="https://wa.me/17872334800?text=${encodeURIComponent(t("d_wa_msg", { car: carName(c) }))}" target="_blank" rel="noopener" class="btn btn-silver">💬 ${t("d_whatsapp")}</a>
            <a href="tel:+17878684840" class="btn btn-silver">📞 ${t("d_call_office")}</a>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  if (photos.length > 1) {
    let idx = 0;
    const mainImg = document.getElementById("galleryMain");
    const countEl = document.getElementById("galleryCount");
    const thumbBtns = [...app.querySelectorAll(".gallery-thumbs button")];
    const show = i => {
      idx = (i + photos.length) % photos.length;
      if (mainImg) mainImg.src = photos[idx];
      countEl.textContent = `${idx + 1} / ${photos.length}`;
      thumbBtns.forEach(b => b.classList.toggle("active", +b.dataset.idx === idx));
    };

    thumbBtns.forEach(btn => btn.addEventListener("click", () => show(+btn.dataset.idx)));
    app.querySelector(".gallery-nav.prev").addEventListener("click", () => show(idx - 1));
    app.querySelector(".gallery-nav.next").addEventListener("click", () => show(idx + 1));

    const gallery = app.querySelector(".gallery-main");
    let touchX = null;
    gallery.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener("touchend", e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
}

function renderFinancing(params) {
  const prefill = params.get("car") || "";
  const waMsg = prefill ? t("fin_wa_msg_car", { car: prefill }) : t("fin_wa_msg");

  app.innerHTML = `
  <section class="section">
    <div class="section-inner">
      <h1 class="section-title">${t("fin_title")}</h1>
      <p style="max-width:680px;font-size:1.05rem">${t("fin_intro_1")}</p>

      <div class="fin-cards">
        <div class="fin-card"><div class="fin-icon">💵</div><h3>${t("fin_cash_title")}</h3><p>${t("fin_cash_text")}</p></div>
        <div class="fin-card"><div class="fin-icon">🤝</div><h3>${t("fin_financing_title")}</h3><p>${t("fin_financing_text")}</p></div>
      </div>

      <div class="talk-direct">
        <h3>${t("fin_talk_title")}</h3>
        <p>${t("fin_talk_text")}</p>
        <div class="contact-btns">
          <a href="https://wa.me/17872334800?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener" class="btn btn-silver">💬 ${t("d_whatsapp")}</a>
          <a href="tel:+17878684840" class="btn btn-silver">📞 ${t("d_call_office")}</a>
        </div>
      </div>

      <form class="lead-form" id="leadForm" novalidate>
        <h2>${t("fin_form_title")}</h2>
        <p class="form-sub">${t("fin_form_sub")}</p>

        <div class="form-field">
          <label for="fName">${t("fin_name")} *</label>
          <input id="fName" name="name" type="text" required autocomplete="name">
        </div>
        <div class="form-field">
          <label for="fPhone">${t("fin_phone")} *</label>
          <input id="fPhone" name="phone" type="tel" required autocomplete="tel">
        </div>
        <div class="form-field">
          <label for="fEmail">${t("fin_email")}</label>
          <input id="fEmail" name="email" type="email" autocomplete="email">
        </div>
        <div class="form-field">
          <label for="fCar">${t("fin_car")}</label>
          <input id="fCar" name="car" type="text" value="${esc(prefill)}" placeholder="${t("fin_car_ph")}">
        </div>
        <div class="form-field">
          <label for="fPay">${t("fin_payment")}</label>
          <select id="fPay" name="payment">
            <option value="">${t("fin_payment_select")}</option>
            <option value="Cash">${t("fin_pay_cash")}</option>
            <option value="Financiamiento">${t("fin_pay_financing")}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="fMsg">${t("fin_message")}</label>
          <textarea id="fMsg" name="message"></textarea>
        </div>
        <input type="text" name="_honey" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">


        <p class="privacy-note">${t("fin_privacy")}</p>

        <button type="submit" class="btn btn-red" id="leadSubmit" style="width:100%">${t("fin_submit")}</button>
        <div class="form-status" id="formStatus" role="status"></div>
      </form>
    </div>
  </section>`;

  document.getElementById("leadForm").addEventListener("submit", onLeadSubmit);
}

async function onLeadSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById("formStatus");
  const btn = document.getElementById("leadSubmit");
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.name.trim() || !data.phone.trim()) {
    status.className = "form-status err";
    status.textContent = t("fin_required");
    return;
  }

  const subject = "Interés de compra — Valle Auto Sales" + (data.car ? " — " + data.car : "");

  /* Last resort: open the visitor's email app pre-addressed to the dealer */
  const mailtoFallback = () => {
    const body = [
      t("fin_name") + ": " + data.name,
      t("fin_phone") + ": " + data.phone,
      t("fin_email") + ": " + (data.email || "—"),
      t("fin_car") + ": " + (data.car || "—"),
      t("fin_payment") + ": " + (data.payment || "—"),
      t("fin_message") + ": " + (data.message || "—")
    ].join("\n");
    location.href = "mailto:valleauto@yahoo.com?subject=" +
      encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    status.className = "form-status ok";
    status.textContent = t("fin_success");
  };

  if (!FORM_ENDPOINT) { mailtoFallback(); return; }

  btn.disabled = true;
  btn.textContent = t("fin_sending");
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        _subject: subject,
        _template: "table"   /* readable field/value layout in the email */
      })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    status.className = "form-status ok";
    status.textContent = t("fin_success");
    form.reset();
  } catch (err) {
    /* Service down or over quota — don't lose the lead */
    mailtoFallback();
  } finally {
    btn.disabled = false;
    btn.textContent = t("fin_submit");
  }
}

function renderStory() {
  app.innerHTML = `
  <section class="section">
    <div class="section-inner">
      <h1 class="section-title">${t("story_title")}</h1>
      <figure class="story-photo">
        <img src="img/family.jpg" alt="${esc(t("story_photo_caption"))}" loading="lazy">
        <figcaption>${t("story_photo_caption")}</figcaption>
      </figure>
      <div class="story-body">
        <p>${t("story_p1")}</p>
        <p>${t("story_p2")}</p>
        <p>${t("story_p3")}</p>
        <p>${t("story_p4")}</p>
        <p class="story-sign">${t("story_visit")}</p>
      </div>
    </div>
  </section>`;
}

const MAP_LINK = "https://maps.app.goo.gl/Y89TvFvftSZ9DvCD8";
const FB_LINK = "https://www.facebook.com/valleautosales";
const MAP_EMBED = "https://www.google.com/maps?q=9R3Q%2B93%20Aguada%2C%20Puerto%20Rico&output=embed";

function renderContact() {
  app.innerHTML = `
  <section class="section">
    <div class="section-inner">
      <h1 class="section-title">${t("contact_title")}</h1>
      <div class="contact-grid">
        <div class="contact-card">
          <h3>${t("contact_phones")}</h3>
          <a href="https://wa.me/17872334800" target="_blank" rel="noopener">💬 WhatsApp: (787) 233-4800</a>
          <a href="tel:+17878684840">📞 ${t("contact_office")}: (787) 868-4840</a>
          <h3>${t("contact_email")}</h3>
          <a href="mailto:valleauto@yahoo.com">valleauto@yahoo.com</a>
          <h3>${t("contact_address")}</h3>
          <p>${t("address_physical")}</p>
          <h3>${t("contact_postal")}</h3>
          <p>${t("address_postal")}</p>
          <h3>${t("contact_hours")}</h3>
          <p>${t("hours_weekdays")}<br>${t("hours_sunday")}</p>
          <a href="${FB_LINK}" target="_blank" rel="noopener">${t("fb_follow")}</a>
          <p style="margin-top:1rem;font-style:italic;color:var(--gray-soft)">${t("contact_hours_note")}</p>
          <a href="${MAP_LINK}" target="_blank" rel="noopener" class="btn btn-green directions-btn">📍 ${t("contact_directions")}</a>
        </div>
        <div class="map-wrap">
          <iframe src="${MAP_EMBED}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Valle Auto Sales — Google Maps"></iframe>
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- router ---------- */

const ROUTES = {
  "": { key: "home", render: renderHome },
  "inventario": { key: "inventory", render: renderInventory },
  "financiamiento": { key: "financing", render: renderFinancing },
  "historia": { key: "story", render: renderStory },
  "contacto": { key: "contact", render: renderContact }
};

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = hash.split("?");
  const params = new URLSearchParams(queryPart || "");
  const segments = pathPart.split("/").filter(Boolean);

  let routeKey = "home";
  if (segments[0] === "auto" && segments[1]) {
    renderCarDetail(decodeURIComponent(segments[1]));
    routeKey = "inventory";
  } else {
    const r = ROUTES[segments[0] || ""] || ROUTES[""];
    routeKey = r.key;
    r.render(params);
  }

  document.querySelectorAll(".main-nav a").forEach(a =>
    a.classList.toggle("active", a.dataset.route === routeKey));
  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  window.scrollTo(0, 0);
}

/* ---------- static chrome (header/footer) ---------- */

function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang-toggle").forEach(b => { b.textContent = t("lang_button"); });
  document.title = LANG === "es"
    ? "Valle Auto Sales — Usados e Importados — Aguada, Puerto Rico"
    : "Valle Auto Sales — Used & Imported Cars — Aguada, Puerto Rico";
}

function toggleLang() {
  setLang(LANG === "es" ? "en" : "es");
  applyStaticText();
  route();
}

/* ---------- init ---------- */

document.getElementById("langToggle").addEventListener("click", toggleLang);
document.getElementById("langToggleFooter").addEventListener("click", toggleLang);
document.getElementById("menuToggle").addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  nav.classList.toggle("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", nav.classList.contains("open"));
});
document.getElementById("year").textContent = new Date().getFullYear();
window.addEventListener("hashchange", route);

(async function init() {
  setLang(LANG);
  applyStaticText();
  CARS = await loadInventory();
  route();
})();
