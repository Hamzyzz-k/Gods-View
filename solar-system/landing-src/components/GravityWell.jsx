import { useEffect, useRef, useState } from "react";
import { Renderer, Geometry, Program, Mesh, Texture } from "ogl";
import { createVisibilityGate } from "../lib/visibilityGate.js";

import "./GravityWell.css";

// ---------- gravity demonstration ----------
// A rubber-sheet spacetime demo you can actually experiment with.
//
// The sheet is React Bits' ElasticMesh cloth (OGL shader + spring-mesh
// integration, effectively unchanged) with a permanent dent where the mass
// sits. On top of it the user THROWS objects: press anywhere, drag to aim,
// release. Each object then moves under real Newtonian gravity toward the
// mass (a = -GM * r / |r|^3, semi-implicit Euler at a fixed step), so the
// three classic outcomes appear on their own depending only on the throw:
//
//   too slow  -> it falls in and is swallowed
//   just right -> it keeps falling but keeps missing: an orbit
//   too fast  -> it climbs out of the well and escapes
//
// While aiming, the predicted path is drawn using the same integrator the
// live simulation uses, and the speed is shown as a percentage of escape
// velocity at that spot, so the cause of each outcome is visible.
//
// Honest simplifications: objects are pulled only by the central mass, not
// by each other, and the sheet's dent is the visual analogy — the motion
// itself comes from the inverse-square law, not from rolling down the sheet.
//
// Objects are DOM elements; their plane positions are pushed through the
// exact tilt + perspective projection the vertex shader uses, with the
// sheet's own height sampled under them, so they sit in the dent.

const DIST = 4.6;
const FIT = 0.82;
const BASE_GM = 0.08; // gravitational parameter, tuned for a readable orbit period on screen
const CAPTURE_R = 0.075; // anything closer than this is swallowed by the mass
const MAX_OBJECTS = 8;
const THROW_GAIN = 0.6; // plane units of drag -> plane units/second of launch speed
const MAX_SPEED = 1.1;
const TRAIL_LEN = 140;
const GRAVITY_STEP = 1 / 120;
const OBJECT_COLORS = ["#7ab8ff", "#ffd27a", "#b98bff", "#8fe3c7", "#ff9d6c", "#ff7ab8"];

const VERT = `
precision highp float;
attribute vec2 aGrid;
attribute vec2 uv;
attribute vec3 aOffset;
attribute vec3 aNormal;

uniform float uAspect;
uniform float uTilt;
uniform float uDist;
uniform float uFit;

varying vec2 vUv;
varying vec3 vNormal;
varying float vDepth;

void main() {
  vUv = uv;

  vec2 base = vec2((aGrid.x * 2.0 - 1.0) * uAspect, 1.0 - aGrid.y * 2.0);
  vec3 p = vec3(base + aOffset.xy, aOffset.z);

  float ct = cos(uTilt);
  float st = sin(uTilt);
  float ry = p.y * ct - p.z * st;
  float rz = p.y * st + p.z * ct;
  p.y = ry;
  p.z = rz;

  float persp = uDist / (uDist - p.z);
  vec2 clip = vec2(p.x / uAspect, p.y) * persp * uFit;

  vNormal = aNormal;
  vDepth = aOffset.z;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying float vDepth;

uniform sampler2D tMap;
uniform float uHasImage;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uHighlight;
uniform float uShading;
uniform vec2 uRes;
uniform float uRadius;
uniform float uGrid;
uniform float uGridDensity;
uniform float uGridOpacity;
uniform vec3 uGridColor;

void main() {
  vec3 base;
  if (uHasImage > 0.5) {
    base = texture2D(tMap, vUv).rgb;
  } else {
    base = mix(uColor1, uColor2, clamp(vUv.y, 0.0, 1.0));
  }

  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(-0.35, 0.55, 0.78));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);

  float diff = clamp(dot(N, L), 0.0, 1.0);
  float specRaw = pow(clamp(dot(N, H), 0.0, 1.0), 26.0);
  float specFlat = pow(clamp(H.z, 0.0, 1.0), 26.0);
  float spec = clamp((specRaw - specFlat) / (1.0 - specFlat), 0.0, 1.0);
  float ao = clamp(1.0 + vDepth * 0.45, 0.65, 1.25);

  vec3 lit = base * (1.0 - uShading * 0.28);
  lit += base * diff * uShading * 0.55;
  lit *= ao;
  lit += uHighlight * spec * uShading * 0.25;

  if (uGrid > 0.5) {
    vec2 g = vUv * uGridDensity;
    vec2 w = uGridDensity / max(uRes, vec2(1.0));
    vec2 d = abs(fract(g - 0.5) - 0.5) / max(w * 1.5, vec2(1e-4));
    float line = 1.0 - clamp(min(d.x, d.y), 0.0, 1.0);
    lit = mix(lit, uGridColor, line * uGridOpacity * (0.45 + diff * 0.55));
  }

  vec2 p = (vUv - 0.5) * uRes;
  vec2 halfRes = uRes * 0.5;
  float r = min(uRadius, min(halfRes.x, halfRes.y));
  vec2 q = abs(p) - (halfRes - r);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float alpha = 1.0 - smoothstep(-1.25, 1.25, sd);
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(lit, alpha);
}
`;

