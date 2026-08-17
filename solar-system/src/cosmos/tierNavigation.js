import { AppState } from "../core/state.js";
import { TIER_DATA, getTierIndex, getTierById, VR_NEAR_PLANE } from "./tierData.js";
import { getTierScene } from "./tierScenes.js";
import { clearFocus } from "../interaction/focus.js";

// Per-tier saved view (camera position + OrbitControls target), keyed by
// tier id — the multi-tier generalization of surface/surfaceMode.js's single
// `savedOrbitalView` slot. Re-entering a tier restores exactly where you
// left it, the same "remember and restore exactly" precedent; the very
// first visit to a tier falls back to that tier's `defaultView`.
const savedViews = new Map();

function applyView(view) {
  const { camera, controls } = AppState;
  camera.position.set(view.cameraPos[0], view.cameraPos[1], view.cameraPos[2]);
  controls.target.set(view.target[0], view.target[1], view.target[2]);
  controls.update();
}

// Tier changes are only meaningful while flying free around a tier's scene
// — mid-transition (Phase P's cinematic dolly) or while standing on a
// planet's surface (a wholly separate mode axis, not a tier) neither has
// anywhere sensible to swap TO.
export function canChangeTier() {
  // sizeCompareOpen guard: Size Compare (sizeCompare/sizeCompareMode.js)
  // also reassigns AppState.activeScene directly (its own full-scene
  // takeover) — a tier change firing while it's open would silently steal
  // activeScene back from under it, leaving sizeCompareOpen stuck true
  // against a scene that's no longer on screen. Every tier-change entry
  // point (breadcrumb, VR scale panel, voice, scroll-scrub) already funnels
  // through this one gate, so guarding here covers all of them at once.
  return AppState.mode === "orbital" && !AppState.tierBusy && !AppState.sizeCompareOpen;
}

// The instant scene-swap mechanics — no animation of its own. The cinematic
// transition wraps this between a dolly-out and a dolly-in rather than
// replacing it: this function is the one load-bearing primitive underneath
// every way a tier can be reached (breadcrumb, VR panel, voice, this
// module's own ascend/descend/jump helpers).
export function enterTier(targetId) {
  if (!canChangeTier()) return false;
  if (targetId === AppState.tier) return false;
  const tier = getTierById(targetId);
  if (!tier) return false;

  const { camera, controls, rig } = AppState;
  savedViews.set(AppState.tier, { cameraPos: camera.position.toArray(), target: controls.target.toArray() });

  // A focused body's world position is only meaningful within the scale of
  // the tier it belongs to — carrying it across a tier change would leave
  // the desktop/VR info panels pointed at a mesh whose coordinates now mean
  // something completely different (or nothing at all) in the new tier.
  // Same reasoning surface/surfaceMode.js already applies when swapping
  // into a surface scene.
  clearFocus();

  const targetScene = getTierScene(targetId);
  if (!targetScene) return false;
  targetScene.add(rig); // reparenting: Object3D.add() removes it from the previous scene automatically

  // Each tier spans a wildly different coordinate range (solar system units
  // vs. galaxy-spanning distances), so near/far and OrbitControls' zoom
  // ceiling are per-tier rather than one fixed global — without this, outer
  // tiers would either clip or let you zoom stupidly far past their content.
  // Set BEFORE applyView(), not after: applyView() calls controls.update(),
  // which clamps camera distance to controls.maxDistance immediately — set
  // in the wrong order, the first frame in a tier gets silently clamped to
  // the PREVIOUS tier's (usually much smaller) limit instead of this one's.
  // In VR the tier's own near plane would clip away every rig-mounted panel
  // (they sit ~2.6m out, the outer tiers' near planes are 5-20) — see
  // VR_NEAR_PLANE's comment in tierData.js for the full reasoning.
  camera.near = AppState.xrSession ? VR_NEAR_PLANE : tier.cameraNear;
  camera.far = tier.cameraFar;
  camera.updateProjectionMatrix();
  controls.maxDistance = tier.controlsMax;

  // Desktop only: applyView() writes camera.position/controls.target
  // directly, exactly what the rig-is-the-only-thing-that-moves invariant
  // forbids once a WebXR session owns the camera. In VR there's no
  // meaningful "restore this tier's saved camera framing" concept anyway —
  // the rig is a free-flight first-person position, not an orbit camera,
  // and cosmos/tierTransition.js's VR dolly already places the rig itself
  // via its own PUSH_FACTOR math before/after this call.
  if (!AppState.xrSession) applyView(savedViews.get(targetId) || tier.defaultView);

  AppState.tier = targetId;
  AppState.activeScene = targetScene;
  return true;
}

export function ascendTier() {
  const i = getTierIndex(AppState.tier);
  if (i === -1 || i + 1 >= TIER_DATA.length) return false;
  return enterTier(TIER_DATA[i + 1].id);
}

export function descendTier() {
  const i = getTierIndex(AppState.tier);
  if (i <= 0) return false;
  return enterTier(TIER_DATA[i - 1].id);
}

export function jumpToTier(tierId) {
  return enterTier(tierId);
}

export function getTierLadder() {
  return TIER_DATA;
}
