import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { getItinerary } from "../tour/tourMode.js";

// ---------- VR tour panel ----------
// The desktop tour bar's VR counterpart. Visible only while a tour is
// actually running — per the earlier decision "new panel, only while
// touring" — rather than folded into vrControlPanel.js's always-present
// button row, so it doesn't compete for space with the orbital/surface
// controls that need to stay reachable regardless of tour state.
//
// Drives the same #tourPrevBtn/#tourPlayPauseBtn/#tourNextBtn/#tourExitBtn
// DOM buttons the desktop tour bar uses (button.click()), same
// one-source-of-truth pattern as vrControlPanel.js/vrInfoPanel.js.

const FORWARD_Z = -2.6; // matches vrControlPanel.js — same comfortable viewing distance
const HEIGHT_BELOW_CONTROL_PANEL = 0.85; // sits under the control panel rather than overlapping it

const BUTTONS = [
  { domId: "tourPrevBtn", icon: "⏮" },
  { domId: "tourPlayPauseBtn", icon: () => (document.getElementById("tourPlayPauseBtn")?.textContent === "▶" ? "▶" : "⏸") },
  { domId: "tourNextBtn", icon: "⏭" },
  { domId: "tourExitBtn", icon: "🚪" },
];

const PADDING = 20;
const GAP = 14;
const CELL = 110;
const LABEL_H = 60;

const CANVAS_W = PADDING * 2 + CELL * BUTTONS.length + GAP * (BUTTONS.length - 1);
const CANVAS_H = PADDING * 2 + CELL + LABEL_H;

export const tourPanel = new VRPanel({
  worldWidth: 0.95,
  worldHeight: 0.95 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
tourPanel.mesh.name = "vrTourPanel";
tourPanel.mesh.position.set(0, -HEIGHT_BELOW_CONTROL_PANEL, FORWARD_Z); // Y corrected every frame, same reasoning as vrControlPanel.js

export const buttonHitRects = [];

function drawButton(ctx, x, y, size, btn) {
  roundRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const icon = typeof btn.icon === "function" ? btn.icon() : btn.icon;
  ctx.font = "50px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(icon, x + size / 2, y + size / 2 + 4);
}

export function redrawTourPanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = tourPanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const itinerary = getItinerary();
  const name = itinerary[AppState.tourIndex] || "";
  const label = name ? `${AppState.tourIndex + 1}/${itinerary.length} · ${name}` : "";
  ctx.font = "34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(label, W / 2, PADDING + LABEL_H / 2);

  buttonHitRects.length = 0;
  BUTTONS.forEach((btn, i) => {
    const x = PADDING + i * (CELL + GAP);
    const y = PADDING + LABEL_H;
    drawButton(ctx, x, y, CELL, btn);
    buttonHitRects.push({ domId: btn.domId, x, y, w: CELL, h: CELL });
  });

  tourPanel.markDirty();
}

export function initVrTourPanel() {
  AppState.rig.add(tourPanel.mesh);
  redrawTourPanel();

  registerPanel({
    mesh: tourPanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => tourPanel.uvToCanvasPx(uv),
    afterClick: redrawTourPanel,
  });
}

// Called once per frame; only relevant during an active XR session and an
// active tour (both must hold), otherwise stays hidden like every other
// in-world panel here. Redraws every frame while visible rather than only
// on click/mutation: the tour can also advance via dwell timeout or the
// desktop bar while a session is running, neither of which fires
// afterClick — a small canvas redraw every frame is cheap enough (same cost
// class as vrControlPanel.js) that tracking those triggers individually
// isn't worth the complexity.
export function updateVrTourPanel() {
  const visible = AppState.xrSession && AppState.tourState !== "idle";
  tourPanel.mesh.visible = visible;
  if (!visible) return;

  redrawTourPanel();
  // Tracks the same live eye height vrControlPanel.js uses, offset further
  // down so the two panels never overlap regardless of headset height.
  tourPanel.mesh.position.y = AppState.camera.position.y - HEIGHT_BELOW_CONTROL_PANEL + 0.55; // +0.55 matches vrControlPanel.js's HEIGHT_ABOVE_EYES so both track the same eye-line, tour panel just sits lower
}
