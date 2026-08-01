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
// that brightens toward the silhouette edge, additively blended.
//
// "Fresnel" here just means the effect strengthens as a surface turns away
// from the viewer, which is why it concentrates into a ring at the limb and
// stays nearly invisible face-on — the same reason a real atmosphere is most
// obvious on a planet's edge, where you look through the most air.
//
// Cost is deliberately tiny so this can run on every body at VR framerates:
// one dot product and one pow per pixel, no texture sample and no lighting.
//
// Tuning knobs:
//   scale   — shell size relative to the planet; larger = thicker halo
//   power   — falloff sharpness; higher = tighter ring hugging the limb
//   opacity — overall strength
//   bias    — how far the glow wraps toward the lit face
export function createAtmosphere(radius, color, opts = {}) {
  const { scale = 1.12, power = 3.0, opacity = 0.55, bias = 0.65 } = opts;
  const geo = new THREE.SphereGeometry(radius * scale, 48, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uOpacity: { value: opacity },
      uBias: { value: bias },
    },
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
      uniform float uPower;
      uniform float uOpacity;
      uniform float uBias;
      void main() {
        // vNormal is in view space, so dotting against the view axis gives
        // 0 at the silhouette edge and 1 facing the camera.
        float intensity = pow(uBias - dot(vNormal, vec3(0.0, 0.0, 1.0)), uPower);
        gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 1.0) * uOpacity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- sun corona ----------
// The sprite above gives a soft, wide bloom but no defined edge, so the sun
// read as a lit ball rather than something emitting light. Two Fresnel shells
// on top of it add the bright rim a star actually has:
//
//   inner — tight and hot, hugging the surface (the chromosphere edge)
//   outer — wide, dim and cooler, falling off into space (the corona)
//
// Both are additive, so they stack into a gradient rather than flat bands.
// Declared after createAtmosphere because they use it.
const sunCoronaInner = createAtmosphere(8, 0xffd27a, {
  scale: 1.10, power: 2.4, opacity: 0.75, bias: 0.85,
});
const sunCoronaOuter = createAtmosphere(8, 0xff9a3c, {
  scale: 1.45, power: 1.7, opacity: 0.32, bias: 0.95,
});
sun.add(sunCoronaInner);
sun.add(sunCoronaOuter);
export const sunCorona = [sunCoronaInner, sunCoronaOuter];