function hexToRgb(hex) {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const OUTCOME_TEXT = {
  fall: { label: "Falls in", why: "too slow to miss the mass" },
  orbit: { label: "Orbits", why: "falling, but always missing" },
  escape: { label: "Escapes", why: "faster than escape velocity" },
};

export default function GravityWell({
  color1 = "#0a0e1c",
  color2 = "#05060c",
  showGrid = true,
  gridDensity = 24,
  gridOpacity = 0.32,
  gridColor = "#7ab8ff",
  highlight = "#ffffff",
  borderRadius = 0,
  stiffness = 0.045,
  damping = 0.22,
  wellStrength = 1.4,
  wellRadius = 0.65,
  tilt = 18,
  shading = 0.65,
  resolution = 30,
  className = "",
  style,
}) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const coreRef = useRef(null);
  const layerRef = useRef(null);
  const simRef = useRef(null);

  const [mass, setMass] = useState(1);
  const [armed, setArmed] = useState(true);
  const [aim, setAim] = useState(null); // { outcome, pct } while aiming
  const [stats, setStats] = useState({ count: 0, swallowed: 0, escaped: 0 });

  useEffect(() => {
    simRef.current?.setMass(mass);
  }, [mass]);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    const coreEl = coreRef.current;
    const layer = layerRef.current;
    if (!container || !overlay || !coreEl || !layer) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new Renderer({ alpha: true, antialias: true, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.classList.add("gravity-well__sheet");

    const ctx = overlay.getContext("2d");

    const N = Math.max(6, Math.min(40, Math.round(resolution)));
    const nodeCount = N * N;

    const aGrid = new Float32Array(nodeCount * 2);
    const uv = new Float32Array(nodeCount * 2);
    const aOffset = new Float32Array(nodeCount * 3);
    const aNormal = new Float32Array(nodeCount * 3);

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = j * N + i;
        const u = i / (N - 1);
        const v = j / (N - 1);
        aGrid[idx * 2] = u;
        aGrid[idx * 2 + 1] = v;
        uv[idx * 2] = u;
        uv[idx * 2 + 1] = v;
        aNormal[idx * 3 + 2] = 1;
      }
    }

    const quads = (N - 1) * (N - 1);
    const index = new Uint16Array(quads * 6);
    let t = 0;
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i;
        const b = a + 1;
        const c = a + N;
        const d = c + 1;
        index[t++] = a; index[t++] = c; index[t++] = b;
        index[t++] = b; index[t++] = c; index[t++] = d;
      }
    }

    const geometry = new Geometry(gl, {
      aGrid: { size: 2, data: aGrid },
      uv: { size: 2, data: uv },
      aOffset: { size: 3, data: aOffset },
      aNormal: { size: 3, data: aNormal },
      index: { data: index },
    });

    const texture = new Texture(gl, { generateMipmaps: false, flipY: false });

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      cullFace: null,
      uniforms: {
        tMap: { value: texture },
        uHasImage: { value: 0 },
        uColor1: { value: hexToRgb(color1) },
        uColor2: { value: hexToRgb(color2) },
        uHighlight: { value: hexToRgb(highlight) },
        uGrid: { value: showGrid ? 1 : 0 },
        uGridDensity: { value: gridDensity },
        uGridOpacity: { value: gridOpacity },
        uGridColor: { value: hexToRgb(gridColor) },
        uShading: { value: shading },
        uRes: { value: [1, 1] },
        uRadius: { value: borderRadius },
        uAspect: { value: 1 },
        uTilt: { value: (tilt * Math.PI) / 180 },
        uDist: { value: DIST },
        uFit: { value: FIT },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const baseX = new Float32Array(nodeCount);
    const baseY = new Float32Array(nodeCount);
    const pos = new Float32Array(nodeCount * 3);
    const vel = new Float32Array(nodeCount * 3);
    const accel = new Float32Array(nodeCount * 3);

    let aspect = 1;
    let width = 1;
    let height = 1;
    function refreshBase() {
      for (let idx = 0; idx < nodeCount; idx++) {
        baseX[idx] = (aGrid[idx * 2] * 2 - 1) * aspect;
        baseY[idx] = 1 - aGrid[idx * 2 + 1] * 2;
      }
    }

    function resize() {
      width = container.offsetWidth || 1;
      height = container.offsetHeight || 1;
      renderer.setSize(width, height);
      aspect = width / height;
      program.uniforms.uAspect.value = aspect;
      program.uniforms.uRes.value = [width, height];
      overlay.width = Math.round(width * dpr);
      overlay.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refreshBase();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const tiltRad = (tilt * Math.PI) / 180;
    const cosT = Math.cos(tiltRad);
    const sinT = Math.sin(tiltRad);

    // Plane point -> screen pixels, identical to the vertex shader's math.
    function project(px, py, pz) {
      const ry = py * cosT - pz * sinT;
      const rz = py * sinT + pz * cosT;
      const persp = DIST / (DIST - rz);
      const clipX = (px / aspect) * persp * FIT;
      const clipY = ry * persp * FIT;
      return { x: (clipX * 0.5 + 0.5) * width, y: (1 - (clipY * 0.5 + 0.5)) * height, persp };
    }

    // Screen point -> plane point (inverse of project() at z = 0).
    function toPlane(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      const clipX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const clipY = 1 - ((clientY - rect.top) / rect.height) * 2;
      const a = clipY / (cosT * FIT * DIST);
      const py = (a * DIST) / (1 + a * sinT);
      const persp = DIST / (DIST - py * sinT);
      return { x: (clipX * aspect) / (persp * FIT), y: py };
    }

    // Height of the sheet at a plane point, bilinear over the cloth grid, so
    // objects ride down into the dent instead of floating above it.
    function sheetZ(x, y) {
      const gu = Math.max(0, Math.min(1, (x / aspect + 1) / 2)) * (N - 1);
      const gv = Math.max(0, Math.min(1, (1 - y) / 2)) * (N - 1);
      const i0 = Math.min(N - 2, Math.floor(gu));
      const j0 = Math.min(N - 2, Math.floor(gv));
      const fu = gu - i0;
      const fv = gv - j0;
      const z = (i, j) => pos[(j * N + i) * 3 + 2];
      return (
        z(i0, j0) * (1 - fu) * (1 - fv) +
        z(i0 + 1, j0) * fu * (1 - fv) +
        z(i0, j0 + 1) * (1 - fu) * fv +
        z(i0 + 1, j0 + 1) * fu * fv
      );
    }

    // ---------- the mass ----------
    const well = { x: 0, y: 0, mass: 1 };
    const gm = () => BASE_GM * well.mass;
    const clampWell = (p) => ({
      x: Math.max(-aspect * 0.85, Math.min(aspect * 0.85, p.x)),
      y: Math.max(-0.85, Math.min(0.85, p.y)),
    });

    function escapeSpeedAt(x, y) {
      const r = Math.max(Math.hypot(x - well.x, y - well.y), CAPTURE_R);
      return Math.sqrt((2 * gm()) / r);
    }

    // One gravity step for a single point mass. Returns "fall" if it was
    // swallowed this step, otherwise null.
    function gravityStep(b) {
      const dx = b.x - well.x;
      const dy = b.y - well.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < CAPTURE_R * CAPTURE_R) return "fall";
      const invR3 = 1 / (r2 * Math.sqrt(r2));
      b.vx -= gm() * dx * invR3 * GRAVITY_STEP;
      b.vy -= gm() * dy * invR3 * GRAVITY_STEP;
      b.x += b.vx * GRAVITY_STEP;
      b.y += b.vy * GRAVITY_STEP;
      return null;
    }

    function energy(b) {
      const r = Math.hypot(b.x - well.x, b.y - well.y);
      return 0.5 * (b.vx * b.vx + b.vy * b.vy) - gm() / r;
    }

    // ---------- thrown objects ----------
    const objects = [];
    let colorIdx = 0;
    let swallowed = 0;
    let escaped = 0;
    const pushStats = () => setStats({ count: objects.length, swallowed, escaped });

    function spawn(x, y, vx, vy) {
      if (objects.length >= MAX_OBJECTS) removeObject(objects[0]);
      const color = OBJECT_COLORS[colorIdx++ % OBJECT_COLORS.length];
      const el = document.createElement("span");
      el.className = "gravity-well__object";
      el.style.setProperty("--obj", color);
      layer.appendChild(el);
      objects.push({ x, y, vx, vy, color, el, trail: [] });
      pushStats();
    }

    function removeObject(o) {
      const i = objects.indexOf(o);
      if (i >= 0) objects.splice(i, 1);
      o.el.remove();
    }

    function swallow(o) {
      removeObject(o);
      swallowed++;
      pushStats();
      coreEl.animate(
        [
          { boxShadow: "0 0 60px rgba(255,210,122,1), 0 0 120px rgba(255,140,58,0.7)" },
          { boxShadow: "0 0 30px rgba(255,210,122,0.55), 0 0 60px rgba(255,140,58,0.3)" },
        ],
        { duration: 600, easing: "ease-out" }
      );
    }

    // Predict a throw with the same integrator the live sim uses.
    function predict(x, y, vx, vy) {
      const b = { x, y, vx, vy };
      const pts = [];
      let outcome = energy(b) >= 0 ? "escape" : "orbit";
      for (let k = 0; k < 1400; k++) {
        if (gravityStep(b) === "fall") {
          outcome = "fall";
          pts.push({ x: well.x, y: well.y });
          break;
        }
        if (k % 3 === 0) pts.push({ x: b.x, y: b.y });
        if (Math.hypot(b.x - well.x, b.y - well.y) > 3) break;
      }
      return { pts, outcome };
    }

    // ---------- pointer: drag the mass, or aim + throw anywhere else ----------
    // On touch screens the frame starts "asleep" (CSS touch-action: pan-y) so
    // a swipe over it scrolls the page instead of trapping the user. One tap
    // wakes it for throwing; scrolling it out of view puts it back to sleep.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let armed = !coarse;
    function setArmedState(v) {
      armed = v;
      container.classList.toggle("is-armed", v);
      setArmed(v);
    }
    setArmedState(armed);

    let mode = null; // "arm" | "well" | "aim"
    let aimStart = null;
    let aimEnd = null;
    let preview = null;
    let activePointer = null;

    function throwVelocity() {
      let vx = (aimEnd.x - aimStart.x) * THROW_GAIN;
      let vy = (aimEnd.y - aimStart.y) * THROW_GAIN;
      const s = Math.hypot(vx, vy);
      if (s > MAX_SPEED) {
        vx *= MAX_SPEED / s;
        vy *= MAX_SPEED / s;
      }
      return { vx, vy };
    }

    function updateAim() {
      const { vx, vy } = throwVelocity();
      preview = predict(aimStart.x, aimStart.y, vx, vy);
      const pct = Math.round((Math.hypot(vx, vy) / escapeSpeedAt(aimStart.x, aimStart.y)) * 100);
      setAim({ outcome: preview.outcome, pct });
    }

    function onPointerDown(e) {
      if (activePointer !== null || e.button > 0) return;
      // The mass slider and buttons sit inside the container; leave them alone.
      if (e.target.closest(".gravity-well__controls")) return;
      if (!armed && e.pointerType !== "mouse") {
        // Asleep: let the browser scroll; a plain tap (pointerup) wakes it.
        activePointer = e.pointerId;
        mode = "arm";
        return;
      }
      activePointer = e.pointerId;
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone; the drag still works while over the frame */
      }
      const p = toPlane(e.clientX, e.clientY);
      if (e.target === coreEl) {
        mode = "well";
        coreEl.classList.add("is-dragging");
        return;
      }
      // Can't throw from inside the mass itself.
      if (Math.hypot(p.x - well.x, p.y - well.y) < CAPTURE_R * 1.6) {
        activePointer = null;
        return;
      }
      mode = "aim";
      aimStart = p;
      aimEnd = p;
      updateAim();
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointer) return;
      const p = toPlane(e.clientX, e.clientY);
      if (mode === "well") {
        const c = clampWell(p);
        well.x = c.x;
        well.y = c.y;
      } else if (mode === "aim") {
        aimEnd = p;
        updateAim();
      }
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointer) return;
      if (mode === "arm" && e.type === "pointerup") setArmedState(true);
      if (mode === "aim" && e.type === "pointerup") {
        const { vx, vy } = throwVelocity();
        spawn(aimStart.x, aimStart.y, vx, vy);
      }
      coreEl.classList.remove("is-dragging");
      mode = null;
      preview = null;
      activePointer = null;
      setAim(null);
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    simRef.current = {
      setMass(m) {
        well.mass = m;
        const size = 34 * Math.sqrt(m);
        coreEl.style.width = `${size}px`;
        coreEl.style.height = `${size}px`;
      },
      clear() {
        while (objects.length) removeObject(objects[0]);
        swallowed = 0;
        escaped = 0;
        pushStats();
      },
    };

    // A first object already in flight, so the demo is alive before anyone
    // touches it: thrown sideways at ~85% of circular speed, which gives a
    // visibly eccentric orbit rather than a perfect circle.
    if (!reduceMotion) {
      const r0 = 0.62;
      const v0 = Math.sqrt(BASE_GM / r0) * 0.85;
      spawn(-r0, 0.15, 0.08, -v0);
    }

    // ---------- cloth spring simulation (ElasticMesh's own mechanic) ----------
    const STEP = 1 / 120;
    const MAX_SUB = 5;
    let accTime = 0;
    let gravityAcc = 0;
    let last = performance.now();

    function dent(idx, ox, oy, cx, cy, radius, force) {
      const dx = cx - (baseX[idx] + ox);
      const dy = cy - (baseY[idx] + oy);
      const d = Math.sqrt(dx * dx + dy * dy);
      const tnorm = d / radius;
      if (tnorm >= 1) return;
      const zBump = 1 - tnorm * tnorm;
      accel[idx * 3 + 2] += force * zBump * zBump * 6.0;
      if (d > 1e-4) {
        const pinch = tnorm * (1 - tnorm) * (1 - tnorm) * 6.75;
        const dir = (force * pinch * 1.6) / d;
        accel[idx * 3] += dx * dir;
        accel[idx * 3 + 1] += dy * dir;
      }
    }

    function substep() {
      const s = stiffness;
      const retain = 1 - damping;
      const coupling = 0.06 + 5 * 0.032;
      // Heavier mass: deeper and wider dent.
      const wellR = Math.max(0.08, wellRadius) * 1.4 * (0.75 + 0.25 * well.mass);
      const wellForce = wellStrength * 0.009 * well.mass;
      const objR = 0.22;
      const objForce = 0.0016;

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const idx = j * N + i;
          const o3 = idx * 3;
          const ox = pos[o3];
          const oy = pos[o3 + 1];
          const oz = pos[o3 + 2];

          let sumx = 0, sumy = 0, sumz = 0, cnt = 0;
          if (i > 0) { const n = (idx - 1) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (i < N - 1) { const n = (idx + 1) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (j > 0) { const n = (idx - N) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (j < N - 1) { const n = (idx + N) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          accel[o3] = -s * ox + coupling * (sumx - cnt * ox);
          accel[o3 + 1] = -s * oy + coupling * (sumy - cnt * oy);
          accel[o3 + 2] = -s * oz + coupling * (sumz - cnt * oz);

          dent(idx, ox, oy, well.x, well.y, wellR, wellForce);
          // Each object also presses its own small dimple into the sheet.
          for (const o of objects) dent(idx, ox, oy, o.x, o.y, objR, objForce);
        }
      }

      for (let k = 0; k < nodeCount; k++) {
        const o3 = k * 3;
        const nvx = (vel[o3] + accel[o3]) * retain;
        const nvy = (vel[o3 + 1] + accel[o3 + 1]) * retain;
        const nvz = (vel[o3 + 2] + accel[o3 + 2]) * retain;
        vel[o3] = nvx; vel[o3 + 1] = nvy; vel[o3 + 2] = nvz;
        pos[o3] = Math.max(-1.2, Math.min(1.2, pos[o3] + nvx));
        pos[o3 + 1] = Math.max(-1.2, Math.min(1.2, pos[o3 + 1] + nvy));
        pos[o3 + 2] = Math.max(-1.2, Math.min(1.2, pos[o3 + 2] + nvz));
      }
    }

    function commit() {
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const idx = j * N + i;
          const o3 = idx * 3;
          const iL = i > 0 ? idx - 1 : idx;
          const iR = i < N - 1 ? idx + 1 : idx;
          const iD = j > 0 ? idx - N : idx;
          const iU = j < N - 1 ? idx + N : idx;

          const lx = baseX[iL] + pos[iL * 3], ly = baseY[iL] + pos[iL * 3 + 1], lz = pos[iL * 3 + 2];
          const rx = baseX[iR] + pos[iR * 3], ry = baseY[iR] + pos[iR * 3 + 1], rz = pos[iR * 3 + 2];
          const dx = baseX[iD] + pos[iD * 3], dy = baseY[iD] + pos[iD * 3 + 1], dz = pos[iD * 3 + 2];
          const ux = baseX[iU] + pos[iU * 3], uy = baseY[iU] + pos[iU * 3 + 1], uz = pos[iU * 3 + 2];

          const txx = rx - lx, txy = ry - ly, txz = rz - lz;
          const tyx = ux - dx, tyy = uy - dy, tyz = uz - dz;

          let nx = txy * tyz - txz * tyy;
          let ny = txz * tyx - txx * tyz;
          let nz = txx * tyy - txy * tyx;
          if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          aNormal[o3] = nx / len; aNormal[o3 + 1] = ny / len; aNormal[o3 + 2] = nz / len;

          aOffset[o3] = pos[o3]; aOffset[o3 + 1] = pos[o3 + 1]; aOffset[o3 + 2] = pos[o3 + 2];
        }
      }
      geometry.attributes.aOffset.needsUpdate = true;
      geometry.attributes.aNormal.needsUpdate = true;
    }

    function stepObjects() {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (gravityStep(o) === "fall") {
          swallow(o);
          continue;
        }
        const r = Math.hypot(o.x - well.x, o.y - well.y);
        if ((r > 3 && energy(o) >= 0) || r > 10) {
          removeObject(o);
          escaped++;
          pushStats();
        }
      }
    }

    function drawPath(pts, color, alphaFn, widthPx, dashed) {
      if (pts.length < 2) return;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      if (dashed) {
        // One continuous path so the dash pattern runs along the whole curve.
        ctx.setLineDash([5, 8]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        pts.forEach((p, k) => {
          const s = project(p.x, p.y, sheetZ(p.x, p.y));
          if (k === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        return;
      }
      let prev = project(pts[0].x, pts[0].y, sheetZ(pts[0].x, pts[0].y));
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k];
        const s = project(p.x, p.y, sheetZ(p.x, p.y));
        ctx.globalAlpha = alphaFn(k / (pts.length - 1));
        ctx.strokeStyle = color;
        ctx.lineWidth = widthPx;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        prev = s;
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    const PREVIEW_COLOR = { fall: "#ff8a6c", orbit: "#8fe3c7", escape: "#ffd27a" };

    let raf = 0;
    function frame(now) {
      if (!gate.visible) {
        raf = 0;
        if (coarse && armed) setArmedState(false);
        return;
      }
      raf = requestAnimationFrame(frame);

      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      accTime += dt;
      let sub = 0;
      while (accTime >= STEP && sub < MAX_SUB) {
        substep();
        accTime -= STEP;
        sub++;
      }
      if (accTime > STEP) accTime = 0;

      gravityAcc += dt;
      let gSub = 0;
      while (gravityAcc >= GRAVITY_STEP && gSub < 8) {
        stepObjects();
        gravityAcc -= GRAVITY_STEP;
        gSub++;
      }
      if (gravityAcc > GRAVITY_STEP) gravityAcc = 0;

      commit();
      renderer.render({ scene: mesh });

      ctx.clearRect(0, 0, width, height);

      for (const o of objects) {
        o.trail.push({ x: o.x, y: o.y });
        if (o.trail.length > TRAIL_LEN) o.trail.shift();
        drawPath(o.trail, o.color, (f) => f * 0.75, 2, false);

        const s = project(o.x, o.y, sheetZ(o.x, o.y));
        o.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${s.persp.toFixed(3)})`;
      }

      if (mode === "aim" && aimStart && preview) {
        const color = PREVIEW_COLOR[preview.outcome];
        drawPath(preview.pts, color, (f) => 0.9 - f * 0.6, 2, true);
        // Launch arrow from the release point along the throw direction.
        const a = project(aimStart.x, aimStart.y, sheetZ(aimStart.x, aimStart.y));
        const b = project(aimEnd.x, aimEnd.y, sheetZ(aimEnd.x, aimEnd.y));
        ctx.strokeStyle = "#ffffff";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (Math.hypot(b.x - a.x, b.y - a.y) > 8) {
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - 10 * Math.cos(ang - 0.45), b.y - 10 * Math.sin(ang - 0.45));
          ctx.lineTo(b.x - 10 * Math.cos(ang + 0.45), b.y - 10 * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      const cs = project(well.x, well.y, sheetZ(well.x, well.y));
      coreEl.style.left = `${cs.x}px`;
      coreEl.style.top = `${cs.y}px`;
    }
    // Pause the cloth + orbits while scrolled away or while the landing page
    // is hidden; resume from where they were (dt is reset, so no jump).
    const gate = createVisibilityGate(container, () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    raf = requestAnimationFrame(frame);

    container.insertBefore(gl.canvas, container.firstChild);

    return () => {
      cancelAnimationFrame(raf);
      gate.disconnect();
      ro.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      objects.forEach((o) => o.el.remove());
      simRef.current = null;
      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution]);

  const outcome = aim ? OUTCOME_TEXT[aim.outcome] : null;

  return (
    <div ref={containerRef} className={`gravity-well${className ? ` ${className}` : ""}`} style={style}>
      <canvas ref={overlayRef} className="gravity-well__overlay" aria-hidden="true" />
      <div ref={layerRef} className="gravity-well__layer" aria-hidden="true" />
      <span ref={coreRef} className="gravity-well__core" title="Drag to move the mass" />

      <div className="gravity-well__hud" aria-live="polite">
        {outcome ? (
          <>
            <strong className={`gravity-well__outcome is-${aim.outcome}`}>{outcome.label}</strong>
            <span>
              {aim.pct}% of escape speed · {outcome.why}
            </span>
          </>
        ) : !armed ? (
          <>
            <strong>Tap to start</strong>
            <span>Then drag and release to throw an object</span>
          </>
        ) : (
          <>
            <strong>Press, drag and release to throw an object</strong>
            <span>Drag the glowing mass to move it</span>
          </>
        )}
      </div>

      <div className="gravity-well__controls">
        <label className="gravity-well__mass">
          <span>Mass</span>
          <input
            type="range"
            min="0.4"
            max="2"
            step="0.05"
            value={mass}
            onChange={(e) => setMass(Number(e.target.value))}
            aria-label="Mass of the central body"
          />
        </label>
        <span className="gravity-well__stats">
          {stats.count} in motion · {stats.swallowed} swallowed · {stats.escaped} escaped
        </span>
        <button type="button" className="gravity-well__clear" onClick={() => simRef.current?.clear()}>
          Clear
        </button>
      </div>
    </div>
  );
}
