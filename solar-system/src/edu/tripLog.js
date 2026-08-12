import { AppState } from "../core/state.js";
import { getTierById } from "../cosmos/tierData.js";

// ---------- trip log ----------
// A lightweight record of everywhere the player has focused, across every
// tier — the "edutainment" trace of a session ("you've visited Mars, the
// Whirlpool Galaxy, and 8 other places today"). localStorage + a versioned
// key + everything wrapped in try/catch that degrades to a no-op, the same
// pattern data/spaceNews.js and data/bodyFacts.js already establish for
// this app's other localStorage use.
const TRIP_LOG_KEY = "gods-view-trip-log-v1";
const MAX_ENTRIES = 200;

function loadEntries() {
  try {
    const raw = localStorage.getItem(TRIP_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(TRIP_LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // storage full/disabled — fine, it's only a log
  }
}

let entries = loadEntries();
let lastRecordedName = null;

export function recordVisit(name, tierId) {
  if (!name || name === lastRecordedName) return; // collapse repeats (refocusing the same body, or a stale frame) into one entry
  lastRecordedName = name;
  entries.push({ name, tierLabel: getTierById(tierId)?.label || tierId, timestamp: Date.now() });
  saveEntries();
}

export function getTripLog() {
  return entries;
}

export function clearTripLog() {
  entries = [];
  lastRecordedName = null;
  saveEntries();
}

// Called once per frame from core/loop.js. Deliberately observes
// AppState.focusedTarget rather than requiring interaction/focus.js or
// tour/tourMode.js to import and call this directly — the same "watch
// shared state, don't couple modules" pattern the VR panels' own
// MutationObservers already use elsewhere in this app, so a body focused
// via desktop click, voice, the tour, or a VR laser is all recorded through
// the one place that already knows about every one of those paths.
export function updateTripLog() {
  if (AppState.focusedTarget) recordVisit(AppState.focusedTarget.name, AppState.tier);
}

// ---------- trip log panel (reuses #eclipseCalModal's exact CSS classes) ----------
const modal = document.getElementById("tripLogModal");
const body = document.getElementById("tripLogBody");
const openBtn = document.getElementById("tripLogBtn");
const closeBtn = document.getElementById("tripLogClose");
const backdrop = document.getElementById("tripLogBackdrop");
const clearBtn = document.getElementById("tripLogClearBtn");

function renderTripLog() {
  if (!body) return;
  if (entries.length === 0) {
    body.innerHTML = `<div class="eclipse-row-body">Nothing logged yet — focus on a planet, moon, or galaxy to start your trip log.</div>`;
    return;
  }
  // Most recent first.
  body.innerHTML = entries
    .slice()
    .reverse()
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `<div class="eclipse-row">
        <div class="eclipse-row-head"><strong>${e.name}</strong> — ${e.tierLabel}</div>
        <div class="eclipse-row-body">${time}</div>
      </div>`;
    })
    .join("");
}

export function initTripLog() {
  openBtn?.addEventListener("click", () => {
    renderTripLog();
    modal?.classList.add("visible");
  });
  closeBtn?.addEventListener("click", () => modal?.classList.remove("visible"));
  backdrop?.addEventListener("click", () => modal?.classList.remove("visible"));
  clearBtn?.addEventListener("click", () => {
    clearTripLog();
    renderTripLog();
  });
}
