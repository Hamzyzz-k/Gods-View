import * as THREE from "three";
import { loadRealTexture } from "../textures/realTextures.js";

// ---------- per-landmark photosphere scenes ----------
// Built once and cached by landmark name — same pattern
// surface/surfaceScene.js and cosmos/tierScenes.js already established.
// Each scene is just ONE sphere: the equirectangular photo itself IS the
// entire environment, viewed from inside (BackSide), with the player
// standing at its exact center — unlike Surface Mode, there's no separate
// ground plane, because a real photo panorama already contains its own
// ground within the image, and there is nowhere for a "walk across it"
// gravity model to actually go without the scene distorting.
const DOME_RADIUS = 50;
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

export function getLandmarkScene(entry) {
  if (sceneCache.has(entry.name)) return sceneCache.get(entry.name);

  const scene = new THREE.Scene();
  scene.name = `landmark:${entry.name}`;

  const geo = new THREE.SphereGeometry(DOME_RADIUS, 48, 32);
  const tex = new THREE.CanvasTexture(buildPlaceholderCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = "landmarkDome";
  // Mirrors the sphere horizontally: SphereGeometry's default UV winding is
  // correct for an OUTWARD-facing view, but viewed from BackSide (inside,
  // which is what standing inside a panorama needs), left and right swap —
  // a well-known gotcha for inside-a-sphere equirectangular viewers.
  // NOTE: not visually confirmed in this pass — this sandboxed preview
  // environment can't composite frames for a screenshot (documented
  // elsewhere in this project's own verification notes), so this is the
  // standard fix for the standard problem, applied on that basis, and
  // worth a real look once someone can actually see it rendered.
  dome.scale.x = -1;
  scene.add(dome);

  loadRealTexture(entry.imageUrl, (t) => {
    t.wrapS = THREE.ClampToEdgeWrapping; // a single full 360° wrap, not a repeating tile
    mat.map = t;
    mat.needsUpdate = true;
  });

  scene.add(new THREE.AmbientLight(0xffffff, 1)); // the panorama IS the lighting; this just keeps every scene in the app having an explicit light, consistent with the rest

  sceneCache.set(entry.name, scene);
  return scene;
}
