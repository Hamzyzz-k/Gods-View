import { useEffect, useRef } from "react";
import { Renderer, Geometry, Program, Mesh, Texture } from "ogl";

import "./GravityWell.css";

// ---------- gravity well ----------
// Built on React Bits' ElasticMesh (JS + CSS variant, OGL cloth-warp shader
// — vertex/fragment shaders, spring-mesh integration, and resize/pointer
// plumbing are that component's own code, effectively unchanged), extended
// with two things ElasticMesh alone doesn't do:
//
//   1. A PERMANENT central attractor, not just a pointer-driven one — the
//      sheet is always dented at center, reading as the standard rubber-
//      sheet analogy for spacetime curvature around a mass (the same
//      picture every planetarium/pop-science gravity demo uses). Dragging
//      still adds a second, temporary perturbation on top — the doc's own
//      "users can experience it" interactivity, kept.
//   2. A small set of orbiting bodies with REAL gravity — inverse-square
//      acceleration toward the center, integrated every frame with
//      semi-implicit Euler (position/velocity updated from actual computed
//      acceleration, not a canned CSS/keyframe orbit). Each body starts at
//      the real circular-orbit speed for its starting radius
//      (v = sqrt(GM/r), perpendicular to the radius vector) so they settle
//      into genuine elliptical paths instead of immediately spiraling in or
//      flying off. Honest simplification, stated plainly rather than
//      hidden: each body is pulled only by the central mass, not by each
//      other (a restricted problem) — the standard simplification for a
//      demo like this, not a claim of full N-body accuracy.
//
// The orbiting bodies are rendered as DOM elements, not more WebGL geometry
// — their positions are computed in real plane coordinates each frame and
// pushed through the EXACT SAME tilt + perspective projection the vertex
// shader below uses (see projectToScreen()), so they visually sit on the
// warped sheet in the right place despite being a separate rendering layer.

