import { AppState } from "../core/state.js";
import { planets } from "../scene/planetFactory.js";
import { focusOnObject } from "../interaction/focus.js";

// ---------- Guided Tour ----------
// Mercury -> Pluto, no Sun stop (explicit decision). Reuses focusOnObject()
// for framing + info panel + narration rather than re-implementing any of
// that: showInfoFor() (ui/infoPanel.js), which focusOnObject already calls,
// already populates the panel AND calls speak() on the same text — so tour
// narration needed no new TTS code at all, just driving the same entry point
// the rest of the app already uses for "show me this body".
const ITINERARY = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

// Fixed dwell rather than waiting for narration to finish: predictable, works
// identically whether narration is muted, and avoids threading an end-of-
// speech callback through two different TTS engines (Web Speech vs
// ElevenLabs, voice/tts.js) that don't report completion the same way.
const DWELL_MS = 12000;

let dwellRemainingMs = 0;

function planetMesh(name) {
  return planets.find((p) => p.data.name === name)?.mesh || null;
}

function goToStop(index) {
  const mesh = planetMesh(ITINERARY[index]);
  if (!mesh) return;
  AppState.tourIndex = index;
  focusOnObject(mesh);
  dwellRemainingMs = DWELL_MS;
}

// Surface Mode has no orbital bodies to tour between, and entering it already
// force-ends any active tour (surface/surfaceMode.js) — starting one is
// symmetrically blocked so the two states can't fight over what the rig
// should be doing.
export function startTour() {
  if (AppState.mode !== "orbital") return false;
  AppState.tourState = "playing";
  goToStop(0);
  return true;
}

export function nextStop() {
  if (AppState.tourState === "idle") return;
  if (AppState.tourIndex + 1 >= ITINERARY.length) {
    exitTour(); // reached the end — a graceful stop, not an error
    return;
  }
  goToStop(AppState.tourIndex + 1);
  AppState.tourState = "playing"; // explicit skip also resumes from a pause
}

export function prevStop() {
  if (AppState.tourState === "idle" || AppState.tourIndex <= 0) return;
  goToStop(AppState.tourIndex - 1);
  AppState.tourState = "playing";
}

// For voice/chat ("jump to Saturn") and any future direct-selection UI.
// Case-insensitive since that's how the chat/voice commands elsewhere in
// this app already normalize target names (assistant/localParser.js).
export function jumpToPlanet(name) {
  const index = ITINERARY.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  if (index === -1) return false;
  AppState.tourState = "playing";
  goToStop(index);
  return true;
}

export function pauseTour() {
  if (AppState.tourState === "playing") AppState.tourState = "paused";
}

export function resumeTour() {
  if (AppState.tourState === "paused") AppState.tourState = "playing";
}

// Explicitly does NOT clear focus: "drop back into free-roam from wherever
// they are" (the brief's own wording) means staying exactly where the tour
// left the camera, not snapping back to a full overview.
export function exitTour() {
  AppState.tourState = "idle";
  AppState.tourIndex = -1;
}

export function getItinerary() {
  return ITINERARY;
}

// Called once per frame from the render loop.
export function updateTour(dt) {
  if (AppState.tourState !== "playing") return;
  dwellRemainingMs -= dt * 1000;
  if (dwellRemainingMs <= 0) nextStop();
}
