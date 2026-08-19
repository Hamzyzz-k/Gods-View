import * as THREE from "three";
import { AppState } from "../core/state.js";
import { getSizeEntry } from "../data/sizeData.js";

// ---------- scale grab: hold two worlds side by side ----------
// Squeeze while pointing at a body and a miniature of it appears in that
// hand. Squeeze with the other hand on something else and you are holding
// both, at a SHARED scale — which is the entire point. Scaling each one to
// fit its hand would look tidier and mean nothing; the comparison is only
// honest if one factor applies to both, so Earth in one hand and Jupiter in
// the other really is that much smaller.
//
// Complements sizeCompare/sizeCompareMode.js rather than replacing it: that
// is a guided sequence through chosen pairings, this is "I wonder about these
// two" answered directly.
//
// INPUT. Squeeze is already push-to-talk (xr/vrVoiceControl.js), which took
// it because trigger is select and both sticks are locomotion. Rather than
// move voice to some worse binding, the two are told apart by what the laser
// is on at the moment of the squeeze: pointing at a body means grab, pointing
// at nothing means talk. controllerRaycast.js has already written this
// frame's hover onto the controller, so both readings come from one source.
// This is the same disambiguation hand pinch-drag uses in locomotion.js.

// How large the bigger of the two held bodies is drawn, in metres. Sized to
// be examinable at arm's length without either hand's contents colliding
// with the other.
const HELD_MAX_SIZE = 0.22;

// A held body is never drawn smaller than this, even when true scale says it
// should be. Without a floor, Phobos next to the Sun is a fraction of a pixel
// — technically correct and visually useless. The label always states the
// real ratio, and says outright when the floor is in effect, so the honest
// number is never replaced by the convenient picture. Same disclosure
// ui/sizeComparePanel.js already makes for its own minimum-size floor.
const HELD_MIN_SIZE = 0.006;

const LABEL_W = 512;
const LABEL_H = 128;

// controller -> { name, mesh, label, diameterKm }
const held = new Map();

function diameterKmFor(name) {
  const entry = getSizeEntry(name);
  return entry?.diameterKm ?? null;
}

function makeLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24 * (LABEL_H / LABEL_W)),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.userData.ctx = canvas.getContext("2d");
  mesh.userData.tex = tex;
  return mesh;
}

function drawLabel(label, name, diameterKm, note) {
  const ctx = label.userData.ctx;
  ctx.clearRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = "rgba(10,12,24,0.82)";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  ctx.textAlign = "center";
  ctx.font = "bold 40px sans-serif";
  ctx.fillStyle = "#ffd27a";
  ctx.fillText(name, LABEL_W / 2, 46);

  ctx.font = "26px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(diameterKm ? `${Math.round(diameterKm).toLocaleString()} km across` : "size unknown", LABEL_W / 2, 84);

  if (note) {
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#7ab8ff";
    ctx.fillText(note, LABEL_W / 2, 114);
  }
  label.userData.tex.needsUpdate = true;
}

// Builds the miniature. Clones the live material off the real mesh rather
// than rebuilding one, so whatever that body currently looks like — including
// a real photo texture that finished loading after startup — is what you end
// up holding. Same reasoning sizeCompare/sizeCompareScene.js documents for
// its own clones.
function makeMiniature(sourceMesh) {
  const geo = new THREE.SphereGeometry(1, 32, 32);
  const mat = sourceMesh.material?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
  // The pick proxy on a black hole is deliberately invisible (opacity 0), and
  // cloning that would put nothing in the player's hand. Restore it for the
  // miniature.
  if (mat.transparent && mat.opacity === 0) {
    mat.opacity = 1;
    mat.transparent = false;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `held:${sourceMesh.name}`;
  return mesh;
}

export function grabBody(controller, bodyMesh) {
  if (!bodyMesh || held.has(controller)) return false;

  const name = bodyMesh.name;
  const mesh = makeMiniature(bodyMesh);
  const label = makeLabel();

  // Out in front of the hand, with the label below it, so the body itself
  // isn't hidden behind the controller model.
  mesh.position.set(0, 0, -0.28);
  label.position.set(0, -0.16, -0.28);

  controller.add(mesh);
  controller.add(label);
  held.set(controller, { name, mesh, label, diameterKm: diameterKmFor(name) });
  return true;
}

export function releaseBody(controller) {
  const entry = held.get(controller);
  if (!entry) return false;
  controller.remove(entry.mesh);
  controller.remove(entry.label);
  entry.mesh.geometry.dispose();
  entry.mesh.material.dispose();
  entry.label.geometry.dispose();
  entry.label.material.dispose();
  entry.label.userData.tex.dispose();
  held.delete(controller);
  return true;
}

export function isHolding(controller) {
  return held.has(controller);
}

export function heldCount() {
  return held.size;
}

// Called once per frame from core/loop.js. Recomputes the shared scale every
// frame rather than once at grab time, because the second hand can pick
// something up (or drop it) at any moment and both miniatures have to resize
// together the instant that happens.
export function updateScaleGrab() {
  if (held.size === 0) return;

  const entries = [...held.values()];
  const known = entries.filter((e) => e.diameterKm);
  // Largest of what's actually held is what gets drawn at full size;
  // everything else is measured against it.
  const maxKm = known.length ? Math.max(...known.map((e) => e.diameterKm)) : null;

  entries.forEach((entry) => {
    let radius = HELD_MAX_SIZE / 2;
    let note = null;

    if (entry.diameterKm && maxKm) {
      const trueSize = (entry.diameterKm / maxKm) * HELD_MAX_SIZE;
      if (trueSize < HELD_MIN_SIZE) {
        radius = HELD_MIN_SIZE / 2;
        // State the floor rather than letting the picture quietly lie.
        note = `enlarged to stay visible · really 1/${Math.round(maxKm / entry.diameterKm).toLocaleString()}`;
      } else {
        radius = trueSize / 2;
        if (entries.length > 1 && entry.diameterKm < maxKm) {
          note = `1/${Math.round(maxKm / entry.diameterKm).toLocaleString()} the size`;
        }
      }
    }

    entry.mesh.scale.setScalar(radius);
    entry.mesh.rotation.y += 0.004; // slow turn, so it reads as a globe rather than a flat disc

    if (entry.label.userData.note !== note) {
      entry.label.userData.note = note;
      drawLabel(entry.label, entry.name, entry.diameterKm, note);
    }
  });
}

// Drops everything. Called on session end and whenever the scene changes
// underneath the player (tier change, entering a surface) — the miniature is
// parented to the controller so it would otherwise survive into a context
// where the body it represents isn't even present.
export function releaseAll() {
  [...held.keys()].forEach(releaseBody);
}
