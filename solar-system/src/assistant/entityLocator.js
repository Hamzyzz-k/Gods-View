import { AppState } from "../core/state.js";
import { GALAXY_DATA } from "../cosmos/galaxyData.js";
import { LANDMARK_DATA } from "../landmark/landmarkData.js";
import { jumpToTierCinematic, isTierTransitioning } from "../cosmos/tierTransition.js";
import { locateAndFocus } from "../interaction/locate.js";
import { enterLandmark } from "../landmark/landmarkMode.js";

// ---------- cross-tier entity locator ----------
// Every galaxy, black hole, and Earth landmark the app knows about, in one
// flat searchable list with enough info (which tier it lives in, if any) to
// actually take the user there from wherever they currently are — not just
// act if they already happen to be looking at the right scene. Before this,
// "show me Andromeda" only worked if the milkyWay/localGroup tier was
// already active; from the solar system it either did nothing or told the
// user to navigate there themselves first.
//
// Planets/moons/sun/iss deliberately aren't in here: they only ever live in
// the solar-system tier, so the existing direct lookups in
// assistant/localParser.js and assistant/runCommand.js's "focus" action
// already cover them with no tier-resolution needed.
const ENTITIES = [
  ...GALAXY_DATA.map((g) => ({ name: g.name, aliases: [g.altName].filter(Boolean), kind: "galaxy", tier: g.tier })),
  // Sagittarius A* isn't in GALAXY_DATA — it's the Milky Way's own core,
  // built inline in cosmos/milkyWay.js as part of that tier's content, not
  // a member of the galaxy roster — so it's listed here by hand, the one
  // genuine special case.
  {
    name: "Sagittarius A*",
    aliases: ["sgr a*", "sagittarius a star", "the galactic core", "galactic core", "the black hole"],
    kind: "blackhole",
    tier: "milkyWay",
  },
  // The handful of major galaxies with their own black hole marker
  // (cosmos/galaxyData.js's `blackHole` field, built by cosmos/galaxyFactory.js
  // as a sibling clickable next to the galaxy itself).
  ...GALAXY_DATA.filter((g) => g.blackHole).map((g) => ({ name: g.blackHole.name, aliases: [], kind: "blackhole", tier: g.tier })),
  ...LANDMARK_DATA.map((l) => ({ name: l.name, aliases: [], kind: "landmark", tier: null })),
];

// Exported so localParser.js's hide/show matching (extractTargets below)
// can recognize the same short forms ("andromeda" for "Andromeda Galaxy")
// locate already does, rather than duplicating a weaker copy that only
// matches the full name.
export function normalize(s) {
  return s
    .toLowerCase()
    .replace(/^(the )/, "")
    .replace(/\s+(galaxy|cluster)$/, "")
    .replace(/ of china$/, ""); // "great wall", not only "great wall of china" — matches localParser.js's prior landmark-matching behavior
}

// Matches the full name, the short form anyone would actually say out loud
// ("andromeda" for "Andromeda Galaxy", "great wall" for "Great Wall of
// China"), or a known alias/acronym (altName, "M31", "sgr a*"). Works
// against either a whole sentence ("take me to andromeda") or a bare name.
export function findEntity(text) {
  const q = text.toLowerCase();
  return (
    ENTITIES.find((e) => {
      const full = e.name.toLowerCase();
      const short = normalize(full);
      if (q.includes(full) || (short && q.includes(short))) return true;
      return e.aliases.some((a) => q.includes(a.toLowerCase()));
    }) || null
  );
}

// Runs `callback` once the current tier transition (if any) has finished —
// tier scenes only have their content in the live scene graph after
// enterTier()'s swap actually happens partway through the cinematic dolly
// (cosmos/tierTransition.js), so focusing/entering-landmark immediately
// after starting the transition would act on a scene that isn't showing yet.
function afterTierSettles(callback) {
  if (isTierTransitioning()) {
    setTimeout(() => afterTierSettles(callback), 100);
    return;
  }
  callback();
}

// Takes the user to a named galaxy, black hole, or landmark from wherever
// they currently are, jumping tiers (or returning to the solar system, for
// a landmark) first if needed. Returns a short human reply, or null if
// `text` didn't match anything this locator knows about (the caller should
// fall through to its own further matching — planets, etc.).
export function locateAndShow(text) {
  const entry = findEntity(text);
  if (!entry) return null;

  if (entry.kind === "landmark") {
    if (AppState.mode !== "orbital") return `Can't travel to ${entry.name} from here — head back to free-roam first.`;
    if (AppState.tier === "solarSystem") {
      return enterLandmark(entry.name) ? `Taking you to ${entry.name}.` : `Couldn't travel to ${entry.name} right now.`;
    }
    // Landmark mode's own exit path is hardcoded back to the solar-system
    // scene (landmark/landmarkMode.js's exitLandmark()), so entering it from
    // another tier would return the player to the wrong place afterward —
    // this tier hop first keeps that return path correct.
    if (!jumpToTierCinematic("solarSystem")) return "Busy with another transition — try again in a moment.";
    afterTierSettles(() => enterLandmark(entry.name));
    return `Heading back to the Solar System, then taking you to ${entry.name}.`;
  }

  // galaxy or black hole. The tier hop, the wait for the transition to
  // settle, and the focus are all interaction/locate.js's job — this file
  // only resolves *which* entity a phrase refers to. The tier comes from
  // static data (galaxyData.js) rather than the live clickables registry,
  // because a tier the player has never visited hasn't been built yet and so
  // has nothing registered to look up.
  return locateAndFocus(entry.name, { tier: entry.tier });
}
