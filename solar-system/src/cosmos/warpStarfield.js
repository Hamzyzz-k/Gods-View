// ---------- warp starfield ----------
// A real "flying through stars" effect — particles hurtle toward the
// viewer and streak into trails, the classic hyperspace-jump canvas
// technique — replacing the earlier spinning-streak-overlay approach per
// explicit feedback that the transition should actually look like moving
// through a starfield, not an abstract spinning pattern.
//
// Pure 2D-canvas drawing logic with no THREE.js dependency, so the exact
// same drawWarpFrame() call works against two different targets: a
// full-viewport DOM <canvas> for desktop (cosmos/tierTransition.js), and
// an offscreen canvas backing a CanvasTexture painted onto the VR veil
// sphere (same file) — one implementation, two renderers, the same
// "canvas-texture-on-a-surface" pattern every VR panel in this app already
// uses for its own content.

const PARTICLE_COUNT = 260;

function resetParticle(p) {
  p.x = Math.random() * 2 - 1;
  p.y = Math.random() * 2 - 1;
  p.z = 0.15 + Math.random() * 0.85; // depth: larger = farther away, smaller = about to pass the viewer
  p.px = null;
  p.py = null; // previous projected screen position — null means "just spawned, no streak yet"
}

function makeParticles() {
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = {};
    resetParticle(p);
    p.z = Math.random(); // stagger initial depths across the full range for a natural-looking starting field, instead of every star spawning at the same distance
    particles.push(p);
  }
  return particles;
}

// One independent particle set per canvas target (desktop vs. VR), since
// the two run on different draw surfaces at different times and shouldn't
// visibly sync/mirror each other.
export function createWarpField() {
  return { particles: makeParticles() };
}

// intensity: 0..1, same eased "how far through the motion are we" number
// tierTransition.js's applyMotionCues() already computes for the starfield
// size boost — drives both speed (faster streaks at peak dolly speed) and
// trail opacity (streaks read more solid at peak, fainter at the edges of
// the transition, so it fades in/out rather than snapping on).
export function drawWarpFrame(field, ctx, W, H, intensity) {
  if (intensity <= 0.001) {
    ctx.clearRect(0, 0, W, H);
    return;
  }

  const cx = W / 2;
  const cy = H / 2;
  const focal = Math.min(W, H) * 0.5;

  // Trail persistence: paint a translucent dark rect instead of clearing,
  // so each frame's streaks fade into the next rather than vanishing
  // instantly — the actual mechanism that makes this read as motion rather
  // than a static starburst.
  ctx.fillStyle = `rgba(5,6,12,${0.32 + intensity * 0.22})`;
  ctx.fillRect(0, 0, W, H);

  const speed = 0.01 + intensity * 0.045;
  ctx.lineCap = "round";

  field.particles.forEach((p) => {
    p.z -= speed;
    if (p.z <= 0.02) {
      resetParticle(p);
      return;
    }
    const sx = cx + (p.x / p.z) * focal;
    const sy = cy + (p.y / p.z) * focal;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) {
      resetParticle(p);
      return;
    }
    if (p.px !== null) {
      const closeness = 1 - p.z; // 0 far, ~1 about to pass the viewer
      const alpha = Math.min(1, closeness * 1.3) * (0.35 + intensity * 0.65);
      const width = Math.max(0.6, closeness * 2.6 * (0.5 + intensity));
      ctx.strokeStyle = `rgba(220,230,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    p.px = sx;
    p.py = sy;
  });
}

export function clearWarpField(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
}
