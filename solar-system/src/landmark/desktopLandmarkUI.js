import { AppState } from "../core/state.js";
import { enterLandmark, exitLandmark, getLandmarkList } from "./landmarkMode.js";
import { infoName } from "../ui/infoPanel.js";

const exitBtn = document.getElementById("exitLandmarkBtn");
const landmarksBtn = document.getElementById("landmarksBtn");
const modal = document.getElementById("landmarksModal");
const body = document.getElementById("landmarksBody");
const closeBtn = document.getElementById("landmarksClose");
const backdrop = document.getElementById("landmarksBackdrop");

function renderLandmarkList() {
  if (!body) return;
  body.innerHTML = getLandmarkList()
    .map(
      (l) => `<div class="landmark-row" data-name="${l.name}">
        <div class="landmark-row-head"><strong>${l.name}</strong></div>
        <div class="landmark-row-body">${l.location} — ${l.mode === "sphere" ? "360&deg; photosphere" : "panoramic view"}</div>
      </div>`
    )
    .join("");
  body.querySelectorAll(".landmark-row").forEach((row) => {
    row.addEventListener("click", () => {
      modal?.classList.remove("visible");
      enterLandmark(row.dataset.name);
    });
  });
}

export function initDesktopLandmarkUI() {
  exitBtn?.addEventListener("click", exitLandmark);

  landmarksBtn?.addEventListener("click", () => {
    renderLandmarkList();
    modal?.classList.add("visible");
  });
  closeBtn?.addEventListener("click", () => modal?.classList.remove("visible"));
  backdrop?.addEventListener("click", () => modal?.classList.remove("visible"));

  // Earth only — mirrors surface/desktopSurfaceUI.js's syncLandButton()
  // exactly, watching the same #infoName node it already observes.
  const syncLandmarksButton = () => {
    landmarksBtn?.classList.toggle("hidden", infoName.textContent !== "Earth");
  };
  new MutationObserver(syncLandmarksButton).observe(infoName, { childList: true, characterData: true, subtree: true });
  syncLandmarksButton();
}

let lastMode = null;

// Called once per frame from core/loop.js. A per-frame sync rather than
// toggling exitBtn only inside this file's own click handlers, so it stays
// correct regardless of how landmark mode was entered/exited — the desktop
// picker here, or a voice command (assistant/localParser.js), which calls
// enterLandmark()/exitLandmark() directly with no UI involvement of its own.
export function updateLandmarkUI() {
  if (AppState.mode === lastMode) return;
  lastMode = AppState.mode;
  exitBtn?.classList.toggle("hidden", AppState.mode !== "landmark");
}
