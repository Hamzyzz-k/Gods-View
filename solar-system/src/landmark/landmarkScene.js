import * as THREE from "three";
import { loadRealTexture } from "../textures/realTextures.js";
import { createStarfield } from "../core/starfield.js";

// ---------- per-landmark scenes ----------
// Built once and cached by landmark name — same pattern
// surface/surfaceScene.js and cosmos/tierScenes.js already established.
//
// Two shapes, chosen by the landmark's own `mode` (see landmark/
// landmarkData.js for why only two of the seven wonders can honestly be
// the first kind):
//
//   "sphere" — a real equirectangular photosphere. One inside-out sphere;
//     the photo IS the whole environment, and the viewer stands at its
//     exact centre. No ground plane, unlike Surface Mode: a real panorama
//     already contains its own ground.
//   "screen" — an ordinary wide panorama on a large curved screen in front
//     of the viewer, against a starfield surround. A gently curved plane
//     rather than a flat one so it still fills peripheral vision and reads
//     as a place rather than a poster, but it deliberately does NOT claim
//     to be a full sphere it isn't.
const DOME_RADIUS = 50;
const SCREEN_RADIUS = 26; // curvature radius of the screen arc; also how far in front of the viewer it sits
const sceneCache = new Map();

function buildPlaceholderCanvas() {
  // No procedural "photo of a real place" generator exists (unlike the
  // planets' procedural textures, which stand in for a plausible surface
  // rather than a specific real photo) — this is an honest neutral
  // placeholder, not a fake landmark, shown only for the moment before the
  // real photo loads.
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 2;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 2);
  grad.addColorStop(0, "#6a8fb8");
  grad.addColorStop(1, "#2a3644");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 2);
  return c;
}

function makeMaterial() {
  const tex = new THREE.CanvasTexture(buildPlaceholderCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
}

function swapInRealPhoto(entry, mat) {
  loadRealTexture(entry.imageUrl, (t) => {
    t.wrapS = THREE.ClampToEdgeWrapping; // a single image, never a repeating tile
    t.wrapT = THREE.ClampToEdgeWrapping;
    mat.map = t;
    mat.needsUpdate = true;
  });
}

function buildPhotosphere(entry) {
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 48, 32), mat);
  mesh.name = "landmarkDome";
  // Mirrors the sphere horizontally: SphereGeometry's default UV winding is
  // correct for an OUTWARD-facing view, but viewed from BackSide (inside,
  // which is what standing inside a panorama needs), left and right swap —
  // a well-known gotcha for inside-a-sphere equirectangular viewers.
  mesh.scale.x = -1;
  swapInRealPhoto(entry, mat);
  return mesh;
}

function buildCurvedScreen(entry, aspect) {
  const mat = makeMaterial();
  // A horizontal slice of a cylinder: `thetaLength` sets how much of the
  // viewer's field of view the screen wraps around, and the height is
  // derived from the photo's own aspect ratio so it is never stretched —
  // the whole reason this mode exists rather than forcing everything onto
  // a sphere.
  const arc = Math.min(Math.PI * 1.1, (aspect / 3.2) * Math.PI * 0.7); // wider photos wrap further around
  const width = SCREEN_RADIUS * arc;
  const height = width / aspect;
  const geo = new THREE.CylinderGeometry(SCREEN_RADIUS, SCREEN_RADIUS, height, 64, 1, true, -arc / 2, arc);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "landmarkDome"; // same name both modes, so callers/tests don't need to care which they got
  mesh.rotation.y = Math.PI; // face the viewer's default -Z look direction
  swapInRealPhoto(entry, mat);
  return mesh;
}

export function getLandmarkScene(entry) {
  if (sceneCache.has(entry.name)) return sceneCache.get(entry.name);

  const scene = new THREE.Scene();
  scene.name = `landmark:${entry.name}`;

  if (entry.mode === "screen") {
    // `aspect` comes from each image's real, API-verified dimensions
    // (landmark/landmarkData.js), so the screen is built at the photo's
    // true ratio and never stretches it.
    scene.add(buildCurvedScreen(entry, entry.aspect));
    createStarfield(scene); // surround, so the space around the screen isn't an empty void
  } else {
    scene.add(buildPhotosphere(entry));
  }

  scene.add(new THREE.AmbientLight(0xffffff, 1)); // the photo IS the lighting; this just keeps every scene in the app having an explicit light, consistent with the rest

  sceneCache.set(entry.name, scene);
  return scene;
}
