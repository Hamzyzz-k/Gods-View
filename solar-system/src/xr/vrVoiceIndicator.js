import { AppState } from "../core/state.js";
import { VRPanel, COLORS, roundRect } from "./vrPanel.js";

// ---------- VR voice feedback ----------
// There's no chat log in VR to show a transcript in, so without this a
// push-to-talk press would give zero confirmation of whether anything was
// heard before the spoken reply arrives — this exists purely to close that
// gap: a small rig-parented strip, just below the control panel, showing
// "listening" while recording and the transcript briefly after.
const LOCAL_POSITION = [0, 1.15, -2.0]; // control panel sits at y=1.6; this sits just under it

export const voiceIndicator = new VRPanel({ worldWidth: 2.0, worldHeight: 0.4, canvasWidth: 1024 });
voiceIndicator.mesh.name = "vrVoiceIndicator";
voiceIndicator.mesh.position.set(...LOCAL_POSITION);

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

export function showListening() {
  clearTimeout(hideTimer);
  draw("🎤 Listening…", "#ff6b6b");
  voiceIndicator.mesh.visible = true;
}

export function showHeard(text) {
  clearTimeout(hideTimer);
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
