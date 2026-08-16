import { AppState } from "../core/state.js";
import { beginScrub, updateScrub, isScrubbing } from "./tierTransition.js";

// ---------- scroll-past-the-edge tier scrub ----------
// The breadcrumb's "+"/"-"/voice/chat are all explicit, deliberate ways to
// change tiers — this adds an implicit one: scrolling the mouse wheel past
// where OrbitControls' own zoom stops doing anything, in EITHER direction.
// Scrolling out past controls.maxDistance scrubs toward the next tier out;
// scrolling in past controls.minDistance scrubs toward the next tier in —
// gradually, tied directly to how much you keep scrolling (cosmos/
// tierTransition.js's beginScrub()/updateScrub()), not an instant trigger.
//
// Bound directly to the canvas (renderer.domElement), not window — wheel
// events over a DOM panel (the assistant chat, a modal) never reach a
// listener on a sibling element, so this is naturally inert while the
// pointer is over UI rather than the 3D view.
const AT_MAX_THRESHOLD = 0.985; // fraction of controls.maxDistance counted as "already at the edge"
const MIN_EPSILON = 0.3; // scene units of slack near controls.minDistance — that value is small (3) so a percentage threshold doesn't make sense the way it does for the (huge) max side

function onWheel(event) {
  if (AppState.mode !== "orbital" || AppState.xrSession) return;

  // Already mid-scrub: every further wheel tick drives it, regardless of
  // the camera's current distance (it's no longer sitting at the boundary
  // once the dolly has moved it) — scrolling the opposite direction un-scrubs.
  if (isScrubbing()) {
    updateScrub(event.deltaY);
    return;
  }
  if (AppState.tierBusy) return; // a button/voice-triggered cinematic transition is already playing

  const { camera, controls } = AppState;
  const distance = camera.position.distanceTo(controls.target);
  // The triggering tick's own deltaY feeds updateScrub() immediately too,
  // not just beginScrub() arming the scrub at 0 — otherwise this first
  // tick would be the one tick that contributes nothing, making the very
  // start of a scrub feel one tick less responsive than every tick after it.
  if (event.deltaY > 0 && distance >= controls.maxDistance * AT_MAX_THRESHOLD) {
    if (beginScrub("ascend")) updateScrub(event.deltaY);
  } else if (event.deltaY < 0 && distance <= controls.minDistance + MIN_EPSILON) {
    if (beginScrub("descend")) updateScrub(event.deltaY);
  }
}

export function initScrollZoomTier() {
  AppState.renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
}
