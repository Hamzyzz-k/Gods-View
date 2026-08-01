import { speechSupported, startListening, stopListening, isListening, onStateChange } from "./speechRecognition.js";
import { runCommand, agentInput } from "../assistant/runCommand.js";
import { stopSpeaking } from "./tts.js";
import { AmbientAudio } from "../audio/ambientAudio.js";

// ---------- desktop mic button ----------
// Bonus per the brief: the same voice pipeline as VR push-to-talk, wired into
// the desktop chat panel too, not VR-exclusive. Click-to-toggle rather than
// press-and-hold — there's no physical "hold" gesture on a mouse click the
// way there is a controller button, so toggle is the natural desktop
// equivalent of push-to-talk.
const micBtn = document.getElementById("agentMicBtn");

if (!speechSupported) {
  // Firefox (and any other browser without SpeechRecognition) lands here.
  // Disabled with an explanatory title rather than hidden outright, so it's
  // clear the feature exists but isn't available here — and importantly,
  // never throws by trying to use an API that doesn't exist.
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser";
} else {
  micBtn.addEventListener("click", () => {
    if (isListening()) {
      stopListening();
      return;
    }
    stopSpeaking(); // don't let the assistant talk over the user
    AmbientAudio.duck(true);
    startListening((text) => {
      agentInput.value = text;
      runCommand(text);
    });
  });

  onStateChange((state) => {
    micBtn.classList.toggle("listening", state === "listening");
    if (state === "idle") AmbientAudio.duck(false);
  });
}
