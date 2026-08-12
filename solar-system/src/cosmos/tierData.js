import * as THREE from "three";
import { AppState } from "../core/state.js";
import { createStarfield } from "../core/starfield.js";
import { buildMilkyWayContent } from "./milkyWay.js";

// ---------- the cosmic scale ladder ----------
// Ordered innermost (solar system) to outermost. `defaultView` is only used
// the FIRST time a tier is entered — after that, cosmos/tierNavigation.js
// remembers and restores wherever the camera was left, generalizing the
// single-slot "remember and restore exactly" precedent
// surface/surfaceMode.js already established for Surface Mode enter/exit.
//
// `getScene`: the solar system tier's scene already exists (built at app
// startup by every scene/* module) so it is read live off AppState rather
// than lazily constructed and cached like every other tier's `buildScene`.
//
// `update(scene, dt)` is optional and called from core/loop.js only while
// that tier is active — the solar system's own orbital sim already runs
// unconditionally regardless of tier (see loop.js's comment on why), so it
// has no `update` here.
export const TIER_DATA = [
  {
    id: "solarSystem",
    label: "Solar System",
    defaultView: { cameraPos: [0, 60, 140], target: [0, 0, 0] },
    cameraNear: 0.1,
    cameraFar: 5000,
    controlsMax: 800,
    getScene: () => AppState.scene,
  },
  {
    id: "milkyWay",
    label: "Milky Way",
    // Just outside the spiral's own visual edge (~2860 units — see
    // cosmos/milkyWay.js's GALAXY_RADIUS), looking down at a gentle angle
    // so the arm structure actually reads as a spiral rather than an
    // edge-on line.
    defaultView: { cameraPos: [0, 2200, 3400], target: [0, 0, 0] },
    cameraNear: 1,
    cameraFar: 20000,
    controlsMax: 6000,
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:milkyWay";
      scene.add(new THREE.AmbientLight(0x445566, 0.8));
      createStarfield(scene); // distant background stars, behind the galaxy itself — same depth cue used at every other tier
      scene.add(buildMilkyWayContent());
      return scene;
    },
  },
];

export function getTierIndex(tierId) {
  return TIER_DATA.findIndex((t) => t.id === tierId);
}

export function getTierById(tierId) {
  return TIER_DATA.find((t) => t.id === tierId) || null;
}
