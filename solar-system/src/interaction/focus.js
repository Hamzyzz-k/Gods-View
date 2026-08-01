import * as THREE from "three";
import { AppState } from "../core/state.js";
import { showInfoFor, infoPanel, infoCredit, infoClose, infoReset } from "../ui/infoPanel.js";
import { stopSpeaking } from "../voice/tts.js";
import { AmbientAudio } from "../audio/ambientAudio.js";

// How long the VR fly-to takes, and how close it parks the rig relative to
// the body's framing distance. Pulled out so the feel is easy to tune once
// there's a headset to try it on.
const VR_FLY_DURATION_MS = 1400;
const VR_PARK_DISTANCE_SCALE = 1.0;

// Scratch vectors, reused every frame. The focus update runs on every tick,
// so allocating fresh Vector3s here would produce steady garbage and the
// resulting GC pauses show up as stutter — far more noticeable in VR, where
// a dropped frame is felt rather than just seen.
const _worldPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _desired = new THREE.Vector3();

// The in-flight VR fly-to, or null. Module-local rather than on AppState
// because this file is its only writer.
let rigTween = null;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Focus state lives on AppState rather than as module-local variables because
// the frame loop reads it every tick, and the XR locomotion system needs to
// see and clear it too.
export function focusOnObject(obj) {
  AppState.focusedTarget = obj;
  // Zoom distance is derived from the mesh's own bounding sphere, so a small
  // moon and a gas giant both end up framed sensibly.
  obj.geometry.computeBoundingSphere();
  const r = obj.geometry.boundingSphere.radius;
  AppState.desiredZoomDistance = Math.max(r * 6, r + 4);
  showInfoFor(obj);

  if (AppState.xrSession) startVrFlyTo(obj);
}

export function clearFocus() {
  AppState.focusedTarget = null;
  AppState.desiredZoomDistance = null;
  rigTween = null;
  infoPanel.classList.remove("visible");
  infoCredit.textContent = "";
  stopSpeaking();
  AmbientAudio.stop();
}

// ---------- VR: one-shot fly-to ----------
// Desktop focus is a continuous lerp that keeps re-centring on the target for
// as long as it stays focused. That would be wrong in VR: free-flight has no
// orbit pivot to anchor to, so a permanent follow would fight the player's
// thumbstick every frame and feel broken. Instead the rig eases toward the
// body once and then hands control straight back.
function startVrFlyTo(obj) {
  const rig = AppState.rig;
  if (!rig) return;

  obj.getWorldPosition(_worldPos);
  // Approach from wherever the player already is, so the move reads as
  // "fly me over there" rather than teleporting to a fixed vantage point.
  _dir.subVectors(rig.position, _worldPos);
  if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1); // rig sitting exactly on the
  // body would make the direction undefined; any fixed axis will do.
  _dir.normalize();

  const park = AppState.desiredZoomDistance * VR_PARK_DISTANCE_SCALE;
  rigTween = {
    from: rig.position.clone(),
    to: _worldPos.clone().add(_dir.multiplyScalar(park)),
    startTime: performance.now(),
    duration: VR_FLY_DURATION_MS,
  };
}

function updateFocusVR() {
  if (!rigTween) return;
  const rig = AppState.rig;
  const t = Math.min(1, (performance.now() - rigTween.startTime) / rigTween.duration);
  rig.position.lerpVectors(rigTween.from, rigTween.to, easeInOutCubic(t));
  // Finished: drop the tween so locomotion has the rig back with no
  // lingering pull toward the target.
  if (t >= 1) rigTween = null;
}

// ---------- desktop: continuous follow ----------
// Unchanged in behaviour from before the rig existed. Writing camera.position
// is safe here precisely because this branch only ever runs outside an XR
// session, where the rig sits at identity and local space equals world space.
function updateFocusDesktop() {
  const { camera, controls, focusedTarget, desiredZoomDistance } = AppState;
  if (!focusedTarget) return;

  focusedTarget.getWorldPosition(_worldPos);
  controls.target.lerp(_worldPos, 0.08);

  if (desiredZoomDistance !== null) {
    // Keep the current viewing angle and only change the distance, so
    // focusing dollies in rather than swinging the camera around.
    _dir.subVectors(camera.position, controls.target).normalize();
    _desired.copy(_worldPos).add(_dir.multiplyScalar(desiredZoomDistance));
    camera.position.lerp(_desired, 0.05);
  }
}

// Called once per frame from the render loop.
export function updateFocus() {
  if (AppState.xrSession) {
    updateFocusVR();
    return;
  }
  updateFocusDesktop();
}

infoClose.addEventListener("click", clearFocus);
infoReset.addEventListener("click", clearFocus);
