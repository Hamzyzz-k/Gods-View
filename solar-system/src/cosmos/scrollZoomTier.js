import { AppState } from "../core/state.js";
import { ascendTierCinematic } from "./tierTransition.js";

// ---------- scroll-past-the-edge tier ascend ----------
// The breadcrumb's "+"/voice/chat are all explicit, deliberate ways to
// change tiers — this adds an implicit one: scrolling the mouse wheel to
// zoom out, same gesture used to zoom out within a tier, just continued
// past where OrbitControls' own zoom stops doing anything. Continuing to
// scroll out once already pinned at controls.maxDistance now reads as
// "I want to keep going" rather than a dead end, and triggers the same
// cinematic ascent the breadcrumb button does.
//
// Bound directly to the canvas (renderer.domElement), not window — wheel
// events over a DOM panel (the assistant chat, a modal) never reach a
// listener on a sibling element, so this is naturally inert while the
// pointer is over UI rather than the 3D view.
const AT_MAX_THRESHOLD = 0.985; // fraction of controls.maxDistance counted as "already at the edge"
const RETRIGGER_COOLDOWN_MS = 1500; // longer than the dolly itself, so a still-scrolling wheel can't queue a second ascent before the first finishes

let lastTriggerTime = 0;

function onWheel(event) {
  if (event.deltaY <= 0) return; // only the zoom-OUT direction
  if (AppState.mode !== "orbital" || AppState.xrSession || AppState.tierBusy) return;

  const { camera, controls } = AppState;
  const distance = camera.position.distanceTo(controls.target);
  if (distance < controls.maxDistance * AT_MAX_THRESHOLD) return; // still real zoom headroom left — let OrbitControls handle it normally

  const now = performance.now();
  if (now - lastTriggerTime < RETRIGGER_COOLDOWN_MS) return;

  if (ascendTierCinematic()) lastTriggerTime = now;
}

export function initScrollZoomTier() {
  AppState.renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
}
