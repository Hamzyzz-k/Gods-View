import * as THREE from "three";
import { getGalaxyRamp, sampleRamp } from "./galaxyPalette.js";

// ---------- procedural galaxy geometry ----------
// Real 3D particle structure for every galaxy in the cosmos tiers, replacing
// the flat camera-facing photo Sprites cosmos/galaxyFactory.js drew before.
// Same technique cosmos/milkyWay.js already uses for the Milky Way's own
// spiral — a THREE.Points field placed by a real structural formula rather
// than an image — generalized per galaxy TYPE and sized to whatever radius
// the tier hands it.
//
// Three things do the heavy lifting on making these read as photographs of
// real objects rather than dot clouds:
//
//   1. COLOUR comes off the real photo. cosmos/galaxyPalette.js measures a
//      core-to-rim colour ramp from each galaxy's actual Wikimedia image, so
//      Andromeda gets Andromeda's warm core and blue arms, Sombrero its tan
//      bulge, Centaurus A its dust-reddened orange. Nothing is hand-guessed.
//   2. STARS ARE SOFT AND VARIED. A plain PointsMaterial draws every star as
//      an identical hard square — the single biggest tell that something is
//      a particle system. The shader below draws each one as a round glow
//      with its own size, so a few bright foreground stars sit over a haze
//      of faint ones, which is what a long-exposure actually looks like.
//   3. REAL STRUCTURE INSIDE THE ARMS. Dust lanes carve dark gaps along the
//      inner edge of each spiral arm, and pink H-alpha knots (star-forming
//      regions) stud the arms the way they visibly do in every real photo of
//      Andromeda, Triangulum or the Whirlpool.
//
// One BufferGeometry and one draw call per galaxy regardless of shape. That
// includes the two CLUSTER types, which are dozens of small member-galaxy
// clumps packed into the same buffer rather than dozens of separate Points
// objects: a cluster is physically many galaxies, but there's no reason for
// it to cost many draw calls.
//
// Placement is deterministic per galaxy name (see makeRandom below), not
// Math.random() — so a given galaxy has the same structure every time its
// tier is built, instead of silently reshaping itself on each visit.

// Particle budget per galaxy, chosen to sit around 8-12k each: the whole
// roster across every tier stays near ~100k total, and only one tier is ever
// active at once. (For contrast, milkyWay.js spends 60,000 on the Milky Way
// alone — it can afford to, being the only object in its own tier.)
const COUNTS = {
  spiral: 10000,
  elliptical: 9000,
  irregular: 8000,
  ring: 9000,
  cluster: 10000,
  colliding: 11000,
};

// Particle kinds, written per-vertex so colours can be recomputed later
// (when the real photo's ramp arrives) without rebuilding any positions.
const KIND_STAR = 0;
const KIND_CORE = 1;
const KIND_HII = 2; // pink H-alpha star-forming knot

// The crimson-pink of ionized hydrogen. Real, not decorative: H-alpha
// emission at 656nm is why star-forming regions glow this specific colour in
// every long-exposure photo of a spiral galaxy.
const HII_COLOR = new THREE.Color(1.0, 0.36, 0.52);

