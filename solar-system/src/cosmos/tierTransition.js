import * as THREE from "three";
import { AppState } from "../core/state.js";
import { easeInOutCubic } from "../scene/alignmentsAndEclipses.js";
import { enterTier, canChangeTier } from "./tierNavigation.js";
import { TIER_DATA, getTierIndex, getTierById } from "./tierData.js";
import { showToast } from "../ui/toast.js";
import { STARFIELD_BASE_SIZE, STARFIELD_NAME } from "../core/starfield.js";
import { createWarpField, drawWarpFrame, clearWarpField } from "./warpStarfield.js";

// ---------- cinematic tier transition ----------
// Wraps tierNavigation.js's instant enterTier() between a camera dolly-out
// (in the tier being left), a brief hold behind a translucent veil (the
// actual scene swap happens here — see MAX_OVERLAY_OPACITY below for why
// the veil is never fully opaque), and a dolly-in (in the tier being
// arrived at). enterTier() stays the one load-bearing primitive
// underneath every way a tier can be reached — this only adds motion
// around it, the same "wrap, don't replace" relationship
// surface/surfaceMode.js's enter/exit has to the rest of Surface Mode.
//
// Works both outside and inside a WebXR session. Desktop drives
// camera.position directly (safe there — the rig sits at identity, so local
// space equals world space). During a session, driving camera.position
// directly would break the rig-is-the-only-thing-that-moves invariant, so
// the VR branch instead tweens AppState.rig.position, mirroring
// interaction/focus.js's startVrFlyTo() — the established pattern for any
// scripted VR camera motion in this app. Both branches share the exact
// same phase math (see driveTransition() below) and the exact same
// PUSH_FACTOR/PULL_IN_FACTOR pacing, just aimed at a different object and a
// different veil (the DOM overlay can't render inside an active session —
// xr/vrPanel.js's own header documents this — so VR gets a small
// rig-parented translucent mesh instead, built lazily below).
//
// The wheel-scrubbed path (beginScrub/updateScrub below) stays desktop-only
// and untouched — beginScrub() already refuses outright while a session is
// active, since there's no mouse wheel in a headset; VR tier navigation
// goes exclusively through xr/vrScalePanel.js's +/- buttons, which already
// call ascendTierCinematic()/descendTierCinematic() and so pick up the VR
// dolly automatically via the branch in beginTransition() below.

// Lengthened from the original 1000/400/1000 split — more of the perceived
// motion now happens in the eased dolly phases and less in a static pause,
// closer to the reference "powers of ten" zoom video's unbroken pull-back.
const DOLLY_OUT_MS = 1500;
const HOLD_MS = 250;
const DOLLY_IN_MS = 1500;
const TOTAL_MS = DOLLY_OUT_MS + HOLD_MS + DOLLY_IN_MS;
const PUSH_FACTOR = 2.6; // how far the camera dollies, as a multiple of its current distance from target

// How much the active tier's own background starfield (core/starfield.js)
// grows on top of its base point size at peak dolly speed — a cheap
// "stars are streaking past as you accelerate" continuity cue, purely a
// material.size write, no geometry rebuild.
const STARFIELD_BOOST = 2.6;

// The overlay never reaches full opacity — a translucent veil rather than a
// solid wall. The scene swap still happens behind it (still instant, still
// at the DOLLY_OUT_MS mark below), but because the veil tops out well under
// 1, the destination tier is already faintly visible through it the moment
// it's swapped in, and grows clearer as the veil lifts during dolly-in —
// reading as the destination coalescing into view rather than a hard cut
// behind a blackout.
const MAX_OVERLAY_OPACITY = 0.6;

// How much accumulated wheel deltaY it takes to fully scrub a transition —
// roughly 6 standard notch-scrolls worth. See beginScrub()/updateScrub()
// below for the scroll-scrubbed path (mouse-wheel-driven, reversible,
// stops the instant scrolling stops); ascendTierCinematic()/
// descendTierCinematic()/jumpToTierCinematic() below that are the
// pre-existing INSTANT auto-playing path (breadcrumb buttons, voice/chat)
// and are deliberately untouched — a click is already a deliberate,
// singular action, unlike a continuous scroll gesture.
const SCRUB_SENSITIVITY = 1 / 600;
const PULL_IN_FACTOR = 0.35; // how far the camera dollies IN, for a descend scrub — the mirror of PUSH_FACTOR

