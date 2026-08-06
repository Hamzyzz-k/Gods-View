import { AppState } from "../core/state.js";
import { enterSurface, exitSurface, addLocomotionHooks } from "./surfaceMode.js";
import { getSurfaceData } from "./surfaceData.js";
import {
  initWalkControls, activateWalkControls, deactivateWalkControls, requestPointerLock,
} from "./walkControls.js";
import { infoName } from "../ui/infoPanel.js";

const exitBtn = document.getElementById("exitSurfaceBtn");
const hint = document.getElementById("surfaceHint");
const landBtn = document.getElementById("landBtn");

export function initDesktopSurfaceUI() {
  initWalkControls();

  // Wires surfaceMode.js's generic enter/exit to this specific input scheme,
  // without surfaceMode.js needing to import walkControls.js directly — see
  // the comment on addLocomotionHooks() for why (avoids an import cycle the
  // same way surface/skyObjects.js's fix did in Phase B). Guarded to non-VR:
  // xr/surfaceLocomotion.js registers the VR counterpart of this same hook,
  // and pointer-lock / keyboard WASD have no meaning while a headset owns
  // the camera, so this half must stay out of the way during a session.
  addLocomotionHooks({
    onEnter: (cfg) => {
      if (AppState.xrSession) return;
      activateWalkControls(cfg);
      // Landing is only ever triggered from within a real user gesture right
      // now (double-click), so this lock() call is still inside that
      // gesture's call stack and succeeds immediately — no second click
      // needed. If a future entry point calls enterSurface() outside a
      // gesture (voice/chat commands, Phase G), the browser will silently
      // refuse this and the hint below — itself clickable — is the retry.
      requestPointerLock();
      exitBtn.classList.remove("hidden");
      hint.classList.remove("hidden");
    },
    onExit: () => {
      if (AppState.xrSession) return;
      deactivateWalkControls();
      exitBtn.classList.add("hidden");
      hint.classList.add("hidden");
    },
  });

  // Not desktop-exclusive: the VR control panel's Surface-Mode "Exit" icon
  // and the VR info panel's "Land on Surface" button both drive these SAME
  // DOM elements via .click() (see xr/vrControlPanel.js and
  // xr/vrInfoPanel.js's panel registrations) — one shared listener handles
  // both input paths, since AppState.focusedTarget is set identically by
  // desktop click-to-focus and VR laser-select-to-focus.
  exitBtn.addEventListener("click", exitSurface);
  hint.addEventListener("click", requestPointerLock);

  landBtn.addEventListener("click", () => {
    const name = AppState.focusedTarget?.name;
    if (name && getSurfaceData(name)) enterSurface(name);
  });

  // Toggles the Land button per whichever body is currently focused, mirroring
  // the exact "watch the DOM the desktop panel already updates, don't
  // duplicate the content-assembly logic" approach xr/vrInfoPanel.js uses for
  // its own content. Only planets in surface/surfaceData.js are landable —
  // the Sun, moons, and the ISS have no surface scene, so the button hides
  // for those rather than doing nothing when clicked.
  const syncLandButton = () => {
    const landable = !!getSurfaceData(infoName.textContent);
    landBtn.classList.toggle("hidden", !landable);
  };
  new MutationObserver(syncLandButton).observe(infoName, { childList: true, characterData: true, subtree: true });
  syncLandButton();
}
