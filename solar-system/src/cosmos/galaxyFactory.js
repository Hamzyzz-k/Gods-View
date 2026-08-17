import * as THREE from "three";
import { raDecToVec3 } from "../core/starfield.js";
import { registerTierClickables } from "../interaction/raycastPicking.js";
import { getGalaxiesForTier } from "./galaxyData.js";
import { buildGalaxyParticles } from "./galaxyGeometry.js";
import { buildBlackHole } from "./blackHole.js";

// ---------- galaxy factory ----------
// Each galaxy is a transparent proxy Mesh (real geometry, real bounding
// sphere) carrying a real particle-field child — a THREE.Points object built
// by cosmos/galaxyGeometry.js, shaped by that galaxy's actual TYPE (spiral
// arms, elliptical spheroid, irregular clumps, ring, or a cluster of many
// member galaxies). Same approach cosmos/milkyWay.js already takes for the
// Milky Way's own spiral, applied to the whole roster.
//
// This replaced an earlier flat camera-facing photo Sprite per galaxy. The
// photo always faced the viewer, so it read as a flat cutout the moment you
// flew around it — no depth, no parallax, no structure to orbit. A real
// particle field is an actual object in the scene: you can circle it, see a
// spiral go edge-on, and fly through the outskirts of a cluster. (The
// verified real photos are still used, and still worth having, in the size
// comparison sequence — see sizeCompare/sizeCompareScene.js, where flat
// imagery is exactly right for a side-by-side scale comparison.)
//
// The proxy stays a Mesh, and stays visible=true, for two specific reasons:
//
//   - interaction/focus.js's focusOnObject() reads obj.geometry.
//     boundingSphere.radius to frame the camera, and raycastPicking.js needs
//     a real clickable target — both require an actual THREE.Mesh with its
//     own geometry. A Points object's bounding sphere would work for framing
//     but gives a far worse click target (you'd have to hit an individual
//     particle), so the invisible sphere stays as the hit area.
//   - WebGLRenderer skips a whole subtree's render when a PARENT is
//     invisible, so setting the proxy .visible = false would silently hide
//     its particle children too. Instead its own material is fully
//     transparent: it draws nothing, still recurses into and renders its
//     children, and still raycasts normally (Mesh.raycast tests geometry
//     only, never opacity).

// Preserves each object's real relative ordering/direction while keeping
// everything visible within one tier's bounds — the log1p compression the
// project's design already commits to (galaxies span 160,000 to 3.8
// billion light-years; a linear scale would put all but the very nearest
// at the same spot).
function compressDistance(distanceLy, dMaxLy, innerR, outerR) {
  const t = Math.log1p(distanceLy) / Math.log1p(dMaxLy);
  return innerR + (outerR - innerR) * t;
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

// Returns an array of top-level clickable meshes for this entry: the galaxy
// proxy always, plus a black hole marker for the entries that have one
// (galaxyData.js's `blackHole` field) — see the block near the end of this
// function for why that has to be a sibling mesh rather than a child.
function buildGalaxyMesh(entry, innerR, outerR, dMaxLy) {
  const displayR = compressDistance(entry.distanceLy, dMaxLy, innerR, outerR);
  const dir = raDecToVec3(entry.raHours, entry.decDeg, 1);
  const position = dir.multiplyScalar(displayR);

  const visualRadius = THREE.MathUtils.clamp(outerR * 0.02, 30, 150);

  // The proxy: real geometry for focus.js's bounding-sphere framing and
  // raycastPicking.js's hit-testing, fully transparent so it never draws
  // (see the file header for why this has to be a Mesh and not the visible
  // object, and why "invisible" means transparent rather than .visible = false).
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(visualRadius, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  proxy.name = entry.name;
  proxy.position.copy(position);
  proxy.userData.info = { name: entry.name, meta: entry.meta, info: entry.info };

  // The visible galaxy: a real 3D particle field shaped by this entry's own
  // `type` (cosmos/galaxyGeometry.js). Built a little larger than the
  // pickable proxy sphere so the structure reads clearly around it, the same
  // relationship the old Sprite had — the proxy is the hit area, not the
  // visual extent.
  proxy.add(buildGalaxyParticles(entry, visualRadius * 1.35));

  // A soft core glow underneath the particles: real galaxy cores are far
  // brighter than any individual star, and a few thousand discrete points
  // alone can't carry that. Dimmer and tighter than the old sprite-era glow,
  // since it's now accenting real structure rather than standing in for it.
  proxy.add(makeGlowSprite(entry.color, visualRadius * 2.2));

  const meshes = [proxy];

  // A handful of major galaxies (galaxyData.js's `blackHole` field) get their
  // own separate clickable marker — not a child of the galaxy proxy, since
  // recursive=false raycasting (raycastPicking.js) only ever tests the
  // top-level entries in the clickables array, and it needs its own
  // independent hit area rather than being buried entirely inside the
  // galaxy's own footprint. Offset up and to the side of the galaxy by a
  // fixed fraction of its own size — same "stylized, not to scale" policy
  // this whole tier already commits to (see the compressDistance() comment
  // above), just applied one step further in.
  if (entry.blackHole) {
    const bh = entry.blackHole;
    const bhRadius = THREE.MathUtils.clamp(visualRadius * 0.35, 12, 45);
    const bhMesh = buildBlackHole(bh.name, bh.meta, bh.info, bhRadius, 0.5);
    bhMesh.position.copy(position).add(new THREE.Vector3(visualRadius * 1.6, visualRadius * 1.4, 0));
    meshes.push(bhMesh);
  }

  return meshes;
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
  // buildGalaxyMesh() returns an array (the galaxy proxy, plus a black hole
  // marker for the handful of entries that have one) — flattened here so
  // every downstream consumer (the scene group, the clickables registry,
  // the visibility toggle) just sees a flat list of top-level meshes.
  const meshes = entries.flatMap((entry) => buildGalaxyMesh(entry, innerR, outerR, dMaxLy));
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
