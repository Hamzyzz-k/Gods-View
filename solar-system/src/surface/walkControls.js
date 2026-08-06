import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { AppState } from "../core/state.js";
import { EYE_HEIGHT } from "./surfaceMode.js";
import { playFootstep } from "./footsteps.js";

// ---------- desktop surface walking ----------
// PointerLockControls is used ONLY for mouse-look (it owns camera.quaternion
// while locked) — NOT for movement. Its own moveForward()/moveRight() write
// directly to camera.position, which would break the rig-is-the-only-thing-
// that-moves invariant xr/locomotion.js already established for VR. WASD
// here reads the camera's current facing and applies translation to
// AppState.rig.position instead, the same pattern, so gravity/grounding only
// has to be written once and works identically regardless of which input
// scheme is driving it.
const WALK_SPEED = 4.5; // scene units/sec — units are being treated as roughly meters at Surface Mode's ground scale
const BASE_GRAVITY = 9.8; // m/s^2, scaled per-planet by surfaceData.js's real gravity-relative-to-Earth ratios
const GROUND_CLAMP_RADIUS = 180; // keeps the player inside the 400-unit ground plane (surfaceScene.js) with margin before the fog-hidden edge
const STRIDE_LENGTH = 1.7; // scene units between footstep sounds

let controls = null;
let verticalVelocity = 0;
let strideAccumulator = 0;
let gravityMultiplier = 1;
let footstepStyle = "rocky";
let active = false;

const keys = { forward: false, back: false, left: false, right: false };
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function onKeyDown(e) {
  if (!active) return;
  switch (e.code) {
    case "KeyW": case "ArrowUp": keys.forward = true; break;
    case "KeyS": case "ArrowDown": keys.back = true; break;
    case "KeyA": case "ArrowLeft": keys.left = true; break;
    case "KeyD": case "ArrowRight": keys.right = true; break;
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case "KeyW": case "ArrowUp": keys.forward = false; break;
    case "KeyS": case "ArrowDown": keys.back = false; break;
    case "KeyA": case "ArrowLeft": keys.left = false; break;
    case "KeyD": case "ArrowRight": keys.right = false; break;
  }
}

// Called once at startup. Constructing PointerLockControls is inert until
// lock() is actually called (itself gated on a user gesture, per the browser
// Pointer Lock API), so this is safe to do unconditionally at init — same
// "safe to construct before it's ever used" reasoning as
// xr/locomotion.js's initLocomotion().
export function initWalkControls() {
  const { camera, renderer } = AppState;
  controls = new PointerLockControls(camera, renderer.domElement);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

export function requestPointerLock() {
  controls?.lock();
}
export function releasePointerLock() {
  controls?.unlock();
}
export function isPointerLocked() {
  return !!controls?.isLocked;
}

// cfg is a surfaceData.js entry — read here rather than re-imported, so this
// module doesn't need to know planet names, only "how heavy is walking here".
export function activateWalkControls(cfg) {
  active = true;
  verticalVelocity = 0;
  strideAccumulator = 0;
  gravityMultiplier = cfg.gravity;
  footstepStyle = cfg.footstepStyle;
  Object.assign(keys, { forward: false, back: false, left: false, right: false });
}

export function deactivateWalkControls() {
  active = false;
  releasePointerLock();
  Object.assign(keys, { forward: false, back: false, left: false, right: false });
}

// Called once per frame while AppState.mode === 'surface' and not in an XR
// session (see core/loop.js).
export function updateWalkControls(dt) {
  if (!active) return;
  const { camera, rig } = AppState;

  // Horizontal movement, flattened to the ground plane (this is walking, not
  // free flight — pitching the camera up/down must never tilt the direction
  // WASD moves you, unlike xr/locomotion.js's deliberately-unflattened flight).
  camera.getWorldQuaternion(_quat);
  _forward.set(0, 0, -1).applyQuaternion(_quat);
  _forward.y = 0;
  if (_forward.lengthSq() > 1e-8) _forward.normalize();
  _right.set(1, 0, 0).applyQuaternion(_quat);
  _right.y = 0;
  if (_right.lengthSq() > 1e-8) _right.normalize();

  _move.set(0, 0, 0);
  if (keys.forward) _move.add(_forward);
  if (keys.back) _move.sub(_forward);
  if (keys.right) _move.add(_right);
  if (keys.left) _move.sub(_right);

  if (_move.lengthSq() > 0) {
    _move.normalize().multiplyScalar(WALK_SPEED * dt);
    rig.position.add(_move);

    // Keep the player on the finite ground plane rather than walking out
    // past it into the fog with nothing underfoot.
    const r = Math.hypot(rig.position.x, rig.position.z);
    if (r > GROUND_CLAMP_RADIUS) {
      const scale = GROUND_CLAMP_RADIUS / r;
      rig.position.x *= scale;
      rig.position.z *= scale;
    }

    strideAccumulator += _move.length();
    if (strideAccumulator >= STRIDE_LENGTH) {
      strideAccumulator = 0;
      playFootstep(footstepStyle);
    }
  }

  // Gravity. rig.position.y is grounded (not falling) exactly when it has
  // settled at EYE_HEIGHT — the ground mesh sits at y=0, so eye height above
  // it is the resting value, same invariant VR's headset-driven walking
  // (Phase D) will also target.
  verticalVelocity -= BASE_GRAVITY * gravityMultiplier * dt;
  rig.position.y += verticalVelocity * dt;
  if (rig.position.y <= EYE_HEIGHT) {
    rig.position.y = EYE_HEIGHT;
    verticalVelocity = 0;
  }
}
