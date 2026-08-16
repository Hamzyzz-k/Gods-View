import * as THREE from "three";
import { SIZE_ENTITIES } from "../data/sizeData.js";
import { GALAXY_DATA } from "../cosmos/galaxyData.js";
import { planets, allMoonMeshes } from "../scene/planetFactory.js";
import { sunMat } from "../scene/sun.js";
import { buildBlackHole } from "../cosmos/blackHole.js";
import { loadRealTexture } from "../textures/realTextures.js";

// ---------- size-compare scene builder ----------
// Builds real THREE content for one sizeCompareData.js stop, rebuilt fresh
// each time a stop is shown (sizeCompareMode.js calls buildStopContent()
// on every step) rather than kept as one giant persistent world — each
// stop resets its own scene-unit scale, the same "never literal, always
// relative within the shown group" policy already used everywhere else in
// this app (galaxyFactory.js's compressDistance(), tierData.js's per-tier
// bounds).
//
// "Same texture/material as the main scene" is resolved by actually
// reusing the LIVE material off the already-built main-scene mesh wherever
// one exists (every grid-stop body except Ceres is a real planet/moon/the
// Sun, already rendered in the orbital scene right now) — see
// findLiveMaterial() below. Ceres has no 3D counterpart anywhere else in
// this app, so it loads its own real photo the same way every other body's
// material was originally built (textures/realTextures.js's loadRealTexture(),
// the same shared loader/CORS/graceful-fallback pipeline). Galaxies/black
// holes aren't part of "the main solar system scene" the brief's own
// wording refers to, so they're rebuilt fresh from cosmos/galaxyData.js's
// own verified image URLs and cosmos/blackHole.js's reusable builder,
// rather than reached into a cached tier scene and cloned.

const MAX_RADIUS = 4.2;
const MIN_RADIUS = 0.22;
const LY_KM = 9.4607e12;

function entityByName(name) {
  return SIZE_ENTITIES.find((e) => e.name === name);
}

function formatDiameterKm(km) {
  if (km >= LY_KM * 0.1) {
    const ly = km / LY_KM;
    if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million ly`;
    if (ly >= 1e3) return `${(ly / 1e3).toFixed(ly >= 1e4 ? 0 : 1)}k ly`;
    return `${ly.toFixed(ly >= 100 ? 0 : 1)} ly`;
  }
  if (km >= 1e6) return `${(km / 1e6).toFixed(km >= 1e7 ? 0 : 1)} million km`;
  if (km >= 1) return `${Math.round(km).toLocaleString()} km`;
  return `${Math.round(km * 1000)} m`;
}

// Reuses the LIVE material off an already-built main-scene mesh — cloned
// (not shared directly) so per-stop tweaks (none currently, but future-proof)
// never risk mutating the real planet's own material. .clone() copies the
// `.map` texture REFERENCE, not a texture copy, so it's still the exact
// same already-loaded (procedural or real-photo-upgraded) texture object.
function findLiveMaterial(name) {
  const planet = planets.find((p) => p.data.name === name);
  if (planet) return planet.mesh.material.clone();
  if (name === "Moon") {
    const earth = planets.find((p) => p.data.name === "Earth");
    if (earth?.data._moonMesh) return earth.data._moonMesh.material.clone();
  }
  const moon = allMoonMeshes.find((m) => m.name === name);
  if (moon) return moon.material.clone();
  if (name === "Sun") return sunMat.clone();
  return null;
}

function makeTextSprite(text, { size = 48, color = "rgba(232,236,247,0.95)", widthPx = 512, heightPx = 128 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.font = `${size}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, widthPx / 2, heightPx / 2);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false })
  );
  sprite.scale.set(widthPx / heightPx, 1, 1);
  return sprite;
}

