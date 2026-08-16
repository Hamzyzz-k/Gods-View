import * as THREE from "three";
import { AppState } from "../core/state.js";
import { getTexture, ringTexture, earthCloudsTexture, crateredPlanet, crateredHeightMap } from "../textures/proceduralTextures.js";
import { PLANET_TEXTURE_FACTORIES, PLANET_BUMP_FACTORIES } from "../textures/textureMaps.js";
import { loadRealTexture, REAL_TEXTURE_URLS } from "../textures/realTextures.js";
import { createISSModel } from "./issModel.js";
import { sun, createAtmosphere } from "./sun.js";
import { planetData, sunInfo, ISS_INFO, ORBIT_SPEED_SCALE, SELF_SPIN_SCALE, ISS_ORBIT_SPEED } from "./planetData.js";
const { scene } = AppState;

export const planets = []; // { mesh, pivot, data, angle }
export const orbitLines = [];
export const allMoonMeshes = []; // every non-Earth major-moon mesh, collected for raycasting/click support

export function createOrbitRing(distance) {
  const segments = 128;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * distance, 0, Math.sin(theta) * distance));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0x555577, transparent: true, opacity: 0.4 });
  const line = new THREE.LineLoop(geo, mat);
  scene.add(line);
  return line;
}

export function createPlanet(data) {
  const pivot = new THREE.Object3D();
  pivot.rotation.y = Math.random() * Math.PI * 2; // random starting angle
  scene.add(pivot);

  const geo = new THREE.SphereGeometry(data.radius, 48, 48);
  const bumpFactory = PLANET_BUMP_FACTORIES[data.name];
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture(data.name, PLANET_TEXTURE_FACTORIES[data.name]),
    roughness: data.roughness ?? 0.85,
    metalness: data.metalness ?? 0.05,
    ...(bumpFactory && {
      bumpMap: getTexture(data.name + "Bump", bumpFactory),
      bumpScale: data.bumpScale ?? 0.02,
    }),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(data.distance, 0, 0);
  mesh.rotation.z = THREE.MathUtils.degToRad(data.tilt);
  mesh.name = data.name;
  pivot.add(mesh);

  if (REAL_TEXTURE_URLS[data.name]) {
    loadRealTexture(REAL_TEXTURE_URLS[data.name], (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }

  // Every planet now carries an `atmosphere` colour, tuned per body in
  // planetData.js (see the comments there — Mercury's is a sodium exosphere,
  // not an atmosphere, and Pluto's blue haze is real). The guard stays so a
  // body can still opt out by omitting the field.
  if (data.atmosphere) {
    const atmosphere = createAtmosphere(data.radius, data.atmosphere, data.atmosphereOpts);
    mesh.add(atmosphere);
    data._atmosphereMesh = atmosphere;
  }

  // Saturn's ring
  if (data.hasRing) {
    const ringInnerR = data.radius * 1.5;
    const ringOuterR = data.radius * 2.6;
    const ringGeo = new THREE.RingGeometry(ringInnerR, ringOuterR, 64);
    // Map radial distance continuously to U (0 = inner edge, 1 = outer edge)
    // so a radial ring texture — procedural or real — reads as a smooth
    // gradient across the ring instead of two flat bands.
    const pos = ringGeo.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const u = THREE.MathUtils.clamp((v3.length() - ringInnerR) / (ringOuterR - ringInnerR), 0, 1);
      ringGeo.attributes.uv.setXY(i, u, 1);
    }
    const ringMat = new THREE.MeshStandardMaterial({
      map: getTexture("SaturnRing", () => ringTexture(1024, 16, 44, 25, 68)),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      roughness: 1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    mesh.add(ring);
    data._ringMesh = ring;

    loadRealTexture(REAL_TEXTURE_URLS.SaturnRing, (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping; // a radial slice, not meant to repeat
      ringMat.map = tex;
      ringMat.alphaMap = tex; // same grayscale data doubles as per-pixel transparency (ring gaps)
      ringMat.color.set(0xd8c9a0); // warm tan tint, since the source is near-grayscale
      ringMat.needsUpdate = true;
    });
  }

  // Earth's clouds
  if (data.name === "Earth") {
    const cloudGeo = new THREE.SphereGeometry(data.radius * 1.015, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: getTexture("EarthClouds", () => earthCloudsTexture(1024, 512)),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      roughness: 1,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.add(clouds);
    data._cloudMesh = clouds;

    loadRealTexture(REAL_TEXTURE_URLS.EarthClouds, (tex) => {
      cloudMat.map = tex;
      cloudMat.needsUpdate = true;
    });
  }

  // Earth's moon
  if (data.hasMoon) {
    const moonPivot = new THREE.Object3D();
    mesh.add(moonPivot);
    // Earth's Moon is the one people look at closest, so it gets the most
    // geometry of any moon here. It already had a heightmap defined in
    // PLANET_BUMP_FACTORIES but was never using it.
    const moonGeo = new THREE.SphereGeometry(0.28, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({
      map: getTexture("Moon", PLANET_TEXTURE_FACTORIES.Moon),
      bumpMap: getTexture("MoonBump", PLANET_BUMP_FACTORIES.Moon),
      bumpScale: 0.012,
      roughness: 0.9,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(2, 0, 0);
    moonPivot.add(moon);
    data._moonPivot = moonPivot;
    data._moonMesh = moon;
    data._moonBaseColor = moon.material.color.clone();

    loadRealTexture(REAL_TEXTURE_URLS.Moon, (tex) => {
      moonMat.map = tex;
      moonMat.needsUpdate = true;
    });
  }

  // Major moons for planets other than Earth (Mars, Jupiter, Saturn, Uranus,
  // Neptune). Attached to `pivot` (the planet's sun-orbit pivot), NOT `mesh`
  // (which spins for day/night) — same reasoning as the ISS below: this
  // keeps each moon's orbital plane from being dragged around by the
  // planet's own axial spin. A shared sub-pivot is positioned at the
  // planet's location within `pivot`, and every moon gets its own child
  // pivot so each can orbit at its own speed.
  if (data.moons && data.moons.length) {
    const moonSystemPivot = new THREE.Object3D();
    moonSystemPivot.position.copy(mesh.position);
    pivot.add(moonSystemPivot);

    data._moons = data.moons.map((m) => {
      const moonPivot = new THREE.Object3D();
      moonPivot.rotation.y = Math.random() * Math.PI * 2; // random starting phase
      moonSystemPivot.add(moonPivot);

      // 32 segments rather than 24, and 512x256 textures rather than 256x128:
      // the moons previously read as flat coloured balls mostly because they
      // had no bumpMap at all, unlike the planets. Reusing crateredHeightMap
      // (the same generator PLANET_BUMP_FACTORIES uses) makes their craters
      // catch the light instead of looking painted on. Still cheap — these are
      // small on screen and the textures are generated once and cached.
      const moonGeo = new THREE.SphereGeometry(m.radius, 32, 32);
      const texKey = `${data.name}_${m.name}`;
      const craters = m.craterCount ?? 25;
      const moonMat = new THREE.MeshStandardMaterial({
        map: getTexture(texKey, () => crateredPlanet(512, 256, m.hue, m.sat, m.baseLight, craters, false)),
        bumpMap: getTexture(texKey + "Bump", () => crateredHeightMap(512, 256, craters)),
        bumpScale: m.bumpScale ?? 0.015,
        roughness: 0.92,
        metalness: 0.02,
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.name = m.name;
      moonMesh.position.set(m.distance, 0, 0);
      moonMesh.userData.info = { name: m.name, meta: m.meta || {}, info: m.info || "" };
      moonPivot.add(moonMesh);

      if (REAL_TEXTURE_URLS[m.name]) {
        loadRealTexture(REAL_TEXTURE_URLS[m.name], (tex) => {
          moonMat.map = tex;
          moonMat.needsUpdate = true;
        });
      }

      // faint orbit path, same style as the planet orbit rings
      const segs = 64;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * m.distance, 0, Math.sin(theta) * m.distance));
      }
      const moonOrbitLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.25 })
      );
      moonPivot.add(moonOrbitLine);

      allMoonMeshes.push(moonMesh);

      return { mesh: moonMesh, pivot: moonPivot, speed: m.speed, orbitLine: moonOrbitLine };
    });
  }

  // International Space Station — low Earth orbit.
  // Attached to `pivot` (Earth's sun-orbit pivot), NOT `mesh` (which spins
  // for day/night), so Earth's fast axial spin doesn't drag the ISS's
  // inclined orbital plane around with it.
  if (data.hasISS) {
    const issOrbitRadius = data.radius * 1.7; // just outside the cloud layer
    const issPivot = new THREE.Object3D();
    issPivot.position.copy(mesh.position);
    issPivot.rotation.x = THREE.MathUtils.degToRad(51.6); // real ISS orbital inclination
    issPivot.rotation.y = Math.random() * Math.PI * 2;
    pivot.add(issPivot);

    const issGroup = createISSModel();
    issGroup.position.set(issOrbitRadius, 0, 0);
    issGroup.name = "ISS";
    issPivot.add(issGroup);

    // Invisible slightly-larger sphere: gives an easy click/hover target and
    // a bounding sphere for focusOnObject (the visual model is a multi-mesh
    // Group, which has neither).
    const issProxy = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    issProxy.name = "ISS";
    issProxy.position.set(issOrbitRadius, 0, 0);
    issProxy.userData.info = { name: "ISS", ...ISS_INFO };
    issPivot.add(issProxy);

    // faint path so the orbit is visible even before you click it
    const issRingPoints = [];
    const issRingSegments = 64;
    for (let i = 0; i <= issRingSegments; i++) {
      const theta = (i / issRingSegments) * Math.PI * 2;
      issRingPoints.push(new THREE.Vector3(Math.cos(theta) * issOrbitRadius, 0, Math.sin(theta) * issOrbitRadius));
    }
    const issRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(issRingPoints),
      new THREE.LineBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.35 })
    );
    issPivot.add(issRing);

    data._issPivot = issPivot;
    data._issProxy = issProxy;
  }

  mesh.userData.info = data;

  orbitLines.push(createOrbitRing(data.distance));

  planets.push({ mesh, pivot, data });
}

planetData.forEach(createPlanet);

// The sun is built in sun.js but its info-panel payload is attached here,
// alongside the planets', so every clickable body carries the same shape.
sun.userData.info = { name: "Sun", ...sunInfo };

// Earth is looked up by name in several places (moon-colour tinting during a
// lunar eclipse, the ISS raycast proxy), so resolve it once here.
export const earthEntry = planets.find((p) => p.data.name === "Earth");

// The ISS is a multi-mesh Group with no single raycastable bounding sphere,
// so an invisible proxy sphere stands in for it during picking.
export const issProxyMesh = earthEntry?.data._issProxy || null;
