import * as THREE from "three";
import { AppState } from "../core/state.js";
import { getMoveSpeed } from "../core/moveSpeed.js";
import { resolveAndApplyMovement } from "./collision.js";

// ---------- VR free-flight locomotion ----------
//
// This is space: no floor, no gravity, so movement is flight-sim style
// rather than walk-and-teleport. Left thumbstick moves the rig relative to
// where the player is looking (in full 3D — pushing forward while looking up
// flies you upward, which is what "free flight" means as opposed to a flat
// walking metaphor). Right thumbstick handles vertical move and turning.
//
// Tuning knobs, grouped here so they're easy to find and adjust once this can
// actually be tried on a headset:
const MOVE_SPEED = 18; // scene units/sec — Sun-to-Pluto is ~88 units, so this crosses the system in well under a minute
const VERTICAL_SPEED = 8; // slowed from 12 — felt too fast on the right stick
const TURN_SPEED_RAD_PER_SEC = 1.3; // ~75 deg/sec — slowed from 2.0 (~115 deg/sec), same complaint

// Smooth turn was the explicit choice over snap turn, despite the higher
// motion-sickness risk that comes with combining continuous turning and free
// 6DOF flight. This flag exists so that trade can be revisited in one line
// without touching any other logic if it doesn't feel good on a real headset.
const SNAP_TURN_MODE = false;
const SNAP_TURN_ANGLE_RAD = THREE.MathUtils.degToRad(30);
const SNAP_TURN_COOLDOWN_MS = 350; // debounce so a held-over stick doesn't spam snaps every frame

// Ignore small off-center readings so a controller at rest doesn't cause slow
// drift — real thumbsticks rarely report exactly (0,0) when released.
const STICK_DEADZONE = 0.15;

let leftController = null;
let rightController = null;
let lastSnapTime = 0;

// Scratch objects, reused every frame — see interaction/focus.js for why:
// per-frame allocation becomes steady GC pressure, and a GC pause reads as a
// dropped frame, which is far more noticeable in VR than on desktop.
const _camQuat = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
// Accumulates BOTH the left stick's horizontal move and the right stick's
// vertical move into one vector, because collision has to see them as a
// single intended translation for the frame — deflecting them separately
// would let you, say, get vertical push-back cancelled by a horizontal slide
// component that was resolved against a different pass entirely.
const _moveDelta = new THREE.Vector3();

// Called once at startup (from main.js, after the rig exists). Acquiring
// XRTargetRaySpace objects does not require an active session — they simply
// stay empty (no gamepad, no pose) until one starts. Handedness is only known
// once the underlying XRInputSource connects, which can happen at session
// start or mid-session if a controller is turned on late, hence the
// 'connected'/'disconnected' listeners rather than assuming index 0 is left.
export function initLocomotion() {
  const { renderer, rig } = AppState;

  const c0 = renderer.xr.getController(0);
  const c1 = renderer.xr.getController(1);

  [c0, c1].forEach((controller) => {
    controller.addEventListener("connected", (event) => {
      controller.userData.handedness = event.data.handedness;
      controller.userData.gamepad = event.data.gamepad;
      if (event.data.handedness === "left") leftController = controller;
      else if (event.data.handedness === "right") rightController = controller;
    });
    controller.addEventListener("disconnected", () => {
      if (controller === leftController) leftController = null;
      if (controller === rightController) rightController = null;
      controller.userData.handedness = null;
      controller.userData.gamepad = null;
    });
    // Parented to the rig, not the scene: the controller's world transform
    // must compose with rig movement so a laser pointer (Phase 8) drawn from
    // it points the right way after the player has flown somewhere.
    rig.add(controller);
  });
}

// xr-standard maps a thumbstick to the LAST two entries in gamepad.axes: most
// Quest-class controllers report 4 axes total (an unused touchpad pair first,
// then the thumbstick), but a controller with only a thumbstick may report
// just 2. Reading from the end rather than hardcoding indices 2/3 handles
// both without needing to special-case a specific controller profile — this
// still needs confirming against a real device once one is available, but it
// matches how the emulator's Stick X/Y panel behaves.
function readStickAxes(gamepad) {
  const axes = gamepad?.axes;
  if (!axes || axes.length < 2) return { x: 0, y: 0 };
  let x = axes[axes.length - 2];
  let y = axes[axes.length - 1];
  if (Math.abs(x) < STICK_DEADZONE) x = 0;
  if (Math.abs(y) < STICK_DEADZONE) y = 0;
  return { x, y };
}

// Called once per frame from the render loop, only while a session is active.
export function updateLocomotion(dt) {
  const { camera, rig } = AppState;
  _moveDelta.set(0, 0, 0);

  if (leftController?.userData.gamepad) {
    const { x, y } = readStickAxes(leftController.userData.gamepad);
    if (x !== 0 || y !== 0) {
      // Direction comes from the camera's actual world orientation (which the
      // headset supplies), not the rig's yaw alone — that's what makes
      // looking up and pushing forward fly you upward instead of just
      // sliding you along the horizontal plane.
      camera.getWorldQuaternion(_camQuat);
      _forward.set(0, 0, -1).applyQuaternion(_camQuat);
      _right.set(1, 0, 0).applyQuaternion(_camQuat);

      // Gamepad Y is negative when the stick is pushed forward/up — standard
      // joystick convention, flip here if a real controller reads backwards.
      // getMoveSpeed() scales every axis by the same player-set factor, so
      // the tuned relationship between forward, vertical and turn rates is
      // preserved rather than replaced. See core/moveSpeed.js.
      const move = MOVE_SPEED * getMoveSpeed();
      _moveDelta.addScaledVector(_forward, -y * move * dt).addScaledVector(_right, x * move * dt);
    }
  }

  if (rightController?.userData.gamepad) {
    const { x, y } = readStickAxes(rightController.userData.gamepad);

    if (y !== 0) {
      // Deliberately world-up rather than camera-relative: vertical movement
      // staying tied to gravity's usual "up" is far less disorienting than
      // having it swing around with head tilt. Folded into the same delta as
      // the horizontal move above so collision resolves both together.
      _moveDelta.y += -y * VERTICAL_SPEED * getMoveSpeed() * dt;
    }

    if (x !== 0) {
      // Turning rotates the rig directly rather than translating it, so it
      // never needs to go through collision at all.
      if (SNAP_TURN_MODE) {
        const now = performance.now();
        if (now - lastSnapTime > SNAP_TURN_COOLDOWN_MS) {
          rig.rotation.y -= Math.sign(x) * SNAP_TURN_ANGLE_RAD;
          lastSnapTime = now;
        }
      } else {
        rig.rotation.y -= x * TURN_SPEED_RAD_PER_SEC * getMoveSpeed() * dt;
      }
    }
  }

  if (_moveDelta.lengthSq() > 0) resolveAndApplyMovement(_moveDelta, dt);
}
