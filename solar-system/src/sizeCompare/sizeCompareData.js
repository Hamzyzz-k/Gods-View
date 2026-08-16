// ---------- size-compare stop sequence ----------
// The ordered script the rebuilt size-compare feature steps through,
// manual Prev/Next only (no auto-dwell timer) — modeled on tour/tourMode.js's
// itinerary-array shape, minus its dwell timer. Two kinds of stop:
//
//   "grid"      — flat side-by-side spheres, real diameters compared
//                 directly (Part A of the reference sequence).
//   "orbitRing" — concentric "orbit of X" rings escalating from Solar
//                 System scale up through galaxy/black-hole scale, ending
//                 on full-frame black-hole close-ups (Part B).
//
// Body names in `bodies`/`sun`/`galaxy`/`blackHole` fields must match
// data/sizeData.js's SIZE_ENTITIES `name` field exactly — sizeCompareScene.js
// looks diameters up by that same name.
export const SIZE_COMPARE_STOPS = [
  // ---- Part A: flat grids ----
  { kind: "grid", id: "smallWorlds", title: "Small Worlds", bodies: ["Venus", "Moon", "Pluto", "Ceres"] },
  { kind: "grid", id: "rockyPlanets", title: "Rocky Planets", bodies: ["Mercury", "Venus", "Earth", "Mars"] },
  { kind: "grid", id: "outerPlanets", title: "Outer Planets", bodies: ["Jupiter", "Saturn", "Uranus", "Neptune"] },
  {
    kind: "grid",
    id: "sunVsPlanets",
    title: "The Sun vs. Every Planet",
    bodies: ["Sun", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  },

  // ---- Part B: escalating orbit-ring diagrams ----
  // "solarSystem" is a special first stop: no new geometry, just a wide
  // framing of the real, already-existing orbital scene (see
  // sizeCompareScene.js's buildOrbitStop()).
  { kind: "orbitRing", id: "solarSystemOverview", title: "The Solar System", ring: "solarSystem" },
  {
    kind: "orbitRing",
    id: "sgrA",
    title: "The Sun's Orbit Around Sagittarius A*",
    ring: "sunAndBlackHole",
    sun: "Sun",
    blackHoleName: "Sagittarius A*",
  },
  { kind: "orbitRing", id: "andromeda", title: "Andromeda + Its Black Hole", ring: "galaxy", galaxyName: "Andromeda Galaxy" },
  { kind: "orbitRing", id: "centaurusA", title: "Centaurus A + Its Black Hole", ring: "galaxy", galaxyName: "Centaurus A" },
  { kind: "orbitRing", id: "cygnusA", title: "Cygnus A + Its Black Hole", ring: "galaxy", galaxyName: "Cygnus A" },
  { kind: "orbitRing", id: "virgoM87", title: "M87 / Virgo Cluster + M87*", ring: "galaxy", galaxyName: "Virgo Cluster" },
  { kind: "orbitRing", id: "m87Closeup", title: "M87* — Bigger Than the Solar System", ring: "closeup", blackHoleName: "M87*" },
  { kind: "orbitRing", id: "ton618", title: "TON 618 — the Largest Known Black Hole", ring: "closeup", blackHoleName: "TON 618" },
];
