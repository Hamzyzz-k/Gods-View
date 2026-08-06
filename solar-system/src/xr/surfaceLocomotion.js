import * as THREE from "three";
import { AppState } from "../core/state.js";
import { EYE_HEIGHT, addLocomotionHooks } from "../surface/surfaceMode.js";
import { playFootstep } from "../surface/footsteps.js";

// ---------- VR surface walking ----------
// The VR equivalent of surface/walkControls.js: gravity-based walking rather
// than the free-flight xr/locomotion.js uses in the orbital scene. Left
// stick moves the rig, flattened to the horizontal plane (this is walking,
// not flying — looking up must not tilt the direction the stick moves you,
// unlike orbital free-flight's deliberately-unflattened forward vector).
// Right stick handles turning only; there is no manual vertical axis here —
// gravity is the only thing that ever touches rig.position.y, matching the
// brief's "gravity-based walking... not the free-flight movement used in
// open space".
//
// Kept entirely separate from xr/locomotion.js rather than branching inside
// it: the two movement models share almost nothing (full-3D-relative-to-view
// vs flattened-with-gravity, collision-routed vs ground-clamped), so forcing
// one function to do both would mean more conditionals than code.
const WALK_SPEED = 4.5; // matches surface/walkControls.js's desktop speed, so the two feel the same regardless of input scheme
const TURN_SPEED_RAD_PER_SEC = 1.3; // matches xr/locomotion.js's orbital turn rate, for consistency between the two VR locomotion modes
const BASE_GRAVITY = 9.8;
const GROUND_CLAMP_RADIUS = 180; // matches surface/walkControls.js — same ground plane, same 400-unit surfaceScene.js size
const STRIDE_LENGTH = 1.7;
const STICK_DEADZONE = 0.15;

let leftController = null;
let rightController = null;
let verticalVelocity = 0;
let strideAccumulator = 0;
let gravityMultiplier = 1;
let footstepStyle = "rocky";
let active = false;

const _camQuat = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

function readStickAxes(gamepad) {
  const axes = gamepad?.axes;
  if (!axes || axes.length < 2) return { x: 0, y: 0 };
  let x = axes[axes.length - 2];
  let y = axes[axes.length - 1];
  if (Math.abs(x) < STICK_DEADZONE) x = 0;
  if (Math.abs(y) < STICK_DEADZONE) y = 0;
  return { x, y };
}

// Called once at startup. Deliberately does NOT re-parent the controllers
// under the rig — xr/locomotion.js's initLocomotion() already did that once
// at startup, and these are the same cached XRTargetRaySpace objects (three.js
// returns the same instance per index every time), so a second reparent here
// would just be redundant. This only needs its own 'connected'/'disconnected'
// listeners to track gamepad state — the same "each XR subsystem listens for
// what it needs independently" pattern xr/controllerRaycast.js's selectstart
// listener already follows on these same controllers.
export function initSurfaceLocomotion() {
  const { renderer } = AppState;
  [renderer.xr.getController(0), renderer.xr.getController(1)].forEach((controller) => {
    controller.addEventListener("connected", (event) => {
      if (event.data.handedness === "left") leftController = controller;
      else if (event.data.handedness === "right") rightController = controller;
    });
    controller.addEventListener("disconnected", () => {
      if (controller === leftController) leftController = null;
      if (controller === rightController) rightController = null;
    });
  });

  // The VR counterpart of surface/desktopSurfaceUI.js's own hook
  // registration — guarded the opposite way (only acts DURING a session),
  // so landing on a planet correctly activates exactly one of the two
  // locomotion schemes depending on how the player is actually playing right
  // now, never both.
  addLocomotionHooks({
    onEnter: (cfg) => {
      if (!AppState.xrSession) return;
      activateSurfaceLocomotion(cfg);
    },
    onExit: () => {
      if (!AppState.xrSession) return;
      deactivateSurfaceLocomotion();
    },
  });
}

// cfg is a surfaceData.js entry, same as surface/walkControls.js's activate.
export function activateSurfaceLocomotion(cfg) {
  active = true;
  verticalVelocity = 0;
  strideAccumulator = 0;
  gravityMultiplier = cfg.gravity;
  footstepStyle = cfg.footstepStyle;
}

export function deactivateSurfaceLocomotion() {
  active = false;
}

// Called once per frame while AppState.mode === 'surface' and AppState.xrSession is true.
export function updateSurfaceLocomotion(dt) {
  if (!active) return;
  const { camera, rig } = AppState;

  if (leftController?.userData?.gamepad) {
    const { x, y } = readStickAxes(leftController.userData.gamepad);
    if (x !== 0 || y !== 0) {
      camera.getWorldQuaternion(_camQuat);
      _forward.set(0, 0, -1).applyQuaternion(_camQuat);
      _forward.y = 0;
      if (_forward.lengthSq() > 1e-8) _forward.normalize();
      _right.set(1, 0, 0).applyQuaternion(_camQuat);
      _right.y = 0;
      if (_right.lengthSq() > 1e-8) _right.normalize();

      _move.set(0, 0, 0).addScaledVector(_forward, -y * WALK_SPEED * dt).addScaledVector(_right, x * WALK_SPEED * dt);
      rig.position.add(_move);

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
  }

  if (rightController?.userData?.gamepad) {
    const { x } = readStickAxes(rightController.userData.gamepad);
    if (x !== 0) rig.rotation.y -= x * TURN_SPEED_RAD_PER_SEC * dt;
  }

  verticalVelocity -= BASE_GRAVITY * gravityMultiplier * dt;
  rig.position.y += verticalVelocity * dt;
  if (rig.position.y <= EYE_HEIGHT) {
    rig.position.y = EYE_HEIGHT;
    verticalVelocity = 0;
  }
}
