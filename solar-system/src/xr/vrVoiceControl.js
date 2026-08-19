import { AppState } from "../core/state.js";
import { speechSupported, startListening, stopListening } from "../voice/speechRecognition.js";
import { runCommand } from "../assistant/runCommand.js";
import { stopSpeaking } from "../voice/tts.js";
import { AmbientAudio } from "../audio/ambientAudio.js";
import { showListening, showHeard, hide as hideVoiceIndicator } from "./vrVoiceIndicator.js";
import { grabBody, releaseBody } from "./scaleGrab.js";

// ---------- VR push-to-talk ----------
// Bound to squeeze (grip), not trigger or either thumbstick: trigger already
// selects/focuses (Phase 8), both thumbsticks already handle locomotion
// (Phase 6), which leaves squeeze as the only standard input not already
// claimed. squeezestart/squeezeend are WebXR's semantic grip events — spec-
// defined and delivered the same way regardless of controller profile,
// unlike reading a specific gamepad.buttons[n] index, which varies by device
// and was never verified against what the emulator actually reports.
//
// Both controllers are bound identically (either hand works) rather than
// locking this to one, since nothing else in this app is hand-specific.
function onSqueezeStart(event) {
  // Squeeze does two jobs, told apart by what the laser is on at the moment
  // it fires: on a body it picks that body up (xr/scaleGrab.js), on empty
  // space it is push-to-talk. Rather than move voice to a worse binding —
  // there isn't one; trigger is select and both sticks are locomotion — the
  // grab claims the squeeze only when there is something to grab.
  // controllerRaycast.js has already written this frame's hover onto the
  // controller, so both features read one source of truth.
  const controller = event.target;
  const body = controller?.userData.hoveredBody;
  if (body && grabBody(controller, body)) return;

  if (!speechSupported) return; // Firefox has no SpeechRecognition; fail silent, not console-noisy
  stopSpeaking(); // don't let the assistant's own voice talk over the user
  AmbientAudio.duck(true);
  showListening();
  startListening((text) => {
    showHeard(text);
    runCommand(text); // identical pipeline to typed chat input and the desktop mic button — no separate logic path
  });
}

function onSqueezeEnd(event) {
  // If this squeeze was holding a body, releasing it drops the body and was
  // never a voice request, so it must not fall through to stopListening().
  if (releaseBody(event.target)) return;

  if (!speechSupported) return;
  stopListening();
  AmbientAudio.duck(false);
  hideVoiceIndicator(); // showHeard() will override this moments later if a transcript actually comes back
}

// Called once at startup. Safe even with no VR support or no controllers
// connected yet — these are just event listeners, inert until a real
// squeezestart ever fires, same reasoning as locomotion/controllerRaycast.
export function initVrVoiceControl() {
  const { renderer } = AppState;
  [renderer.xr.getController(0), renderer.xr.getController(1)].forEach((controller) => {
    controller.addEventListener("squeezestart", onSqueezeStart);
    controller.addEventListener("squeezeend", onSqueezeEnd);
  });
}
