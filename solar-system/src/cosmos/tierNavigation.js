import { AppState } from "../core/state.js";
import { TIER_DATA, getTierIndex, getTierById, VR_NEAR_PLANE } from "./tierData.js";
import { getTierScene } from "./tierScenes.js";
import { clearFocus } from "../interaction/focus.js";
import { releaseAll as releaseHeldBodies } from "../xr/scaleGrab.js";
import { stopBigBangAudio } from "./bigBangAudio.js";

// Per-tier saved view (camera position + OrbitControls target), keyed by
// tier id — the multi-tier generalization of surface/surfaceMode.js's single
// `savedOrbitalView` slot. Re-entering a tier restores exactly where you
// left it, the same "remember and restore exactly" precedent; the very
// first visit to a tier falls back to that tier's `defaultView`.
const savedViews = new Map();

// The VR equivalent, keyed the same way. Kept separate from savedViews
// because the two store different things: on desktop a tier is left with an
// orbit camera position plus a look-at target, in VR with a single
// free-flight rig position and no target at all (the headset owns where the
// player is looking). Storing the rig's position in savedViews' cameraPos
// slot would let one mode restore the other's framing, which is meaningless
// in both directions.
const savedRigPositions = new Map();

// Where the rig genuinely was when the player triggered a tier change, as
// opposed to where it has been shoved to by the time the swap happens.
// cosmos/tierTransition.js's cinematic dolly pushes the rig outward by
// PUSH_FACTOR *before* calling enterTier(), so reading rig.position at swap
// time records a point 2.6x further out than the player ever actually was —
// and since that inflated value is what the next visit restores, every
// ascend/descend round trip multiplied the distance again (measured: 4,050
// units out, back, and up to 10,529). The transition reports its true
// departure point here instead.
let pendingVrDeparture = null;
export function noteVrDeparture(position) {
  pendingVrDeparture = position.toArray();
}

// A saved position is only useful if you can see anything from it. Every
// tier's origin is the middle of its headline object — the Sun, Sagittarius
// A*, the centre of a galaxy field — so a rig sitting there is buried inside
// geometry with no horizon to orient against. Rather than hard-coding each
// body's radius, "too close to be a vantage point" is measured against the
// tier's own default framing distance, which already encodes how far out you
// need to be for that tier's content to read.
const MIN_USABLE_FRACTION = 0.05;
function isUsableVantage(positionArray, tier) {
  const d = Math.hypot(positionArray[0], positionArray[1], positionArray[2]);
  const def = tier.defaultView.cameraPos;
  const defaultDist = Math.hypot(def[0], def[1], def[2]) || 1;
  return d >= defaultDist * MIN_USABLE_FRACTION;
}

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
  if (AppState.xrSession) {
    const departure = pendingVrDeparture || rig.position.toArray();
    const fromTier = getTierById(AppState.tier);
    // Discard a departure point that's effectively at the tier's centre —
    // most often the session's own starting position, since sessionManager
    // parks the rig at the origin. Saving it would mean "return to where you
    // left off" puts the player back inside the Sun.
    if (fromTier && isUsableVantage(departure, fromTier)) {
      savedRigPositions.set(AppState.tier, departure);
    }
  }
  pendingVrDeparture = null;

  // A focused body's world position is only meaningful within the scale of
  // the tier it belongs to — carrying it across a tier change would leave
  // the desktop/VR info panels pointed at a mesh whose coordinates now mean
  // something completely different (or nothing at all) in the new tier.
  // Same reasoning surface/surfaceMode.js already applies when swapping
  // into a surface scene.
  clearFocus();

  // Anything held in a hand belongs to the tier being left — its miniature
  // is parented to the controller, so it would otherwise ride along into a
  // scene where the body it represents doesn't exist.
  releaseHeldBodies();

  // The Big Bang tier's audio bed is driven from its own update, which stops
  // being called the moment another tier is active — so without this it would
  // hold its last gain and keep roaring under the Milky Way.
  stopBigBangAudio();

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

  // Both modes need to be PUT somewhere in the new tier, they just move
  // different objects: desktop writes camera.position/controls.target (which
  // the rig-is-the-only-thing-that-moves invariant forbids once a session
  // owns the camera), VR moves the rig.
  //
  // VR used to be skipped entirely here, on the assumption that
  // cosmos/tierTransition.js's dolly placed the rig itself. It doesn't: that
  // dolly derives its start and end from pushedOutFrom(rig.position, ORIGIN),
  // which is a direction *away from the origin* — and xr/sessionManager.js
  // parks the rig exactly ON the origin when a session starts, where that
  // direction is a zero vector that normalises to zero. Every VR tier change
  // therefore left the player pinned at the new tier's world origin, which is
  // inside the Sun in the solar system and inside Sagittarius A* in the Milky
  // Way — a featureless wall of light with no way to tell which way to fly.
  // That is what "can't go back after pressing −" actually was.
  //
  // Each tier's defaultView.cameraPos is already a good vantage point (it is
  // what desktop arrives at), so VR reuses it, falling back to it the same
  // way desktop falls back — first visit gets the default, later visits get
  // wherever the player left off.
  if (AppState.xrSession) {
    const savedRig = savedRigPositions.get(targetId);
    rig.position.fromArray(savedRig || tier.defaultView.cameraPos);
  } else {
    applyView(savedViews.get(targetId) || tier.defaultView);
  }

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