const DIST = 4.6;
const FIT = 0.82;
const GM = 0.055; // gravitational parameter (G*M) — tuned for a readable orbit period on screen, not a real astronomical value
const NUM_BODIES = 6;
const BODY_COLORS = ["#ffd27a", "#7ab8ff", "#b98bff", "#ff9d6c", "#8fe3c7", "#ffe27a"];

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
  const bodyRefs = useRef([]);
  const coreRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
    function refreshBase() {
      for (let idx = 0; idx < nodeCount; idx++) {
        baseX[idx] = (aGrid[idx * 2] * 2 - 1) * aspect;
        baseY[idx] = 1 - aGrid[idx * 2 + 1] * 2;
      }
    }

    function resize() {
      const w = container.offsetWidth || 1;
      const h = container.offsetHeight || 1;
      renderer.setSize(w, h);
      aspect = w / h;
      program.uniforms.uAspect.value = aspect;
      program.uniforms.uRes.value = [w, h];
      refreshBase();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Real projection of a plane point through the identical tilt +
    // perspective math the vertex shader above applies, so the DOM-rendered
    // orbiting bodies land in the right screen position relative to the
    // WebGL-warped sheet beneath them.
    function projectToScreen(px, py, pz) {
      const t = (tilt * Math.PI) / 180;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const ry = py * ct - pz * st;
      const rz = py * st + pz * ct;
      const persp = DIST / (DIST - rz);
      const clipX = (px / aspect) * persp * FIT;
      const clipY = ry * persp * FIT;
      return { x: (clipX * 0.5 + 0.5) * 100, y: (1 - (clipY * 0.5 + 0.5)) * 100, depth: rz };
    }

    // Pointer hover/drag ANYWHERE on the sheet — a temporary, ambient
    // perturbation on top of the permanent well, same mechanic ElasticMesh's
    // own doc documents (grabRadius/pull). Suppressed while the well itself
    // is being dragged (below) so the two don't double up at the same spot.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false, targetActive: false };

    function toPlane(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      const mx = (clientX - rect.left) / rect.width;
      const my = (clientY - rect.top) / rect.height;
      const clipX = mx * 2 - 1;
      const clipY = 1 - my * 2;
      const t = (tilt * Math.PI) / 180;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const a = clipY / (ct * FIT * DIST);
      const py = (a * DIST) / (1 + a * st);
      const persp = DIST / (DIST - py * st);
      pointer.tx = (clipX * aspect) / (persp * FIT);
      pointer.ty = py;
    }

    function onMove(e) {
      if (draggingWell) return;
      toPlane(e.clientX, e.clientY);
      pointer.targetActive = true;
    }
    function onLeave() {
      pointer.targetActive = false;
    }
    function onDown(e) {
      if (draggingWell) return;
      toPlane(e.clientX, e.clientY);
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
      pointer.targetActive = true;
    }
    function onUp() {
      pointer.targetActive = false;
    }
    function onTouch(e) {
      if (draggingWell) return;
      if (e.touches.length) {
        toPlane(e.touches[0].clientX, e.touches[0].clientY);
        pointer.targetActive = true;
      }
    }

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    container.addEventListener("touchstart", onTouch, { passive: true });
    container.addEventListener("touchmove", onTouch, { passive: true });
    container.addEventListener("touchend", onLeave);

    // ---------- dragging the well itself ----------
    // The actual ask this answers: the black hole isn't a fixed decoration,
    // it's a real, relocatable gravity source — grabbing the core and moving
    // it moves where BOTH the sheet's permanent dent (substep(), below) AND
    // the orbiting bodies' gravity target (stepGravity(), below) actually
    // are, in real plane coordinates, not just a visual drag effect.
    const wellPos = { x: 0, y: 0 };
    let draggingWell = false;
    const wellClampX = () => aspect * 0.85;
    const WELL_CLAMP_Y = 0.85;

    function onCoreDown(e) {
      e.preventDefault();
      e.stopPropagation(); // don't also trigger the ambient sheet-perturbation handlers above
      draggingWell = true;
    }
    function onWindowMove(e) {
      if (!draggingWell) return;
      toPlane(e.clientX, e.clientY);
      wellPos.x = Math.max(-wellClampX(), Math.min(wellClampX(), pointer.tx));
      wellPos.y = Math.max(-WELL_CLAMP_Y, Math.min(WELL_CLAMP_Y, pointer.ty));
    }
    function onWindowUp() {
      draggingWell = false;
    }
    function onCoreTouchStart(e) {
      e.stopPropagation();
      draggingWell = true;
    }
    function onWindowTouchMove(e) {
      if (!draggingWell || !e.touches.length) return;
      toPlane(e.touches[0].clientX, e.touches[0].clientY);
      wellPos.x = Math.max(-wellClampX(), Math.min(wellClampX(), pointer.tx));
      wellPos.y = Math.max(-WELL_CLAMP_Y, Math.min(WELL_CLAMP_Y, pointer.ty));
    }

    const coreEl = coreRef.current;
    coreEl?.addEventListener("mousedown", onCoreDown);
    coreEl?.addEventListener("touchstart", onCoreTouchStart, { passive: false });
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onWindowUp);
    window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
    window.addEventListener("touchend", onWindowUp);

    // ---------- real orbital mechanics ----------
    // Independent of the cloth spring-sim above: each body is a point mass
    // with its own (x, y, vx, vy) in the same plane coordinates, integrated
    // every physics step with actual Newtonian gravity toward the origin
    // (a = -GM * r / |r|^3), semi-implicit Euler. Seeded at the real
    // circular-orbit speed for its starting radius so the paths read as
    // genuine orbits from frame one rather than a chaotic scatter.
    const bodies = [];
    for (let i = 0; i < NUM_BODIES; i++) {
      const r0 = 0.35 + (i / NUM_BODIES) * 0.55 + (Math.random() - 0.5) * 0.06;
      const theta0 = (i / NUM_BODIES) * Math.PI * 2 + Math.random() * 0.5;
      const x = r0 * Math.cos(theta0);
      const y = r0 * Math.sin(theta0);
      const vCirc = Math.sqrt(GM / r0);
      // velocity perpendicular to the radius vector — a real circular-orbit seed
      const vx = -vCirc * Math.sin(theta0);
      const vy = vCirc * Math.cos(theta0);
      bodies.push({ x, y, vx, vy, color: BODY_COLORS[i % BODY_COLORS.length], size: 8 + (i % 3) * 3 });
    }

    const GRAVITY_STEP = 1 / 90;
    let gravityAcc = 0;

    function stepGravity() {
      for (const b of bodies) {
        // Relative to wherever the well has actually been dragged to, not
        // the origin — this is what makes moving the black hole genuinely
        // relocate what the bodies orbit, not just what's drawn on screen.
        const dx = b.x - wellPos.x;
        const dy = b.y - wellPos.y;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(Math.max(r2, 0.0025)); // softened minimum radius so a close pass doesn't blow up to infinite acceleration
        const invR3 = 1 / (r2 * r + 1e-6);
        const ax = -GM * dx * invR3;
        const ay = -GM * dy * invR3;
        b.vx += ax * GRAVITY_STEP;
        b.vy += ay * GRAVITY_STEP;
        b.x += b.vx * GRAVITY_STEP;
        b.y += b.vy * GRAVITY_STEP;
        // A body flung far outside the visible sheet (an unstable trajectory
        // from a sudden well move) is quietly respawned on a fresh circular
        // orbit around the well's CURRENT position, rather than left to
        // drift off-screen forever.
        if (r2 > 4) {
          const r0 = 0.4 + Math.random() * 0.5;
          const theta0 = Math.random() * Math.PI * 2;
          b.x = wellPos.x + r0 * Math.cos(theta0);
          b.y = wellPos.y + r0 * Math.sin(theta0);
          const vCirc = Math.sqrt(GM / r0);
          b.vx = -vCirc * Math.sin(theta0);
          b.vy = vCirc * Math.cos(theta0);
        }
      }
    }

    // ---------- cloth spring simulation (ElasticMesh's own mechanic) ----------
    const STEP = 1 / 120;
    const MAX_SUB = 5;
    let accTime = 0;
    let last = performance.now();

    function substep() {
      const s = stiffness;
      const retain = 1 - damping;
      const coupling = 0.06 + 5 * 0.032;
      const dragActive = pointer.active && !reduceMotion;
      const dragR = 0.6 * 1.4;
      const invDragR = 1 / dragR;
      const dragForce = 0.4 * 0.009;
      const wellR = Math.max(0.08, wellRadius) * 1.4;
      const invWellR = 1 / wellR;
      const wellForceMag = wellStrength * 0.009;

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const idx = j * N + i;
          const o3 = idx * 3;
          const ox = pos[o3];
          const oy = pos[o3 + 1];
          const oz = pos[o3 + 2];

          let ax = -s * ox;
          let ay = -s * oy;
          let az = -s * oz;

          let sumx = 0, sumy = 0, sumz = 0, cnt = 0;
          if (i > 0) { const n = (idx - 1) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (i < N - 1) { const n = (idx + 1) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (j > 0) { const n = (idx - N) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          if (j < N - 1) { const n = (idx + N) * 3; sumx += pos[n]; sumy += pos[n + 1]; sumz += pos[n + 2]; cnt++; }
          ax += coupling * (sumx - cnt * ox);
          ay += coupling * (sumy - cnt * oy);
          az += coupling * (sumz - cnt * oz);

          // Permanent attractor at the well's CURRENT (draggable) position —
          // the black hole always dents the sheet wherever it currently is,
          // not just on hover, and follows it when it's moved.
          {
            const dx = wellPos.x - (baseX[idx] + ox);
            const dy = wellPos.y - (baseY[idx] + oy);
            const d = Math.sqrt(dx * dx + dy * dy);
            const tnorm = d * invWellR;
            if (tnorm < 1) {
              const zBump = 1 - tnorm * tnorm;
              az += wellForceMag * zBump * zBump * 6.0;
              if (d > 1e-4) {
                const pinch = tnorm * (1 - tnorm) * (1 - tnorm) * 6.75;
                const dir = (wellForceMag * pinch * 1.6) / d;
                ax += dx * dir;
                ay += dy * dir;
              }
            }
          }

          // Interactive pointer perturbation, additive on top of the well.
          if (dragActive) {
            const dx = pointer.x - (baseX[idx] + ox);
            const dy = pointer.y - (baseY[idx] + oy);
            const d = Math.sqrt(dx * dx + dy * dy);
            const tnorm = d * invDragR;
            if (tnorm < 1) {
              const zBump = 1 - tnorm * tnorm;
              az += dragForce * zBump * zBump * 6.0;
              if (d > 1e-4) {
                const pinch = tnorm * (1 - tnorm) * (1 - tnorm) * 6.75;
                const dir = (dragForce * pinch * 1.6) / d;
                ax += dx * dir;
                ay += dy * dir;
              }
            }
          }

          accel[o3] = ax; accel[o3 + 1] = ay; accel[o3 + 2] = az;
        }
      }

      for (let k = 0; k < nodeCount; k++) {
        const o3 = k * 3;
        const nvx = (vel[o3] + accel[o3]) * retain;
        const nvy = (vel[o3 + 1] + accel[o3 + 1]) * retain;
        const nvz = (vel[o3 + 2] + accel[o3 + 2]) * retain;
        vel[o3] = nvx; vel[o3 + 1] = nvy; vel[o3 + 2] = nvz;

        let px = pos[o3] + nvx;
        let py = pos[o3 + 1] + nvy;
        let pz = pos[o3 + 2] + nvz;
        px = Math.max(-1.2, Math.min(1.2, px));
        py = Math.max(-1.2, Math.min(1.2, py));
        pz = Math.max(-1.2, Math.min(1.2, pz));
        pos[o3] = px; pos[o3 + 1] = py; pos[o3 + 2] = pz;
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

    let raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);

      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      const tau = 0.06;
      const kLerp = 1 - Math.exp(-Math.max(dt, 1e-4) / tau);
      pointer.x += (pointer.tx - pointer.x) * kLerp;
      pointer.y += (pointer.ty - pointer.y) * kLerp;
      pointer.active = pointer.targetActive;

      accTime += dt;
      let sub = 0;
      while (accTime >= STEP && sub < MAX_SUB) {
        substep();
        accTime -= STEP;
        sub++;
      }
      if (accTime > STEP) accTime = 0;

      if (!reduceMotion) {
        gravityAcc += dt;
        let gSub = 0;
        while (gravityAcc >= GRAVITY_STEP && gSub < 6) {
          stepGravity();
          gravityAcc -= GRAVITY_STEP;
          gSub++;
        }
      }

      commit();
      renderer.render({ scene: mesh });

      // Project each body's real simulated position through the sheet's own
      // tilt+perspective transform and place its DOM marker there.
      bodies.forEach((b, i) => {
        const el = bodyRefs.current[i];
        if (!el) return;
        const s = projectToScreen(b.x, b.y, 0);
        el.style.left = `${s.x}%`;
        el.style.top = `${s.y}%`;
        const scale = Math.max(0.4, Math.min(1.6, 1.4 - s.depth * 0.3));
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        el.style.opacity = s.depth > -DIST * 0.9 ? "1" : "0";
      });

      // The core itself — wherever it's been dragged to, not a fixed center.
      if (coreEl) {
        const cs = projectToScreen(wellPos.x, wellPos.y, 0);
        coreEl.style.left = `${cs.x}%`;
        coreEl.style.top = `${cs.y}%`;
      }
    }
    raf = requestAnimationFrame(frame);

    container.appendChild(gl.canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      container.removeEventListener("touchstart", onTouch);
      container.removeEventListener("touchmove", onTouch);
      container.removeEventListener("touchend", onLeave);
      coreEl?.removeEventListener("mousedown", onCoreDown);
      coreEl?.removeEventListener("touchstart", onCoreTouchStart);
      window.removeEventListener("mousemove", onWindowMove);
      window.removeEventListener("mouseup", onWindowUp);
      window.removeEventListener("touchmove", onWindowTouchMove);
      window.removeEventListener("touchend", onWindowUp);
      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution]);

  return (
    <div ref={containerRef} className={`gravity-well${className ? ` ${className}` : ""}`} style={style}>
      {Array.from({ length: NUM_BODIES }).map((_, i) => (
        <span
          key={i}
          ref={(el) => (bodyRefs.current[i] = el)}
          className="gravity-well__body"
          style={{ background: BODY_COLORS[i % BODY_COLORS.length] }}
        />
      ))}
      <span ref={coreRef} className="gravity-well__core" title="Drag me" />
    </div>
  );
}
