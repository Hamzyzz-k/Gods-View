
// ---------- ISS live position (wheretheiss.at API — no key, CORS-enabled) ----------
// The ISS moves fast enough that a long localStorage cache would go stale
// within seconds, so this just uses a short in-memory cache to avoid
// hammering the API on rapid re-focus/re-open, not a persistent one.
export const ISS_API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
export const ISS_LIVE_TTL_MS = 12 * 1000;
export let issLiveCache = null;
export let issLiveCachedAt = 0;

export async function fetchISSLive() {
  if (issLiveCache && Date.now() - issLiveCachedAt < ISS_LIVE_TTL_MS) return issLiveCache;
  const res = await fetch(ISS_API_URL);
  if (!res.ok) throw new Error("ISS tracking API error " + res.status);
  const data = await res.json();
  issLiveCache = {
    latitude: data.latitude,
    longitude: data.longitude,
    altitudeKm: data.altitude,
    velocityKph: data.velocity,
    visibility: data.visibility,
  };
  issLiveCachedAt = Date.now();
  return issLiveCache;
}
