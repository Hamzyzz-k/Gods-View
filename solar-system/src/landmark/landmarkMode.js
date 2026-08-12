import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { AppState } from "../core/state.js";
import { getLandmarkScene } from "./landmarkScene.js";
import { getLandmark, LANDMARK_DATA } from "./landmarkData.js";
import { clearFocus } from "../interaction/focus.js";

// ---------- Earth landmark photosphere mode ----------
// A third value for AppState.mode alongside 'orbital'/'surface' — standing
// inside a real 360° photo is neither free-flight nor gravity-walking, it's
// "look around from a fixed point," the closest thing to real Street View
// photosphere viewing. Deliberately reached only from the solar-system
// tier's Earth (the info panel's Land button's sibling), the same tier
// scope surface/surfaceMode.js already enforces for the same reason: the
// return destination is hardcoded to AppState.scene.
//
// No movement scheme of its own is needed: desktop gets pointer-lock
// mouse-look only (no WASD — there is nowhere to walk inside a single
// photosphere), and in VR the headset's own head tracking already rotates
// the view natively with no extra locomotion code required, the same way
// core/loop.js's `if (AppState.mode === "orbital") updateLocomotion(delta)`
// already skips free-flight for Surface Mode without Surface Mode needing
// its own VR-specific opt-out.
let savedView = null;
let currentLandmarkName = null;
let lookControls = null;

function ensureLookControls() {
  if (!lookControls) lookControls = new PointerLockControls(AppState.camera, AppState.renderer.domElement);
  return lookControls;
}

export function enterLandmark(name) {
  if (AppState.mode !== "orbital") return false;
  if (AppState.tierBusy) return false;
  const entry = getLandmark(name);
  if (!entry) return false;

  const { camera, controls, rig, scene } = AppState;
  savedView = { cameraPos: camera.position.clone(), target: controls.target.clone() };

  clearFocus();
  AppState.tourState = "idle";
  AppState.tourIndex = -1;

  const landmarkScene = getLandmarkScene(entry);
  landmarkScene.add(rig);
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);

  controls.enabled = false;
  AppState.mode = "landmark";
  currentLandmarkName = name;
  AppState.activeScene = landmarkScene;

  if (!AppState.xrSession) ensureLookControls().lock();
  return true;
}

export function exitLandmark() {
  if (AppState.mode !== "landmark") return false;
  const { camera, controls, rig, scene } = AppState;

  lookControls?.unlock();

  scene.add(rig);
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  if (savedView) {
    camera.position.copy(savedView.cameraPos);
    controls.target.copy(savedView.target);
    savedView = null;
  }
  controls.enabled = !AppState.xrSession;
  controls.update();

  AppState.mode = "orbital";
  currentLandmarkName = null;
  AppState.activeScene = scene;
  return true;
}

export function getLandmarkList() {
  return LANDMARK_DATA;
}

export function getCurrentLandmark() {
  return currentLandmarkName;
}
