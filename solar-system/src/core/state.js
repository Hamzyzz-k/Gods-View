// Shared mutable application state.
//
// Every module imports this same object and reads/writes properties on it.
// A plain object (rather than `export let` bindings) is deliberate: the
// reference never changes, so there is no chance of a module capturing a
// stale copy, and the whole app state is inspectable in devtools with
// `console.log(AppState)`.
export const AppState = {
  // Three.js singletons, assigned once by core/sceneSetup.js
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  // Parent of the camera. Locomotion moves the rig, never the camera —
  // inside a WebXR session the headset owns camera position/rotation
  // outright, so the rig is the only thing we are allowed to move.
  rig: null,

  // Scene contents, populated during construction
  planets: [],
  allMoonMeshes: [],
  clickableMeshes: [],
  orbitLines: [],
  sun: null,
  asteroidBelt: null,
  constellations: null,

  // Simulation controls
  paused: false,
  speedMultiplier: 1,
  orbitLinesVisible: true,

  // Focus/camera targeting
  focusedTarget: null,
  desiredZoomDistance: 12,

  // True only while an immersive WebXR session is active. Guards every
  // XR-only system (locomotion, collision, in-world panels) so the desktop
  // path is completely untouched by them.
  xrSession: false,
};
