import { AppState } from "../core/state.js";
import { sceneRegistry } from "../assistant/sceneRegistry.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";

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
const BUTTONS = [
  { domId: "pauseBtn", icon: () => (document.getElementById("pauseBtn")?.textContent === "Resume" ? "▶" : "⏸") },
  { domId: "orbitBtn", icon: "🛰", active: () => AppState.orbitLinesVisible },
  { domId: "moonsBtn", icon: "🌙", active: () => isBtnActive("moonsBtn") },
  { domId: "constellationBtn", icon: "✨", active: () => isBtnActive("constellationBtn") },
  { domId: "issBtn", icon: "📡" },
  { domId: "ttsToggleBtn", icon: () => document.getElementById("ttsToggleBtn")?.textContent || "🔊", active: () => !document.getElementById("ttsToggleBtn")?.classList.contains("muted") },
  { domId: "ambientToggleBtn", icon: () => document.getElementById("ambientToggleBtn")?.textContent || "🪐", active: () => !document.getElementById("ambientToggleBtn")?.classList.contains("muted") },
];

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

// Sized directly from the button geometry above (7 x 130px cells) rather
// than picked independently of it — canvasWidth/Height are computed from the
// actual content, so there's no way for the panel to end up too short (or
// too tall) for its own buttons again. worldWidth is modest on purpose: at
// FORWARD_Z this spans roughly 24° of horizontal view, a glanceable strip
// rather than the ~66°-wide bar the original 2.6-unit version worked out to
// — that was most of the headset's horizontal FOV, which is what "spoils
// the view" turned out to mean.
const CANVAS_W = PADDING * 2 + CELL * BUTTONS.length + GAP * (BUTTONS.length - 1);
const CANVAS_H = PADDING * 2 + CELL;
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
  roundRect(ctx, x, y, size, size, 18);
  ctx.fillStyle = isActive ? COLORS.pillBgActive : COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = isActive ? COLORS.blue : COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const icon = typeof btn.icon === "function" ? btn.icon() : btn.icon;
  ctx.font = "58px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isActive ? COLORS.blue : COLORS.text;
  ctx.fillText(icon, x + size / 2, y + size / 2 + 4); // +4: optical centering, most emoji glyphs sit slightly above their own baseline-middle
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

  buttonHitRects.length = 0;
  BUTTONS.forEach((btn, i) => {
    const x = PADDING + i * (CELL + GAP);
    const y = PADDING;
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
}

// Called once per frame; the panel only needs to exist while a session is
// active, so it's kept invisible otherwise rather than removed/recreated.
export function updateVrControlPanel() {
  controlPanel.mesh.visible = AppState.xrSession;
  if (!AppState.xrSession) return;
  // camera.position is local to the rig (see core/sceneSetup.js), and once a
  // session starts it's driven by the real headset pose — so this is the
  // actual current eye height, not a guess, updated every frame in case the
  // player crouches/stands or a different headset connects mid-session.
  controlPanel.mesh.position.y = AppState.camera.position.y + HEIGHT_ABOVE_EYES;
}
