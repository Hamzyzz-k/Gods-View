import { AppState } from "../core/state.js";
import { sceneRegistry } from "../assistant/sceneRegistry.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { registerPanel } from "./controllerRaycast.js";
import { isVrSizeCompareOpen } from "./vrSizeComparePanel.js";
import { isVrLandmarkPanelOpen } from "./vrLandmarkPanel.js";
import { getMoveSpeedLabel, isMoveSpeedDefault } from "../core/moveSpeed.js";

// ---------- VR control panel ----------
// The desktop pause/orbit-lines/moons/constellations/mute controls, mirrored
// into VR so they're reachable without leaving the headset. Rather than
// re-implementing what each button does, this panel drives the SAME DOM
// buttons desktop uses (button.click()) and reads them back for its own
// state (button.textContent, button.classList) — so there is exactly one
// place any of this logic lives, and the two surfaces can't drift apart.
//
// Placement: parented to the RIG, not the camera. A camera-parented HUD
// tracks head tilt too, which for a panel you're meant to deliberately look
// toward and point at is more "swimming in your face" than useful — a known
// VR comfort complaint. Parented to the rig instead, it behaves like a
// console mounted in front of the player: it comes along as they fly and
// turns when they turn (rig yaw), but doesn't jitter with small head
// movements. THREE.PlaneGeometry's front face points toward +Z by default;
// placed at local -Z from the rig with no rotation, that face already looks
// back toward the player, so no extra rotation is needed.
//
// Y is NOT a fixed guess. An earlier version hardcoded 1.6m as "average eye
// height" — which put it AT eye level, dead center of the forward view,
// blocking the scene rather than sitting above it as intended. The actual
// eye height is whatever the real headset reports (unknown until a real
// session runs), so this instead tracks the camera's live local Y each frame
// and adds a fixed offset above it — correct regardless of the player's
// actual height, and reliably out of the primary view instead of in it.
const FORWARD_Z = -2.6; // slightly further than before, so the smaller panel is still comfortably readable
const HEIGHT_ABOVE_EYES = 0.55; // look-up angle at FORWARD_Z: atan(0.55/2.6) ≈ 12°, a glance, not a stretch

// Icon-only, no text label. The original design drew an icon plus a label
// next to it sized off the button's HEIGHT — fine for a short, wide pill,
// but this row of 7 buttons actually came out much TALLER than each one is
// WIDE, so the label position (computed from height) landed far outside the
// button's own width and overlapped its neighbor. Rather than patch that
// math for a shape it was never designed for, buttons are square icons now:
// simpler, always fits, and state is still visible via the highlight color
// plus the icon itself (e.g. pause swaps to a play glyph).
// These two mirror the desktop buttons' textContent, which is a fixed "TTS"
// and "AMB" — the desktop versions show their state through CSS, which does
// not survive being copied into a canvas. So in VR the label never changed
// when you muted: only a subtle highlight colour did, on a button that was
// under 3° wide. Muting genuinely does stop narration mid-sentence (verified:
// speechSynthesis.speaking goes true -> false on the click), but with no
// visible change to the control it read as having done nothing.
//
// The label now states the state outright instead of relying on colour.
function isMuted(domId) {
  return !!document.getElementById(domId)?.classList.contains("muted");
}
const VOICE_BTN = { domId: "ttsToggleBtn", icon: () => (isMuted("ttsToggleBtn") ? "VOICE OFF" : "VOICE ON"), active: () => !isMuted("ttsToggleBtn") };
const AMBIENCE_BTN = { domId: "ambientToggleBtn", icon: () => (isMuted("ambientToggleBtn") ? "AMB OFF" : "AMB ON"), active: () => !isMuted("ambientToggleBtn") };

const BUTTONS_ORBITAL = [
  { domId: "pauseBtn", icon: () => (document.getElementById("pauseBtn")?.textContent === "Resume" ? "▶" : "⏸") },
  { domId: "orbitBtn", icon: "ORBIT", active: () => AppState.orbitLinesVisible },
  { domId: "moonsBtn", icon: "MOON", active: () => isBtnActive("moonsBtn") },
  { domId: "constellationBtn", icon: "STARS", active: () => isBtnActive("constellationBtn") },
  { domId: "issBtn", icon: "ISS" },
  { domId: "vrSizeToggleBtn", icon: "SIZE", active: () => isVrSizeCompareOpen() },
  // Added after auditing every desktop control against its VR counterpart.
  // These three had no way to be reached from inside a headset at all: a
  // player could operate the tour's prev/next/exit strip but never START a
  // tour, and Align Planets and the landmark picker were desktop-only.
  { domId: "alignBtn", icon: "ALIGN" },
  { domId: "startTourBtn", icon: "TOUR", active: () => AppState.tourState !== "idle" },
  { domId: "vrLandmarkToggleBtn", icon: "PLACE", active: () => isVrLandmarkPanelOpen() },
  // Flight speed. The faster button carries the current multiplier as its
  // label so the panel shows the value without spending a third slot on a
  // read-only readout — at 8x you can see you're at 8x. Deliberately not the
  // "−"/"+" glyphs: the scale panel already uses exactly those for tier
  // zoom, and two different pairs of −/+ buttons floating in front of the
  // player would be genuinely ambiguous.
  { domId: "moveSpeedDownBtn", icon: "SLOW" },
  { domId: "moveSpeedUpBtn", icon: () => getMoveSpeedLabel(), active: () => !isMoveSpeedDefault() },
  VOICE_BTN,
  AMBIENCE_BTN,
];

