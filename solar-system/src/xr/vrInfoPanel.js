import * as THREE from "three";
import { AppState } from "../core/state.js";
import { infoPanel, infoName, infoMeta, infoDesc, infoCredit } from "../ui/infoPanel.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { getSurfaceData } from "../surface/surfaceData.js";
import { registerPanel } from "./controllerRaycast.js";

// ---------- VR in-world info panel ----------
// Shows the same content as the desktop #infoPanel — name, description, and
// the real Solar System OpenData / ISS-live fact chips — for whichever body
// is currently focused.
//
// Rather than re-running the fetches and re-building this content from
// scratch (a second implementation that could quietly drift from the
// desktop one), this panel is a mirror: a MutationObserver watches the real
// #infoPanel DOM node, which showInfoFor() (ui/infoPanel.js) already
// populates synchronously for the base content and asynchronously for the
// fact chips once they arrive. Whenever that DOM changes, this redraws from
// whatever is actually in it right now — one source of content, two
// renderers.
export const infoVrPanel = new VRPanel({ worldWidth: 2.0, worldHeight: 1.3, canvasWidth: 1024 });
infoVrPanel.mesh.name = "vrInfoPanel";

const PADDING = 40;

// Consumed by xr/controllerRaycast.js's panel registry. VR has no double-
// click gesture (the desktop landing trigger — interaction/raycastPicking.js),
// so this button IS how landing happens in VR: laser-select it and it fires
// the exact same click handler the desktop #landBtn does (see
// surface/desktopSurfaceUI.js), reused rather than duplicated by mapping
// this hit-rect to that same DOM id.
export const infoPanelHitRects = [];

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y + lines * lineHeight);
  return lines + 1;
}

function redraw() {
  const { ctx, canvasWidth: W, canvasHeight: H } = infoVrPanel;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  let y = PADDING + 20;

  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(infoName.textContent || "", PADDING, y);
  y += 60;

  // Meta chips (Object -> "<span>k: v</span>" pairs) — drawn as small pills
  // wrapped across the panel width rather than a single line, since some
  // bodies (Saturn, with a ring + multiple facts) have more chips than fit.
  ctx.font = "24px sans-serif";
  const chipEls = Array.from(infoMeta.querySelectorAll("span"));
  let cx = PADDING;
  let cy = y;
  const chipH = 40;
  chipEls.forEach((span) => {
    const text = span.textContent;
    const isReal = span.classList.contains("real-data");
    const w = ctx.measureText(text).width + 28;
    if (cx + w > W - PADDING) {
      cx = PADDING;
      cy += chipH + 10;
    }
    roundRect(ctx, cx, cy, w, chipH, chipH / 2);
    ctx.fillStyle = isReal ? "rgba(255,210,122,0.18)" : COLORS.pillBg;
    ctx.fill();
    ctx.strokeStyle = isReal ? COLORS.gold : COLORS.pillBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isReal ? COLORS.gold : COLORS.textDim;
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx + 14, cy + chipH / 2 + 2);
    ctx.textBaseline = "alphabetic";
    cx += w + 10;
  });
  y = cy + chipH + 30;

  ctx.font = "26px sans-serif";
  ctx.fillStyle = COLORS.text;
  const lines = wrapText(ctx, infoDesc.textContent || "", PADDING, y, W - PADDING * 2, 34);
  y += lines * 34 + 20;

  // Land button — only for the 9 planets in surface/surfaceData.js. Placed
  // at a fixed distance from the bottom edge (not stacked under the
  // variable-height description above) so its position is predictable
  // regardless of how much text just wrapped above it.
  infoPanelHitRects.length = 0;
  if (getSurfaceData(infoName.textContent)) {
    const btnH = 64;
    const btnY = H - 108;
    roundRect(ctx, PADDING, btnY, W - PADDING * 2, btnH, btnH / 2);
    ctx.fillStyle = COLORS.pillBgActive;
    ctx.fill();
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.blue;
    ctx.fillText("🚶 Land on Surface", W / 2, btnY + btnH / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    infoPanelHitRects.push({ domId: "landBtn", x: PADDING, y: btnY, w: W - PADDING * 2, h: btnH });
  }

  if (infoCredit.textContent) {
    ctx.font = "italic 20px sans-serif";
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(infoCredit.textContent, PADDING, H - 24);
  }

  infoVrPanel.markDirty();
}

export function initVrInfoPanel() {
  AppState.scene.add(infoVrPanel.mesh); // world-anchored, so it's a scene child, not the rig's
  redraw();
  const observer = new MutationObserver(redraw);
  observer.observe(infoPanel, { childList: true, subtree: true, characterData: true });

  // The mesh sits in raycastTargets regardless of visibility, but
  // THREE.Raycaster already skips invisible objects during traversal, so
  // this needs no extra "only while shown" guard of its own.
  registerPanel({
    mesh: infoVrPanel.mesh,
    getHitRects: () => infoPanelHitRects,
    uvToCanvasPx: (uv) => infoVrPanel.uvToCanvasPx(uv),
  });
}

// Scratch objects, reused every frame.
const _targetPos = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _camPos = new THREE.Vector3();

// Called once per frame, VR only. World-anchored near the focused body
// (offset by its radius so it doesn't clip into the surface) rather than
// locked to the camera: a panel that only rotates to face the player, but
// doesn't translate with them, is the billboarded-object pattern the brief
// calls for, and avoids the "always pinned in your peripheral vision"
// discomfort of a head-locked panel — reserved here for the small control
// bar instead, which needs to be reachable from anywhere.
export function updateVrInfoPanel() {
  const target = AppState.focusedTarget;
  const shouldShow = AppState.xrSession && target && infoPanel.classList.contains("visible");
  infoVrPanel.mesh.visible = !!shouldShow;
  if (!shouldShow) return;

  target.getWorldPosition(_targetPos);
  target.geometry.computeBoundingSphere();
  const r = target.geometry.boundingSphere.radius;

  AppState.camera.getWorldPosition(_camPos);
  _offset.subVectors(_camPos, _targetPos);
  _offset.y = 0; // keep the panel roughly level rather than tilting toward the player's height
  if (_offset.lengthSq() < 1e-6) _offset.set(1, 0, 0);
  _offset.normalize().multiplyScalar(r + 1.5);

  infoVrPanel.mesh.position.copy(_targetPos).add(_offset);
  infoVrPanel.mesh.position.y = _targetPos.y + r + 0.9; // float above the body, not beside it at its equator

  // Billboard: face the panel toward the camera's actual position, not just
  // match its rotation — those are only the same thing when the panel
  // happens to sit exactly on the camera's boresight, which it usually
  // won't (it's offset near the focused body, not centered in view).
  // Object3D.lookAt() on a non-Camera/Light object orients its local +Z
  // toward the target — which is exactly PlaneGeometry's front-face
  // direction, so this is the correct call for a billboard, not a
  // camera-style "look toward" of its own facing.
  infoVrPanel.mesh.lookAt(_camPos);
}
