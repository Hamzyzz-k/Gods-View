import * as THREE from "three";
import { AppState } from "../core/state.js";
import { sun } from "../scene/sun.js";
import { planets } from "../scene/planetFactory.js";

// ---------- VR collision: sphere-vs-sphere with soft push-back ----------
//
// Solid: the Sun, every planet, and every moon (Earth's and every other
// planet's). Explicitly pass-through: the asteroid belt (decorative only)
// and the ISS (small and fast — colliding with it added fiddliness with no
// real benefit). Desktop's OrbitControls is an external orbit view, not
// first-person movement, so none of this runs there.
//
// This isn't a physics engine — it's a distance check per solid body per
// frame, in two passes:
//   1. Deflect the player's intended movement so it can't carry them THROUGH
//      a surface (slide along it instead of stopping dead) — most contact
//      never gets past this pass, which is why it doesn't feel like hitting
//      a wall.
//   2. A clamped, framerate-scaled spring nudges the player back out if
//      anything still ends up overlapping (fast approach, spawning inside a
//      body, two close bodies fighting over the correction) — gradual over a
//      few frames rather than an instant teleport, which is what makes it
//      read as a soft bounce instead of a glitch.

// Not physically scaled to this scene (Earth's radius here is ~1.1 units) —
// a stylistic choice, tuned by eye. No headset to tune it further against
// yet, so this is a reasonable starting guess.
const PLAYER_RADIUS = 0.4;

// A body only starts deflecting movement once the player is within this much
// extra distance of contact, rather than exactly at the surface — otherwise
// a single large frame delta (a lag spike, or just fast flight) can jump from
// "not touching" to "already through" between two consecutive checks.
const DEFLECT_MARGIN = 0.4;

// This is a discrete, distance-based check — it looks at where the player is
// before and after a move, not along the path between, so nothing stops a
// single move bigger than DEFLECT_MARGIN from landing past a surface without
// ever registering as "close" the frame before. Clamping the maximum size of
// any one frame's movement to less than the margin closes that gap for real:
// starting from just outside the margin, the worst a clamped move can do is
// land just outside the surface, never through it — this is a guarantee, not
// just a smaller version of the same risk, which only holds because
// MAX_STEP_PER_FRAME < DEFLECT_MARGIN.
//
// The clamp only engages during an actual frame-time spike: at full combined
// horizontal+vertical speed even at 72Hz (the lower end of Quest refresh
// rates) a single frame moves about 0.27 units, comfortably under this
// value, so normal flight is never affected. It only starts trimming
// movement below roughly 56fps, at which point briefly slowing down is a far
// smaller problem than clipping through a planet.
const MAX_STEP_PER_FRAME = 0.35;

// Ceiling on how many collision-resolved substeps one frame may be split into
// (see resolveAndApplyMovement). 24 covers the fastest selectable flight
// speed with room to spare — 8x at 72Hz needs about 6 — while bounding the
// worst-case cost of a single frame after a long stall.
const MAX_SUBSTEPS = 24;

const MAX_PUSH_PER_FRAME = 2.0; // clamp so the spring can't overshoot past the surface and start oscillating
const SPRING_STRENGTH = 6.0; // correction rate, per second
const SPRING_PASSES = 2; // re-check after correcting, so fixing one overlap doesn't reintroduce another (e.g. a planet and its moon sitting close together)

// Built once, lazily, the first time collision runs — planets/moons/sun all
// exist by then (main.js imports scene modules before xr modules). Radius is
// read from each mesh's own SphereGeometry rather than duplicated by hand, so
// it can never drift out of sync with the geometry actually being rendered.
// isVisible mirrors exactly what assistant/sceneRegistry.js checks for the
// same body, so a body you've hidden from the scene stops being solid too —
// bumping into something you can't see would just look like a bug.
let collidables = null;

function buildCollidables() {
  const list = [{ mesh: sun, radius: sun.geometry.parameters.radius, isVisible: () => sun.visible }];

  planets.forEach(({ mesh, pivot, data }) => {
    list.push({ mesh, radius: mesh.geometry.parameters.radius, isVisible: () => pivot.visible });

    if (data._moonMesh && data._moonPivot) {
      // Earth's Moon
      list.push({
        mesh: data._moonMesh,
        radius: data._moonMesh.geometry.parameters.radius,
        isVisible: () => data._moonPivot.visible,
      });
    }
    if (data._moons) {
      data._moons.forEach((m) => {
        list.push({ mesh: m.mesh, radius: m.mesh.geometry.parameters.radius, isVisible: () => m.pivot.visible });
      });
    }
  });

  return list;
}