// Surface Mode: none of the orbital-simulation buttons above mean anything
// while standing on a planet (there are no orbit lines, moons-as-a-group, or
// ISS to locate down there) — replaced with the one action that does,
// "leave", which drives the same #exitSurfaceBtn desktop's own Exit button
// uses (surface/desktopSurfaceUI.js). Mute toggles carry over since you'd
// still want them available while walking around.
const BUTTONS_SURFACE = [
  { domId: "exitSurfaceBtn", icon: "EXIT" },
  VOICE_BTN,
  AMBIENCE_BTN,
];

// Landmark Mode had NO button set at all, which meant entering a real place
// in VR was a one-way trip: the orbital set stayed on screen, none of it
// applied, and #exitLandmarkBtn — the only way out — existed solely in the
// desktop DOM. Same shape as Surface Mode's set, for the same reason.
const BUTTONS_LANDMARK = [
  { domId: "exitLandmarkBtn", icon: "EXIT" },
  VOICE_BTN,
  AMBIENCE_BTN,
];

function currentButtons() {
  if (AppState.mode === "surface") return BUTTONS_SURFACE;
  if (AppState.mode === "landmark") return BUTTONS_LANDMARK;
  return BUTTONS_ORBITAL;
}

// The desktop toggle buttons don't carry an explicit "on/off" CSS class today
// (moonsBtn/constellationBtn just fire and let their exported *Visible flag
// track state), so active-state here is read straight from sceneRegistry —
// still one source of truth, just a different one per button.
function isBtnActive(domId) {
  if (domId === "moonsBtn") return sceneRegistry.moons.isVisible();
  if (domId === "constellationBtn") return sceneRegistry.constellations.isVisible();
  return true;
}

const PADDING = 20;
const GAP = 14;
const CELL = 130; // square button, canvas px

// Laid out as a GRID rather than one long row. The panel's world width is
// fixed at a comfortable ~24° of horizontal view (see worldWidth below), so
// every button added to a single row made all of them narrower: at eight
// buttons each one measured 2.67° across — eight near-identical dark squares
// in a strip the width of two fingers held at arm's length. That is what
// "the Size Compare button isn't visible in VR" actually was. It was drawn,
// wired, and functional; it was just too small to find or reliably hit with
// a laser held in an unsupported hand.
//
// Wrapping to a second row keeps the tuned 24° width while roughly doubling
// each button's angular size, and leaves headroom for the controls the
// desktop-vs-VR audit found missing without shrinking anything again.
const MAX_PER_ROW = 6;

// Rows are balanced rather than filled greedily: 13 buttons become 5/5/3,
// not 6/6/1. A single stranded button under two full rows reads as a mistake,
// and the even split also makes each button wider (fewer columns), which is
// the whole point of wrapping in the first place.
function gridShape(count) {
  const rows = Math.ceil(count / MAX_PER_ROW);
  return { rows, cols: Math.ceil(count / rows) };
}

