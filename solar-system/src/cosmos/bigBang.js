import * as THREE from "three";
import { AppState } from "../core/state.js";

// ---------- the Big Bang tier ----------
// An artistic visualization of the universe forming, built to be stood
// INSIDE rather than watched. It is a real tier, not a cutscene: free-flight
// stays live throughout (xr/locomotion.js runs for any orbital tier), so the
// player can fly toward the core, out past the expanding shell, or sit still
// and let it happen around them.
//
// ON HONESTY. There is no image, film or observation of the Big Bang itself,
// and there never can be — the universe was opaque to light for its first
// ~380,000 years, so the earliest thing anyone can photograph is the cosmic
// microwave background, which is the wall at the END of this sequence, not
// the beginning. Everything here is therefore an artist's impression chosen
// to convey scale and sequence, in the same spirit as the Milky Way tier's
// top-down "artist's concept" (no photograph of our own galaxy from outside
// exists either). The scene says so itself, on a caption the player can read
// in-world — the brief asks for that to be visible in the UI rather than
// buried in a comment, and this is that caption. The epoch names and times
// are real; the pictures are not.
//
// PERFORMANCE. Expansion is done entirely on the GPU. Every particle carries
// a fixed random direction and a per-particle speed, and its position is
// computed in the vertex shader from a single `uTime` uniform — so animating
// 60,000 particles costs one uniform write per frame and zero CPU work, no
// per-frame BufferAttribute uploads. This matters here more than elsewhere:
// this tier animates continuously, where the others are largely static.

const PARTICLE_COUNT = 90000;
const GALAXY_COUNT = 46;

// Radius the shell reaches at full expansion, in scene units. Chosen to sit
// comfortably inside the tier's own camera far plane while still being large
// enough that flying "out past the edge" takes real travel.
export const BIG_BANG_RADIUS = 9000;

// ---------- the timeline ----------
// Real cosmic history, compressed. `t` is seconds into the loop; `time` is
// the honest label for what that moment corresponds to. The compression is
// wildly non-linear (inflation really did last ~10^-32 s and structure
// formation really did take billions of years) which is exactly why the
// labels are worth showing: the numbers carry the scale the animation
// physically cannot.
const EPOCHS = [
  { at: 0.0, name: "Singularity", time: "t = 0", note: "All of space, everywhere, in one point" },
  { at: 2.4, name: "Inflation", time: "t = 10⁻³² s", note: "Space itself expands faster than light" },
  { at: 4.2, name: "Quark soup", time: "t = 10⁻⁶ s", note: "Too hot for atoms — a plasma of free particles" },
  { at: 7.0, name: "First nuclei", time: "t = 3 minutes", note: "Hydrogen and helium form" },
  { at: 10.5, name: "First light", time: "t = 380,000 years", note: "The universe cools and turns transparent" },
  { at: 14.0, name: "Cosmic dawn", time: "t = 200 million years", note: "The first stars ignite" },
  { at: 19.0, name: "Galaxies", time: "t = 1 billion years", note: "Gravity gathers matter into galaxies" },
  { at: 26.0, name: "Today", time: "t = 13.8 billion years", note: "You are here" },
];
const LOOP_SECONDS = 34;

export function getEpochAt(t) {
  let current = EPOCHS[0];
  for (const e of EPOCHS) if (t >= e.at) current = e;
  return current;
}

// Expansion curve, in three parts to match what the sequence has to read as.
// A single power curve was tried first and was wrong in a way the numbers
// showed plainly: it put the universe at a third of full size two seconds in,
// while the caption still said "Singularity". The point has to sit there
// looking like a point before anything happens, or the detonation has nothing
// to detonate from.
//
//   0 - 2.0s   a still, essentially dimensionless point
//   2.0 - 5.0s inflation: the violent part, easing out into the flash
//   5.0s +     long decelerating expansion, the shape real expansion has
//              under gravity, not a linear ramp (which reads as a balloon
//              inflating rather than an explosion)
const INFLATION_START = 2.0;
const INFLATION_END = 5.0;
const INFLATION_SIZE = 0.40;

