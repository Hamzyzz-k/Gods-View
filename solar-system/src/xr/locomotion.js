import * as THREE from "three";
import { AppState } from "../core/state.js";
import { getMoveSpeed } from "../core/moveSpeed.js";
import { getTierById } from "../cosmos/tierData.js";
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

// ---------- scale movement to the tier ----------
// MOVE_SPEED is tuned for the solar system, where Sun-to-Pluto is about 88
// units. Every outer tier is orders of magnitude larger and was using the
// same number: inside the Big Bang, whose shell is 9,000 units across, full
// stick at 1x covered it in 500 seconds. Movement technically worked, but at
// that rate nothing visibly changes, which reads as being unable to move at
// all rather than as moving slowly.
//
// The factor comes from each tier's own controlsMax — the zoom ceiling it
// already declares, which is the closest thing the data has to "how big is
// this place". Deriving it means a tier added later is correct without anyone
// remembering to tune a second constant.
//
// TURNING IS DELIBERATELY NOT SCALED. Rotation is angular: 75 degrees per
// second is right whether you are beside a moon or inside a forming universe,
// and multiplying it by 27 would make the Big Bang tier unusable, not faster.
const BASE_CONTROLS_MAX = 800; // the solar system tier's own value

function tierMoveScale() {
  const tier = getTierById(AppState.tier);
  if (!tier?.controlsMax) return 1;
  return Math.max(1, tier.controlsMax / BASE_CONTROLS_MAX);
}

// ---------- hand tracking ----------
// Hands report no gamepad, so the thumbstick scheme above simply has nothing
// to read and free-flight would be dead on a headset running hand tracking.
// The replacement is direct manipulation: pinch on empty space and move your
// hand, and the rig moves the opposite way, as though you had taken hold of
// the world and pulled it past you. Chosen over a "point and pinch to glide"
// scheme because it is self-explanatory without instruction — which is the
// stated reason for wanting hand tracking at all (younger users, classroom
// demos, nobody learning a gamepad first).
//
// HAND_DRAG_GAIN turns a hand movement of a few centimetres into useful
// travel. It is multiplied by the shared flight-speed setting as well, so the
// same SLOW/FAST control covers both input methods rather than hands needing
// their own.
const HAND_DRAG_GAIN = 26;
const _dragNow = new THREE.Vector3();
const _dragDelta = new THREE.Vector3();

export function isHandTrackingActive() {
  return !!(leftController?.userData.isHand || rightController?.userData.isHand);
}

// Accumulates this frame's grab-drag from either hand into `out`. Both hands
// may drag at once; their contributions sum, which makes a two-handed pull
// simply twice as strong rather than a special gesture with its own rules.
function updateHandDrag(out, dt) {
  for (const controller of [leftController, rightController]) {
    if (!controller?.userData.dragging || !controller.userData.dragPrev) continue;
    controller.getWorldPosition(_dragNow);
    _dragDelta.subVectors(controller.userData.dragPrev, _dragNow); // reversed: the WORLD moves with the hand, so the rig moves against it
    controller.userData.dragPrev.copy(_dragNow);
    // dt-independent by construction: this is a positional delta already, not
    // a velocity, so scaling it by dt would make the same hand movement travel
    // different distances at different frame rates.
    out.addScaledVector(_dragDelta, HAND_DRAG_GAIN * getMoveSpeed() * tierMoveScale());
  }
}

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
      // XRInputSource.hand is present only for a tracked HAND rather than a
      // held controller. Both arrive through this same event and both drive
      // the same XRTargetRaySpace, which is why hand input needs no parallel
      // system for pointing: three.js's getController(i) already carries the
      // hand's aim ray, and a pinch already fires the same selectstart the
      // trigger does (xr/controllerRaycast.js). Only locomotion differs, so
      // only locomotion is special-cased — see updateHandDrag() below.
      controller.userData.isHand = !!event.data.hand;
      if (event.data.handedness === "left") leftController = controller;
      else if (event.data.handedness === "right") rightController = controller;
    });
    controller.addEventListener("disconnected", () => {
      if (controller === leftController) leftController = null;
      if (controller === rightController) rightController = null;
      controller.userData.handedness = null;
      controller.userData.gamepad = null;
      controller.userData.isHand = false;
      controller.userData.dragging = false;
    });

    // Pinch-to-drag, hands only. A pinch that starts while the laser is over
    // a panel button or a body is a SELECT and must stay one — that is how
    // every control in VR is operated. A pinch that starts pointing at
    // nothing has no other meaning, so it becomes a grab on space itself:
    // close, pull, and the universe comes with you. controllerRaycast.js has
    // already written this frame's hover state onto the same controller, so
    // the two readings can't disagree.
    controller.addEventListener("selectstart", () => {
      if (!controller.userData.isHand) return;
      if (controller.userData.hoveredButton || controller.userData.hoveredBody) return;
      controller.userData.dragging = true;
      // Per-controller, not a shared scratch vector: both hands can be
      // dragging at once, and a shared "previous position" would have each
      // hand reading the other's last frame and yanking the rig sideways.
      controller.userData.dragPrev = controller.getWorldPosition(new THREE.Vector3());
    });
    controller.addEventListener("selectend", () => {
      controller.userData.dragging = false;
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
      const move = MOVE_SPEED * getMoveSpeed() * tierMoveScale();
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
      _moveDelta.y += -y * VERTICAL_SPEED * getMoveSpeed() * tierMoveScale() * dt;
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

  // Hand pinch-drag folds into the SAME delta the thumbsticks write to, so it
  // goes through the same collision resolution below rather than teleporting
  // the rig through a planet. A headset with one controller and one tracked
  // hand therefore works too: each contributes whatever it can.
  updateHandDrag(_moveDelta, dt);

  if (_moveDelta.lengthSq() === 0) return;

  // Collision is only meaningful in the solar system: xr/collision.js builds
  // its collider list from the Sun, planets and moons, and nothing else in the
  // app is in it. Running it elsewhere achieved nothing except cost -- and,
  // once tier scaling above made movement fast, actively capped it: the
  // anti-tunneling substep limit trims any frame asking for more than about
  // 8 units, which at Big Bang speeds is most of them. Skipping it outside
  // the tier it protects is both correct and what lets the outer tiers move
  // at their own scale.
  if (AppState.tier === "solarSystem") resolveAndApplyMovement(_moveDelta, dt);
  else rig.position.add(_moveDelta);
}