// Sized for the LARGEST button set so the panel's physical size — and
// therefore its position and angular size in view — never changes when
// switching modes; the shorter Surface/Landmark sets are centred within that
// same fixed size instead (see redrawControlPanel()).
const MAX_SHAPE = gridShape(BUTTONS_ORBITAL.length);
const CANVAS_W = PADDING * 2 + CELL * MAX_SHAPE.cols + GAP * (MAX_SHAPE.cols - 1);
const CANVAS_H = PADDING * 2 + CELL * MAX_SHAPE.rows + GAP * (MAX_SHAPE.rows - 1);
export const controlPanel = new VRPanel({
  worldWidth: 1.1,
  worldHeight: 1.1 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
controlPanel.mesh.name = "vrControlPanel";
controlPanel.mesh.position.set(0, HEIGHT_ABOVE_EYES, FORWARD_Z); // Y corrected every frame in updateVrControlPanel() once real eye height is known

// Populated by redraw(), consumed by controllerRaycast.js for hit-testing —
// canvas-pixel rectangles, one per button, in the same order as BUTTONS.
export const buttonHitRects = [];

function drawButton(ctx, x, y, size, btn) {
  const isActive = btn.active ? btn.active() : false;
  // Read straight off the mirrored DOM button, so any control that disables
  // itself at a limit (flight speed at its slowest/fastest step) looks
  // unavailable here too. The click dispatch already no-ops on a disabled
  // button — this just stops the panel claiming otherwise.
  const isDisabled = !!document.getElementById(btn.domId)?.disabled;
  ctx.globalAlpha = isDisabled ? 0.35 : 1;
  roundRect(ctx, x, y, size, size, 18);
  ctx.fillStyle = isActive ? COLORS.pillBgActive : COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = isActive ? COLORS.blue : COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const icon = typeof btn.icon === "function" ? btn.icon() : btn.icon;
  // Plain-text labels (no emoji) need a smaller font than a single glyph to
  // stay inside the square button — scaled down by label length rather than
  // a fixed size chosen for one-character icons.
  ctx.font =
    icon.length <= 1 ? "58px sans-serif"
    : icon.length <= 3 ? "34px sans-serif"
    : icon.length <= 5 ? "26px sans-serif"
    : "21px sans-serif"; // the state-bearing labels ("VOICE OFF") need the extra step down
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isActive ? COLORS.blue : COLORS.text;
  ctx.fillText(icon, x + size / 2, y + size / 2 + 2, size - 16);
  ctx.globalAlpha = 1; // restore, or the next button inherits the dimming
}

export function redrawControlPanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = controlPanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const buttons = currentButtons();
  const { rows, cols } = gridShape(buttons.length);
  // Each row is centred independently within the fixed canvas, so a partly
  // filled last row sits under the middle of the one above rather than flush
  // left with empty space stranded beside it. The whole block is centred
  // vertically too, so the shorter Surface/Landmark sets don't hug the top of
  // a panel sized for the taller orbital grid.
  const gridH = rows * CELL + (rows - 1) * GAP;
  const startY = (H - gridH) / 2;

  buttonHitRects.length = 0;
  buttons.forEach((btn, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inThisRow = Math.min(cols, buttons.length - row * cols);
    const rowWidth = inThisRow * CELL + (inThisRow - 1) * GAP;
    const x = (W - rowWidth) / 2 + col * (CELL + GAP);
    const y = startY + row * (CELL + GAP);
    drawButton(ctx, x, y, CELL, btn);
    buttonHitRects.push({ domId: btn.domId, x, y, w: CELL, h: CELL });
  });

  controlPanel.markDirty();
}

// Re-draws whenever any underlying control's DOM state changes, so the panel
// never shows stale text (e.g. "Pause" after the sim is already paused). This
// catches pauseBtn's text and the tts/ambient buttons' "muted" class, since
// those are real DOM mutations. It does NOT catch orbitBtn/moonsBtn/
// constellationBtn: their click handlers only flip AppState/sceneRegistry
// flags without writing anything back to their own button element, so there
// is no mutation here to observe. controllerRaycast.js covers that gap by
// calling redrawControlPanel() itself immediately after simulating a click
// on this panel, rather than waiting on a mutation that will never come.
export function initVrControlPanel() {
  AppState.rig.add(controlPanel.mesh); // rig-parented — see the placement comment above
  redrawControlPanel();
  const watchTargets = [document.getElementById("ui"), document.getElementById("ttsToggleBtn"), document.getElementById("ambientToggleBtn")].filter(Boolean);
  const observer = new MutationObserver(redrawControlPanel);
  watchTargets.forEach((el) => observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] }));

  registerPanel({
    mesh: controlPanel.mesh,
    getHitRects: () => buttonHitRects,
    uvToCanvasPx: (uv) => controlPanel.uvToCanvasPx(uv),
    afterClick: redrawControlPanel,
  });
}

let lastPanelMode = null;

// Called once per frame; the panel only needs to exist while a session is
// active, so it's kept invisible otherwise rather than removed/recreated.
export function updateVrControlPanel() {
  controlPanel.mesh.visible = AppState.xrSession;
  if (!AppState.xrSession) return;

  // Redraw exactly once when entering/leaving Surface Mode, not every frame
  // — orbitBtn/moonsBtn-style clicks already get their own redraw via
  // afterClick above, this only needs to catch the mode itself changing.
  if (AppState.mode !== lastPanelMode) {
    lastPanelMode = AppState.mode;
    redrawControlPanel();
  }

  // camera.position is local to the rig (see core/sceneSetup.js), and once a
  // session starts it's driven by the real headset pose — so this is the
  // actual current eye height, not a guess, updated every frame in case the
  // player crouches/stands or a different headset connects mid-session.
  controlPanel.mesh.position.y = AppState.camera.position.y + HEIGHT_ABOVE_EYES;
}
