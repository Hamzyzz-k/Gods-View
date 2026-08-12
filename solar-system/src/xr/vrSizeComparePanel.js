import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { SIZE_ENTITIES } from "../data/sizeData.js";

// ---------- VR size comparison panel ----------
// The desktop size comparison panel (ui/sizeComparePanel.js) is a free-text
// search over 40+ bodies with a scrollable result list — there's no
// keyboard in a headset to drive that with, so this is NOT a mirror of that
// DOM panel the way vrControlPanel.js/vrTourPanel.js mirror theirs (there is
// no shared DOM element to route a controller click through). Instead: a
// small set of curated preset comparisons, cycled with Prev/Next, drawn as
// actual proportionally-sized circles bottom-aligned in a row — same visual
// idea as the desktop panel's own circles (ui/sizeComparePanel.js), same
// underlying data (data/sizeData.js), just a fixed set of interesting
// comparisons instead of an open search.
//
// Toggled by its own icon button on the main VR control panel
// (xr/vrControlPanel.js's "SIZE" button) rather than opening automatically,
// same "off by default, one press to bring up" treatment the tour and scale
// panels get.

const FORWARD_Z = -2.6;
const HEIGHT_BELOW_EYES = 0.35; // sits a little low, since it's wide rather than tall — see it by glancing slightly down

const LY_KM = 9.4607e12;
const MAX_CIRCLE_PX = 150;
const MIN_CIRCLE_PX = 10;

function byName(name) {
  return SIZE_ENTITIES.find((e) => e.name === name);
}

