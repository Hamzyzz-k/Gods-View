import { getTierById, getTierIndex } from "../cosmos/tierData.js";
import { getTransitionProgress } from "../cosmos/tierTransition.js";
import { formatDistanceLy } from "../cosmos/distanceFormat.js";

// ---------- running cosmic scale-bar label ----------
// The top-of-screen distance readout shown only while a tier transition is
// in flight (button/voice-triggered OR scroll-scrubbed — getTransitionProgress()
// covers both), matching the reference video's continuously-updating scale
// label rather than a persistent always-on HUD. Fades in/out with the
// transition, the same opacity-driven show/hide #tierTransitionOverlay
// already uses.
const el = document.getElementById("cosmicScaleBar");
const textEl = document.getElementById("cosmicScaleBarText");

let visible = false;

// Called once per frame from core/loop.js, right after updateTierTransition()/
// updateScaleBreadcrumb() — same "cheap no-op when idle" shape every other
// per-frame UI sync function in this app already follows.
export function updateScaleBar() {
  const progress = getTransitionProgress();
  if (!progress) {
    if (visible) {
      visible = false;
      el.classList.remove("visible");
    }
    return;
  }

  const fromTier = getTierById(progress.fromTierId);
  const toTier = getTierById(progress.toTierId);
  if (!fromTier?.realDistanceLy || !toTier?.realDistanceLy) return;

  // Ascending (zooming out to a bigger tier): the distance climbs from the
  // tier you're leaving's own far edge to the tier you're arriving at's far
  // edge — by design fromTier.far === toTier.near (see tierData.js's own
  // comments), so this reads as one continuous number growing across the
  // boundary, never a jump. Descending mirrors it against each tier's near
  // edge instead.
  const ascending = getTierIndex(progress.toTierId) > getTierIndex(progress.fromTierId);
  const startLy = ascending ? fromTier.realDistanceLy.far : fromTier.realDistanceLy.near;
  const endLy = ascending ? toTier.realDistanceLy.far : toTier.realDistanceLy.near;
  const ly = startLy + (endLy - startLy) * progress.t;

  // A tier can declare that its rung of the ladder is a step through TIME
  // rather than distance (tierData.js's `journey`). The Big Bang is the only
  // one: past the observable universe there is no more space to travel, only
  // earlier time, and showing "46.5 billion light-years" while arriving at
  // t=0 would be quietly wrong. Distance is still shown on the way in, right
  // up to the boundary, then hands over to the time label.
  const journey = ascending ? toTier.journey : fromTier.journey;
  if (journey && progress.t > 0.5) {
    textEl.textContent = `${journey.label} · ${toTier.label}`;
  } else {
    textEl.textContent = `${formatDistanceLy(ly)} · ${toTier.label}`;
  }

  if (!visible) {
    visible = true;
    el.classList.add("visible");
  }
}