function expansionAt(t) {
  if (t < INFLATION_START) {
    // Not exactly zero: the core needs some extent to be a glowing mote
    // rather than a single pixel.
    return 0.004 + Math.pow(t / INFLATION_START, 2) * 0.012;
  }
  if (t < INFLATION_END) {
    const u = (t - INFLATION_START) / (INFLATION_END - INFLATION_START);
    return 0.016 + (1 - Math.pow(1 - u, 3)) * INFLATION_SIZE;
  }
  const span = LOOP_SECONDS * 0.72 - INFLATION_END;
  const u = Math.min(1, (t - INFLATION_END) / span);
  return 0.016 + INFLATION_SIZE + Math.pow(u, 0.65) * (1 - 0.016 - INFLATION_SIZE);
}

// Brightness envelope: dark, then the detonation flash, then a long slow fade
// to the dim present. Drives the core's size/colour and the particle glow.
function flashAt(t) {
  if (t < 2.0) return Math.pow(t / 2.0, 3) * 0.25; // the point brightening
  if (t < 3.4) return 0.25 + ((t - 2.0) / 1.4) * 0.75; // detonation
  if (t < 5.6) return 1.0; // white-out
  return Math.max(0.05, 1.0 - (t - 5.6) / 12); // long fade
}

function makeRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- expanding matter ----------
const MATTER_VERT = `
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uExpansion;
  uniform float uFlash;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    // Each particle flies outward along its own fixed direction. Spreading
    // speed per particle (rather than one shared radius) is what makes the
    // shell a thick, textured cloud instead of a hollow sphere surface.
    vec3 p = aDir * (uExpansion * aSpeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective-correct point size, with a floor so distant matter stays
    // visible as a haze rather than dropping to sub-pixel and flickering.
    gl_PointSize = max(1.0, aSize * (300.0 / -mv.z));
    vColor = aColor;
    vGlow = uFlash;
  }
`;

const MATTER_FRAG = `
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    // Round, soft-edged points. gl_PointCoord is 0..1 across the sprite, so
    // this is a radial falloff from its centre — the default square point
    // would read as confetti at this density.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    float alpha = pow(1.0 - r * 2.0, 1.6);
    // Toward white at peak flash: hot plasma has no colour of its own to the
    // eye, it just saturates. Colour returns as the universe cools.
    vec3 c = mix(vColor, vec3(1.0), vGlow * 0.75);
    gl_FragColor = vec4(c, alpha * (0.30 + vGlow * 0.7));
  }
`;

function buildMatter() {
  const rand = makeRandom("bigbang-matter");
  const pos = new Float32Array(PARTICLE_COUNT * 3); // unused at runtime, required for a valid draw range
  const dir = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);
  const speed = new Float32Array(PARTICLE_COUNT);
  const size = new Float32Array(PARTICLE_COUNT);

  const hot = new THREE.Color(0xfff2d0);
  const mid = new THREE.Color(0xb98bff);
  const cool = new THREE.Color(0x4a6cff);
  const c = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Uniform on the sphere. Naively picking two angles bunches particles at
    // the poles; inverting the cosine distributes them evenly by area.
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    dir[i * 3] = s * Math.cos(phi);
    dir[i * 3 + 1] = u;
    dir[i * 3 + 2] = s * Math.sin(phi);

    // Spread across the WHOLE radius, with a floor near zero rather than at
    // 0.18. The cubed distribution used before bunched almost everything at
    // the slow end, which meant the matter formed a hollow shell with its
    // inner wall at ~1,620 units — so the blast swept past a player standing
    // at ~620 in about two seconds and then left them alone in an empty
    // cavity, watching it recede. An exponent below 1 still weights the
    // leading edge outward (there is a visible front) while leaving matter at
    // every distance, including inside and around the player, for the whole
    // sequence. Being in among it is the point, so nowhere should be empty.
    speed[i] = BIG_BANG_RADIUS * (0.015 + Math.pow(rand(), 0.75) * 0.985);
    size[i] = 1.2 + Math.pow(rand(), 3) * 5.0;

    // Faster matter is "younger"/hotter at the front, cooler behind — a cheap
    // stand-in for a temperature gradient that reads correctly at a glance.
    const f = speed[i] / BIG_BANG_RADIUS;
    c.copy(cool).lerp(mid, Math.min(1, f * 1.5)).lerp(hot, Math.max(0, f - 0.55) * 2.2);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  // The shader ignores `position`, so three.js's automatic bounding sphere
  // (computed from it) would be a zero-radius sphere at the origin and the
  // whole cloud would be frustum-culled the moment the origin left view. Set
  // it by hand to the full expanded extent instead.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), BIG_BANG_RADIUS * 1.1);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uExpansion: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: MATTER_VERT,
    fragmentShader: MATTER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.name = "bigBangMatter";
  points.frustumCulled = false; // it surrounds the player; there is no view in which it isn't on screen
  return points;
}

