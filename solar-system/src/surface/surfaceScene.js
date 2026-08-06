import * as THREE from "three";
import { getTexture, crateredPlanet, crateredHeightMap, bandedPlanet, bandedHeightMap } from "../textures/proceduralTextures.js";
import { createStarfield } from "../core/starfield.js";
import { getSurfaceData, SURFACE_GROUND_SIZE } from "./surfaceData.js";
import { buildSkyObjects } from "./skyObjects.js";

// ---------- per-planet surface scenes ----------
// Each planet gets its own THREE.Scene (ground + sky dome + fog + lights +
// sky objects), built once and cached by name — repeat visits reuse the same
// scene rather than rebuilding geometry/textures, which is what keeps
// enter/exit cycles cheap and leak-free (see core/loop.js's comment on why
// the orbital scene keeps existing in parallel rather than being torn down).
const sceneCache = new Map();

const GROUND_SIZE = SURFACE_GROUND_SIZE;
const GROUND_REPEAT = 6; // modest tiling: crateredPlanet/bandedPlanet are equirectangular SPHERE maps (seamless only
// horizontally, by design — see textures/proceduralTextures.js), not built for a repeating ground tile. A low
// repeat count keeps seams infrequent and soft rather than chasing true seamless tiling for a stylized surface.

function buildGroundTextures(planetName, cfg) {
  const g = cfg.ground;
  const colorKey = `${planetName}GroundColor`;
  const bumpKey = `${planetName}GroundBump`;
  const colorTex = cfg.isGasGiant
    ? getTexture(colorKey, () => bandedPlanet(1024, 512, g.hue, g.sat, g.light, g.bandCount, g.contrast))
    : getTexture(colorKey, () => crateredPlanet(1024, 512, g.hue, g.sat, g.light, g.craterCount, false));
  const bumpTex = cfg.isGasGiant
    ? getTexture(bumpKey, () => bandedHeightMap(1024, 512, g.bandCount))
    : getTexture(bumpKey, () => crateredHeightMap(1024, 512, g.craterCount));

  // getTexture()'s cache is keyed by name and shared app-wide, but these two
  // keys are unique to this module (never used for an orbital planet mesh),
  // so mutating wrap/repeat on the returned objects here is safe.
  [colorTex, bumpTex].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
  });
  return { colorTex, bumpTex };
}

function buildGround(planetName, cfg) {
  const { colorTex, bumpTex } = buildGroundTextures(planetName, cfg);
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
  geo.rotateX(-Math.PI / 2); // lay flat in the XZ plane, +Y up, matching the rig's world-up convention
  const mat = new THREE.MeshStandardMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: cfg.isGasGiant ? 0.03 : 0.06,
    roughness: cfg.isGasGiant ? 0.35 : 0.9, // a cloud-deck should read softer/glossier than bare rock
    metalness: 0,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = "surfaceGround";
  return ground;
}

function buildSkyDome(cfg) {
  // A simple vertical gradient (zenith -> horizon) is enough for a stylized
  // sky and costs one small canvas — same "draw it on a <canvas>, wrap it in
  // a texture" approach used throughout this app rather than a shader sky.
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, cfg.sky.zenith);
  grad.addColorStop(1, cfg.sky.horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.SphereGeometry(GROUND_SIZE * 0.9, 24, 16);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide, // viewed from inside the sphere
    fog: false, // the dome IS the sky — it shouldn't itself fade into scene fog
    depthWrite: false, // lets stars/sky objects (added after it) always draw regardless of the dome's own depth
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = "surfaceSkyDome";
  return dome;
}

function buildLights(cfg) {
  const group = new THREE.Group();
  // Brightness leans on the same "closer = brighter" logic the orbital
  // sunLight already implies, simplified to two tiers since surface lighting
  // is stylized, not physically falling off with real distance.
  const sunLight = new THREE.DirectionalLight(0xfff4e0, cfg.isGasGiant ? 0.85 : 1.15);
  sunLight.position.set(60, 90, 40);
  group.add(sunLight);
  // Ambient tinted by the sky's horizon color so shadowed ground isn't
  // pitch black and reads as lit by its own sky, not a neutral studio light.
  group.add(new THREE.AmbientLight(new THREE.Color(cfg.sky.horizon), 0.55));
  return group;
}

export function getSurfaceScene(planetName) {
  if (sceneCache.has(planetName)) return sceneCache.get(planetName);

  const cfg = getSurfaceData(planetName);
  if (!cfg) return null;

  const scene = new THREE.Scene();
  scene.name = `surface:${planetName}`;
  scene.fog = new THREE.FogExp2(cfg.sky.horizon, cfg.sky.fogDensity);

  scene.add(buildGround(planetName, cfg));
  scene.add(buildSkyDome(cfg));
  scene.add(buildLights(cfg));
  if (cfg.sky.stars) createStarfield(scene);
  scene.add(buildSkyObjects(planetName));

  sceneCache.set(planetName, scene);
  return scene;
}
