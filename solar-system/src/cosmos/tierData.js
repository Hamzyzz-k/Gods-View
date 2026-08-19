import * as THREE from "three";
import { AppState } from "../core/state.js";
import { createStarfield } from "../core/starfield.js";
import { buildMilkyWayContent, buildMilkyWayHomeMarker, buildHomeMarker } from "./milkyWay.js";
import { buildGalaxiesForTier } from "./galaxyFactory.js";
import { buildObservableUniverseBackdrop, WEB_RADIUS } from "./cosmicWeb.js";
import { buildBigBangContent, updateBigBang, BIG_BANG_RADIUS } from "./bigBang.js";

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
// Near-clip plane used INSTEAD of each tier's own `cameraNear` while a WebXR
// session is running. Every VR panel in this app sits about 2.6 metres from
// the rig (xr/vrControlPanel.js's FORWARD_Z and friends), and the transition
// veil is a 2-metre sphere around it — so the outer tiers' own near planes
// (localGroup 5, supercluster 10, observableUniverse 20, all chosen for
// depth precision across galaxy-spanning distances) would put every one of
// those INSIDE the near plane and clip them away entirely. That was a real
// bug: in VR the control/scale/tour/size panels silently vanished from the
// Local Group outward, so there was no way to navigate back down the ladder
// once past the Milky Way.
//
// Safe to keep this small even at the outermost tier: with near 0.1 and far
// 48000 the depth resolution out at the cosmic web is still far finer than
// the objects there are large, and the galaxies are additive points with
// depthWrite off, so they don't depend on depth ordering anyway.
export const VR_NEAR_PLANE = 0.1;

