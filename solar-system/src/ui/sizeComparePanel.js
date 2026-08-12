import { SIZE_ENTITIES, searchSizeEntities } from "../data/sizeData.js";

// ---------- size comparison panel ----------
// Search-and-select 2+ real bodies from src/data/sizeData.js's flat
// diameter list, then see them as actual proportionally-sized circles side
// by side, each one a REAL photo of that specific body clipped into a
// circle (see circleStyle() below) — not an abstract axis position, not a
// generic colored dot, an actual small photo of the actual thing at its
// actual relative size. The same idea as the classic "planets lined up by
// size" infographic, built for a young audience specifically: a number next
// to a name doesn't land the same way a recognizable photo, obviously
// bigger or smaller than its neighbor, does.
//
// Scale is LINEAR and relative to whichever selected body is biggest —
// deliberately not the shared log range src/data/sizeData.js's full
// dataset spans, since that's the wrong tool here: log position is honest
// about huge ratios but doesn't look like a size difference, it looks like
// a ruler. A circle sized directly proportional to real diameter is what
// actually reads as "this one is bigger."
//
// The tradeoff that trade-off creates: if the smallest selected body is
// too tiny relative to the biggest to render at all (a few pixels or less),
// it's floored to a minimum visible size and honestly labeled "enlarged to
// be visible" rather than either vanishing or silently lying about its true
// proportion — same disclosure instinct src/landmark/landmarkData.js
// applies to its own sphere/screen split.

const LY_KM = 9.4607e12;
const MAX_CIRCLE_PX = 170;
const MIN_CIRCLE_PX = 10;