// Every TIER_DATA entry's defaultView.target is world origin (confirmed
// across all 5 tiers) — the VR dolly anchors to this instead of
// controls.target, which doesn't exist/apply once OrbitControls is disabled
// for the session.
const ORIGIN = new THREE.Vector3(0, 0, 0);

let active = null; // { targetId, fromTierId, startTime, swapped, inFrom, inTo, vr } — the auto-playing dolly-in (and, for a button/voice-triggered jump, dolly-out+hold too)
let scrub = null; // { direction, fromTierId, targetId, progress, outFrom, outTo } — the scroll-scrubbed dolly-out, before it's committed (desktop-only, see file header)
let overlay = null;
let vrVeil = null;

// Desktop warp canvas — a real full-viewport <canvas> (see index.html),
// resized to track the window rather than a fixed size, since it needs to
// cover the whole screen at native resolution to read as "flying through
// stars" rather than a blurry stretched effect.
let warpCanvas = null;
let warpCtx = null;
const desktopWarpField = createWarpField();

// VR warp canvas — a small offscreen canvas backing a CanvasTexture on the
// veil sphere below, same "canvas-texture-on-a-surface" pattern every VR
// panel in this app already uses. A separate warp field instance so the
// two never visibly sync/mirror each other.
const VR_VEIL_CANVAS_SIZE = 512;
let vrVeilCanvas = null;
let vrVeilCtx = null;
let vrVeilTexture = null;
const vrWarpField = createWarpField();

function resizeWarpCanvas() {
  if (!warpCanvas) return;
  warpCanvas.width = window.innerWidth;
  warpCanvas.height = window.innerHeight;
}

export function initTierTransition() {
  overlay = document.getElementById("tierTransitionOverlay");
  warpCanvas = document.getElementById("tierTransitionWarpCanvas");
  warpCtx = warpCanvas?.getContext("2d") || null;
  resizeWarpCanvas();
  window.addEventListener("resize", resizeWarpCanvas);

  vrVeil = buildVrVeil();
  if (AppState.rig) AppState.rig.add(vrVeil);
}

