import { AppState } from "../core/state.js";
import { focusOnObject, clearFocus } from "../interaction/focus.js";
import { jumpToTierCinematic, isTierTransitioning } from "../cosmos/tierTransition.js";

// ---------- Guided Tour ----------
// Two itineraries sharing one state machine: the original Mercury -> Pluto
// planet tour (unchanged behavior, no Sun stop — explicit decision), and a
// new Cosmic Tour that rides the scale ladder itself (cosmos/tierData.js)
// out to the observable universe. A stop is { tier, target, label }:
// `target` is a mesh name to focus once arrived (getObjectByName() against
// whatever the active scene is by then — works identically for a planet or
// a galaxy, since both carry mesh.name per their own data files' info-
// panel contract), or null for a stop that's just "look at this tier's own
// overview, nothing specific."
const PLANET_ITINERARY = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
  .map((name) => ({ tier: "solarSystem", target: name, label: name }));

const COSMIC_ITINERARY = [
  { tier: "solarSystem", target: "Earth", label: "Earth" },
  { tier: "solarSystem", target: null, label: "The Edge of the Solar System" },
  { tier: "milkyWay", target: "Sagittarius A*", label: "The Milky Way" },
  { tier: "localGroup", target: "Andromeda Galaxy", label: "The Local Group" },
  { tier: "supercluster", target: "Virgo Cluster", label: "The Local Supercluster" },
  { tier: "observableUniverse", target: null, label: "The Observable Universe" },
];

const ITINERARIES = { planets: PLANET_ITINERARY, cosmic: COSMIC_ITINERARY };
let currentItineraryName = "planets";

// Fixed dwell rather than waiting for narration to finish: predictable, works
// identically whether narration is muted, and avoids threading an end-of-
// speech callback through two different TTS engines (Web Speech vs
// ElevenLabs, voice/tts.js) that don't report completion the same way.
const DWELL_MS = 12000;

let dwellRemainingMs = 0;
// Set while waiting for a cross-tier stop's cinematic transition to finish
// (cosmos/tierTransition.js is async — a stop that changes tier can't be
// "arrived at" the same frame it's requested). Cleared, and the stop's own
// focus/dwell applied, once the transition completes.
let pendingStop = null;

function currentItinerary() {
  return ITINERARIES[currentItineraryName];
}

function arriveAtStop(stop) {
  if (stop.target) {
    const obj = AppState.activeScene.getObjectByName(stop.target);
    if (obj) focusOnObject(obj);
    else clearFocus(); // target not found in the scene it should be in — fail visible-but-safe rather than throw
  } else {
    clearFocus();
  }
  dwellRemainingMs = DWELL_MS;
}

function goToStop(index) {
  const stop = currentItinerary()[index];
  if (!stop) return;
  AppState.tourIndex = index;
  dwellRemainingMs = 0; // don't start dwelling until actually arrived — see updateTour()

  if (AppState.tier !== stop.tier) {
    pendingStop = stop;
    jumpToTierCinematic(stop.tier); // async; updateTour() below finishes the job once the dolly completes
  } else {
    pendingStop = null;
    arriveAtStop(stop);
  }
}

// Surface Mode has no orbital bodies to tour between, and entering it already
// force-ends any active tour (surface/surfaceMode.js) — starting one is
// symmetrically blocked so the two states can't fight over what the rig
// should be doing. No longer requires tier === 'solarSystem': goToStop()
// above now navigates to whatever tier the first stop needs on its own,
// for either itinerary.
export function startTour(itineraryName = "planets") {
  if (AppState.mode !== "orbital") return false;
  if (!ITINERARIES[itineraryName]) return false;
  currentItineraryName = itineraryName;
  AppState.tourState = "playing";
  goToStop(0);
  return true;
}

// Both guard on `pendingStop`: while a cross-tier stop's transition is
// still resolving, a second goToStop() would call jumpToTierCinematic()
// again, which cosmos/tierTransition.js correctly refuses (a transition is
// already in flight) — but pendingStop would then be overwritten to point
// at a stop whose tier was never actually entered, so once the FIRST
// (still-running) transition eventually finishes, updateTour() would apply
// the wrong stop's focus/index against the wrong tier's scene. Simplest
// correct fix: ignore Next/Prev presses entirely during that narrow window,
// the same "ignore input while busy" shape AppState.tierBusy already
// enforces for tier navigation generally.
export function nextStop() {
  if (AppState.tourState === "idle" || pendingStop) return;
  if (AppState.tourIndex + 1 >= currentItinerary().length) {
    exitTour(); // reached the end — a graceful stop, not an error
    return;
  }
  goToStop(AppState.tourIndex + 1);
  AppState.tourState = "playing"; // explicit skip also resumes from a pause
}

export function prevStop() {
  if (AppState.tourState === "idle" || AppState.tourIndex <= 0 || pendingStop) return;
  goToStop(AppState.tourIndex - 1);
  AppState.tourState = "playing";
}

// For voice/chat ("jump to Saturn") and any future direct-selection UI.
// Case-insensitive since that's how the chat/voice commands elsewhere in
// this app already normalize target names (assistant/localParser.js).
// Searches the CURRENTLY ACTIVE itinerary's named stops — works for a
// galaxy name too when the Cosmic Tour is running, not just planets.
export function jumpToPlanet(name) {
  if (pendingStop) return false; // see nextStop()/prevStop() — same reasoning
  const index = currentItinerary().findIndex((s) => s.target && s.target.toLowerCase() === name.toLowerCase());
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
  pendingStop = null;
}

export function getItinerary() {
  return currentItinerary();
}

export function getItineraryName() {
  return currentItineraryName;
}

// Called once per frame from the render loop.
export function updateTour(dt) {
  if (AppState.tourState !== "playing") return;

  if (pendingStop) {
    if (isTierTransitioning()) return; // still en route — nothing to do until the dolly finishes
    const stop = pendingStop;
    pendingStop = null;
    arriveAtStop(stop);
    return; // just arrived this frame; don't also burn dwell time on it
  }

  dwellRemainingMs -= dt * 1000;
  if (dwellRemainingMs <= 0) nextStop();
}
