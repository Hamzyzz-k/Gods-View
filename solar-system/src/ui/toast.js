// Transient toast notification at the top of the screen.
//
// Lives in its own module because it is used from two very different places:
// the alignment/eclipse detector (scene/) and the progressive texture loader
// (textures/). Keeping it in the scene module would have made textures depend
// on the scene, which already depends on textures — a cycle.
const eventToast = document.getElementById("eventToast");
const eventToastTitle = document.getElementById("eventToastTitle");
const eventToastBody = document.getElementById("eventToastBody");
const eventToastClose = document.getElementById("eventToastClose");
let toastHideTimer = null;

export function showToast(title, body, duration = 6000) {
  if (!eventToast) return;
  eventToastTitle.textContent = title;
  eventToastBody.textContent = body || "";
  eventToast.classList.add("visible");
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => eventToast.classList.remove("visible"), duration);
}

eventToastClose?.addEventListener("click", () => {
  eventToast.classList.remove("visible");
  clearTimeout(toastHideTimer);
});
