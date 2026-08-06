import { planetData } from "../scene/planetData.js";

// Shared by surfaceScene.js and skyObjects.js. Lives here, not in either of
// those, because they import from each other (surfaceScene builds the sky
// objects; skyObjects needs the ground size to place them) — a constant
// either one needed from the other would create an import cycle where the
// value could read as undefined at module-eval time depending on load order.
export const SURFACE_GROUND_SIZE = 400; // scene units — the horizon fades into fog well before an edge is ever reachable on foot

// ---------- per-planet Surface Mode config ----------
// Deliberately hand-authored rather than derived from planetData's `color`
// field: a planet's overall disk color (Earth's ocean-blue marble, for
// instance) is not its ground albedo, so deriving one from the other would
// give wrong-looking terrain for exactly the planets people know best. Ground
// hue/sat/light below is chosen from real reference photos/rover imagery
// where they exist (Mars's rust, Venus's Venera-lander orange-brown, Pluto's
// pale ice), same "plausible, not scientifically accurate" bar as the rest
// of the app's per-planet art direction (see the atmosphere comments in
// scene/planetData.js for the established precedent).
//
// Gravity multipliers are real surface-gravity-relative-to-Earth ratios
// (Mercury 0.38g, Pluto 0.063g, etc.) — a genuine detail worth keeping even
// though the rest of the surface is stylized, and a nice thing to mention in
// a presentation.
export const SURFACE_DATA = {
  Mercury: {
    isGasGiant: false, gravity: 0.38, footstepStyle: "rocky",
    ground: { hue: 30, sat: 8, light: 40, craterCount: 600, poles: false },
    sky: { zenith: "#050505", horizon: "#1a1208", stars: true, fogDensity: 0.006 },
  },
  Venus: {
    isGasGiant: false, gravity: 0.9, footstepStyle: "rocky",
    ground: { hue: 32, sat: 38, light: 42, craterCount: 70, poles: false },
    sky: { zenith: "#d9a15c", horizon: "#f2c98a", stars: false, fogDensity: 0.05 },
  },
  Earth: {
    isGasGiant: false, gravity: 1.0, footstepStyle: "rocky",
    ground: { hue: 100, sat: 22, light: 34, craterCount: 35, poles: false },
    sky: { zenith: "#4a90e2", horizon: "#bfe3ff", stars: false, fogDensity: 0.018 },
  },
  Mars: {
    isGasGiant: false, gravity: 0.38, footstepStyle: "rocky",
    ground: { hue: 14, sat: 55, light: 40, craterCount: 300, poles: false },
    sky: { zenith: "#c9906a", horizon: "#e8c9a0", stars: true, fogDensity: 0.03 },
  },
  Jupiter: {
    isGasGiant: true, gravity: 2.4, footstepStyle: "gas",
    ground: { hue: 35, sat: 30, light: 58, bandCount: 10, contrast: 8 },
    sky: { zenith: "#e8d9b8", horizon: "#f5ecd5", stars: false, fogDensity: 0.045 },
  },
  Saturn: {
    isGasGiant: true, gravity: 1.07, footstepStyle: "gas",
    ground: { hue: 45, sat: 22, light: 66, bandCount: 8, contrast: 6 },
    sky: { zenith: "#ecdfb8", horizon: "#f7f0da", stars: false, fogDensity: 0.045 },
  },
  Uranus: {
    isGasGiant: true, gravity: 0.9, footstepStyle: "gas",
    ground: { hue: 185, sat: 30, light: 64, bandCount: 5, contrast: 5 },
    sky: { zenith: "#b8e8ec", horizon: "#dcf5f7", stars: false, fogDensity: 0.04 },
  },
  Neptune: {
    isGasGiant: true, gravity: 1.14, footstepStyle: "gas",
    ground: { hue: 225, sat: 45, light: 44, bandCount: 6, contrast: 6 },
    sky: { zenith: "#3a5ec4", horizon: "#7a94d8", stars: false, fogDensity: 0.035 },
  },
  Pluto: {
    isGasGiant: false, gravity: 0.063, footstepStyle: "rocky",
    ground: { hue: 35, sat: 14, light: 70, craterCount: 150, poles: true },
    sky: { zenith: "#05050a", horizon: "#3a5570", stars: true, fogDensity: 0.008 },
  },
};

export function getSurfaceData(planetName) {
  return SURFACE_DATA[planetName] || null;
}

// A planet's "sky neighbours" — the other bodies stylized into its sky dome.
// Derived from planetData's existing Mercury->Pluto order (already sorted by
// orbital distance) rather than hand-listed a second time: for a given
// planet, its immediate predecessor and successor in that list are the ones
// that would plausibly be nearest, and closest, in the real solar system.
export function getSkyNeighbours(planetName) {
  const names = planetData.map((p) => p.name);
  const i = names.indexOf(planetName);
  if (i === -1) return [];
  return [names[i - 1], names[i + 1]].filter(Boolean);
}