// A real photo (fresh-loaded, same loadRealTexture() pipeline every other
// real-image material in this app uses) for a body with no live main-scene
// mesh — currently only Ceres — falling back to a plain tinted sphere until
// (or if) the fetch resolves, same graceful-degrade behavior as everywhere
// else.
function loadOrphanMaterial(entry) {
  const mat = new THREE.MeshStandardMaterial({ color: entry.color || 0x9aa4b8, roughness: 0.85 });
  if (entry.imageUrl) {
    loadRealTexture(entry.imageUrl, (tex) => {
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  }
  return mat;
}

function sphereMaterialFor(name) {
  const live = findLiveMaterial(name);
  if (live) return live;
  const entry = entityByName(name);
  return loadOrphanMaterial(entry || { color: 0x9aa4b8 });
}

// ---------- Part A: flat grid stops ----------
export function buildGridStop(stop) {
  const group = new THREE.Group();
  const entries = stop.bodies.map(entityByName).filter(Boolean);
  if (!entries.length) return { group, cameraDistance: 20 };

  const maxD = Math.max(...entries.map((e) => e.diameterKm));
  const radii = entries.map((e) => Math.max(MIN_RADIUS, (e.diameterKm / maxD) * MAX_RADIUS));

  // Labels are a FIXED world size regardless of each body's own radius —
  // scaling label size to r (the original approach) made a large body's
  // label balloon out far past its neighbors (the Sun's label alone would
  // span ~22 world units, swallowing every other body's position in a
  // "Sun vs. Planets" row) — that was the actual cause of the reported
  // text-overlap bug, not a layout/spacing miscalculation. GAP is sized
  // with margin over LABEL_WIDTH so two adjacent labels never touch even in
  // the worst case (both bodies at MIN_RADIUS, contributing the least
  // sphere-to-sphere spacing of their own).
  const LABEL_WIDTH = 2.4;
  const LABEL_HEIGHT = 0.42;
  const GAP = 2.6;
  const totalWidth = radii.reduce((sum, r) => sum + r * 2, 0) + GAP * (radii.length - 1);
  let x = -totalWidth / 2;

  entries.forEach((entry, i) => {
    const r = radii[i];
    x += r;

    const mat = sphereMaterialFor(entry.name);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 40), mat);
    mesh.position.set(x, r, 0); // bottom-aligned at y=0, same "circles' bottoms line up" read the old 2D panel used
    group.add(mesh);

    const trueR = (entry.diameterKm / maxD) * MAX_RADIUS;
    const clamped = trueR < MIN_RADIUS;
    const label = makeTextSprite(`${entry.name} — ${formatDiameterKm(entry.diameterKm)}${clamped ? " (enlarged)" : ""}`, {
      size: 30,
      widthPx: 420,
      heightPx: 70,
    });
    label.scale.set(LABEL_WIDTH, LABEL_HEIGHT, 1);
    // Fixed offset below the common y=0 ground line every sphere already
    // bottom-aligns to (mesh.position.y = r, so every sphere's bottom sits
    // at y=0 regardless of its own radius) — not r-dependent either, so
    // labels line up in a single row under the whole group instead of
    // drifting to wildly different heights for a big body vs. a small one.
    label.position.set(x, -0.5, 0);
    group.add(label);

    x += r + GAP;
  });

  const title = makeTextSprite(stop.title, { size: 44, color: "rgba(255,210,122,0.95)", widthPx: 700, heightPx: 110 });
  title.scale.multiplyScalar(Math.max(3, totalWidth * 0.12));
  title.position.set(0, Math.max(...radii) * 1.9 + 1.5, 0);
  group.add(title);

  return { group, cameraDistance: totalWidth * 1.1 + 4, cameraHeight: Math.max(...radii) * 0.6 };
}

// ---------- Part B: orbit-ring stops ----------
const RING_STEP = 3.4;

function buildRing(radius) {
  const points = [];
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0x6a7fd8, transparent: true, opacity: 0.4 });
  return new THREE.LineLoop(geo, mat);
}

function buildGalaxySprite(entry) {
  const mat = new THREE.SpriteMaterial({ transparent: true, opacity: 0.95, depthWrite: false, fog: false, color: entry.color ?? 0xffffff });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(2.6);
  if (entry.imageUrl) {
    loadRealTexture(entry.imageUrl, (tex) => {
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  }
  return sprite;
}

function galaxyByName(name) {
  return GALAXY_DATA.find((g) => g.name === name);
}

export function buildOrbitStop(stop) {
  const group = new THREE.Group();

  if (stop.ring === "solarSystem") {
    // No new geometry — the caller (sizeCompareMode.js) frames the real,
    // already-existing AppState.scene directly for this one stop instead of
    // swapping to this (empty) group.
    return { group, reuseMainScene: true, cameraDistance: 60 };
  }

  if (stop.ring === "sunAndBlackHole") {
    const sunEntry = entityByName(stop.sun);
    const innerR = 0.9;
    group.add(buildRing(innerR));
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(innerR * 0.35, 32, 32), sunMat.clone());
    sunMesh.position.set(innerR, 0, 0);
    group.add(sunMesh);
    group.add(makeTextSprite("The Sun's orbit", { size: 26, widthPx: 360, heightPx: 60 }).translateX(innerR).translateY(0.6));

    const outerR = innerR + RING_STEP;
    group.add(buildRing(outerR));
    const bh = buildBlackHole(stop.blackHoleName, { Type: "Supermassive black hole" }, "", outerR * 0.14, 0.5);
    bh.position.set(outerR, 0, 0);
    group.add(bh);

    return { group, cameraDistance: outerR * 2.6 };
  }

  if (stop.ring === "galaxy") {
    const entry = galaxyByName(stop.galaxyName);
    if (!entry) return { group, cameraDistance: 20 };

    const innerR = 1.2;
    group.add(buildRing(innerR));
    group.add(makeTextSprite("Local Group / Supercluster orbit", { size: 22, widthPx: 460, heightPx: 60 }).translateY(innerR + 0.6));

    const outerR = innerR + RING_STEP;
    group.add(buildRing(outerR));
    const sprite = buildGalaxySprite(entry);
    sprite.position.set(outerR, 0, 0);
    group.add(sprite);
    group.add(makeTextSprite(entry.name, { size: 26, widthPx: 380, heightPx: 60 }).translateX(outerR).translateY(-1.8));

    if (entry.blackHole) {
      const bhR = outerR + RING_STEP * 0.55;
      const bh = buildBlackHole(entry.blackHole.name, entry.blackHole.meta || {}, entry.blackHole.info || "", 0.55, 0.5);
      bh.position.set(outerR + 1.6, 1.3, 0);
      group.add(bh);
      void bhR;
    }

    return { group, cameraDistance: outerR * 2.4 };
  }

  if (stop.ring === "closeup") {
    const bh = buildBlackHole(stop.blackHoleName, { Type: "Supermassive black hole" }, "", 3.2, 0.5);
    group.add(bh);
    return { group, cameraDistance: 9 };
  }

  return { group, cameraDistance: 20 };
}

export function buildStopContent(stop) {
  if (stop.kind === "grid") return buildGridStop(stop);
  return buildOrbitStop(stop);
}
