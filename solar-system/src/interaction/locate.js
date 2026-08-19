import { AppState } from "../core/state.js";
import { focusOnObject } from "./focus.js";
import { jumpToTierCinematic, isTierTransitioning } from "../cosmos/tierTransition.js";
import { getTierById } from "../cosmos/tierData.js";
import { findTierForMesh } from "./raycastPicking.js";

// ---------- the one tier-aware "take me to that thing" path ----------
// Focusing an object only works if that object is in the scene currently
// being rendered. Every tier keeps its own scene (cosmos/tierScenes.js), and
// only one is live at a time — so calling focusOnObject() on a body from a
// different tier used to lerp the camera toward coordinates in a scene that
// is not on screen. That is what "Locate ISS" did from any tier other than
// the solar system: the ISS sits a few dozen units from the origin, the
// Milky Way camera sits thousands of units out, and the result was the view
// drifting toward empty space near the player rather than travelling to the
// station.
//
// Rather than special-casing the ISS, everything that means "go to that
// object" routes through here: resolve which tier owns the target, hop there
// first if the player isn't already in it, and only then run the normal
// focus/fly-to. Anything registered as a tier's clickable — including tiers
// added later — gets this for free with no per-object handling.

// Tier scenes are built lazily, so a tier the player has never visited has
// no entry in the clickables registry yet and its meshes cannot be found by
// instance. Callers that know the tier from static data (assistant/
// entityLocator.js reads it off galaxyData.js) pass it explicitly instead.
function resolveTier(target, explicitTier) {
  if (explicitTier) return explicitTier;
  if (typeof target !== "string") return findTierForMesh(target);
  return null;
}

// Runs `callback` once any in-flight tier transition has finished. A tier's
// content only enters the live scene graph partway through the cinematic
// dolly (cosmos/tierTransition.js calls enterTier() mid-flight), so focusing
// the moment the transition is *started* would act on a scene that is not
// showing yet. Polling rather than an event because the transition exposes
// progress, not completion callbacks.
function afterTierSettles(callback) {
  if (isTierTransitioning()) {
    setTimeout(() => afterTierSettles(callback), 100);
    return;
  }
  callback();
}

// Looks the target up inside whichever scene is live right now. Meshes built
// once at startup (everything in the solar system) keep a stable identity, so
// the instance itself is used when it is already in the active scene; tier
// scenes built lazily are re-resolved by name, since the instance the caller
// held may predate the scene actually being on screen.
function resolveInActiveScene(target) {
  const scene = AppState.activeScene;
  if (!scene) return null;
  if (typeof target === "string") return scene.getObjectByName(target);
  // Walking up to the root is how "is this actually in the live scene" gets
  // answered — an object's .parent chain ends at whichever scene owns it.
  let root = target;
  while (root.parent) root = root.parent;
  if (root === scene) return target;
  return target.name ? scene.getObjectByName(target.name) : null;
}

// Takes the player to `target` (a mesh, or a name to look up once the right
// tier is live) from wherever they currently are.
//
// Returns a short human-readable string describing what happened — the
// assistant surfaces it as chat text, and button callers can ignore it.
export function locateAndFocus(target, { tier: explicitTier } = {}) {
  const label = typeof target === "string" ? target : target?.name || "that";

  if (!target) return `Couldn't find ${label}.`;

  // Surface Mode and Landmark Mode both replace the scene wholesale and own
  // their own exit path back to orbital; jumping tiers underneath them would
  // strand the player. Same guard assistant/entityLocator.js already applies.
  if (AppState.mode !== "orbital") {
    return `Can't navigate there while ${AppState.mode === "surface" ? "walking on a surface" : "visiting a landmark"} — exit back to free-roam first.`;
  }

  const tierId = resolveTier(target, explicitTier);

  // Already in the right tier (or the tier is unknown, in which case the
  // object can only be somewhere in the live scene anyway) — straight to the
  // existing focus behaviour, unchanged.
  if (!tierId || tierId === AppState.tier) {
    const obj = resolveInActiveScene(target);
    if (!obj) return `Couldn't find ${label} in the current view.`;
    focusOnObject(obj);
    return `Focusing on ${obj.name || label}.`;
  }

  if (!jumpToTierCinematic(tierId)) return "Busy with another transition — try again in a moment.";
  afterTierSettles(() => {
    const obj = resolveInActiveScene(target);
    if (obj) focusOnObject(obj);
  });
  const tierLabel = getTierById(tierId)?.label || tierId;
  return `Heading to ${tierLabel} to show you ${label}.`;
}
