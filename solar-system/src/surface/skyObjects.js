import * as THREE from "three";
import { planetData } from "../scene/planetData.js";
import { getSkyNeighbours, SURFACE_GROUND_SIZE } from "./surfaceData.js";

// ---------- stylized sky content ----------
// Two different kinds of object, deliberately built differently because they
// mean different things to the player:
//
//   - Neighbour planets are fixed points of light in the sky, like real
//     planets are to the naked eye — you don't watch Venus visibly move
//     across the sky in real time. Positioned per this dome, not the real
//     orbital mechanics (the brief explicitly allows stylized/exaggerated
//     placement, and the app already isn't to real scale anywhere else).
//   - This planet's own moons DO visibly orbit overhead, per the brief, so
//     they're built as pivot+mesh pairs that genuinely animate every frame.
//
// New lightweight meshes, not the real orbital-scale objects from
// scene/planetFactory.js — those live in the orbital scene at orbital scale
// and are only ever added to that scene, never reparented, so a fresh, cheap
// representation is what "reuse across two scenes" actually has to mean here.

const DOME_R = SURFACE_GROUND_SIZE * 0.85; // just inside the sky dome itself
const MOON_ORBIT_RADIUS = 45;
const MOON_ORBIT_HEIGHT = 70; // how high overhead the moons' shared pivot sits

// Fixed, hand-picked sky positions so two neighbours never land on top of
// each other — azimuth spread left/right of "north", moderate elevation so
// they read as being in the sky, not on the horizon or directly overhead.
const NEIGHBOUR_SLOTS = [
  { azimuthDeg: -50, elevationDeg: 28 },
  { azimuthDeg: 55, elevationDeg: 34 },
];

function sphericalToVec3(azimuthDeg, elevationDeg, radius) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    radius * Math.cos(el) * Math.sin(az),
    radius * Math.sin(el),
    -radius * Math.cos(el) * Math.cos(az) // -Z is "forward"/north, matching the rig's default facing
  );
}

function buildNeighbourPlanet(data, slot) {
  // A flat, unlit sphere using the planet's own established disk color
  // (scene/planetData.js) — cheap, and keeps the same color identity as the
  // orbital view rather than inventing a second palette.
  const visualRadius = THREE.MathUtils.clamp(data.radius * 1.8, 1.5, 6); // exaggerated so it actually reads at sky distance
  const geo = new THREE.SphereGeometry(visualRadius, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: data.color, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(sphericalToVec3(slot.azimuthDeg, slot.elevationDeg, DOME_R));
  mesh.name = `sky:${data.name}`;

  // A soft glow sprite (same technique as scene/sun.js's createGlow) so it
  // reads as a bright object in the sky rather than a flat cutout disk.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const gctx = glowCanvas.getContext("2d");
  const grd = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  const c = new THREE.Color(data.color);
  grd.addColorStop(0, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.55)`);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  gctx.fillStyle = grd;
  gctx.fillRect(0, 0, 64, 64);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, fog: false,
  }));
  glowSprite.scale.setScalar(visualRadius * 5);
  mesh.add(glowSprite);

  return mesh;
}

function buildOrbitingMoon(m, pivotGroup) {
  const moonPivot = new THREE.Object3D();
  moonPivot.rotation.y = Math.random() * Math.PI * 2; // random starting phase, same touch as the orbital moons
  const geo = new THREE.SphereGeometry(THREE.MathUtils.clamp(m.radius * 6, 1.2, 4), 14, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${m.hue}, ${m.sat}%, ${m.baseLight}%)`),
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(MOON_ORBIT_RADIUS * (0.6 + Math.random() * 0.4), 0, 0);
  mesh.name = `skyMoon:${m.name}`;
  moonPivot.add(mesh);
  pivotGroup.add(moonPivot);
  // Sign of m.speed is meaningful (Triton orbits retrograde — see
  // planetData.js) and worth preserving even here; magnitude is rescaled so
  // a full revolution takes on the order of a minute, genuinely watchable
  // rather than the real (much slower, or telescopically fast) rate.
  return { pivot: moonPivot, angularSpeed: Math.sign(m.speed || 1) * 0.15 };
}

export function buildSkyObjects(planetName) {
  const group = new THREE.Group();
  group.name = "skyObjects";

  getSkyNeighbours(planetName).forEach((name, i) => {
    const data = planetData.find((p) => p.name === name);
    if (data && NEIGHBOUR_SLOTS[i]) group.add(buildNeighbourPlanet(data, NEIGHBOUR_SLOTS[i]));
  });

  const thisPlanet = planetData.find((p) => p.name === planetName);
  const moonPivotGroup = new THREE.Group();
  moonPivotGroup.name = "moonOrbits";
  moonPivotGroup.position.set(0, MOON_ORBIT_HEIGHT, -30);

  // Earth's Moon isn't in planetData's `moons` array the way every other
  // planet's are — it's built separately in scene/planetFactory.js off the
  // `hasMoon` flag, with its look hardcoded there via
  // PLANET_TEXTURE_FACTORIES.Moon (textures/textureMaps.js:
  // crateredPlanet(512, 256, 40, 4, 60, ...)). Standing on Earth without the
  // Moon overhead would be a glaring omission, so its hue/sat/light are
  // reproduced here to match that exact look, and it's spliced into the
  // same list every other planet's real moons come from.
  const moonSource = thisPlanet?.moons ? [...thisPlanet.moons] : [];
  if (planetName === "Earth") {
    moonSource.push({ name: "Moon", radius: 0.28, hue: 40, sat: 4, baseLight: 60, speed: 1 });
  }
  const moonEntries = moonSource.map((m) => buildOrbitingMoon(m, moonPivotGroup));
  group.add(moonPivotGroup);
  // Stashed on userData rather than a module-level map keyed by scene: each
  // surface scene owns exactly one skyObjects group, so the animation state
  // it needs lives right on the object updateSkyObjects() is handed.
  group.userData.moonEntries = moonEntries;

  return group;
}

// Called once per frame while a surface scene is active (see core/loop.js).
// Only the moon pivots need updating — neighbour planets are intentionally
// static (see the file header comment on why).
export function updateSkyObjects(scene, dt) {
  const group = scene.getObjectByName("skyObjects");
  if (!group) return;
  group.userData.moonEntries.forEach(({ pivot, angularSpeed }) => {
    pivot.rotation.y += angularSpeed * dt;
  });
}
