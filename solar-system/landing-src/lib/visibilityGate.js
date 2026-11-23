// Lets an animation loop stop when its element can't be seen and start again
// when it can. "Can't be seen" covers both scrolling it out of view and the
// whole landing page being hidden after "Begin Exploration" (it is only set to
// display:none, never unmounted, so without this its WebGL loops would keep
// running behind the 3D app and compete with it for the GPU).
//
// Usage inside a loop:   if (!gate.visible) { stop; return; }
// and pass onResume to restart the loop when the element is visible again.
export function createVisibilityGate(el, onResume) {
  let visible = true;
  if (typeof IntersectionObserver === "undefined") {
    return { get visible() { return true; }, disconnect() {} };
  }
  const io = new IntersectionObserver((entries) => {
    const wasVisible = visible;
    visible = entries[entries.length - 1].isIntersecting;
    if (visible && !wasVisible) onResume();
  });
  io.observe(el);
  return {
    get visible() {
      return visible;
    },
    disconnect() {
      io.disconnect();
    },
  };
}
