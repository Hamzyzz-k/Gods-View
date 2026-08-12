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

  // ---------- Surface Mode ----------
  // 'orbital' | 'surface'. The orbital scene keeps existing and keeps
  // simulating in the background even while mode is 'surface' — see
  // core/loop.js, which renders `activeScene` rather than the module-eval-
  // time-captured `scene`. That is what makes returning to orbit seamless
  // (nothing to resync) at the cost of a render call that never shows up.
  mode: "orbital",
  // The THREE.Scene actually passed to renderer.render() each frame. Starts
  // equal to `scene`; core/sceneSetup.js sets this once at init.
  activeScene: null,
  // Planet name (lowercase) currently landed on, or null in orbital mode.
  surfacePlanet: null,

  // ---------- Guided Tour ----------
  // 'idle' | 'playing' | 'paused'. Entering Surface Mode always ends an
  // active tour (see surface/surfaceMode.js) rather than pausing it, per
  // an explicit product decision — a landed planet is a destination, not a
  // detour from the tour.
  tourState: "idle",
  tourIndex: -1,

  // ---------- Cosmic scale ladder ----------
  // An axis ORTHOGONAL to `mode` above, not a third value of it: `mode`
  // means "how do I move and interact" (fly vs. walk), `tier` means "how
  // far out am I" (solar system, Milky Way, ...). See cosmos/tierData.js
  // for the ordered ladder. Tier changes are only permitted while
  // mode === 'orbital' (see cosmos/tierNavigation.js's canChangeTier()).
  tier: "solarSystem",
  // True only during the cinematic dolly between tiers (cosmos/
  // tierTransition.js) — blocks starting a second transition mid-flight.
  tierBusy: false,
};
