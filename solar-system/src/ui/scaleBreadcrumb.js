import { AppState } from "../core/state.js";
import { getTierLadder } from "../cosmos/tierNavigation.js";
import { ascendTierCinematic, descendTierCinematic, jumpToTierCinematic } from "../cosmos/tierTransition.js";

// ---------- cosmic scale ladder breadcrumb ----------
// Always visible (unlike #tourBar, which only shows during an active tour)
// except while walking on a planet's surface, where tier navigation has no
// meaning. Segments are built once from cosmos/tierData.js's ordered
// ladder rather than hardcoded in index.html, so later phases can add more
// tiers (Local Group, Supercluster, ...) without touching this file or the
// markup — the same "data drives the UI" precedent ui/tourControls.js
// already sets for the tour bar's stop label.
const breadcrumb = document.getElementById("scaleBreadcrumb");
const segmentsEl = document.getElementById("scaleBreadcrumbSegments");
const descendBtn = document.getElementById("tierDescendBtn");
const ascendBtn = document.getElementById("tierAscendBtn");

export function initScaleBreadcrumb() {
  descendBtn.addEventListener("click", descendTierCinematic);
  ascendBtn.addEventListener("click", ascendTierCinematic);

  getTierLadder().forEach((tier, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "›";
      segmentsEl.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.id = `tierSegmentBtn_${tier.id}`;
    btn.textContent = tier.label;
    btn.dataset.tierId = tier.id;
    // A direct jump, not forced to step through every tier in between —
    // jumpToTierCinematic() still plays the same dolly/fade regardless of
    // how many rungs of the ladder it's skipping.
    btn.addEventListener("click", () => jumpToTierCinematic(tier.id));
    segmentsEl.appendChild(btn);
  });
}

let lastHidden = null;
let lastBusy = null;
let lastTier = null;

// Called once per frame from core/loop.js, same per-frame DOM-sync pattern
// ui/tourControls.js's updateTourUI() already uses — memoized so
// classList.toggle only runs on an actual change, not every frame.
export function updateScaleBreadcrumb() {
  const hidden = AppState.mode === "surface";
  if (hidden !== lastHidden) {
    lastHidden = hidden;
    breadcrumb.classList.toggle("hidden", hidden);
  }

  if (AppState.tierBusy !== lastBusy) {
    lastBusy = AppState.tierBusy;
    breadcrumb.classList.toggle("busy", AppState.tierBusy);
  }

  if (AppState.tier !== lastTier) {
    lastTier = AppState.tier;
    segmentsEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tierId === AppState.tier);
    });

    const ladder = getTierLadder();
    const idx = ladder.findIndex((t) => t.id === AppState.tier);
    descendBtn.disabled = idx <= 0;
    ascendBtn.disabled = idx === -1 || idx + 1 >= ladder.length;
  }
}
