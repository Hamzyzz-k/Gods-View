import * as THREE from "three";
import { SURFACE_GROUND_SIZE } from "./surfaceData.js";

// ---------- wind visuals ----------
// Two effects, both driven by a planet's windSpeed/windStyle
// (surface/surfaceData.js), both purely visual/decorative (no gameplay
// effect on walking):
//
//   - A THREE.Points field of drifting dust/cloud sprites, blown across the
//     ground in one fixed direction and wrapped back around when a particle
//     exits the play area — cheap (one draw call regardless of count) and
//     the same "no external assets" approach as every other texture in this
//     app: the sprite itself is a small radial-gradient canvas.
//   - For gas giants specifically, the ground texture's own UV offset is
//     nudged every frame so the cloud-band texture visibly "flows" —
//     reuses the existing ground material rather than adding new geometry,
//     since a gas giant's surface IS the weather, not separate from it.

const HALF = SURFACE_GROUND_SIZE / 2;

const STYLE = {
  dust: { count: 160, heightRange: [0.15, 2.5], baseSpeed: 3, sizeRange: [0.25, 0.7], color: "#c9b89a", opacity: 0.35 },
  gas: { count: 260, heightRange: [4, 45], baseSpeed: 7, sizeRange: [1.5, 4], color: "#ffffff", opacity: 0.4 },
};

function makeSpriteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
let spriteTexCache = null;
function spriteTexture() {
  if (!spriteTexCache) spriteTexCache = makeSpriteTexture();
  return spriteTexCache;
}

// Called once per surface scene build (surfaceScene.js). Returns null for
// windStyle "none" (Mercury/Pluto) — no mesh, no per-frame cost.
export function buildWindParticles(cfg) {
  if (!cfg.windStyle || cfg.windStyle === "none" || cfg.windSpeed <= 0) return null;
  const style = STYLE[cfg.windStyle];

  const positions = new Float32Array(style.count * 3);
  for (let i = 0; i < style.count; i++) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(SURFACE_GROUND_SIZE);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(style.heightRange[0], style.heightRange[1]);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(SURFACE_GROUND_SIZE);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));

  // PointsMaterial's own `size` is a single value for every particle in the
  // draw call (per-vertex size needs a custom ShaderMaterial, which this app
  // deliberately avoids everywhere else) — using the midpoint of the style's
  // size range is close enough for a stylized dust/cloud field.
  const mat = new THREE.PointsMaterial({
    map: spriteTexture(),
    color: new THREE.Color(style.color),
    size: (style.sizeRange[0] + style.sizeRange[1]) / 2,
    sizeAttenuation: true,
    transparent: true,
    opacity: style.opacity,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = "windParticles";

  // Fixed per-scene wind direction/speed — picked once at build time so it
  // stays consistent for the life of the (cached) surface scene rather than
  // randomizing every frame.
  const angle = Math.random() * Math.PI * 2;
  points.userData.direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  points.userData.speed = style.baseSpeed * cfg.windSpeed;

  return points;
}

const _delta = new THREE.Vector3();

// Called once per frame while a surface scene with wind is active (see
// core/loop.js). Wraps particles that drift past the ground's edge back
// around to the opposite side, so the field reads as endless rather than
// visibly finite.
export function updateWindParticles(scene, dt) {
  const points = scene.getObjectByName("windParticles");
  if (points) {
    const { direction, speed } = points.userData;
    const pos = points.geometry.attributes.position;
    _delta.copy(direction).multiplyScalar(speed * dt);
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + _delta.x;
      let z = pos.getZ(i) + _delta.z;
      if (x > HALF) x -= SURFACE_GROUND_SIZE;
      else if (x < -HALF) x += SURFACE_GROUND_SIZE;
      if (z > HALF) z -= SURFACE_GROUND_SIZE;
      else if (z < -HALF) z += SURFACE_GROUND_SIZE;
      pos.setX(i, x);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  // Gas giants: nudge the ground texture's own UV offset so the cloud-band
  // pattern visibly flows, instead of (or alongside) particles drifting over
  // a static surface — the surface IS the weather on a gas giant.
  const ground = scene.getObjectByName("surfaceGround");
  if (ground?.userData.windSpeed) {
    ground.material.map.offset.x += ground.userData.windSpeed * 0.015 * dt;
    if (ground.material.normalMap) ground.material.normalMap.offset.x = ground.material.map.offset.x;
  }
}
