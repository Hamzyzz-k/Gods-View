import { AppState } from "../core/state.js";
import { easeInOutCubic } from "../scene/alignmentsAndEclipses.js";
import { enterTier, canChangeTier } from "./tierNavigation.js";
import { TIER_DATA, getTierIndex, getTierById } from "./tierData.js";
import { showToast } from "../ui/toast.js";

// ---------- cinematic tier transition ----------
// Wraps tierNavigation.js's instant enterTier() between a camera dolly-out
// (in the tier being left), a brief full-opacity hold (the actual scene
// swap happens here, invisibly), and a dolly-in (in the tier being
// arrived at). enterTier() stays the one load-bearing primitive
// underneath every way a tier can be reached — this only adds motion
// around it, the same "wrap, don't replace" relationship
// surface/surfaceMode.js's enter/exit has to the rest of Surface Mode.
//
// Desktop only: this drives camera.position directly, which is exactly the
// thing the rig-is-the-only-thing-that-moves invariant forbids once a WebXR
// session owns the camera. During a session, tier changes fall back to
// enterTier()'s instant swap — no worse than what Phase O already shipped,
// just without the dolly. A VR-native version (tweening the RIG, the same
// way interaction/focus.js's startVrFlyTo() already does for focusing a
// body) is future work, not a regression.

const DOLLY_OUT_MS = 1000;
const HOLD_MS = 400;
const DOLLY_IN_MS = 1000;
const TOTAL_MS = DOLLY_OUT_MS + HOLD_MS + DOLLY_IN_MS;
const PUSH_FACTOR = 2.6; // how far the camera dollies, as a multiple of its current distance from target

let active = null; // { targetId, startTime, outFrom, outTo, swapped, inFrom, inTo }
let overlay = null;

export function initTierTransition() {
  overlay = document.getElementById("tierTransitionOverlay");
}

function pushedOutFrom(pos, target, factor) {
  return target.clone().add(pos.clone().sub(target).multiplyScalar(factor));
}

function beginTransition(targetId) {
  if (AppState.xrSession) return enterTier(targetId); // see file header — no dolly during a session
  if (!canChangeTier()) return false;
  if (targetId === AppState.tier) return false;
  const tier = getTierById(targetId);
  if (!tier) return false;

  const { camera, controls } = AppState;
  AppState.tierBusy = true;
  controls.enabled = false; // otherwise a mouse-drag mid-dolly fights the programmatic camera.position writes below

  active = {
    targetId,
    startTime: performance.now(),
    outFrom: camera.position.clone(),
    outTo: pushedOutFrom(camera.position, controls.target, PUSH_FACTOR),
    swapped: false,
  };
  showToast("🌌 Traveling…", `Heading to ${tier.label}…`, TOTAL_MS);
  return true;
}

export function ascendTierCinematic() {
  const i = getTierIndex(AppState.tier);
  if (i === -1 || i + 1 >= TIER_DATA.length) return false;
  return beginTransition(TIER_DATA[i + 1].id);
}

export function descendTierCinematic() {
  const i = getTierIndex(AppState.tier);
  if (i <= 0) return false;
  return beginTransition(TIER_DATA[i - 1].id);
}

export function jumpToTierCinematic(tierId) {
  return beginTransition(tierId);
}

export function isTierTransitioning() {
  return !!active;
}

// Called once per frame from core/loop.js. Cheap no-op when idle. Drives
// camera.position directly rather than through OrbitControls (which is
// disabled for the transition's duration above) — controls.update() is
// called exactly once, at the very end, to resync OrbitControls' internal
// spherical state to wherever the dolly actually left the camera.
export function updateTierTransition() {
  if (!active) return;
  const elapsed = performance.now() - active.startTime;
  const { camera, controls } = AppState;

  // Ensures the swap has happened before ANY code path below reads
  // active.inTo — checked unconditionally, first, rather than nested
  // inside the "we're in the HOLD window" branch below. That nesting
  // silently assumed this function gets called often enough to land
  // inside the narrow post-dolly-out/pre-dolly-in window on some call —
  // true at 60fps, but a large gap between two calls (a backgrounded or
  // throttled tab, a slow device, or — how this was actually found — two
  // separate calls in this session's own verification sweep with several
  // real seconds between them) can jump straight past that window in one
  // step. The swap would then never run, active.inTo would stay
  // undefined, and the final branch below would throw reading it —
  // leaving AppState.tierBusy stuck true forever, since the line that
  // resets it never gets reached either.
  if (elapsed >= DOLLY_OUT_MS && !active.swapped) {
    // enterTier() itself checks canChangeTier(), which refuses to run
    // while AppState.tierBusy is true — the exact flag beginTransition()
    // set to block a SECOND transition from starting concurrently. Lift
    // it for just this one internal call (restored immediately after,
    // regardless of outcome) or this call silently no-ops and the tier
    // never actually changes despite the dolly playing out around it.
    AppState.tierBusy = false;
    enterTier(active.targetId); // the actual scene swap — invisible behind the full-opacity overlay
    AppState.tierBusy = true;
    active.swapped = true;
    active.inTo = camera.position.clone(); // wherever enterTier() just placed us (saved or default view)
    active.inFrom = pushedOutFrom(camera.position, controls.target, PUSH_FACTOR);
    camera.position.copy(active.inFrom); // start the arrival dolly from the pushed-out point
  }

  if (elapsed < DOLLY_OUT_MS) {
    const t = easeInOutCubic(elapsed / DOLLY_OUT_MS);
    camera.position.lerpVectors(active.outFrom, active.outTo, t);
    if (overlay) overlay.style.opacity = String(t);
    return;
  }

  if (elapsed < DOLLY_OUT_MS + HOLD_MS) {
    if (overlay) overlay.style.opacity = "1";
    return;
  }

  if (elapsed < TOTAL_MS) {
    const t = easeInOutCubic((elapsed - DOLLY_OUT_MS - HOLD_MS) / DOLLY_IN_MS);
    camera.position.lerpVectors(active.inFrom, active.inTo, t);
    if (overlay) overlay.style.opacity = String(1 - t);
    return;
  }

  // Done. Guaranteed safe to read active.inTo here regardless of how this
  // frame was reached, per the guard at the top of this function.
  camera.position.copy(active.inTo);
  if (overlay) overlay.style.opacity = "0";
  controls.update(); // resync OrbitControls' internal state now that the dolly has stopped moving camera.position by hand
  controls.enabled = !AppState.xrSession; // same "don't fight the session for this flag" caution surfaceMode.js's exitSurface() already applies
  AppState.tierBusy = false;
  active = null;
}
