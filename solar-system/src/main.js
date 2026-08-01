// Entry point.
//
// Modules are imported *dynamically and in sequence* rather than with static
// `import` statements at the top. Static imports are hoisted and evaluated
// before any of this file's own code runs, which would mean scene modules
// evaluate before initScene() has created the renderer/scene. Awaiting each
// import in order reproduces the top-to-bottom execution the original
// single-file script relied on.
import { AppState } from "./core/state.js";
import { initScene } from "./core/sceneSetup.js";
import { createStarfield, createConstellations } from "./core/starfield.js";

initScene();
createStarfield(AppState.scene);
AppState.constellations = createConstellations(AppState.scene);

// Scene contents — order matters: the sun and planets must exist before
// anything that raycasts against them or registers them for visibility.
await import("./scene/sun.js");
await import("./scene/planetFactory.js");
await import("./scene/asteroidBelt.js");

// The scene registry indexes everything built above, and the desktop
// controls drive it, so it has to come first.
await import("./assistant/sceneRegistry.js");

// Interaction + UI
await import("./ui/infoPanel.js");
await import("./interaction/focus.js");
await import("./interaction/raycastPicking.js");
await import("./ui/desktopControls.js");
await import("./ui/eclipseCalendar.js");

// Data feeds
await import("./data/spaceNews.js");

// Assistant + voice
await import("./assistant/localParser.js");
await import("./assistant/runCommand.js");
await import("./audio/ambientAudio.js");

// Events + frame loop (must be last — the loop drives everything above)
await import("./scene/alignmentsAndEclipses.js");
await import("./core/resize.js");

// WebXR must be initialised BEFORE the loop starts: renderer.xr.enabled has to
// be true before setAnimationLoop is called, or session frames are never
// delivered. initXR resolves false (without throwing) on any browser that
// cannot do VR, in which case nothing else here changes.
const { initXR } = await import("./xr/sessionManager.js");
await initXR();

// Safe to call even when initXR found no VR support: getController() just
// returns an (unused) XRTargetRaySpace that never receives input without an
// active session, so this never needs its own support guard.
const { initLocomotion } = await import("./xr/locomotion.js");
initLocomotion();

// In-world panels + laser picking. Also safe with no VR support: everything
// they create just sits invisible (mesh.visible = false) until a session
// exists to show it in.
const { initVrControlPanel } = await import("./xr/vrControlPanel.js");
initVrControlPanel();
const { initVrInfoPanel } = await import("./xr/vrInfoPanel.js");
initVrInfoPanel();
const { initControllerRaycast } = await import("./xr/controllerRaycast.js");
initControllerRaycast();

await import("./core/loop.js");
