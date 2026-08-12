import { getTierById } from "./tierData.js";

// ---------- per-tier scene cache ----------
// Built once and cached by tier id — repeat visits reuse the same scene
// rather than rebuilding geometry/textures, the exact pattern
// surface/surfaceScene.js already established for per-planet surfaces, and
// for the same reason: it's what keeps ascend/descend cycles cheap and
// leak-free.
//
// The solar system tier is the one exception: its scene already exists,
// built at app startup by every scene/* module, so `getTierScene` reads it
// live via the tier's `getScene()` rather than caching a snapshot that could
// drift from the real thing.
const sceneCache = new Map();

export function getTierScene(tierId) {
  const tier = getTierById(tierId);
  if (!tier) return null;
  if (tier.getScene) return tier.getScene();
  if (sceneCache.has(tierId)) return sceneCache.get(tierId);
  const scene = tier.buildScene();
  sceneCache.set(tierId, scene);
  return scene;
}
