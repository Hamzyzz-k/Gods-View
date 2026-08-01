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
// movements, and sits in the upper part of the default forward view as
// requested. THREE.PlaneGeometry's front face points toward +Z by default;
// placed at local -Z from the rig with no rotation, that face already looks
// back toward the player, so no extra rotation is needed.
const LOCAL_POSITION = [0, 1.6, -2.0]; // 1.6m is a reasonable average standing eye height; forward 2m keeps it reachable by a laser without the player having to lunge

const BUTTONS = [
  { domId: "pauseBtn", label: () => document.getElementById("pauseBtn")?.textContent || "Pause", icon: "⏯" },
  { domId: "orbitBtn", label: () => "Orbits", icon: "🛰", active: () => AppState.orbitLinesVisible },
  { domId: "moonsBtn", label: () => "Moons", icon: "🌙", active: () => isBtnActive("moonsBtn") },
  { domId: "constellationBtn", label: () => "Stars", icon: "✨", active: () => isBtnActive("constellationBtn") },
  { domId: "issBtn", label: () => "Locate ISS", icon: "📡" },
  { domId: "ttsToggleBtn", label: () => "Voice", icon: () => document.getElementById("ttsToggleBtn")?.textContent || "🔊", active: () => !document.getElementById("ttsToggleBtn")?.classList.contains("muted") },
  { domId: "ambientToggleBtn", label: () => "Ambience", icon: () => document.getElementById("ambientToggleBtn")?.textContent || "🪐", active: () => !document.getElementById("ambientToggleBtn")?.classList.contains("muted") },
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

const PADDING = 24;
const GAP = 16;

export const controlPanel = new VRPanel({ worldWidth: 2.6, worldHeight: 0.62, canvasWidth: 1536 });
controlPanel.mesh.name = "vrControlPanel";
controlPanel.mesh.position.set(...LOCAL_POSITION);

// Populated by redraw(), consumed by controllerRaycast.js for hit-testing —
// canvas-pixel rectangles, one per button, in the same order as BUTTONS.
export const buttonHitRects = [];

function drawButton(ctx, x, y, w, h, btn) {
  const isActive = btn.active ? btn.active() : false;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = isActive ? COLORS.pillBgActive : COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = isActive ? COLORS.blue : COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const icon = typeof btn.icon === "function" ? btn.icon() : btn.icon;
  ctx.font = "44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(icon, x + h * 0.55, y + h / 2);

  ctx.font = "28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = isActive ? COLORS.blue : COLORS.textDim;
  ctx.fillText(btn.label(), x + h * 1.05, y + h / 2);
}

export function redrawControlPanel() {
  const { ctx, canvasWidth: W, canvasHeight: H } = controlPanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const innerW = W - PADDING * 2;
  const btnW = (innerW - GAP * (BUTTONS.length - 1)) / BUTTONS.length;
  const btnH = H - PADDING * 2;

  buttonHitRects.length = 0;
  BUTTONS.forEach((btn, i) => {
    const x = PADDING + i * (btnW + GAP);
    const y = PADDING;
    drawButton(ctx, x, y, btnW, btnH, btn);
    buttonHitRects.push({ domId: btn.domId, x, y, w: btnW, h: btnH });
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
}
