import { AppState } from "../core/state.js";
import { showInfoFor, infoPanel, infoCredit, infoClose, infoReset } from "../ui/infoPanel.js";
import { stopSpeaking } from "../voice/tts.js";
import { AmbientAudio } from "../audio/ambientAudio.js";

// Focus state lives on AppState rather than as module-local variables because
// the frame loop reads it every tick, and the XR locomotion system needs to
// see and clear it too.
export function focusOnObject(obj) {
  AppState.focusedTarget = obj;
  // Zoom distance is derived from the mesh's own bounding sphere, so a small
  // moon and a gas giant both end up framed sensibly.
  obj.geometry.computeBoundingSphere();
  const r = obj.geometry.boundingSphere.radius;
  AppState.desiredZoomDistance = Math.max(r * 6, r + 4);
  showInfoFor(obj);
}

export function clearFocus() {
  AppState.focusedTarget = null;
  AppState.desiredZoomDistance = null;
  infoPanel.classList.remove("visible");
  infoCredit.textContent = "";
  stopSpeaking();
  AmbientAudio.stop();
}

infoClose.addEventListener("click", clearFocus);
infoReset.addEventListener("click", clearFocus);