// The VR equivalent of #tierTransitionOverlay — regular DOM doesn't render
// inside an active WebXR session (xr/vrPanel.js's own header documents
// this), so this is a real rig-parented mesh instead: a large BackSide
// sphere centered on the rig, big enough to enclose the camera's small
// local offset within it regardless of head rotation, textured with the
// same warp-starfield canvas drawing used on desktop (see warpStarfield.js)
// so the "flying through stars" effect actually shows up in-headset too,
// not just as a flat tint. depthTest disabled and a very high renderOrder
// mean it always draws last, on top of whatever's in the scene, the same
// "guaranteed on top regardless of what's nearby" trick a screen-space
// overlay would give on desktop. Attached to the rig once at startup
// rather than only during a session — cheap to keep around at opacity 0,
// and simpler than adding/removing it from the scene graph on every
// session start/end.
function buildVrVeil() {
  const geo = new THREE.SphereGeometry(2, 24, 16);
  vrVeilCanvas = document.createElement("canvas");
  vrVeilCanvas.width = VR_VEIL_CANVAS_SIZE;
  vrVeilCanvas.height = VR_VEIL_CANVAS_SIZE;
  vrVeilCtx = vrVeilCanvas.getContext("2d");
  vrVeilTexture = new THREE.CanvasTexture(vrVeilCanvas);
  const mat = new THREE.MeshBasicMaterial({
    map: vrVeilTexture,
    color: 0x05060c,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "vrTransitionVeil";
  mesh.renderOrder = 9999;
  return mesh;
}

function setVrVeilOpacity(opacity) {
  if (vrVeil) vrVeil.material.opacity = opacity;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pushedOutFrom(pos, target, factor) {
  return target.clone().add(pos.clone().sub(target).multiplyScalar(factor));
}

// Drives the warp-starfield canvas (desktop OR VR, never both at once —
// see isVR) and the active tier's own background starfield boost off a
// single 0..1 "how far through the motion are we" number, eased the same
// way the camera dolly itself already is — its DERIVATIVE (streak speed,
// starfield growth) is naturally slow at spinT=0, fastest around
// spinT=0.5, and slow again at spinT=1, which is exactly "keyed to dolly
// speed" (per the reference video's unbroken pull-back) without
// hand-rolling a separate piecewise velocity curve for each of the three
// transition phases.
function applyMotionCues(spinT, isVR) {
  const eased = easeInOutCubic(clamp01(spinT));

  if (isVR) {
    if (vrVeilCtx) {
      drawWarpFrame(vrWarpField, vrVeilCtx, VR_VEIL_CANVAS_SIZE, VR_VEIL_CANVAS_SIZE, eased);
      if (vrVeilTexture) vrVeilTexture.needsUpdate = true;
    }
  } else if (warpCtx && warpCanvas) {
    drawWarpFrame(desktopWarpField, warpCtx, warpCanvas.width, warpCanvas.height, eased);
  }

  const stars = AppState.activeScene?.getObjectByName(STARFIELD_NAME);
  if (stars) stars.material.size = STARFIELD_BASE_SIZE + eased * STARFIELD_BOOST;
}

function resetMotionCues() {
  if (warpCtx && warpCanvas) clearWarpField(warpCtx, warpCanvas.width, warpCanvas.height);
  if (vrVeilCtx) {
    clearWarpField(vrVeilCtx, VR_VEIL_CANVAS_SIZE, VR_VEIL_CANVAS_SIZE);
    if (vrVeilTexture) vrVeilTexture.needsUpdate = true;
  }
  const stars = AppState.activeScene?.getObjectByName(STARFIELD_NAME);
  if (stars) stars.material.size = STARFIELD_BASE_SIZE;
}

// ---------- scroll-scrubbed transition ----------
// Continuing to scroll out past controls.maxDistance (or in past
// controls.minDistance — see cosmos/scrollZoomTier.js's wheel handler,
// the only caller of this section) no longer instantly triggers a full
// auto-playing transition. Instead it accumulates a reversible 0..1
// "progress" directly off the wheel's own deltaY, with the camera dolly
// and veil opacity driven straight off that number every event — scroll
// a little, the pull-back happens a little; stop scrolling, it stops
// exactly where it is; scroll the other way, it un-scrubs back to normal
// zoom. Only crossing progress 1 commits: the actual tier swap happens,
// and control hands off to the existing auto-playing dolly-IN (below) for
// the arrival half, unchanged from the button/voice-triggered path.
function applyScrubVisual() {
  const { camera } = AppState;
  const t = easeInOutCubic(scrub.progress);
  camera.position.lerpVectors(scrub.outFrom, scrub.outTo, t);
  if (overlay) overlay.style.opacity = String(t * MAX_OVERLAY_OPACITY);
  // scrub only ever represents the "out" portion of a full transition (it
  // hands off to the ordinary active-driven dolly-in on commit, below) —
  // scaling its own 0..1 progress onto the DOLLY_OUT_MS slice of TOTAL_MS
  // keeps the streak/starfield motion on the same curve updateTierTransition()
  // uses, rather than a second, differently-paced copy of it.
  applyMotionCues((scrub.progress * DOLLY_OUT_MS) / TOTAL_MS, false); // scrub is desktop-only, see file header
}

function cancelScrub() {
  const { controls } = AppState;
  scrub = null;
  controls.enabled = !AppState.xrSession;
  controls.update();
  AppState.tierBusy = false;
  resetMotionCues();
}

// Hands off to the exact same auto-playing dolly-IN the button/voice path
// uses (the branch in updateTierTransition() below) by backdating
// startTime as if the (already scroll-played-by-hand) dolly-out and hold
// had already elapsed — reuses that logic verbatim rather than forking a
// second copy of it for this path.
function commitScrub() {
  const { camera, controls } = AppState;
  const targetId = scrub.targetId;
  const fromTierId = scrub.fromTierId;
  const tier = getTierById(targetId);
  scrub = null;

  AppState.tierBusy = false; // lift so enterTier()'s canChangeTier() passes — see beginTransition()'s identical comment
  enterTier(targetId);
  AppState.tierBusy = true;

  const inTo = camera.position.clone();
  const inFrom = pushedOutFrom(camera.position, controls.target, PUSH_FACTOR);
  camera.position.copy(inFrom);

  active = {
    targetId,
    fromTierId,
    startTime: performance.now() - (DOLLY_OUT_MS + HOLD_MS),
    swapped: true,
    inFrom,
    inTo,
    vr: false, // scrub only ever runs desktop-side — beginScrub() refuses outright during a session
  };
  showToast("Traveling…", `Heading to ${tier?.label ?? targetId}…`, DOLLY_IN_MS);
}

export function isScrubbing() {
  return !!scrub;
}

// direction: "ascend" (scrolling out past the edge) or "descend" (scrolling
// in past the edge) — mirrors ascendTierCinematic()/descendTierCinematic()'s
// own tier-index math exactly, just without the instant auto-play.
export function beginScrub(direction) {
  if (AppState.xrSession || scrub || !canChangeTier()) return false;
  const i = getTierIndex(AppState.tier);
  const targetIdx = direction === "ascend" ? i + 1 : i - 1;
  if (i === -1 || targetIdx < 0 || targetIdx >= TIER_DATA.length) return false;

  const { camera, controls } = AppState;
  AppState.tierBusy = true;
  controls.enabled = false;
  scrub = {
    direction,
    fromTierId: AppState.tier,
    targetId: TIER_DATA[targetIdx].id,
    progress: 0,
    outFrom: camera.position.clone(),
    outTo: pushedOutFrom(camera.position, controls.target, direction === "ascend" ? PUSH_FACTOR : PULL_IN_FACTOR),
  };
  return true;
}

// deltaY: the wheel event's own raw deltaY, sign and all — scrubTier()
// (cosmos/scrollZoomTier.js) hands this straight through rather than
// pre-negating it, so the direction math lives in exactly one place.
export function updateScrub(deltaY) {
  if (!scrub) return;
  const sign = scrub.direction === "ascend" ? 1 : -1;
  scrub.progress = clamp01(scrub.progress + deltaY * sign * SCRUB_SENSITIVITY);
  if (scrub.progress <= 0) {
    cancelScrub();
    return;
  }
  applyScrubVisual();
  if (scrub.progress >= 1) commitScrub();
}

function beginTransition(targetId) {
  if (!canChangeTier()) return false;
  if (targetId === AppState.tier) return false;
  const tier = getTierById(targetId);
  if (!tier) return false;

  AppState.tierBusy = true;
  const fromTierId = AppState.tier;
  const isVR = AppState.xrSession;

  if (isVR) {
    const { rig } = AppState;
    active = {
      targetId,
      fromTierId,
      startTime: performance.now(),
      outFrom: rig.position.clone(),
      outTo: pushedOutFrom(rig.position, ORIGIN, PUSH_FACTOR),
      swapped: false,
      vr: true,
    };
  } else {
    const { camera, controls } = AppState;
    controls.enabled = false; // otherwise a mouse-drag mid-dolly fights the programmatic camera.position writes below
    active = {
      targetId,
      fromTierId,
      startTime: performance.now(),
      outFrom: camera.position.clone(),
      outTo: pushedOutFrom(camera.position, controls.target, PUSH_FACTOR),
      swapped: false,
      vr: false,
    };
  }

  showToast("Traveling…", `Heading to ${tier.label}…`, TOTAL_MS);
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
  return !!active || !!scrub;
}

// Read-only snapshot of whatever transition is currently in flight, for
// anything that wants to react to it without owning any of the state above
// (ui/scaleBar.js, xr/vrScalePanel.js's distance readout). `t` is a single
// OVERALL 0..1 progress across the whole transition — for the scrub path
// that's just scrub.progress itself (still pre-commit, a single "out"
// phase); for the active path it's elapsed/TOTAL_MS, spanning dolly-out,
// hold, AND dolly-in as one continuous number, which is what a "the number
// just keeps climbing as you pull back" readout wants rather than a
// per-phase reset. Returns null when idle — the common case, checked first
// by every consumer.
export function getTransitionProgress() {
  if (scrub) {
    return { fromTierId: scrub.fromTierId, toTierId: scrub.targetId, phase: "out", t: scrub.progress };
  }
  if (active) {
    const elapsed = performance.now() - active.startTime;
    const t = clamp01(elapsed / TOTAL_MS);
    const phase = elapsed < DOLLY_OUT_MS ? "out" : elapsed < DOLLY_OUT_MS + HOLD_MS ? "hold" : "in";
    return { fromTierId: active.fromTierId, toTierId: active.targetId, phase, t };
  }
  return null;
}

// The phase math shared by both the desktop (camera) and VR (rig) branches
// of updateTierTransition() below — moveObj is whichever one owns this
// transition, anchor is what its dolly pushes away from/toward (controls.target
// on desktop, world origin in VR — see beginTransition()), and setOpacity
// drives whichever veil applies (the DOM overlay, or the VR mesh). Returns
// true once the transition has fully finished (moveObj parked at
// active.inTo, opacity at 0) so the caller knows when to run its own
// branch-specific cleanup (controls.update() on desktop, nothing extra in
// VR — rig.position is already exactly where it should be).
function driveTransition(elapsed, moveObj, anchor, setOpacity) {
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
    enterTier(active.targetId); // the actual scene swap — invisible behind the full-opacity veil
    AppState.tierBusy = true;
    active.swapped = true;
    active.inTo = moveObj.position.clone(); // wherever enterTier() just placed us (saved or default view)
    active.inFrom = pushedOutFrom(moveObj.position, anchor, PUSH_FACTOR);
    moveObj.position.copy(active.inFrom); // start the arrival dolly from the pushed-out point
  }

  if (elapsed < DOLLY_OUT_MS) {
    const t = easeInOutCubic(elapsed / DOLLY_OUT_MS);
    moveObj.position.lerpVectors(active.outFrom, active.outTo, t);
    setOpacity(t * MAX_OVERLAY_OPACITY);
    return false;
  }

  if (elapsed < DOLLY_OUT_MS + HOLD_MS) {
    setOpacity(MAX_OVERLAY_OPACITY);
    return false;
  }

  if (elapsed < TOTAL_MS) {
    const t = easeInOutCubic((elapsed - DOLLY_OUT_MS - HOLD_MS) / DOLLY_IN_MS);
    moveObj.position.lerpVectors(active.inFrom, active.inTo, t);
    setOpacity((1 - t) * MAX_OVERLAY_OPACITY);
    return false;
  }

  // Done. Guaranteed safe to read active.inTo here regardless of how this
  // frame was reached, per the guard at the top of this function.
  moveObj.position.copy(active.inTo);
  setOpacity(0);
  return true;
}

function setDomOverlayOpacity(opacity) {
  if (overlay) overlay.style.opacity = String(opacity);
}

// Called once per frame from core/loop.js. Cheap no-op when idle.
export function updateTierTransition() {
  if (!active) return;
  const elapsed = performance.now() - active.startTime;
  applyMotionCues(elapsed / TOTAL_MS, active.vr);

  const { camera, controls, rig } = AppState;
  const moveObj = active.vr ? rig : camera;
  const anchor = active.vr ? ORIGIN : controls.target;
  const setOpacity = active.vr ? setVrVeilOpacity : setDomOverlayOpacity;

  const done = driveTransition(elapsed, moveObj, anchor, setOpacity);
  if (!done) return;

  resetMotionCues();
  if (!active.vr) {
    controls.update(); // resync OrbitControls' internal state now that the dolly has stopped moving camera.position by hand
    controls.enabled = !AppState.xrSession; // same "don't fight the session for this flag" caution surfaceMode.js's exitSurface() already applies
  }
  AppState.tierBusy = false;
  active = null;
}
