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
// Rig-parented HUD rather than world-anchored beside the focused body. The
// old placement floated the panel next to whatever you had selected, which
// read well while you were still next to it and became useless the moment you
// flew anywhere — the text you wanted was back at the planet you just left.
// Parented to the rig it travels with you and stays readable from anywhere,
// the same "console mounted in front of the player" treatment
// xr/vrControlPanel.js documents at length.
//
// Sized deliberately smaller than the old world-anchored version (2.0 x 1.3).
// At FORWARD_Z that would have spanned ~42 degrees of horizontal view — the
// exact mistake the control panel was already corrected for once, when a
// 66-degree bar turned out to be what "the panel spoils the view" meant.
// 1.2 wide is ~26 degrees, and it sits off to the left rather than dead
// ahead, so it's a glance rather than an obstruction.
const FORWARD_Z = -2.6; // matches every other rig-parented panel
const SIDE_X = -1.2; // left of centre, clear of the control panel's own ±0.55
const HEIGHT_ABOVE_EYES = 0.35;

const CANVAS_W = 1024;
const CANVAS_H = 666;
export const infoVrPanel = new VRPanel({
  worldWidth: 1.2,
  worldHeight: 1.2 * (CANVAS_H / CANVAS_W),
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
});
infoVrPanel.mesh.name = "vrInfoPanel";

const PADDING = 40;

// Which target the player explicitly dismissed the panel for. Tracked by
// object rather than as a plain boolean because the brief is specific: the
// panel must be dismissable while something is STILL focused, and must come
// back on its own when a different body is selected. A boolean cleared by
// focusedTarget going null would fail the first half; never clearing it would
// fail the second.
let dismissedFor = null;

export function dismissVrInfoPanel() {
  dismissedFor = AppState.focusedTarget;
}

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

  infoPanelHitRects.length = 0;

  let y = PADDING + 20;

  // Close button, top-right. Same role as the desktop panel's own #infoClose,
  // but it can't just mirror that button: #infoClose calls clearFocus(),
  // which unfocuses the body entirely, and the brief asks for a dismiss that
  // leaves the current focus intact. So this carries its own onSelect.
  const closeSize = 52;
  const closeX = W - PADDING - closeSize;
  const closeY = PADDING - 12;
  roundRect(ctx, closeX, closeY, closeSize, closeSize, 12);
  ctx.fillStyle = COLORS.pillBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText("×", closeX + closeSize / 2, closeY + closeSize / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  infoPanelHitRects.push({ x: closeX, y: closeY, w: closeSize, h: closeSize, onSelect: dismissVrInfoPanel });

  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.gold;
  // Stop the title running under the close button.
  ctx.fillText(infoName.textContent || "", PADDING, y, W - PADDING * 2 - closeSize - 16);
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
    ctx.fillText("Land on Surface", W / 2, btnY + btnH / 2 + 2);
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
  // Rig-parented, like every other VR panel. This also removes the
  // self-healing reparent the world-anchored version needed every frame: the
  // rig is itself moved into whichever scene is active
  // (cosmos/tierNavigation.js, surface/surfaceMode.js), so its children come
  // along automatically and can never be left behind in a scene that is no
  // longer being rendered.
  AppState.rig.add(infoVrPanel.mesh);
  infoVrPanel.mesh.position.set(SIDE_X, HEIGHT_ABOVE_EYES, FORWARD_Z);
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

// Called once per frame, VR only. No billboarding and no world anchoring
// anymore: as a rig child the panel already turns with the player (rig yaw)
// and travels with them, so it faces them by construction. PlaneGeometry's
// front face points toward +Z, and the panel sits at local -Z from the rig
// with no rotation, so that face is already looking back at the player —
// the same reasoning vrControlPanel.js documents for its own placement.
export function updateVrInfoPanel() {
  const target = AppState.focusedTarget;

  // A newly focused body clears any earlier dismissal, so closing the panel
  // for one planet doesn't silently suppress it for every planet after.
  if (target && dismissedFor && target !== dismissedFor) dismissedFor = null;

  const shouldShow =
    AppState.xrSession &&
    target &&
    target !== dismissedFor &&
    infoPanel.classList.contains("visible");

  infoVrPanel.mesh.visible = !!shouldShow;
  if (!shouldShow) return;

  // Live eye height, same per-frame tracking every sibling panel does — the
  // constructor's Y is only correct until the headset reports a real pose.
  infoVrPanel.mesh.position.y = AppState.camera.position.y + HEIGHT_ABOVE_EYES;
}