function makeRandom(seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (Math.imul(s, 31) + seedStr.charCodeAt(i)) >>> 0;
  s = (s ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Two uniform samples -> one roughly-normal sample (Box-Muller), for clump
// densities that fall off smoothly from their center instead of ending at a
// hard spherical edge the eye can pick out.
function gaussian(rand) {
  const u = Math.max(1e-6, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Most stars are faint and small; a few are bright and large. Cubing a
// uniform sample gives exactly that lopsided distribution, and it's most of
// what stops the field from looking like uniform digital confetti.
function starSize(rand) {
  return 0.35 + Math.pow(rand(), 3) * 2.4;
}

// A writer bundles the four parallel arrays every fill function appends to.
function makeWriter(count) {
  return {
    pos: new Float32Array(count * 3),
    size: new Float32Array(count),
    depth: new Float32Array(count), // 0..1 into the galaxy, drives the colour ramp
    kind: new Uint8Array(count),
    n: 0,
    put(x, y, z, t, sz, kind) {
      const i = this.n;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.depth[i] = t;
      this.size[i] = sz;
      this.kind[i] = kind;
      this.n++;
    },
  };
}

// ---------- per-type fill functions ----------

function fillSpiral(rand, count, radius, w, center = null) {
  const arms = 2 + Math.floor(rand() * 3); // 2-4 arms, per galaxy
  const tightness = 0.30 + rand() * 0.14;
  const bulgeFrac = 0.22;
  const cx = center ? center.x : 0;
  const cy = center ? center.y : 0;
  const cz = center ? center.z : 0;

  // H-alpha knots sit in discrete clumps along the arms, not sprinkled
  // evenly — precomputing a handful of knot anchors and clustering around
  // them is what makes them read as real star-forming regions.
  const knots = [];
  const knotCount = 10 + Math.floor(rand() * 10);
  for (let k = 0; k < knotCount; k++) {
    const t = 0.25 + rand() * 0.7;
    const armAngle = Math.floor(rand() * arms) * ((Math.PI * 2) / arms);
    const theta = armAngle + Math.log(1 + t * 8) / tightness;
    const r = Math.pow(t, 0.7) * radius;
    knots.push({ x: r * Math.cos(theta), z: r * Math.sin(theta), t });
  }

  for (let i = 0; i < count; i++) {
    if (rand() < bulgeFrac) {
      // Central bulge: dense, flattened, and much brighter than the disc —
      // this is the blown-out core every real galaxy photo has.
      const r = Math.pow(rand(), 2.2) * radius * 0.2;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const t = (r / radius) * 1.6;
      w.put(
        cx + r * Math.sin(phi) * Math.cos(theta),
        cy + r * Math.cos(phi) * 0.6,
        cz + r * Math.sin(phi) * Math.sin(theta),
        t,
        starSize(rand) * 0.85,
        KIND_CORE
      );
      continue;
    }

    // H-alpha knot along an arm.
    if (rand() < 0.05) {
      const k = knots[Math.floor(rand() * knots.length)];
      const spread = radius * 0.035;
      w.put(
        cx + k.x + gaussian(rand) * spread,
        cy + gaussian(rand) * spread * 0.35,
        cz + k.z + gaussian(rand) * spread,
        k.t,
        starSize(rand) * 1.5 + 0.5,
        KIND_HII
      );
      continue;
    }

    // Logarithmic spiral arms — the same relation milkyWay.js uses, but
    // expressed against a normalized 0..1 radius so it holds at any scale
    // rather than being tied to one hardcoded galaxy size.
    const t = rand();
    const r = Math.pow(t, 0.7) * radius;
    const armAngle = (i % arms) * ((Math.PI * 2) / arms);
    let jitter = (rand() - 0.5) * 0.42 * (1.4 - t * 0.8);

    // Dust lane: a narrow band on the INNER edge of the arm ridge, where
    // real spirals carry their dust. Additive blending can't draw anything
    // darker than the background, so the lane is made the way it exists in
    // reality — as an absence of stars. Particles landing in the band get
    // pushed clear of it, leaving a visible dark thread tracing each arm.
    const laneCentre = -0.11;
    const laneHalfWidth = 0.055 * (1.4 - t * 0.8);
    const d = jitter - laneCentre;
    if (Math.abs(d) < laneHalfWidth) jitter = laneCentre + Math.sign(d || 1) * laneHalfWidth;

    const theta = armAngle + Math.log(1 + t * 8) / tightness + jitter;
    const thickness = ((1 - t) * 0.05 + 0.015) * radius;
    w.put(
      cx + r * Math.cos(theta),
      cy + gaussian(rand) * thickness * 0.5,
      cz + r * Math.sin(theta),
      t,
      starSize(rand),
      KIND_STAR
    );
  }
}

function fillElliptical(rand, count, radius, w, center = null) {
  // Smooth, featureless, centrally concentrated — no arms, no disk, no dust,
  // no young blue stars. Squashed on two axes so it reads as a real oblate
  // spheroid rather than a ball.
  const flatY = 0.55 + rand() * 0.2;
  const flatZ = 0.78 + rand() * 0.18;
  const cx = center ? center.x : 0;
  const cy = center ? center.y : 0;
  const cz = center ? center.z : 0;

  for (let i = 0; i < count; i++) {
    const t = Math.pow(rand(), 0.62);
    const r = t * radius;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    w.put(
      cx + r * Math.sin(phi) * Math.cos(theta),
      cy + r * Math.cos(phi) * flatY,
      cz + r * Math.sin(phi) * Math.sin(theta) * flatZ,
      t,
      starSize(rand) * (t < 0.15 ? 0.9 : 1),
      t < 0.12 ? KIND_CORE : KIND_STAR
    );
  }
}

function fillIrregular(rand, count, radius, w) {
  // No defined center and no symmetry — a handful of overlapping
  // star-forming clumps, which is what the Magellanic Clouds actually look
  // like next to a structured spiral. Heavy on H-alpha: the LMC hosts the
  // Tarantula, the most active star-forming region in the Local Group.
  const blobs = 4 + Math.floor(rand() * 3);
  const centers = [];
  for (let b = 0; b < blobs; b++) {
    centers.push({
      x: (rand() - 0.5) * radius * 1.15,
      y: (rand() - 0.5) * radius * 0.5,
      z: (rand() - 0.5) * radius * 1.15,
      r: radius * (0.2 + rand() * 0.28),
      hot: rand() < 0.45, // this clump is an active star-forming region
    });
  }

  for (let i = 0; i < count; i++) {
    const b = centers[Math.floor(rand() * centers.length)];
    const x = b.x + gaussian(rand) * b.r * 0.5;
    const y = b.y + gaussian(rand) * b.r * 0.3;
    const z = b.z + gaussian(rand) * b.r * 0.5;
    const t = Math.min(1, Math.hypot(x, y, z) / radius);
    const isHii = b.hot && rand() < 0.16;
    w.put(x, y, z, t, isHii ? starSize(rand) * 1.4 + 0.4 : starSize(rand), isHii ? KIND_HII : KIND_STAR);
  }
}

function fillRing(rand, count, radius, w) {
  // A bright ring well out from a sparse core — the Cartwheel's shape, left
  // over from a head-on collision that sent a wave of star formation
  // rippling outward. That wave is why the ring is studded with H-alpha.
  const ringR = radius * 0.78;
  const tube = radius * 0.13;
  const coreFrac = 0.18;

  for (let i = 0; i < count; i++) {
    if (rand() < coreFrac) {
      const r = Math.pow(rand(), 0.5) * radius * 0.22;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      w.put(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.5,
        r * Math.sin(phi) * Math.sin(theta),
        0.12,
        starSize(rand),
        KIND_CORE
      );
      continue;
    }
    const theta = rand() * Math.PI * 2;
    const rr = ringR + gaussian(rand) * tube * 0.5;
    const isHii = rand() < 0.14;
    w.put(
      rr * Math.cos(theta),
      gaussian(rand) * tube * 0.25,
      rr * Math.sin(theta),
      0.9,
      isHii ? starSize(rand) * 1.5 + 0.4 : starSize(rand),
      isHii ? KIND_HII : KIND_STAR
    );
  }
}

// A cluster is many galaxies, not one — so this scatters dozens of small
// member galaxies (each a real mini spiral or elliptical, built by the same
// fills above) through the volume, all packed into the one shared buffer.
function fillCluster(rand, count, radius, w, opts = {}) {
  const members = opts.members ?? 36;
  const spread = opts.spread ?? 1;
  const centerOffsetX = opts.centerX ?? 0;
  const per = Math.floor(count / members);
  let remaining = count;

  for (let m = 0; m < members; m++) {
    // Members crowd toward the cluster core, the way real clusters do,
    // rather than spreading uniformly to the edge.
    const rr = Math.pow(rand(), 0.62) * radius * spread;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const center = {
      x: centerOffsetX + rr * Math.sin(phi) * Math.cos(theta),
      y: rr * Math.cos(phi) * 0.72,
      z: rr * Math.sin(phi) * Math.sin(theta),
    };
    const memberR = radius * (0.05 + rand() * 0.075);
    const n = m === members - 1 ? remaining : Math.min(per, remaining);
    if (n <= 0) break;
    remaining -= n;
    // Real clusters are dominated by ellipticals, with spirals more common
    // out toward the edges — the morphology-density relation.
    if (rand() < 0.35) fillSpiral(rand, n, memberR, w, center);
    else fillElliptical(rand, n, memberR, w, center);
  }
}

// Two clusters caught mid-collision — the Bullet Cluster's defining shape,
// and the reason it's the standard visual evidence for dark matter: the two
// masses have passed through each other rather than merging.
function fillColliding(rand, count, radius, w) {
  const half = Math.floor(count / 2);
  fillCluster(rand, half, radius * 0.62, w, { members: 22, centerX: -radius * 0.42 });
  fillCluster(rand, count - half, radius * 0.48, w, { members: 16, centerX: radius * 0.5 });
}

function countFor(type) {
  if (type === "Elliptical galaxy") return COUNTS.elliptical;
  if (type === "Irregular dwarf galaxy") return COUNTS.irregular;
  if (type === "Ring galaxy") return COUNTS.ring;
  if (type === "Galaxy cluster") return COUNTS.cluster;
  if (type === "Colliding galaxy clusters") return COUNTS.colliding;
  return COUNTS.spiral;
}

// Draws every star as a soft round glow at its own size, instead of the
// identical hard squares a plain PointsMaterial produces. ShaderMaterial is
// already an established pattern in this codebase — scene/sun.js's
// createAtmosphere() uses one for the Fresnel rim-light on every planet.
const VERT = `
  attribute float aSize;
  attribute vec3 color;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Perspective size falloff: nearer stars are bigger, exactly like
    // PointsMaterial's sizeAttenuation, but per-particle. Clamped because
    // gl_PointSize above the driver's limit is silently undefined behaviour.
    gl_PointSize = clamp(aSize * uScale / max(0.0001, -mv.z), 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = `
  varying vec3 vColor;
  void main() {
    // Round the square point sprite off into a disc, then fall off toward
    // the edge so each star is a soft glow rather than a hard dot. Squaring
    // the falloff tightens the bright core and leaves a faint halo — with
    // additive blending, overlapping halos build into the diffuse haze a
    // real long-exposure shows between the resolved stars.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = 1.0 - r2 * 4.0;
    gl_FragColor = vec4(vColor, a * a);
  }
`;

// Builds one galaxy as a real THREE.Points object, shaped by `type`.
// `radius` is the galaxy's own visual half-extent in scene units — the
// caller (cosmos/galaxyFactory.js) derives it from the tier's bounds, the
// same value its clickable proxy sphere uses.
export function buildGalaxyParticles(entry, radius) {
  const rand = makeRandom(entry.name);
  const type = entry.type;
  const count = countFor(type);
  const w = makeWriter(count);

  if (type === "Elliptical galaxy") fillElliptical(rand, count, radius, w);
  else if (type === "Irregular dwarf galaxy") fillIrregular(rand, count, radius, w);
  else if (type === "Ring galaxy") fillRing(rand, count, radius, w);
  else if (type === "Galaxy cluster") fillCluster(rand, count, radius, w);
  else if (type === "Colliding galaxy clusters") fillColliding(rand, count, radius, w);
  else fillSpiral(rand, count, radius, w);

  const col = new Float32Array(count * 3);
  const c = new THREE.Color();

  // Colours are a pure function of (depth, kind, ramp) — so when the real
  // photo's measured ramp arrives later, this runs again over the same
  // positions and the galaxy simply restains itself in place.
  function applyRamp(ramp) {
    for (let i = 0; i < w.n; i++) {
      sampleRamp(ramp, w.depth[i], c);
      const kind = w.kind[i];
      if (kind === KIND_CORE) {
        c.lerp(new THREE.Color(1, 0.95, 0.85), 0.35).multiplyScalar(1.25); // cores blow out toward white-gold
      } else if (kind === KIND_HII) {
        c.lerp(HII_COLOR, 0.8);
      }
      col[i * 3] = Math.min(1, c.r);
      col[i * 3 + 1] = Math.min(1, c.g);
      col[i * 3 + 2] = Math.min(1, c.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(w.pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(w.size, 1));
  const colorAttr = new THREE.BufferAttribute(col, 3);
  geo.setAttribute("color", colorAttr);

  // Paints immediately with whatever ramp is available now (the fallback on
  // a first visit), then repaints once the real photo has been measured —
  // the same progressive-upgrade contract textures/realTextures.js uses for
  // every planet in the app.
  applyRamp(
    getGalaxyRamp(entry, (measured) => {
      applyRamp(measured);
      colorAttr.needsUpdate = true;
    })
  );

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      // Star size scales with the galaxy's own radius, so a small dwarf and
      // a large spiral both resolve into a coherent object rather than one
      // looking like sand and the other like scattered dots.
      uScale: { value: radius * 0.55 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // overlapping stars build up into a glowing core, the way a real long-exposure does
  });

  const points = new THREE.Points(geo, mat);
  points.name = `${entry.name} particles`;

  // Every galaxy gets its own stable tilt so the tier doesn't read as a set
  // of coplanar discs all facing the same way — real galaxies are oriented
  // arbitrarily relative to us, and the variety is most of what sells these
  // as objects in a 3D space rather than flat cutouts.
  points.rotation.set(
    (rand() - 0.5) * Math.PI * 0.9,
    rand() * Math.PI * 2,
    (rand() - 0.5) * Math.PI * 0.6
  );

  return points;
}
