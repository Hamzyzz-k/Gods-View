import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { getTierLadder } from "../cosmos/tierNavigation.js";

// ---------- VR scale panel ----------
// The desktop breadcrumb bar's VR counterpart. Unlike the breadcrumb (which
// shows every tier as a clickable segment), VR canvas real estate is small
// and the ladder is expected to grow across later phases, so this mirrors
// vrTourPanel.js's shape instead: a label row showing the current tier,
// plus a small button row — here just zoom-in/zoom-out (descend/ascend),
// driving the same #tierDescendBtn/#tierAscendBtn DOM buttons the desktop
// breadcrumb uses (registerPanel()'s `.click()` dispatch, one source of
// truth). Positioned above the VR control panel — vrTourPanel.js already
// sits below it — same rig-parented "console in front of the player"
// placement every VR panel in this app uses.

const FORWARD_Z = -2.6; // matches vrControlPanel.js/vrTourPanel.js — same comfortable viewing distance
const HEIGHT_ABOVE_CONTROL_PANEL = 1.3;

const BUTTONS = [
  { domId: "tierDescendBtn", icon: "−" },
  { domId: "tierAscendBtn", icon: "+" },
];

const PADDING = 20;
const GAP = 14;
const CELL = 110;
const LABEL_H = 60;

const CANVAS_W = PADDING * 2 + CELL * BUTTONS.length + GAP * (BUTTONS.length - 1);
const CANVAS_H = PADDING * 2 + CELL + LABEL_H;

export const scalePanel = new VRPanel({
  worldWidth: 0.8,
  worldHeight: 0.8 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
scalePanel.mesh.name = "vrScalePanel";
scalePanel.mesh.position.set(0, HEIGHT_ABOVE_CONTROL_PANEL, FORWARD_Z); // Y corrected every frame in updateVrScalePanel() once real eye height is known

export const buttonHitRects = [];

function drawButton(ctx, x, y, size, btn, disabled) {
  roundRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = COLORS.pillBg;
  ctx.globalAlpha = disabled ? 0.35 : 1;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "58px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(btn.icon, x + size / 2, y + size / 2 + 4);
  ctx.globalAlpha = 1;
}

export function redrawScalePanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = scalePanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const ladder = getTierLadder();
  const idx = ladder.findIndex((t) => t.id === AppState.tier);
  const tier = ladder[idx];

  ctx.font = "34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(tier?.label || "", W / 2, PADDING + LABEL_H / 2);

  buttonHitRects.length = 0;
  BUTTONS.forEach((btn, i) => {
    const x = PADDING + i * (CELL + GAP);
    const y = PADDING + LABEL_H;
    const disabled = btn.domId === "tierDescendBtn" ? idx <= 0 : idx === -1 || idx + 1 >= ladder.length;
    drawButton(ctx, x, y, CELL, btn, disabled);
    // Still registered as a hit rect even when disabled: onSelectStart's
    // dispatch is a real DOM .click() on the (correctly disabled) button
    // element, and browsers no-op a click on a disabled button — same
    // "let the DOM be the single source of truth for whether this does
    // anything" reasoning the rest of this app's VR panels already rely on.
    buttonHitRects.push({ domId: btn.domId, x, y, w: CELL, h: CELL });
  });

  scalePanel.markDirty();
}

export function initVrScalePanel() {
  AppState.rig.add(scalePanel.mesh);
  redrawScalePanel();

  registerPanel({
    mesh: scalePanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => scalePanel.uvToCanvasPx(uv),
    afterClick: redrawScalePanel,
  });
}

// Called once per frame; visible whenever a session is active and outside
// Surface Mode (tier navigation has no meaning while walking on a planet,
// same rule the desktop breadcrumb applies). Redraws every frame while
// visible rather than only on click — the tier can also change via the
// desktop breadcrumb or a voice command while a session is running, neither
// of which fires this panel's own afterClick, same reasoning
// vrTourPanel.js already documents for the same situation.
export function updateVrScalePanel() {
  const visible = AppState.xrSession && AppState.mode === "orbital";
  scalePanel.mesh.visible = visible;
  if (!visible) return;

  redrawScalePanel();
  scalePanel.mesh.position.y = AppState.camera.position.y + HEIGHT_ABOVE_CONTROL_PANEL;
}
