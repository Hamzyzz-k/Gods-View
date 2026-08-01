import * as THREE from "three";
import { AppState } from "../core/state.js";
import { loadRealTexture, REAL_TEXTURE_URLS } from "../textures/realTextures.js";
import { getTexture, sunTexture } from "../textures/proceduralTextures.js";
const { scene } = AppState;

// ---------- sun ----------
export const sunGeo = new THREE.SphereGeometry(8, 48, 48);
export const sunMat = new THREE.MeshBasicMaterial({ map: getTexture("Sun", () => sunTexture(1024, 512)) });
export const sun = new THREE.Mesh(sunGeo, sunMat);
sun.name = "Sun";
scene.add(sun);
loadRealTexture(REAL_TEXTURE_URLS.Sun, (tex) => {
  sunMat.map = tex;
  sunMat.needsUpdate = true;
});

// glow sprite around sun
export function createGlow(size, color, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(255,220,150,${opacity})`);
  grd.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(size, size, 1);
  return sprite;
}
export const glow = createGlow(45, 0xffcc55, 0.9);
sun.add(glow);

// Fresnel-style atmosphere rim glow: a slightly larger back-facing sphere
// that brightens toward the silhouette edge, additively blended. Cheap
// (no extra light sources or shadow work) and reads as a soft atmospheric
// halo on planets with real atmospheres.
export function createAtmosphere(radius, color) {
  const geo = new THREE.SphereGeometry(radius * 1.12, 48, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 1.0) * 0.55);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}