// Scratch objects, reused every frame — see locomotion.js for why this
// matters more here than on desktop.
const _bodyPos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _substep = new THREE.Vector3();

// Called once per frame from locomotion.js with the movement the thumbsticks
// intend for this frame, BEFORE it has been applied to the rig. Mutates
// rig.position directly rather than returning a value, since the final
// position after both the deflection and spring passes is what actually
// matters — there is no single "corrected delta" that describes it cleanly
// once a spring correction is layered on top.
//
// dt is the same frame delta locomotion computed intendedDelta from — needed
// here too since the spring pass is framerate-scaled independently of it.
export function resolveAndApplyMovement(intendedDelta, dt) {
  if (!collidables) collidables = buildCollidables();

  // A frame that wants to travel further than MAX_STEP_PER_FRAME is split
  // into several short steps rather than simply truncated.
  //
  // Truncating was correct while the only thing feeding this was thumbstick
  // flight at a fixed speed, where the clamp was documented as engaging only
  // during a frame-time spike. It stopped being correct once movement speed
  // became adjustable (core/moveSpeed.js): at 8x a single 72Hz frame asks to
  // move about 2.0 units, and clamping that to 0.35 silently capped the top
  // speed at roughly 1.4x no matter what the player selected. Hand pinch-drag
  // (xr/locomotion.js) can ask for a large delta in one frame too.
  //
  // Substepping keeps the anti-tunneling guarantee intact rather than trading
  // it away for speed: the guarantee comes from each resolved step being
  // shorter than DEFLECT_MARGIN, and every substep still is. The step count is
  // capped so a pathological delta can't stall a frame — at that cap the old
  // truncating behaviour returns, which is the safe way to fail.
  const length = intendedDelta.length();
  if (length <= MAX_STEP_PER_FRAME) {
    resolveStep(intendedDelta, dt);
    return;
  }
  const steps = Math.min(MAX_SUBSTEPS, Math.ceil(length / MAX_STEP_PER_FRAME));
  _substep.copy(intendedDelta).divideScalar(steps);
  const subDt = dt / steps;
  for (let i = 0; i < steps; i++) resolveStep(_substep, subDt);
}

// One collision-resolved movement step, guaranteed shorter than
// DEFLECT_MARGIN. Split out of resolveAndApplyMovement() so substepping can
// reuse it unchanged — the deflection and spring logic below is exactly what
// it always was.
function resolveStep(intendedDelta, dt) {
  const { rig } = AppState;

  // ---- pass 1: deflect using where the player is RIGHT NOW, then move ----
  _delta.copy(intendedDelta);
  if (_delta.lengthSq() > MAX_STEP_PER_FRAME * MAX_STEP_PER_FRAME) _delta.setLength(MAX_STEP_PER_FRAME);
  for (const body of collidables) {
    if (!body.isVisible()) continue;
    body.mesh.getWorldPosition(_bodyPos);
    const combinedRadius = body.radius + PLAYER_RADIUS;
    const dist = rig.position.distanceTo(_bodyPos);
    if (dist >= combinedRadius + DEFLECT_MARGIN) continue;

    _normal.subVectors(rig.position, _bodyPos);
    if (_normal.lengthSq() < 1e-8) _normal.set(0, 1, 0); // standing exactly on the center — pick an arbitrary way out
    else _normal.normalize();

    const inward = _delta.dot(_normal); // negative == this frame's move is heading into the body
    if (inward < 0) _delta.addScaledVector(_normal, -inward); // cancel only the inward part — the rest is a slide along the surface, not a stop
  }
  rig.position.add(_delta);

  // ---- pass 2: spring-correct anything still overlapping after the move ----
  for (let pass = 0; pass < SPRING_PASSES; pass++) {
    for (const body of collidables) {
      if (!body.isVisible()) continue;
      body.mesh.getWorldPosition(_bodyPos);
      const combinedRadius = body.radius + PLAYER_RADIUS;
      const dist = rig.position.distanceTo(_bodyPos);
      if (dist >= combinedRadius) continue;

      _normal.subVectors(rig.position, _bodyPos);
      if (_normal.lengthSq() < 1e-8) _normal.set(0, 1, 0);
      else _normal.normalize();

      const penetration = combinedRadius - dist;
      const push = Math.min(penetration, MAX_PUSH_PER_FRAME) * SPRING_STRENGTH * dt;
      rig.position.addScaledVector(_normal, push);
    }
  }
}
