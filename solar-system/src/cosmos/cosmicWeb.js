import * as THREE from "three";
import { loadRealTexture } from "../textures/realTextures.js";

// A real large-scale-structure simulation frame (Millennium-Simulation-
// style dark-matter web) — Volker Springel / Max Planck Institute for
// Astrophysics, CC BY-SA 4.0, individually verified against the live
// Wikimedia Commons API. Attribution required (unlike the public-domain
// NASA imagery used elsewhere in this app) — see the credit comment on its
// use below.
const COSMIC_WEB_PHOTO_URL = "https://upload.wikimedia.org/wikipedia/commons/0/0f/Cosmic_web.jpg";
const COSMIC_WEB_CREDIT = "Volker Springel / Max Planck Institute for Astrophysics, CC BY-SA 4.0";

// ---------- Observable Universe tier content ----------
// The finale tier: a single CMB/cosmic-web shell wrapping the whole tier —
// the closest thing to an "edge" of the observable universe, the relic
// light from ~380,000 years after the Big Bang, with the real large-scale
// filament structure as the shell's own surface texture rather than
// separate floating geometry layered on top of it (an earlier version had
// a flat photo plane plus a procedural node/filament line graph inside the
// shell — both removed per explicit feedback: the globe itself should
// carry the look, not a picture floating inside a wireframe).

export const WEB_RADIUS = 8000;

function buildCmbShell() {
  const geo = new THREE.SphereGeometry(WEB_RADIUS * 1.1, 48, 32);
  // Starts as a plain dark sphere (no procedural placeholder texture — a
  // flat dark shell is a perfectly reasonable placeholder for the ~2s it
  // takes the real photo to load, same "harmless no-op fallback" pattern
  // every other real-image upgrade in this app uses) and swaps in the real
  // photo once it loads.
  const mat = new THREE.MeshBasicMaterial({ color: 0x05060c, side: THREE.BackSide, fog: false, depthWrite: false });
  const shell = new THREE.Mesh(geo, mat);
  shell.name = "cmbShell";
  shell.userData.credit = COSMIC_WEB_CREDIT; // CC BY-SA 4.0 — attribution required, unlike the public-domain NASA imagery elsewhere in this app

  loadRealTexture(COSMIC_WEB_PHOTO_URL, (tex) => {
    // The source photo is a single frame (678x452), not a full 360°
    // equirectangular capture of the sky — RepeatWrapping tiles it across
    // the whole sphere rather than stretching one frame paper-thin over
    // the entire globe. This reads fine for an abstract, textural pattern
    // like a filament field (unlike a single object, e.g. a planet, where
    // tiling would look obviously wrong) — the same reasoning any tiled
    // material (grass, brick, noise) relies on elsewhere in 3D work.
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 3);
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  });

  return shell;
}

export function buildObservableUniverseBackdrop() {
  const group = new THREE.Group();
  group.name = "observableUniverseBackdrop";
  group.add(buildCmbShell());
  return group;
}