function formatKm(km) {
  if (km >= LY_KM * 0.1) {
    const ly = km / LY_KM;
    if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)}M ly`;
    if (ly >= 1e3) return `${(ly / 1e3).toFixed(ly >= 1e4 ? 0 : 1)}k ly`;
    return `${ly.toFixed(ly >= 100 ? 0 : 1)} ly`;
  }
  if (km >= 1e6) return `${(km / 1e6).toFixed(km >= 1e7 ? 0 : 1)}M km`;
  if (km >= 1) return `${Math.round(km).toLocaleString()} km`;
  return `${Math.round(km * 1000)} m`;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function shadeRgb(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = clampByte(((n >> 16) & 0xff) + 255 * (pct / 100));
  const g = clampByte(((n >> 8) & 0xff) + 255 * (pct / 100));
  const b = clampByte((n & 0xff) + 255 * (pct / 100));
  return `rgb(${r},${g},${b})`;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
}

// Real photos (data/sizeData.js's imageUrl, same verified-against-Commons
// URLs the desktop panel uses) load as plain Image objects rather than
// THREE.Textures — this is a 2D canvas, not a WebGL material — and get
// cached by URL so cycling back to a preset already seen doesn't re-fetch.
// A body drawn before its image finishes loading falls back to the
// gradient placeholder below and gets a real redraw once onload fires, the
// same "procedural now, real photo the moment it's ready" pattern
// textures/realTextures.js already established for the 3D scene.
const imageCache = new Map();
function getCachedImage(url) {
  let entry = imageCache.get(url);
  if (!entry) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    entry = { img, loaded: false };
    img.onload = () => {
      entry.loaded = true;
      redrawSizePanel();
    };
    img.src = url;
    imageCache.set(url, entry);
  }
  return entry;
}

// Real photo when available (clipped to a circle via ctx.clip(), scaled
// cover-fit so it fills the circle without distortion), otherwise the same
// three procedural treatments the desktop panel's circleStyle() uses —
// solid lit sphere for planets/moons, dark ringed horizon for a black hole,
// soft fading glow for a galaxy.
function drawBody(ctx, x, bottomY, sizePx, e) {
  const r = sizePx / 2;
  const cy = bottomY - r;
  const color = e.color || "#9aa4b8";

  if (e.imageUrl) {
    const entry = getCachedImage(e.imageUrl);
    if (entry.loaded) {
      if (e.category === "Star" || e.category === "Black Hole") {
        ctx.save();
        ctx.shadowColor = e.category === "Star" ? "rgba(255,180,90,0.6)" : "rgba(255,140,58,0.5)";
        ctx.shadowBlur = 22;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const iw = entry.img.naturalWidth || 1;
      const ih = entry.img.naturalHeight || 1;
      const scale = Math.max((r * 2) / iw, (r * 2) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(entry.img, x - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      return;
    }
    // Still loading — fall through to the gradient placeholder below.
  }

  if (e.category === "Black Hole") {
    const grd = ctx.createRadialGradient(x, cy, 0, x, cy, r);
    grd.addColorStop(0, "#000000");
    grd.addColorStop(0.55, "#060606");
    grd.addColorStop(0.72, color);
    grd.addColorStop(0.88, "#000000");
    grd.addColorStop(1, "#000000");
    ctx.fillStyle = grd;
  } else if (e.category === "Galaxy" || e.category === "Galaxy Cluster") {
    const grd = ctx.createRadialGradient(x - r * 0.15, cy - r * 0.2, 0, x, cy, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.32, color);
    grd.addColorStop(0.65, hexToRgba(color, 0.5));
    grd.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grd;
  } else if (e.category === "Star") {
    const grd = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.35, 0, x, cy, r);
    grd.addColorStop(0, "#fffef2");
    grd.addColorStop(0.42, color);
    grd.addColorStop(1, "#ff8c3a");
    ctx.fillStyle = grd;
    ctx.shadowColor = "rgba(255,180,90,0.6)";
    ctx.shadowBlur = 24;
  } else {
    const grd = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.35, 0, x, cy, r);
    grd.addColorStop(0, shadeRgb(color, 32));
    grd.addColorStop(0.55, color);
    grd.addColorStop(1, shadeRgb(color, -28));
    ctx.fillStyle = grd;
  }

  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// Each preset picked to make a specific, real point — the same reasoning
// data/sizeData.js's own header gives for including black holes on this
// scale at all: a hole with a colossal MASS still has a tiny physical size
// next to the star system or galaxy it sits inside.
const PRESETS = [
  { title: "Earth, the Moon, and Jupiter", names: ["Moon", "Earth", "Jupiter"] },
  { title: "The Sun and the rocky planets", names: ["Mercury", "Venus", "Earth", "Mars", "Sun"] },
  { title: "The ISS next to a whole planet", names: ["ISS", "Earth"] },
  { title: "Sagittarius A* vs. the solar system it sits in", names: ["Sagittarius A*", "Sun", "Jupiter"] },
  { title: "M87* — a black hole bigger than the solar system", names: ["Sun", "Neptune", "M87*"] },
  { title: "The Milky Way vs. Andromeda", names: ["Milky Way", "Andromeda Galaxy"] },
];

let presetIndex = 0;

const CANVAS_W = 900;
const CANVAS_H = 420;
const NAV_CELL = 90;

export const sizePanel = new VRPanel({
  worldWidth: 1.5,
  worldHeight: 1.5 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
sizePanel.mesh.name = "vrSizeComparePanel";
sizePanel.mesh.position.set(0, -HEIGHT_BELOW_EYES, FORWARD_Z);

let panelOpen = false;
export const buttonHitRects = [];

function drawNavButton(ctx, x, y, size, label) {
  roundRect(ctx, x, y, size, size, 14);
  ctx.fillStyle = COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(label, x + size / 2, y + size / 2 + 2);
}

export function redrawSizePanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = sizePanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const preset = PRESETS[presetIndex];
  const entities = preset.names.map(byName).filter(Boolean).sort((a, b) => a.diameterKm - b.diameterKm);

  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(preset.title, W / 2, 46);

  // Scale is relative to the BIGGEST body in this preset, not the whole
  // dataset's range — same reasoning ui/sizeComparePanel.js's header gives:
  // a log-position axis is honest about huge ratios but doesn't look like a
  // size difference. A circle sized directly proportional to real diameter
  // does. The smallest body still gets floored to MIN_CIRCLE_PX so it never
  // fully disappears, honestly labeled when that floor kicks in.
  const maxD = entities[entities.length - 1].diameterKm;
  const rowBottomY = H - 24 - NAV_CELL - 55;
  const trackX0 = 70;
  const trackX1 = W - 70;
  const slot = (trackX1 - trackX0) / entities.length;

  entities.forEach((e, i) => {
    const x = trackX0 + slot * (i + 0.5);
    const trueSizePx = (e.diameterKm / maxD) * MAX_CIRCLE_PX;
    const sizePx = Math.max(MIN_CIRCLE_PX, trueSizePx);
    const clamped = trueSizePx < MIN_CIRCLE_PX;

    drawBody(ctx, x, rowBottomY, sizePx, e);

    ctx.font = "20px sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(e.name, x, rowBottomY + 26);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(formatKm(e.diameterKm) + (clamped ? " · enlarged" : ""), x, rowBottomY + 46);
  });

  buttonHitRects.length = 0;
  const prevX = PADDING(W);
  const nextX = W - PADDING(W) - NAV_CELL;
  const navY = H - PADDING(W) - NAV_CELL;
  drawNavButton(ctx, prevX, navY, NAV_CELL, "‹");
  drawNavButton(ctx, nextX, navY, NAV_CELL, "›");
  buttonHitRects.push({ domId: "vrSizePrevBtn", x: prevX, y: navY, w: NAV_CELL, h: NAV_CELL });
  buttonHitRects.push({ domId: "vrSizeNextBtn", x: nextX, y: navY, w: NAV_CELL, h: NAV_CELL });

  ctx.font = "16px sans-serif";
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = "center";
  ctx.fillText(`${presetIndex + 1} / ${PRESETS.length}`, W / 2, H - PADDING(W) - NAV_CELL / 2);

  sizePanel.markDirty();
}

function PADDING(W) {
  return 24;
}

export function toggleVrSizeCompare() {
  panelOpen = !panelOpen;
  if (panelOpen) redrawSizePanel();
}

export function isVrSizeCompareOpen() {
  return panelOpen;
}

// The three hidden DOM buttons index.html carries just for this panel (see
// the markup comment there) — real click listeners here, since nothing else
// in the app has any reason to care about them.
const toggleBtn = document.getElementById("vrSizeToggleBtn");
const prevBtn = document.getElementById("vrSizePrevBtn");
const nextBtn = document.getElementById("vrSizeNextBtn");
toggleBtn?.addEventListener("click", toggleVrSizeCompare);
prevBtn?.addEventListener("click", () => {
  presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length;
});
nextBtn?.addEventListener("click", () => {
  presetIndex = (presetIndex + 1) % PRESETS.length;
});

export function initVrSizeComparePanel() {
  AppState.rig.add(sizePanel.mesh);
  redrawSizePanel();

  registerPanel({
    mesh: sizePanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => sizePanel.uvToCanvasPx(uv),
    afterClick: redrawSizePanel, // Prev/Next only mutate presetIndex, a module-local variable with nothing DOM to observe — same reasoning vrControlPanel.js documents for orbitBtn/moonsBtn
  });
}

// Called once per frame from core/loop.js. Visible only in-session,
// out-of-Surface-Mode, and while explicitly toggled open — same visibility
// rule shape vrTourPanel.js already uses for its own "only sometimes
// relevant" panel.
export function updateVrSizeComparePanel() {
  const visible = AppState.xrSession && AppState.mode === "orbital" && panelOpen;
  sizePanel.mesh.visible = visible;
}
