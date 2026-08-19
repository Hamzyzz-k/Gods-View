import { AppState } from "./state.js";

// ---------- shared movement-speed multiplier ----------
// One scalar, read by every locomotion scheme in the app: VR free-flight
// (xr/locomotion.js), VR surface walking (xr/surfaceLocomotion.js) and
// desktop surface walking (surface/walkControls.js). Deliberately a
// multiplier on top of each scheme's existing constants rather than a second
// set of speeds — those constants were tuned by feel against real distances
// (MOVE_SPEED is documented as crossing Sun-to-Pluto in under a minute, the
// vertical and turn rates were both slowed after testing), and none of that
// tuning should be thrown away to make the speed adjustable. Scaling all of
// them by the same factor keeps their relationships intact, so "faster" means
// the same feel moved up a gear, not a different feel.
//
// Distinct from AppState.speedMultiplier, which is the SIMULATION rate (how
// fast planets orbit) and is set by the #speed slider. Movement speed is a
// property of the player; simulation speed is a property of the world. They
// were kept separate on purpose — flying faster should not fast-forward the
// solar system.

// Roughly a doubling per step, with 1x as the tuned default sitting in the
// middle. The slow end matters as much as the fast: 0.25x is what makes it
// possible to ease up to a small moon without repeatedly overshooting it,
// and the fast end is what makes the outer tiers (thousands of units across)
// crossable without the stick held down for minutes.
export const MOVE_SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8];
const DEFAULT_INDEX = 2; // 1x

let index = DEFAULT_INDEX;
AppState.moveSpeedMultiplier = MOVE_SPEED_STEPS[index];

export function getMoveSpeed() {
  return AppState.moveSpeedMultiplier;
}

// Formatted for a UI label. Whole numbers print without a trailing ".0" so
// the common cases read as "1x" and "8x" rather than "1.0x"/"8.0x", while
// the fractional steps keep the precision they need.
export function getMoveSpeedLabel() {
  const v = AppState.moveSpeedMultiplier;
  return (Number.isInteger(v) ? String(v) : String(v)) + "x";
}

export function isMoveSpeedDefault() {
  return index === DEFAULT_INDEX;
}

export function canStepMoveSpeed(direction) {
  const next = index + direction;
  return next >= 0 && next < MOVE_SPEED_STEPS.length;
}

// direction: +1 faster, -1 slower. Clamped rather than wrapping — wrapping
// from the fastest step straight to the slowest is a nasty surprise when
// you're travelling, and there is no way to undo it mid-flight.
export function stepMoveSpeed(direction) {
  const next = index + direction;
  if (next < 0 || next >= MOVE_SPEED_STEPS.length) return false;
  index = next;
  AppState.moveSpeedMultiplier = MOVE_SPEED_STEPS[index];
  return true;
}
