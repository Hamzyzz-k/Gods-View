import { AppState } from "../core/state.js";
import { startTour, nextStop, prevStop, pauseTour, resumeTour, exitTour, getItinerary } from "../tour/tourMode.js";

const startBtn = document.getElementById("startTourBtn");
const bar = document.getElementById("tourBar");
const prevBtn = document.getElementById("tourPrevBtn");
const playPauseBtn = document.getElementById("tourPlayPauseBtn");
const nextBtn = document.getElementById("tourNextBtn");
const exitBtn = document.getElementById("tourExitBtn");
const stopLabel = document.getElementById("tourStopLabel");
const ttsToggleBtn = document.getElementById("ttsToggleBtn");

export function initTourControls() {
  startBtn.addEventListener("click", startTour);
  prevBtn.addEventListener("click", prevStop);
  nextBtn.addEventListener("click", nextStop);
  exitBtn.addEventListener("click", exitTour);
  playPauseBtn.addEventListener("click", () => {
    if (AppState.tourState === "playing") pauseTour();
    else resumeTour();
  });
  // Narration mute reuses the existing #ttsToggleBtn (voice/tts.js already
  // owns muting/unmuting it) rather than a second mute flag of its own — one
  // source of truth for "is narration on", same reasoning
  // xr/vrControlPanel.js's own mute icon already follows for its buttons.
  // There's deliberately no separate tour-mute button here.
}

let lastShown = false;

// Called once per frame from the render loop, right alongside updateTour().
export function updateTourUI() {
  const active = AppState.tourState !== "idle";
  if (active !== lastShown) {
    lastShown = active;
    bar.classList.toggle("hidden", !active);
  }
  if (!active) return;

  playPauseBtn.textContent = AppState.tourState === "paused" ? "▶" : "⏸";
  playPauseBtn.title = AppState.tourState === "paused" ? "Resume tour" : "Pause tour";
  const itinerary = getItinerary();
  const name = itinerary[AppState.tourIndex] || "";
  stopLabel.textContent = name ? `${AppState.tourIndex + 1}/${itinerary.length} · ${name}` : "";
  prevBtn.disabled = AppState.tourIndex <= 0;
}
