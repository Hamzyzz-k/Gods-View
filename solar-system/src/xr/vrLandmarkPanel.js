import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { getLandmarkList, enterLandmark } from "../landmark/landmarkMode.js";

// ---------- VR landmark picker ----------
// "Visit a Real Place" existed only on desktop. The button (#landmarksBtn)
// opens an HTML modal listing the seven wonders — and regular DOM does not
// render inside a WebXR session at all, so there was no path to any landmark
// from inside a headset. Not a visibility bug: the feature simply had no VR
// surface.
//
// This is that surface. Same source of truth as desktop — landmarkMode.js's
// getLandmarkList()/enterLandmark() — drawn as a canvas-textured panel like
// every other in-world UI here. It differs from the sibling panels in one
// way worth noting: they mirror DOM buttons via .click(), but the desktop
// list is BUILT from LANDMARK_DATA at open time rather than being a fixed set
// of elements, so there are no per-landmark DOM buttons to mirror. Calling
// enterLandmark() directly is therefore still the single source of truth,
// just reached one step earlier in the same chain the desktop click ends in.

const FORWARD_Z = -2.4; // slightly nearer than the control panel: this is a
// read-and-choose list, not a glanceable strip, so it wants to be legible
const HEIGHT_BELOW_EYES = 0.1; // near eye level — you look AT this one

const ROW_H = 86;
const PADDING = 24;
const TITLE_H = 96;
const CANVAS_W = 900;

const landmarks = getLandmarkList();
const CANVAS_H = PADDING * 2 + TITLE_H + landmarks.length * ROW_H;

export const landmarkPanel = new VRPanel({
  worldWidth: 1.25,
  worldHeight: 1.25 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
landmarkPanel.mesh.name = "vrLandmarkPanel";
landmarkPanel.mesh.position.set(0, -HEIGHT_BELOW_EYES, FORWARD_Z);

export const buttonHitRects = [];

// Open/closed is panel-local state rather than something on AppState: no
// other system needs to branch on it, and the control panel reads it through
// isVrLandmarkPanelOpen() below for its button highlight.
let open = false;

export function isVrLandmarkPanelOpen() {
  return open;
}

export function setVrLandmarkPanelOpen(next) {
  open = next;
  if (open) redrawLandmarkPanel();
}

export function toggleVrLandmarkPanel() {
  setVrLandmarkPanelOpen(!open);
}

export function redrawLandmarkPanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = landmarkPanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText("Visit a Real Place", W / 2, PADDING + 26);

  ctx.font = "20px sans-serif";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText("Real photography, on Earth's surface", W / 2, PADDING + 62);

  buttonHitRects.length = 0;

  landmarks.forEach((lm, i) => {
    const x = PADDING;
    const y = PADDING + TITLE_H + i * ROW_H;
    const w = W - PADDING * 2;
    const h = ROW_H - 10;

    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = COLORS.pillBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.pillBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "26px sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(lm.name, x + 22, y + h / 2 - 10, w - 240);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(lm.location, x + 22, y + h / 2 + 18, w - 240);

    // "360°" vs "View": the data's own honest distinction between a real
    // photosphere you stand inside and a wide panorama shown on a screen
    // (landmarkData.js's `mode`). Surfacing it here rather than letting both
    // read as the same thing keeps that honesty in front of the player.
    ctx.textAlign = "right";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = COLORS.blue;
    ctx.fillText(lm.mode === "sphere" ? "360°" : "View", x + w - 22, y + h / 2 + 2);

    // No domId: these rows have no desktop button to mirror (see the file
    // header). controllerRaycast.js calls onSelect() when a rect carries one.
    buttonHitRects.push({ x, y, w, h, onSelect: () => selectLandmark(lm.name) });
  });

  landmarkPanel.markDirty();
}

function selectLandmark(name) {
  // Close first: entering a landmark swaps the whole scene, and a picker
  // still hanging in front of the player afterward would sit between them and
  // the place they just asked to visit.
  open = false;
  enterLandmark(name);
}

export function initVrLandmarkPanel() {
  AppState.rig.add(landmarkPanel.mesh);
  redrawLandmarkPanel();

  registerPanel({
    mesh: landmarkPanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => landmarkPanel.uvToCanvasPx(uv),
    afterClick: redrawLandmarkPanel,
  });

  // The control panel drives this through a hidden DOM button, exactly like
  // every other VR control, so the panel keeps its single "click the DOM
  // button" dispatch path rather than growing a special case.
  document.getElementById("vrLandmarkToggleBtn")?.addEventListener("click", toggleVrLandmarkPanel);
}

// Called once per frame from core/loop.js. Only meaningful in orbital mode:
// once a landmark has actually been entered, the picker's job is done and
// the way back out is the control panel's EXIT button.
export function updateVrLandmarkPanel() {
  const visible = AppState.xrSession && open && AppState.mode === "orbital";
  landmarkPanel.mesh.visible = visible;
  if (!visible) {
    // Entering a landmark (or leaving orbital any other way) closes the
    // picker for real, so re-entering orbital doesn't pop it back open.
    if (open && AppState.mode !== "orbital") open = false;
    return;
  }
  landmarkPanel.mesh.position.y = AppState.camera.position.y - HEIGHT_BELOW_EYES;
}