function formatKm(km) {
  if (km >= LY_KM * 0.1) {
    const ly = km / LY_KM;
    if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million ly`;
    if (ly >= 1e3) return `${(ly / 1e3).toFixed(ly >= 1e4 ? 0 : 1)}k ly`;
    return `${ly.toFixed(ly >= 100 ? 0 : 1)} ly`;
  }
  if (km >= 1e6) return `${(km / 1e6).toFixed(km >= 1e7 ? 0 : 1)} million km`;
  if (km >= 1) return `${Math.round(km).toLocaleString()} km`;
  return `${Math.round(km * 1000)} m`;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Lightens (positive pct) or darkens (negative pct) a "#rrggbb" color —
// used to give each circle a lit-sphere gradient (bright highlight, dark
// limb) from the single real-world tint sizeData.js stores per body.
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = clampByte(((n >> 16) & 0xff) + 255 * (pct / 100));
  const g = clampByte(((n >> 8) & 0xff) + 255 * (pct / 100));
  const b = clampByte((n & 0xff) + 255 * (pct / 100));
  return `rgb(${r},${g},${b})`;
}

// A real photo when sizeData.js has one (verified against the live
// Wikimedia Commons API, same discipline landmark/landmarkData.js's own
// header documents — never hand-constructed) — border-radius on the
// element itself (see the CSS) clips it into a circle, so it reads as an
// actual small globe photo, not an illustration. `background-color` is a
// same-tint placeholder underneath so a still-loading or failed fetch never
// leaves a blank white circle. Only the couple of bodies with genuinely no
// real photo available (no telescope has imaged Andromeda's or Centaurus
// A's black hole; nothing photographs an entire 1,300-galaxy cluster) fall
// back to a procedural gradient shaped for what they actually look like —
// dark and ringed for a black hole, a soft fading glow for a galaxy — the
// same honest-shape instinct cosmos/galaxyFactory.js and
// cosmos/blackHole.js already apply to their own 3D visuals.
function circleStyle(e) {
  const color = e.color || "#9aa4b8";
  const glow =
    e.category === "Star" ? "box-shadow: 0 0 24px rgba(255,180,90,0.55);" :
    e.category === "Black Hole" ? "box-shadow: 0 0 18px rgba(255,140,58,0.45);" : "";

  if (e.imageUrl) {
    return `background-image:url('${e.imageUrl}'); background-size:cover; background-position:center; background-color:${color}; ${glow}`;
  }
  if (e.category === "Black Hole") {
    return `background: radial-gradient(circle at 50% 50%, #000 0%, #060606 55%, ${color} 72%, #000 88%, #000 100%); ${glow}`;
  }
  if (e.category === "Galaxy" || e.category === "Galaxy Cluster") {
    return `background: radial-gradient(circle at 45% 42%, #fff 0%, ${color} 32%, ${color}88 58%, ${color}00 100%); filter: blur(0.6px);`;
  }
  if (e.category === "Star") {
    return `background: radial-gradient(circle at 35% 30%, #fffef2 0%, ${color} 42%, #ff8c3a 100%); ${glow}`;
  }
  return `background: radial-gradient(circle at 32% 28%, ${shade(color, 32)} 0%, ${color} 55%, ${shade(color, -28)} 100%);`;
}

const modal = document.getElementById("sizeCompareModal");
const openBtn = document.getElementById("sizeCompareBtn");
const closeBtn = document.getElementById("sizeCompareClose");
const backdrop = document.getElementById("sizeCompareBackdrop");
const searchInput = document.getElementById("sizeCompareSearch");
const listEl = document.getElementById("sizeCompareList");
const selectedEl = document.getElementById("sizeCompareSelected");
const barEl = document.getElementById("sizeCompareBar");

const selected = new Set(); // entity names

function entityByName(name) {
  return SIZE_ENTITIES.find((e) => e.name === name);
}

function renderList() {
  const results = searchSizeEntities(searchInput.value);
  listEl.innerHTML = results
    .map(
      (e) => `<div class="size-row${selected.has(e.name) ? " selected" : ""}" data-name="${e.name}">
        <span class="size-row-name">${e.name}</span>
        <span class="size-row-meta">${e.category}${e.note ? ` · ${e.note}` : ""} · ${formatKm(e.diameterKm)}</span>
      </div>`
    )
    .join("");
  listEl.querySelectorAll(".size-row").forEach((row) => {
    row.addEventListener("click", () => toggle(row.dataset.name));
  });
}

function renderSelected() {
  selectedEl.innerHTML = [...selected]
    .map((name) => `<span class="size-chip" data-name="${name}">${name}<button type="button">&times;</button></span>`)
    .join("");
  selectedEl.querySelectorAll(".size-chip button").forEach((btn) => {
    btn.addEventListener("click", () => toggle(btn.closest(".size-chip").dataset.name));
  });
}

function renderComparison() {
  if (selected.size < 2) {
    barEl.innerHTML = `<div class="size-bar-empty">Pick 2 or more to compare — try Earth, the Moon, and Jupiter.</div>`;
    return;
  }

  const entities = [...selected].map(entityByName).sort((a, b) => a.diameterKm - b.diameterKm);
  const maxD = entities[entities.length - 1].diameterKm;

  const colsHtml = entities
    .map((e) => {
      const trueSizePx = (e.diameterKm / maxD) * MAX_CIRCLE_PX;
      const sizePx = Math.max(MIN_CIRCLE_PX, trueSizePx);
      const clamped = trueSizePx < MIN_CIRCLE_PX;
      return `<div class="size-body-col">
        <div class="size-body-circle" style="width:${sizePx}px;height:${sizePx}px;${circleStyle(e)}"></div>
        <div class="size-body-label">${e.name}<span class="size-body-value">${formatKm(e.diameterKm)}${clamped ? " · enlarged to be visible" : ""}</span>${e.credit ? `<span class="size-body-credit">${e.credit}</span>` : ""}</div>
      </div>`;
    })
    .join("");

  barEl.innerHTML = `<div class="size-body-row">${colsHtml}</div>`;
}

function toggle(name) {
  if (selected.has(name)) selected.delete(name);
  else selected.add(name);
  renderList();
  renderSelected();
  renderComparison();
}

export function initSizeComparePanel() {
  openBtn?.addEventListener("click", () => {
    searchInput.value = "";
    renderList();
    renderSelected();
    renderComparison();
    modal?.classList.add("visible");
  });
  closeBtn?.addEventListener("click", () => modal?.classList.remove("visible"));
  backdrop?.addEventListener("click", () => modal?.classList.remove("visible"));
  searchInput?.addEventListener("input", renderList);
}
