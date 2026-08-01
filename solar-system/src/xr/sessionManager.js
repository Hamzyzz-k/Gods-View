import { VRButton } from "three/addons/webxr/VRButton.js";
import { AppState } from "../core/state.js";

// ---------- WebXR session lifecycle ----------
//
// Three separate things have to be true before VR is offered at all:
//   1. the browser exposes navigator.xr           (Chrome/Edge do, Firefox does not)
//   2. it reports immersive-vr as supported       (async — needs a headset or the emulator)
//   3. nothing throws while asking                (a half-installed emulator can)
//
// Every one of those is checked, because the requirement is a clean console on
// desktop Chrome and Firefox with no VR hardware present. A browser that
// cannot do VR should simply never see the button, rather than see one that
// fails when pressed.
//
// VRButton handles (1) and (2) itself and swaps its own label to
// "VR NOT SUPPORTED", so it is used rather than hand-rolling a button. The
// extra guards here exist for (3) and so we can avoid injecting a dead button
// into the DOM on browsers that could never use it.

let vrButtonEl = null;

// The desktop camera position/target from just before entering VR, restored
// on exit. Declared here rather than at the bottom so it reads in order.
let savedDesktopView = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkSupportOnce() {
  try {
    return await navigator.xr.isSessionSupported("immersive-vr");
  } catch {
    return false; // a half-injected emulator can throw rather than resolve false
  }
}

// Guards against initialising twice. Two sets of session handlers would both
// write savedDesktopView on sessionstart — the second overwriting the first
// with the already-zeroed camera position — and the desktop view would be
// restored to the origin on exit instead of where the user left it.
let initialised = false;

export async function initXR() {
  if (initialised) return true;
  const { renderer } = AppState;

  // Safe on every browser: three.js no-ops this where WebXR is absent, and it
  // must be set before setAnimationLoop for session frames to be delivered.
  renderer.xr.enabled = true;

  // Firefox and any non-secure context land here. Not an error — just no VR.
  if (!navigator.xr) {
    console.info("WebXR not available in this browser — desktop mode only.");
    return false;
  }

  if (await checkSupportOnce()) {
    activate();
    return true;
  }

  // Emulator extensions (IWER, the old WebXR API Emulator) inject their
  // navigator.xr shim as a content script, which can still be wiring itself
  // up at the exact moment this module's top-level code runs — a page-load
  // race, not a real "unsupported" answer. But retrying inline would delay
  // startup for every plain desktop browser too (the common case, and the one
  // that genuinely has no VR), so instead this returns the normal "no VR"
  // result immediately and keeps checking a few more times in the
  // background. If one of those later succeeds, the button appears on its
  // own with no reload needed; if not, nothing more happens.
  console.info("immersive-vr not supported here (yet) — desktop mode only.");
  retryInBackground();
  return false;
}

async function retryInBackground(attempts = 6, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    await sleep(delayMs);
    if (initialised) return; // a later real check already succeeded
    if (await checkSupportOnce()) {
      console.info("immersive-vr became available — enabling VR.");
      activate();
      return;
    }
  }
}

function activate() {
  // Belt-and-braces: initXR() and the background retry loop can both reach
  // here (e.g. initXR called again mid-retry). Only the first call should
  // ever create a button.
  if (initialised) return;
  const { renderer } = AppState;
  try {
    vrButtonEl = VRButton.createButton(renderer);
    vrButtonEl.id = "vrButton";
    document.body.appendChild(vrButtonEl);
  } catch (err) {
    console.warn("Could not create the VR button:", err);
    return;
  }
  registerSessionHandlers();
  initialised = true;
}

function registerSessionHandlers() {
  const { renderer, controls } = AppState;

  renderer.xr.addEventListener("sessionstart", () => {
    AppState.xrSession = true;

    // OrbitControls must stop: it writes camera.position every update, and in
    // a session the headset owns that. Leaving it enabled means the two fight
    // each other and the view judders.
    controls.enabled = false;

    // Remember where the desktop camera was so exiting VR can restore the
    // exact view the user left, rather than dumping them at the origin.
    savedDesktopView = {
      cameraPos: AppState.camera.position.clone(),
      target: controls.target.clone(),
    };

    // Start the player where the desktop camera was looking from, so entering
    // VR does not teleport them across the solar system. The camera's own
    // local offset is cleared because from here on the headset supplies it —
    // leaving (0,60,140) in place would add itself to every pose.
    AppState.rig.position.copy(AppState.camera.position);
    AppState.camera.position.set(0, 0, 0);

    console.info("XR session started.");
  });

  renderer.xr.addEventListener("sessionend", () => {
    AppState.xrSession = false;
    controls.enabled = true;

    // Put the desktop camera back exactly where it was before entering VR.
    // The alternative — leaving it wherever the player flew to — sounds
    // convenient but lands OrbitControls in a strange spot with its target
    // still on the old body, which reads as a bug.
    if (savedDesktopView) {
      AppState.camera.position.copy(savedDesktopView.cameraPos);
      controls.target.copy(savedDesktopView.target);
      savedDesktopView = null;
    }
    AppState.rig.position.set(0, 0, 0);
    AppState.rig.quaternion.identity();

    controls.update();
    console.info("XR session ended.");
  });
}
