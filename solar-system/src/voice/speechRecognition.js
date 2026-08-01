// ---------- speech-to-text (push-to-talk) ----------
// Thin wrapper around the Web Speech API's SpeechRecognition. Firefox does
// not implement it at all (only webkitSpeechRecognition-prefixed Chrome/Edge
// do), so every caller of this module must check `speechSupported` first and
// degrade the UI (disable the mic button, skip the VR squeeze binding)
// rather than let a missing constructor throw — that's what keeps the "zero
// console errors on Firefox" requirement true for this feature too.
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SpeechRecognitionCtor;

// Created lazily on first use rather than at module load: constructing a
// recognizer has a small cost and this module is imported unconditionally
// (desktop mic button + VR both pull it in), so browsers that never use
// voice at all shouldn't pay for one.
let recognition = null;
let listening = false;
let resultCallback = null;
// A Set, not a single callback: both the desktop mic button and the VR
// push-to-talk indicator listen for state changes independently, and
// recognition itself is a singleton — either one can trigger a "listening"
// state that the OTHER surface still needs to hear about to clear its own
// UI correctly (e.g. so the desktop mic button doesn't stay visually stuck
// mid-pulse if a VR squeeze was what actually ended the session).
const stateListeners = new Set();

function setState(state) {
  stateListeners.forEach((fn) => fn(state)); // 'listening' | 'idle' | 'error'
}

function ensureRecognition() {
  if (recognition) return recognition;
  recognition = new SpeechRecognitionCtor();
  // One utterance per push-to-talk press, not a running transcript — this
  // matches "hold to talk, release to send" rather than a dictation mode.
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.lang = navigator.language || "en-US";

  recognition.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();
    if (text) resultCallback?.(text);
  };
  recognition.onerror = (event) => {
    // "no-speech" and "aborted" fire on completely ordinary paths (released
    // the button before saying anything, or stopped it deliberately) — not
    // real errors, so only the genuinely unexpected ones are worth a log.
    if (event.error !== "no-speech" && event.error !== "aborted") {
      console.warn("Speech recognition error:", event.error);
    }
  };
  recognition.onend = () => {
    listening = false;
    setState("idle");
  };
  return recognition;
}

// onResult(text) fires once with the final transcript. Returns false (rather
// than throwing) if unsupported or if a session is already active, so
// callers can treat both as "did nothing" without their own try/catch.
export function startListening(onResult) {
  if (!speechSupported || listening) return false;
  resultCallback = onResult;
  try {
    ensureRecognition().start();
    listening = true;
    setState("listening");
    return true;
  } catch (err) {
    // Chrome throws InvalidStateError if start() is called in a state it
    // doesn't expect (e.g. a stray double-press) — not worth surfacing as an
    // error for a push-to-talk gesture.
    return false;
  }
}

export function stopListening() {
  if (!recognition || !listening) return;
  try {
    recognition.stop(); // triggers 'result' (if anything was heard) then 'end'
  } catch {
    // stop() on an already-stopping recognizer is a no-op in practice; swallow.
  }
}

export function isListening() {
  return listening;
}

// Registers a listener for 'listening'/'idle' state changes, used to drive UI
// (mic button pulsing, VR indicator). Multiple independent listeners are
// supported — see the stateListeners comment above for why that matters even
// though only one source is ever actually recording at a time.
export function onStateChange(fn) {
  stateListeners.add(fn);
}
