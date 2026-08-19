import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { toggleSizeCompare, nextStep, prevStep, getCurrentStop, getStepInfo } from "../sizeCompare/sizeCompareMode.js";

// ---------- VR size-compare control strip ----------
// The actual comparison content is now real 3D scene geometry — the same
// full-scene takeover sizeCompare/sizeCompareMode.js uses on desktop, so in
// VR the player just looks around the real diorama in stereo depth rather
// than reading it off a flat canvas. This panel's job shrinks accordingly:
// a small floating Prev/Next/Exit strip plus the current stop's title and
// step count, driving the same sizeCompareMode.js functions the desktop
// chrome bar (#sizeCompareBar) calls. No preset-cycling/circle-drawing
// logic lives here anymore — that was the old flat-canvas panel's own
// content; sizeCompare/sizeCompareScene.js owns the real geometry now.

const FORWARD_Z = -2.6;
const HEIGHT_BELOW_EYES = 0.35; // sits a little low, since it's wide rather than tall — see it by glancing slightly down

const CANVAS_W = 640;
const CANVAS_H = 220;
const NAV_CELL = 80;
const PADDING = 20;

export const sizePanel = new VRPanel({
  worldWidth: 1.1,
  worldHeight: 1.1 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
sizePanel.mesh.name = "vrSizeComparePanel";
sizePanel.mesh.position.set(0, -HEIGHT_BELOW_EYES, FORWARD_Z);

export const buttonHitRects = [];

function drawNavButton(ctx, x, y, size, label, disabled) {
  roundRect(ctx, x, y, size, size, 14);
  ctx.fillStyle = COLORS.pillBg;
  ctx.globalAlpha = disabled ? 0.35 : 1;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(label, x + size / 2, y + size / 2 + 2);
  ctx.globalAlpha = 1;
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

  const stop = getCurrentStop();
  const { index, total } = getStepInfo();

  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(stop?.title || "", W / 2, 40);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`${index + 1} / ${total}`, W / 2, 68);

  buttonHitRects.length = 0;
  const navY = H - PADDING - NAV_CELL;
  const prevX = PADDING;
  const nextX = W - PADDING - NAV_CELL;
  const exitW = 140;
  const exitX = (W - exitW) / 2;

  drawNavButton(ctx, prevX, navY, NAV_CELL, "‹", index <= 0);
  drawNavButton(ctx, nextX, navY, NAV_CELL, "›", index >= total - 1);
  buttonHitRects.push({ domId: "vrSizePrevBtn", x: prevX, y: navY, w: NAV_CELL, h: NAV_CELL });
  buttonHitRects.push({ domId: "vrSizeNextBtn", x: nextX, y: navY, w: NAV_CELL, h: NAV_CELL });

  roundRect(ctx, exitX, navY, exitW, NAV_CELL, 14);
  ctx.fillStyle = COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "20px sans-serif";
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Exit", exitX + exitW / 2, navY + NAV_CELL / 2 + 2);
  buttonHitRects.push({ domId: "vrSizeToggleBtn", x: exitX, y: navY, w: exitW, h: NAV_CELL });

  sizePanel.markDirty();
}

export function isVrSizeCompareOpen() {
  return AppState.sizeCompareOpen;
}

// The three hidden DOM buttons index.html carries just for this panel (see
// the markup comment there) — real click listeners here, since nothing else
// in the app has any reason to care about them. vrSizeToggleBtn now doubles
// as the strip's own "Exit" hit-rect above (see redrawSizePanel()), so one
// button/one handler covers both entry points (the main VR control panel's
// "SIZE" icon, and this strip's own Exit button).
const toggleBtn = document.getElementById("vrSizeToggleBtn");
const prevBtn = document.getElementById("vrSizePrevBtn");
const nextBtn = document.getElementById("vrSizeNextBtn");
toggleBtn?.addEventListener("click", toggleSizeCompare);
prevBtn?.addEventListener("click", prevStep);
nextBtn?.addEventListener("click", nextStep);

export function initVrSizeComparePanel() {
  AppState.rig.add(sizePanel.mesh);
  redrawSizePanel();

  registerPanel({
    mesh: sizePanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => sizePanel.uvToCanvasPx(uv),
    afterClick: redrawSizePanel, // Prev/Next/Exit only mutate sizeCompareMode.js's own state, nothing DOM to observe — same reasoning vrControlPanel.js documents for orbitBtn/moonsBtn
  });
}

// Called once per frame from core/loop.js. Visible only in-session and
// while Size Compare is actually open — same visibility rule shape
// vrTourPanel.js already uses for its own "only sometimes relevant" panel.
// Redrawn every visible frame (not just on click) since the step can also
// advance via the desktop chrome bar while a session is running.
export function updateVrSizeComparePanel() {
  const visible = AppState.xrSession && AppState.sizeCompareOpen;
  sizePanel.mesh.visible = visible;
  if (!visible) return;

  redrawSizePanel();
  // Tracks the player's live eye height, same as every sibling panel. The
  // constructor's position.set() above only runs once at module load, when
  // camera.position.y is still the desktop default rather than anything the
  // headset has reported — so without this the strip sat at a fixed height
  // that was wrong for any player whose real eye level differed, and stayed
  // wrong if they stood up or sat down mid-session.
  sizePanel.mesh.position.y = AppState.camera.position.y - HEIGHT_BELOW_EYES;
}
