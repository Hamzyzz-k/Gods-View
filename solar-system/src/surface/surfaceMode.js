import { AppState } from "../core/state.js";
import { getSurfaceScene } from "./surfaceScene.js";
import { getSurfaceData } from "./surfaceData.js";
import { clearFocus } from "../interaction/focus.js";

export const EYE_HEIGHT = 1.7; // the height AppState.rig.position.y settles at when standing on a surface's ground plane (y=0)

// Saved just before entering a surface, restored on exit — the same
// "remember the exact desktop view, restore it exactly" pattern
// xr/sessionManager.js already uses for VR session enter/exit, and for the
// same reason: leaving OrbitControls' target stale after a scene swap reads
// as a bug (the camera would slew toward wherever it last pointed).
let savedOrbitalView = null;

// Wired by surface/walkControls.js (desktop) and xr/surfaceLocomotion.js (VR,
// added when VR surface support lands) via setLocomotionHooks() rather than
// this module importing either directly — both would otherwise need to
// import surfaceMode.js AND be imported back by it, and one side of that
// cycle would see undefined exports depending on load order (the same class
// of bug caught in surface/skyObjects.js during Phase B).
let onEnterHook = null;
let onExitHook = null;
export function setLocomotionHooks({ onEnter, onExit }) {
  onEnterHook = onEnter;
  onExitHook = onExit;
}

export function enterSurface(planetName) {
  const cfg = getSurfaceData(planetName);
  if (!cfg) return false; // not a landable body (e.g. the Sun) — caller should not have offered this
  if (AppState.mode === "surface") return false; // already on a surface; land()ing again is a no-op, not a re-entry

  const { camera, controls, rig, scene } = AppState;
  savedOrbitalView = { cameraPos: camera.position.clone(), target: controls.target.clone() };

  clearFocus(); // drop the orbital focus/info-panel state — Surface Mode has its own info panel content
  AppState.tourState = "idle"; // entering a surface always ends an active tour (explicit product decision, not a pause)
  AppState.tourIndex = -1;

  const surfaceScene = getSurfaceScene(planetName);
  surfaceScene.add(rig); // reparenting: Object3D.add() removes it from `scene` automatically
  rig.position.set(0, EYE_HEIGHT, 0);
  rig.rotation.set(0, 0, 0);
  camera.position.set(0, 0, 0); // from here on the rig's Y IS eye height; the camera carries no offset of its own
  camera.rotation.set(0, 0, 0);

  controls.enabled = false; // OrbitControls has no place on a surface — this is first-person, not an external orbit view
  AppState.mode = "surface";
  AppState.surfacePlanet = planetName;
  AppState.activeScene = surfaceScene;

  onEnterHook?.(cfg);
  return true;
}

export function exitSurface() {
  if (AppState.mode !== "surface") return false;
  const { camera, controls, rig, scene } = AppState;

  onExitHook?.();

  scene.add(rig); // back into the orbital scene
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  if (savedOrbitalView) {
    camera.position.copy(savedOrbitalView.cameraPos);
    controls.target.copy(savedOrbitalView.target);
    savedOrbitalView = null;
  }
  // Not unconditionally true: if this exit happens mid-VR-session (Phase D
  // adds VR surface entry/exit), OrbitControls must stay disabled for the
  // rest of the session — xr/sessionManager.js owns that flag for the
  // session's whole lifetime, and re-enabling it here would fight it the
  // next time locomotion runs.
  controls.enabled = !AppState.xrSession;
  controls.update();

  AppState.mode = "orbital";
  AppState.surfacePlanet = null;
  AppState.activeScene = scene;
  return true;
}
