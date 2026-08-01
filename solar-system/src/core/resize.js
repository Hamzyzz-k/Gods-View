import { AppState } from "./state.js";
const { camera, renderer } = AppState;

// ---------- resize ----------
window.addEventListener("resize", () => {
  // During an immersive session the headset dictates per-eye projection and
  // framebuffer size. Writing camera.aspect / calling setSize here would fight
  // that and can distort the stereo view, so the handler stands down until the
  // session ends. (A resize event can still fire mid-session — e.g. the user
  // rotates or resizes the desktop mirror window.)
  if (renderer.xr.isPresenting) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
