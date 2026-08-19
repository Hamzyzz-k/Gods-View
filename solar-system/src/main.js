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

// Authorization gate. Everything below this line — the renderer, the scene,
// every data request — is held until the visitor is allowed in. Placed here
// rather than deeper so there is exactly one point to reason about: nothing
// that follows can run early by accident.
//
// Resolves immediately when this deployment has no Supabase configured (the
// site then behaves exactly as it did before auth existed) or when a valid
// session already exists. Otherwise it waits for the visitor to actually try
// to enter, shows the sign-in panel, and resolves once they're in. The landing
// page is a separate bundle loaded by its own script tag, so it renders and
// stays fully interactive throughout regardless of what happens here.
const { gateBeforeBoot, takePendingTier, initSignOut } = await import("./auth/authGate.js");
await gateBeforeBoot();

initScene();
createStarfield(AppState.scene);
AppState.constellations = createConstellations(AppState.scene);

// Landing page handoff: the landing page itself is a separate React bundle
// (landing-src/, see index.html) with no shared module state with this app,
// so it hands off via a plain DOM CustomEvent instead — fired once, when the
// user dismisses it, optionally naming a specific tier (the AccordionGallery
// panel they picked). Registered this early so it's live regardless of how
// long the rest of this file's own (awaited, sequential) boot takes — by the
// time a real user has scrolled through the landing page and clicked
// through, the app below is always long since finished booting anyway; the
// dynamic import + jumpToTierCinematic's own canChangeTier() guard make this
// safe even in the (practically unreachable) case it somehow isn't.
document.addEventListener("gv:enter-app", async (e) => {
  const tier = e.detail?.tier;
  if (!tier) return;
  const { jumpToTierCinematic } = await import("./cosmos/tierTransition.js");
  jumpToTierCinematic(tier);
});

// The reverse handoff: clicking the "God's View" title re-opens the
// landing page. The React bundle is only ever hidden on dismiss (display:
// none + a CSS opacity class), never unmounted, so this is a plain
// CustomEvent the other direction — landing-src/App.jsx listens for
// "gv:show-landing" and undoes exactly what its own dismiss handler did.
document.getElementById("godsViewTitle")?.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("gv:show-landing"));
});

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

// Surface Mode (desktop): wires walking controls to surfaceMode.js's
// enter/exit, and the Land/Exit buttons. Safe to init unconditionally —
// nothing here does anything until a planet is actually double-clicked.
const { initDesktopSurfaceUI } = await import("./surface/desktopSurfaceUI.js");
initDesktopSurfaceUI();

// Guided Tour (desktop): Start Tour button + tour bar wiring. Also safe
// unconditionally — inert until Start Tour is clicked.
const { initTourControls } = await import("./ui/tourControls.js");
initTourControls();

// Cosmic scale ladder: grabs the transition overlay element. Inert until a
// tier change is actually triggered.
const { initTierTransition } = await import("./cosmos/tierTransition.js");
initTierTransition();

// Cosmic scale ladder (desktop): the always-visible breadcrumb bar.
const { initScaleBreadcrumb } = await import("./ui/scaleBreadcrumb.js");
initScaleBreadcrumb();

// Cosmic scale ladder (desktop): scrolling out past a tier's zoom limit
// ascends to the next tier, alongside the breadcrumb's explicit +/- buttons.
const { initScrollZoomTier } = await import("./cosmos/scrollZoomTier.js");
initScrollZoomTier();

// Presentation/kiosk mode. Inert until the button is clicked.
const { initKioskMode } = await import("./ui/kioskMode.js");
initKioskMode();

// Trip log + quiz. Both inert until their buttons are clicked.
const { initTripLog } = await import("./edu/tripLog.js");
initTripLog();
const { initQuiz } = await import("./edu/quiz.js");
initQuiz();

// Size Compare: a scripted, full-scene-takeover sequence — flat grid
// comparisons, then escalating orbit-ring diagrams up to black-hole scale.
// Inert until its button is clicked.
const { initSizeCompareMode } = await import("./sizeCompare/sizeCompareMode.js");
initSizeCompareMode();

// Curiosity cards: poses a question on arriving at each new cosmic tier.
// Inert until a tier actually changes.
const { initCuriosityCards } = await import("./edu/curiosityCards.js");
initCuriosityCards();

// Earth landmark photospheres (desktop). Inert until Earth is focused and
// its Visit a Real Place button is clicked.
const { initDesktopLandmarkUI } = await import("./landmark/desktopLandmarkUI.js");
initDesktopLandmarkUI();

// Data feeds
await import("./data/spaceNews.js");

// Assistant + voice
await import("./assistant/localParser.js");
await import("./assistant/runCommand.js");
await import("./audio/ambientAudio.js");
await import("./voice/desktopMic.js");

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

// Surface Mode (VR): the gravity-based-walking counterpart to
// initDesktopSurfaceUI() above, and to initLocomotion() just above (which is
// the orbital free-flight scheme, not this one). Also safe unconditionally —
// see surface/surfaceMode.js's enter/exit hooks for how exactly one of the
// two locomotion schemes ends up active depending on xrSession.
const { initSurfaceLocomotion } = await import("./xr/surfaceLocomotion.js");
initSurfaceLocomotion();

// In-world panels + laser picking. Also safe with no VR support: everything
// they create just sits invisible (mesh.visible = false) until a session
// exists to show it in.
const { initVrControlPanel } = await import("./xr/vrControlPanel.js");
initVrControlPanel();
const { initVrInfoPanel } = await import("./xr/vrInfoPanel.js");
initVrInfoPanel();
const { initVrTourPanel } = await import("./xr/vrTourPanel.js");
initVrTourPanel();
const { initVrScalePanel } = await import("./xr/vrScalePanel.js");
initVrScalePanel();
const { initVrSizeComparePanel } = await import("./xr/vrSizeComparePanel.js");
initVrSizeComparePanel();
const { initVrLandmarkPanel } = await import("./xr/vrLandmarkPanel.js");
initVrLandmarkPanel();
const { initControllerRaycast } = await import("./xr/controllerRaycast.js");
initControllerRaycast();

// Voice push-to-talk, bound to controller squeeze — see xr/vrVoiceControl.js
// for why that button and not trigger/thumbstick. Same "inert without a
// session" safety as everything else above.
const { initVrVoiceIndicator } = await import("./xr/vrVoiceIndicator.js");
initVrVoiceIndicator();
const { initVrVoiceControl } = await import("./xr/vrVoiceControl.js");
initVrVoiceControl();

await import("./core/loop.js");

// Post-boot auth wiring. Done last, once the scene exists, so a sign-out
// triggered mid-session has something coherent to tear down.
await initSignOut();

// If the visitor picked a specific tier on the landing page and then had to
// sign in first, that choice was captured by the gate rather than lost. Honour
// it now that there is a scene to fly through.
const requestedTier = takePendingTier();
if (requestedTier) {
  const { jumpToTierCinematic } = await import("./cosmos/tierTransition.js");
  jumpToTierCinematic(requestedTier);
}
