import { AppState } from "../core/state.js";
import { startTour, exitTour } from "../tour/tourMode.js";

// ---------- kiosk / presentation mode ----------
// Fullscreen, chrome hidden (style.css's body.kiosk rules), the Cosmic Tour
// auto-cycling forever — meant to be started once at a booth/demo and left
// running unattended, the actual thing that gets run DURING an institute
// pitch rather than just what students use afterward.
const KIOSK_CLASS = "kiosk";
let active = false;

function enterKiosk() {
  if (active) return;
  active = true;
  document.body.classList.add(KIOSK_CLASS);
  // Fullscreen can be refused (no user gesture in some contexts, an iframe
  // without the allow-fullscreen permission, etc.) — kiosk mode still
  // works windowed if so, just without the chrome, so this failure is
  // silently ignored rather than blocking anything.
  document.documentElement.requestFullscreen?.().catch(() => {});
  if (AppState.mode === "orbital") startTour("cosmic");
}

function exitKiosk() {
  if (!active) return;
  active = false;
  document.body.classList.remove(KIOSK_CLASS);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  exitTour(); // stop whatever's auto-playing and hand control back
}

export function initKioskMode() {
  document.getElementById("kioskModeBtn")?.addEventListener("click", enterKiosk);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) exitKiosk();
  });
  // A user exiting the BROWSER's fullscreen directly (its own Esc/F11
  // handling, outside this module's control) should also drop kiosk mode's
  // chrome-hiding — otherwise the UI would stay hidden in a normal window
  // with no way back short of a page reload.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && active) exitKiosk();
  });
}

export function isKioskActive() {
  return active;
}

// Called once per frame from the render loop. The Cosmic Tour gracefully
// exits itself at its last stop (tour/tourMode.js) — this is what turns
// that single pass into an unattended loop for as long as kiosk mode stays
// active, without tourMode.js itself needing any "loop forever" concept of
// its own (which the on-demand, single-use planet tour has no reason to want).
export function updateKioskMode() {
  if (active && AppState.mode === "orbital" && AppState.tourState === "idle") {
    startTour("cosmic");
  }
}
