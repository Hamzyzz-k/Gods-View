import * as THREE from "three";
import { raDecToVec3 } from "../core/starfield.js";
import { loadRealTexture } from "../textures/realTextures.js";
import { getTexture } from "../textures/proceduralTextures.js";
import { registerTierClickables } from "../interaction/raycastPicking.js";
import { getGalaxiesForTier } from "./galaxyData.js";
import { buildBlackHole } from "./blackHole.js";

// ---------- galaxy factory ----------
// Each galaxy is a transparent proxy Mesh (real geometry, real bounding
// sphere) carrying a visible child Sprite. Two separate objects because they
// need two different things a single object can't give both:
//
//   - interaction/focus.js's focusOnObject() reads obj.geometry.
//     boundingSphere.radius to frame the camera, and raycastPicking.js needs
//     a real clickable target — both require an actual THREE.Mesh with its
//     own geometry. THREE.Sprite instances all share ONE module-level
//     unit-quad geometry regardless of .scale, so a bounding-sphere read
//     against a scaled Sprite reports the tiny unscaled quad's radius, not
//     the galaxy's real size — the wrong number for framing.
//   - the VISIBLE galaxy needs to be a Sprite, not a Mesh, because that's
//     what actually reads as "a real galaxy" rather than "a planet": a
//     Sprite always faces the camera, so a real photo (or the procedural
//     placeholder before it loads) shows flat, the way a photo of a galaxy
//     actually looks, instead of being wrapped around a sphere and
//     distorting into a globe.
//
// The proxy stays visible=true (WebGLRenderer skips a whole subtree's
// render when a PARENT is invisible, so setting the proxy invisible would
// have silently hidden its Sprite children too) — instead its own material
// is fully transparent, so it draws nothing but still recurses into and
// renders its children, and still raycasts normally (Mesh.raycast tests
// geometry only, never opacity). The visible Sprite is a plain decorative
// child, exactly like the glow sprite every clickable body in this app
// (surface/skyObjects.js's buildNeighbourPlanet(), this file's own glow)
// already adds for the same "Mesh you can click, Sprite you can't" split.

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
// textures/proceduralTextures.js. This is what's shown immediately (and,
// for the one galaxy with no real photo — Virgo Cluster — permanently);
// every entry with an imageUrl swaps to the real Wikimedia photo once it
// loads. Shaped by `type` rather than a single generic blob, so even the
// placeholder reads as the right KIND of galaxy rather than a uniform glow.
function proceduralGalaxyCanvas(hexColor, type) {
  const c = new THREE.Color(hexColor);
  const rgb = `${c.r * 255},${c.g * 255},${c.b * 255}`;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const cx = 128, cy = 128;

  function glow(x, y, radius, alpha) {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, `rgba(${rgb},${alpha})`);
    grd.addColorStop(0.6, `rgba(${rgb},${alpha * 0.4})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (type === "Elliptical galaxy") {
    // A flattened, featureless glow — no arms, no disk, just an old, smooth
    // stellar population concentrated toward the center.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.62);
    ctx.translate(-cx, -cy);
    glow(cx, cy, 120, 0.9);
    ctx.restore();
  } else if (type === "Irregular dwarf galaxy") {
    // Clumpy, asymmetric star-forming regions rather than a single
    // symmetric shape — real irregulars (LMC/SMC) have no defined center.
    const blobs = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < blobs; i++) {
      glow(cx + (Math.random() - 0.5) * 150, cy + (Math.random() - 0.5) * 150, 35 + Math.random() * 45, 0.75);
    }
  } else if (type === "Ring galaxy") {
    glow(cx, cy, 55, 0.6);
    ctx.strokeStyle = `rgba(${rgb},0.85)`;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "Galaxy cluster" || type === "Colliding galaxy clusters") {
    // Not one galaxy but a scattered field of many — small glow points
    // spread across the frame, plus a faint overall haze for the hot
    // intracluster gas.
    ctx.fillStyle = `rgba(${rgb},0.07)`;
    ctx.fillRect(0, 0, 256, 256);
    const blobs = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < blobs; i++) {
      glow(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 20, 0.9);
    }
  } else {
    // Spiral galaxy (default): bright core plus a couple of soft arm
    // strokes curling outward — a cheap but legible stand-in for a spiral's
    // defining feature.
    glow(cx, cy, 34, 0.95);
    for (let a = 0; a < 2; a++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a * Math.PI);
      ctx.strokeStyle = `rgba(${rgb},0.45)`;
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05) {
        const r = t * 116;
        const theta = t * Math.PI * 2.1;
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta) * 0.55;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

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

// Returns an array of top-level clickable meshes for this entry: the galaxy
// proxy always, plus a black hole marker for the entries that have one
// (galaxyData.js's `blackHole` field) — see the block near the end of this
// function for why that has to be a sibling mesh rather than a child.
function buildGalaxyMesh(entry, innerR, outerR, dMaxLy) {
  const displayR = compressDistance(entry.distanceLy, dMaxLy, innerR, outerR);
  const dir = raDecToVec3(entry.raHours, entry.decDeg, 1);
  const position = dir.multiplyScalar(displayR);

  const visualRadius = THREE.MathUtils.clamp(outerR * 0.02, 30, 150);
  const textureKey = `Galaxy_${entry.name.replace(/\s+/g, "")}`;
  const map = getTexture(textureKey, () => proceduralGalaxyCanvas(entry.color, entry.type));

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

  // The visible galaxy: a camera-facing Sprite, sized a bit larger than the
  // pickable proxy so the photo/procedural art reads clearly around it.
  const spriteMat = new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.setScalar(visualRadius * 2.4);
  proxy.add(sprite);
  proxy.add(makeGlowSprite(entry.color, visualRadius * 5));

  if (entry.imageUrl) {
    loadRealTexture(entry.imageUrl, (tex) => {
      spriteMat.map = tex;
      spriteMat.needsUpdate = true;
    });
  }

  const meshes = [proxy];

  // A handful of major galaxies (galaxyData.js's `blackHole` field) get their
  // own separate clickable marker — not a child of the galaxy proxy, since
  // recursive=false raycasting (raycastPicking.js) only ever tests the
  // top-level entries in the clickables array, and it needs its own
  // independent hit area rather than being buried entirely inside the
  // galaxy sprite's footprint. Offset up and to the side of the galaxy by a
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
