import { AppState } from "../core/state.js";
import { getSurfaceScene } from "./surfaceScene.js";
import { getSurfaceData } from "./surfaceData.js";
import { clearFocus } from "../interaction/focus.js";
import { startWind, stopWind } from "./windAudio.js";

export const EYE_HEIGHT = 1.7; // the height AppState.rig.position.y settles at when standing on a surface's ground plane (y=0)

// Saved just before entering a surface, restored on exit — the same
// "remember the exact desktop view, restore it exactly" pattern
// xr/sessionManager.js already uses for VR session enter/exit, and for the
// same reason: leaving OrbitControls' target stale after a scene swap reads
// as a bug (the camera would slew toward wherever it last pointed).
let savedOrbitalView = null;

// Wired by surface/desktopSurfaceUI.js and xr/vrSurfaceUI.js via
// addLocomotionHooks() rather than this module importing either directly —
// both would otherwise need to import surfaceMode.js AND be imported back by
// it, and one side of that cycle would see undefined exports depending on
// load order (the same class of bug caught in surface/skyObjects.js during
// Phase B). A list, not a single slot: desktop and VR both need to react to
// the same enter/exit, each doing something different (pointer-lock vs
// gamepad-driven walking, different UI), the same "every listener hears
// every state change, decides for itself whether it applies" pattern
// voice/speechRecognition.js already uses for the same kind of problem.
const enterHooks = [];
const exitHooks = [];
export function addLocomotionHooks({ onEnter, onExit }) {
  if (onEnter) enterHooks.push(onEnter);
  if (onExit) exitHooks.push(onExit);
}

export function enterSurface(planetName) {
  const cfg = getSurfaceData(planetName);
  if (!cfg) return false; // not a landable body (e.g. the Sun) — caller should not have offered this
  // A positive allowlist (only "orbital" may enter), not `=== "surface"`:
  // that negative form would let entry through from ANY future third mode
  // value (e.g. landmark/landmarkMode.js's own "landmark" — the exact same
  // desync class the tier comment below already guards against) as long as
  // it merely wasn't literally "surface". Landing genuinely only makes
  // sense starting from free-flight.
  if (AppState.mode !== "orbital") return false;
  // Blocked mid-cosmic-tier-transition (cosmos/tierTransition.js): its dolly
  // is actively driving camera.position and will reparent the rig again at
  // its own swap point regardless of what just happened here — landing
  // during that window would have the rig fought over by both systems.
  if (AppState.tierBusy) return false;
  // The 9 landable planets only exist as meshes in the solar-system tier
  // (cosmos/tierData.js). This module's own exitSurface() hardcodes
  // `scene.add(rig)` — always AppState.scene, the solar-system tier's
  // scene — as the return destination; entering from any other tier would
  // silently desync AppState.tier from where the rig actually ends up.
  // interaction/raycastPicking.js's double-click trigger already can't
  // reach this except from that tier (its own clickable set is tier-
  // scoped), but voice/chat ("land on Mars") calls this directly with no
  // such guard of its own, so the check belongs here, once, rather than at
  // every caller.
  if (AppState.tier !== "solarSystem") return false;

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

  startWind(cfg.windStyle, cfg.windSpeed);
  enterHooks.forEach((hook) => hook(cfg));
  return true;
}

export function exitSurface() {
  if (AppState.mode !== "surface") return false;
  const { camera, controls, rig, scene } = AppState;

  exitHooks.forEach((hook) => hook());
  stopWind();

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
