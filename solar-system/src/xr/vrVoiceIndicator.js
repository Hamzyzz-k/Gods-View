import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";
import { controlPanel } from "./vrControlPanel.js";

// ---------- VR voice feedback ----------
// There's no chat log in VR to show a transcript in, so without this a
// push-to-talk press would give zero confirmation of whether anything was
// heard before the spoken reply arrives — this exists purely to close that
// gap: a small rig-parented strip, just below the control panel, showing
// "listening" while recording and the transcript briefly after.
//
// Sized to match the control panel (1.1 wide) rather than the original 2.0 —
// same reasoning as that panel's own resize: anything this size directly in
// front of the player crowds out the view it's supposed to be a small
// addition to.
const GAP_BELOW_CONTROL_PANEL = 0.42;

export const voiceIndicator = new VRPanel({ worldWidth: 1.1, worldHeight: 0.24, canvasWidth: 1024 });
voiceIndicator.mesh.name = "vrVoiceIndicator";

let hideTimer = null;
const SHOW_TRANSCRIPT_MS = 3000;

function draw(text, accent) {
  const { ctx, canvasWidth: W, canvasHeight: H } = voiceIndicator;
  ctx.clearRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, W / 2, H / 2);

  voiceIndicator.markDirty();
}

// Reads the control panel's CURRENT position rather than a fixed offset:
// that panel tracks the real headset's eye height every frame (see
// vrControlPanel.js), which is unknown until a real session reports it, so
// "just under the control panel" has to be computed live too, not assumed.
function syncPositionBelowControlPanel() {
  voiceIndicator.mesh.position.copy(controlPanel.mesh.position);
  voiceIndicator.mesh.position.y -= GAP_BELOW_CONTROL_PANEL;
}

export function showListening() {
  clearTimeout(hideTimer);
  syncPositionBelowControlPanel();
  draw("🎤 Listening…", "#ff6b6b");
  voiceIndicator.mesh.visible = true;
}

export function showHeard(text) {
  clearTimeout(hideTimer);
  syncPositionBelowControlPanel();
  draw(`"${text}"`, COLORS.blue);
  voiceIndicator.mesh.visible = true;
  hideTimer = setTimeout(() => {
    voiceIndicator.mesh.visible = false;
  }, SHOW_TRANSCRIPT_MS);
}

// Called when a push-to-talk press ends with nothing recognized (released
// too early, or genuine silence) — clears the "Listening…" state without
// leaving it stuck. If a transcript arrives moments later after all,
// showHeard() simply re-shows the panel over this.
export function hide() {
  clearTimeout(hideTimer);
  voiceIndicator.mesh.visible = false;
}

export function initVrVoiceIndicator() {
  AppState.rig.add(voiceIndicator.mesh);
}