export const TIER_DATA = [
  {
    id: "solarSystem",
    label: "Solar System",
    defaultView: { cameraPos: [0, 60, 140], target: [0, 0, 0] },
    cameraNear: 0.1,
    cameraFar: 5000,
    controlsMax: 800,
    // Real-world distance range this tier spans, for the running scale-bar
    // label shown during a tier transition (cosmos/tierTransition.js's
    // getTransitionProgress(), ui/scaleBar.js). `far` is Proxima Centauri's
    // real distance — the natural bridge into the next tier's "nearby
    // stars" framing, and (by design) exactly milkyWay's own `near` below,
    // so a transition's distance readout is always continuous across the
    // boundary. Never used for literal 3D-scene placement, same "real
    // number for display only" policy this file's own header sets for
    // dMaxLy below.
    realDistanceLy: { near: 0, far: 4.24 },
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
    // `far` is the Large Magellanic Cloud's real distance — the nearest
    // Local Group member, and (by design) exactly localGroup's own `near`.
    realDistanceLy: { near: 4.24, far: 160000 },
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:milkyWay";
      scene.add(new THREE.AmbientLight(0x445566, 0.8));
      createStarfield(scene); // distant background stars, behind the galaxy itself — same depth cue used at every other tier
      scene.add(buildMilkyWayContent());
      return scene;
    },
  },
  {
    id: "localGroup",
    label: "Local Group",
    // Local Group members range from the LMC (~163,000 ly) to Andromeda/
    // Triangulum (~2.5-2.7 million ly) — see cosmos/galaxyData.js. Bounds
    // and dMaxLy (2.8M, slight headroom past Triangulum's real distance)
    // feed buildGalaxiesForTier()'s log-distance compression below.
    defaultView: { cameraPos: [0, 3000, 5500], target: [0, 0, 0] },
    cameraNear: 5,
    cameraFar: 30000,
    controlsMax: 9000,
    realDistanceLy: { near: 160000, far: 2800000 },
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:localGroup";
      scene.add(new THREE.AmbientLight(0x445566, 0.8));
      createStarfield(scene);
      scene.add(buildMilkyWayHomeMarker()); // "home" reference point — the Milky Way itself is a member of this group too, just not one you click through to a spiral from here
      scene.add(buildGalaxiesForTier("localGroup", 800, 5000, 2800000));
      return scene;
    },
  },
  {
    id: "supercluster",
    label: "Local Supercluster",
    // Supercluster-tier members range from Centaurus A (~12M ly) to the
    // Virgo Cluster (~53.5M ly, the farthest) — see cosmos/galaxyData.js.
    // dMaxLy 55M gives slight headroom past that real distance.
    defaultView: { cameraPos: [0, 4000, 7500], target: [0, 0, 0] },
    cameraNear: 10,
    cameraFar: 200000,
    controlsMax: 15000,
    realDistanceLy: { near: 2800000, far: 55000000 },
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:supercluster";
      scene.add(new THREE.AmbientLight(0x445566, 0.8));
      createStarfield(scene);
      scene.add(buildHomeMarker("Local Group (Home)", 0x7ab8ff)); // points back at where the Milky Way/Andromeda/etc. all sit together, one tier in
      scene.add(buildGalaxiesForTier("supercluster", 1000, 6000, 55000000));
      return scene;
    },
  },
  {
    id: "observableUniverse",
    label: "Observable Universe",
    // The finale tier. dMaxLy 4B gives slight headroom past the Bullet
    // Cluster's real ~3.8 billion ly distance, the farthest object in the
    // whole roster (see cosmos/galaxyData.js) — everything here is a
    // compressed direction/ordering, never literal scale, same as every
    // other tier.
    defaultView: { cameraPos: [0, 5000, 9000], target: [0, 0, 0] },
    cameraNear: 20,
    cameraFar: WEB_RADIUS * 6,
    controlsMax: WEB_RADIUS * 2.2,
    // `far` is the true observable-universe radius (~46.5 billion ly) — the
    // real edge of what's visible at all, distinct from the 4e9 ly dMaxLy
    // passed to buildGalaxiesForTier() just below (that number compresses
    // GALAXY PLACEMENT within this tier's roster; this one is display-only,
    // for whatever the scale bar shows once a transition finishes arriving
    // here — same "two different numbers, two different jobs" split this
    // tier's own header comment already draws).
    realDistanceLy: { near: 55000000, far: 46500000000 },
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:observableUniverse";
      scene.add(new THREE.AmbientLight(0x445566, 0.6));
      scene.add(buildObservableUniverseBackdrop()); // CMB shell + cosmic-web filaments
      scene.add(buildHomeMarker("Local Supercluster (Home)", 0xffd27a));
      scene.add(buildGalaxiesForTier("observableUniverse", 1500, WEB_RADIUS * 0.9, 4000000000));
      return scene;
    },
  },
  {
    id: "bigBang",
    label: "The Big Bang",
    // The one rung that isn't a bigger box. Every tier below this one is a
    // step outward in SPACE; this is a step backward in TIME, to the moment
    // the space in all of them began. That is a real distinction and the UI
    // says so rather than quietly pretending 13.8 billion years is just a
    // longer distance — see `journey` below, which ui/scaleBar.js and
    // ui/scaleBreadcrumb.js use to switch their readout from a distance to a
    // time. Placed at the top of the ladder because that is where "keep
    // zooming out" honestly ends: past the observable universe there is no
    // more space to see, only earlier time.
    journey: { kind: "time", label: "13.8 billion years ago", caption: "Looking back in time, not further out in space" },
    defaultView: { cameraPos: [0, 3200, 7200], target: [0, 0, 0] },
    cameraNear: 5,
    cameraFar: BIG_BANG_RADIUS * 8,
    controlsMax: BIG_BANG_RADIUS * 2.4,
    // Kept for the scale bar's interpolation on the way IN from the
    // observable universe. `far` repeats the observable-universe radius
    // because that genuinely is as far as distance goes — the extra span of
    // this tier is time, which `journey` above carries instead.
    realDistanceLy: { near: 46500000000, far: 46500000000 },
    buildScene: () => {
      const scene = new THREE.Scene();
      scene.name = "tier:bigBang";
      // No starfield: there are no stars yet at t=0, and the whole point of
      // the sequence is watching matter appear where there was none.
      scene.add(new THREE.AmbientLight(0x333344, 0.4));
      scene.add(buildBigBangContent());
      return scene;
    },
    update: (scene, dt) => updateBigBang(scene, dt),
  },
];

export function getTierIndex(tierId) {
  return TIER_DATA.findIndex((t) => t.id === tierId);
}

export function getTierById(tierId) {
  return TIER_DATA.find((t) => t.id === tierId) || null;
}