// ---------- the core ----------
function makeGlowSprite(color, scale, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.35, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity,
    })
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

// The bipolar jet. Two opposed cones along the vertical axis — the strongest
// single visual signature in the reference material, and a real feature of
// collimated astrophysical outflows, though here it is pure styling: the Big
// Bang had no axis and no centre. Called out in the caption for that reason.
function buildJet() {
  const group = new THREE.Group();
  group.name = "bigBangJet";
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc9a6ff,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sign of [1, -1]) {
    const geo = new THREE.ConeGeometry(BIG_BANG_RADIUS * 0.10, BIG_BANG_RADIUS * 1.5, 20, 1, true);
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = (sign * BIG_BANG_RADIUS * 1.5) / 2;
    cone.rotation.z = sign > 0 ? 0 : Math.PI;
    group.add(cone);
  }
  return group;
}

// ---------- galaxies that condense out of the cooling matter ----------
// One procedurally drawn spiral texture, reused across every instance with a
// different rotation, scale and tint. A few dozen real particle galaxies
// (cosmos/galaxyGeometry.js) would be far heavier for something the player
// mostly sees at a distance, and this reads correctly at the sizes involved.
function makeSpiralTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  const rand = makeRandom("bigbang-spiral");

  const core = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.16);
  core.addColorStop(0, "rgba(255,246,220,1)");
  core.addColorStop(1, "rgba(255,220,160,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  ctx.globalCompositeOperation = "lighter";
  for (let arm = 0; arm < 2; arm++) {
    const phase = arm * Math.PI;
    for (let i = 0; i < 1400; i++) {
      const t = i / 1400;
      const r = t * S * 0.46;
      const theta = phase + t * 3.4 + (rand() - 0.5) * 0.5;
      const x = S / 2 + Math.cos(theta) * r;
      const y = S / 2 + Math.sin(theta) * r * 0.66; // slight inclination
      const a = (1 - t) * 0.5;
      ctx.fillStyle = `rgba(190,210,255,${a})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGalaxies() {
  const group = new THREE.Group();
  group.name = "bigBangGalaxies";
  const tex = makeSpiralTexture();
  const rand = makeRandom("bigbang-galaxies");
  const tints = [0xffffff, 0xffd9c0, 0xc9d8ff, 0xffe9b0, 0xd9c0ff];

  for (let i = 0; i < GALAXY_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: tints[Math.floor(rand() * tints.length)],
      opacity: 0,
      rotation: rand() * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(mat);

    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    // Held between 0.25 and 0.95 of the shell radius so galaxies sit within
    // the structure rather than at its dead centre or stranded outside it.
    const r = BIG_BANG_RADIUS * (0.25 + rand() * 0.7);
    sprite.userData.home = new THREE.Vector3(s * Math.cos(phi), u * 0.75, s * Math.sin(phi)).multiplyScalar(r);
    sprite.userData.scale = BIG_BANG_RADIUS * (0.02 + rand() * 0.045);
    sprite.scale.setScalar(sprite.userData.scale);
    group.add(sprite);
  }
  return group;
}

// ---------- the blind-out ----------
// The reference goes completely, featurelessly white for two full seconds at
// peak — not "bright particles", an actual wall of light with no structure in
// it at all. Reproducing that needs something covering the entire field of
// view, which particles and a glow sprite cannot do however bright they get.
//
// A plane held just in front of the camera, inside the tier's own scene
// rather than parented to the camera itself. Camera-parenting would be
// simpler but the camera outlives this tier, so the flash would have to be
// explicitly torn down on exit or it would follow the player into the Milky
// Way; living in the scene means it leaves when the scene does.
//
// depthTest off and a high renderOrder so it draws over everything regardless
// of what it happens to be intersecting.
function buildBlindFlash() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false, // full white, not tone-mapped down to grey
    })
  );
  mesh.name = "bigBangBlindFlash";
  mesh.frustumCulled = false;
  mesh.renderOrder = 9999;
  mesh.visible = false;
  return mesh;
}

// How blinding it gets, and when. Sharper and later than the particle glow:
// the screen only whites out around the detonation itself, so the singularity
// before it and the galaxies after it are never washed out.
function blindAt(t) {
  if (t < 2.6) return 0;
  if (t < 3.6) return Math.pow((t - 2.6) / 1.0, 2) * 0.97; // ramp in fast
  if (t < 5.4) return 0.97; // the wall of light
  if (t < 8.2) return Math.max(0, 0.97 * (1 - (t - 5.4) / 2.8)); // long bleed-out
  return 0;
}

const _camQuat = new THREE.Quaternion();
const _flashOffset = new THREE.Vector3();

function updateBlindFlash(mesh, cam, amount) {
  // Written even when hidden, so the material never holds a stale opacity
  // from the last frame it was visible.
  mesh.material.opacity = amount;
  mesh.visible = amount > 0.002;
  if (!mesh.visible) return;

  cam.getWorldQuaternion(_camQuat);
  // Just beyond the near plane, whatever that currently is — this tier uses a
  // different near in VR (0.1) than on desktop (5), so a hardcoded distance
  // would be clipped away in one of the two.
  const d = Math.max(cam.near * 2.5, 0.4);
  mesh.position.copy(_camPos).add(_flashOffset.set(0, 0, -d).applyQuaternion(_camQuat));
  mesh.quaternion.copy(_camQuat);

  // Oversized on purpose. In VR each eye has its own off-axis projection that
  // camera.fov doesn't describe, so sizing exactly to the desktop frustum
  // would leave the edges of a headset's view uncovered — and a blind-out with
  // visible corners is worse than none.
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * d * 2.4;
  mesh.scale.set(height * Math.max(cam.aspect, 1) * 1.4, height, 1);
}

// ---------- in-world caption ----------
// Deliberately scene geometry rather than DOM: the DOM does not render inside
// a WebXR session, and this text is the honesty disclaimer the brief requires
// to be visible in the UI. One implementation, readable in both modes.
const CAPTION_W = 1024;
const CAPTION_H = 300;

function buildCaption() {
  const canvas = document.createElement("canvas");
  canvas.width = CAPTION_W;
  canvas.height = CAPTION_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const w = BIG_BANG_RADIUS * 0.55;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (CAPTION_H / CAPTION_W)), mat);
  mesh.name = "bigBangCaption";
  mesh.userData.ctx = canvas.getContext("2d");
  mesh.userData.tex = tex;
  mesh.frustumCulled = false;
  return mesh;
}

function drawCaption(mesh, epoch) {
  const ctx = mesh.userData.ctx;
  ctx.clearRect(0, 0, CAPTION_W, CAPTION_H);

  ctx.textAlign = "center";
  ctx.font = "bold 62px sans-serif";
  ctx.fillStyle = "#ffd27a";
  ctx.fillText(epoch.name, CAPTION_W / 2, 74);

  ctx.font = "38px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(epoch.time, CAPTION_W / 2, 130);

  ctx.font = "30px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.fillText(epoch.note, CAPTION_W / 2, 182);

  // The disclaimer rides along with every epoch rather than appearing once at
  // the start, so a player who arrives mid-sequence still sees it.
  ctx.font = "italic 23px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText("Artist's visualization — no image of the Big Bang exists.", CAPTION_W / 2, 246);
  ctx.fillText("Epoch names and times are real; the picture is not.", CAPTION_W / 2, 278);

  mesh.userData.tex.needsUpdate = true;
}

// ---------- assembly ----------
export function buildBigBangContent() {
  const group = new THREE.Group();
  group.name = "bigBangContent";

  const matter = buildMatter();
  const jet = buildJet();
  const galaxies = buildGalaxies();
  const caption = buildCaption();
  const blindFlash = buildBlindFlash();

  // Two-layer core, same recipe scene/sun.js uses for the corona: a tight
  // bright centre inside a wide soft halo.
  const coreInner = makeGlowSprite(0xffffff, 1, 0.95);
  const coreOuter = makeGlowSprite(0xb98bff, 1, 0.55);
  coreInner.name = "bigBangCoreInner";
  coreOuter.name = "bigBangCoreOuter";

  group.add(matter, jet, galaxies, caption, coreOuter, coreInner, blindFlash);
  group.userData = { matter, jet, galaxies, caption, coreInner, coreOuter, blindFlash, elapsed: 0 };
  return group;
}

const _camPos = new THREE.Vector3();

// Called once per frame from core/loop.js while this tier is active.
export function updateBigBang(scene, delta) {
  const group = scene.getObjectByName("bigBangContent");
  if (!group) return;
  const d = group.userData;

  d.elapsed = (d.elapsed + delta) % LOOP_SECONDS;
  const t = d.elapsed;
  const expansion = expansionAt(t);
  const flash = flashAt(t);

  d.matter.material.uniforms.uExpansion.value = expansion;
  d.matter.material.uniforms.uFlash.value = flash;

  // Core: enormous at the flash, shrinking to a dim ember. The colour walk
  // white -> violet -> red mirrors the reference's dying core, and is roughly
  // honest about a cooling blackbody.
  const coreScale = BIG_BANG_RADIUS * (0.02 + flash * 0.30);
  d.coreInner.scale.setScalar(coreScale);
  d.coreOuter.scale.setScalar(coreScale * 2.6);
  d.coreInner.material.opacity = 0.25 + flash * 0.75;
  d.coreOuter.material.opacity = 0.15 + flash * 0.55;
  const cool = Math.min(1, Math.max(0, (t - 8) / 16));
  d.coreOuter.material.color.setRGB(0.72 + cool * 0.28, 0.55 - cool * 0.34, 1.0 - cool * 0.78);

  // Jet: brightest during inflation, gone by the time galaxies appear.
  const jetLife = t < 3 ? t / 3 : Math.max(0, 1 - (t - 3) / 9);
  d.jet.visible = jetLife > 0.01;
  if (d.jet.visible) {
    d.jet.children[0].material.opacity = 0.20 * jetLife;
    d.jet.scale.setScalar(0.25 + expansion * 0.9);
  }

  // Galaxies fade in through the structure-formation epoch and drift outward
  // with the expansion, so they belong to the shell rather than floating in
  // front of it.
  // Starts at Cosmic Dawn (the first stars, 14s) rather than earlier, so
  // recognisable spiral galaxies don't fade in while the caption is still on
  // "First light" — at 380,000 years there was nothing but hydrogen fog.
  const galaxyFade = Math.min(1, Math.max(0, (t - 13.5) / 6));
  d.galaxies.children.forEach((sprite) => {
    sprite.material.opacity = galaxyFade * 0.95;
    sprite.position.copy(sprite.userData.home).multiplyScalar(expansion);
    sprite.scale.setScalar(sprite.userData.scale * (0.4 + expansion * 0.6));
  });

  // Caption: parked below the core and turned to face the player, so it is
  // readable from wherever they have flown to. Object3D.lookAt() aims local
  // +Z at the target, which is PlaneGeometry's front face — the correct call
  // for a billboard (a mistake worth stating: it is NOT the same convention
  // as a camera's lookAt).
  const epoch = getEpochAt(t);
  if (d.caption.userData.epochName !== epoch.name) {
    d.caption.userData.epochName = epoch.name;
    drawCaption(d.caption, epoch);
  }
  const cam = AppState.camera;
  if (cam) {
    // getWorldPosition, not .position: in VR the camera is a child of the rig
    // and its local position is a head offset, not a world location.
    cam.getWorldPosition(_camPos);

    const camDist = _camPos.length();
    // Placed BETWEEN the player and the origin, at a fraction of however far
    // out they are. The previous version put it at a distance derived from the
    // shell radius, which was further out than the player now starts — so from
    // inside the blast the caption sat behind them, permanently unread.
    // Sitting inboard means it is always in view when facing the core, which
    // is where the sequence is happening.
    const dist = Math.max(120, camDist * 0.45);
    if (camDist > 1e-3) {
      d.caption.position.copy(_camPos).setLength(dist);
      d.caption.position.y -= dist * 0.38; // below the core, not across it
    }
    d.caption.scale.setScalar(Math.max(0.12, dist / (BIG_BANG_RADIUS * 0.55)));
    d.caption.lookAt(_camPos);

    // Screen-filling white-out at the detonation.
    updateBlindFlash(d.blindFlash, cam, blindAt(t));
  }
}
