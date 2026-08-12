import * as THREE from "three";
import { raDecToVec3 } from "../core/starfield.js";
import { loadRealTexture } from "../textures/realTextures.js";
import { getTexture } from "../textures/proceduralTextures.js";
import { registerTierClickables } from "../interaction/raycastPicking.js";
import { getGalaxiesForTier } from "./galaxyData.js";

// ---------- galaxy factory ----------
// Builds one Mesh + glow-Sprite pair per galaxy for a given tier — a real
// THREE.Mesh with its own SphereGeometry, not a Sprite, specifically so
// interaction/focus.js's focusOnObject() (which reads
// obj.geometry.boundingSphere.radius to frame the camera) gets a REAL,
// correctly-sized bounding sphere. THREE.Sprite instances all share one
// module-level unit-quad geometry internally regardless of their .scale,
// so a bounding-sphere read against a scaled Sprite would report the
// unscaled quad's tiny radius instead — the exact wrong number for a
// galaxy meant to read as hundreds of units across. The child glow Sprite
// is purely decorative (never focused/clicked directly), so that
// limitation doesn't apply to it — same sphere-mesh-plus-child-glow-sprite
// shape surface/skyObjects.js's buildNeighbourPlanet() already uses for
// exactly this reason.

// Preserves each object's real relative ordering/direction while keeping
// everything visible within one tier's bounds — the log1p compression the
// project's design already commits to (galaxies span 160,000 to 3.8
// billion light-years; a linear scale would put all but the very nearest
// at the same spot).
function compressDistance(distanceLy, dMaxLy, innerR, outerR) {
  const t = Math.log1p(distanceLy) / Math.log1p(dMaxLy);
  return innerR + (outerR - innerR) * t;
}

// Returns a raw <canvas> (not a texture) — the shape getTexture()'s cache
// factory expects, matching every other procedural generator in
// textures/proceduralTextures.js.
function proceduralGalaxyCanvas(hexColor) {
  const c = new THREE.Color(hexColor);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},1)`);
  grd.addColorStop(0.5, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.7)`);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

function makeGlowSprite(hexColor, scale) {
  const c = new THREE.Color(hexColor);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.5)`);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false,
  }));
  sprite.scale.setScalar(scale);
  return sprite;
}

function buildGalaxyMesh(entry, innerR, outerR, dMaxLy) {
  const displayR = compressDistance(entry.distanceLy, dMaxLy, innerR, outerR);
  const dir = raDecToVec3(entry.raHours, entry.decDeg, 1);
  const position = dir.multiplyScalar(displayR);

  const visualRadius = THREE.MathUtils.clamp(outerR * 0.02, 30, 150);
  const textureKey = `Galaxy_${entry.name.replace(/\s+/g, "")}`;
  const mat = new THREE.MeshBasicMaterial({
    map: getTexture(textureKey, () => proceduralGalaxyCanvas(entry.color)),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(visualRadius, 20, 20), mat);
  mesh.name = entry.name;
  mesh.position.copy(position);
  mesh.userData.info = { name: entry.name, meta: entry.meta, info: entry.info };
  mesh.add(makeGlowSprite(entry.color, visualRadius * 5));

  if (entry.imageUrl) {
    loadRealTexture(entry.imageUrl, (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }

  return mesh;
}

// Every galaxy mesh ever built, across every tier — backs the
// assistant/sceneRegistry.js "galaxies" group entry (setGroupVisible(["galaxies"], ...)
// in a voice/chat command), the same "one registry entry toggles every
// member regardless of which scene is currently active" shape
// "constellations" already has there. A galaxy built in a tier that isn't
// even the active one right now still needs to honor the last visibility
// choice once its tier IS entered, so this list — not a per-tier one — is
// what that toggle should act on.
const allGalaxyMeshes = [];
let galaxiesVisible = true;

// Builds every galaxy belonging to one tier, registers them all as that
// tier's clickable set (interaction/raycastPicking.js's per-tier registry
// — cosmos/tierNavigation.js), and returns a Group ready to add to that
// tier's scene.
export function buildGalaxiesForTier(tierId, innerR, outerR, dMaxLy) {
  const group = new THREE.Group();
  group.name = `galaxies:${tierId}`;
  const entries = getGalaxiesForTier(tierId);
  const meshes = entries.map((entry) => buildGalaxyMesh(entry, innerR, outerR, dMaxLy));
  meshes.forEach((m) => {
    m.visible = galaxiesVisible;
    group.add(m);
    allGalaxyMeshes.push(m);
  });
  registerTierClickables(tierId, meshes);
  return group;
}

export function setAllGalaxiesVisible(visible) {
  galaxiesVisible = visible;
  allGalaxyMeshes.forEach((m) => (m.visible = visible));
}

export function areGalaxiesVisible() {
  return galaxiesVisible;
}
