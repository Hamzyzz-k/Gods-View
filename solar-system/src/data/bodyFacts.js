
export function formatNumber(n) {
  return Math.round(n).toLocaleString();
}

// ---------- real astronomical facts (Solar System OpenData API, no key needed) ----------
// Used two ways: (1) layered onto the info panel as verified numbers, and
// (2) sent to the n8n agent as grounding data so it answers with real figures
// instead of the LLM guessing when a planet is focused.
export const SSOD_CACHE_KEY = "solar-system-body-facts-v1";
export const SSOD_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // this data barely changes — cache a full day
export const FACTS_ELIGIBLE = new Set(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "sun", "moon"]);
export let bodyFactsCache = {};

(function loadFactsCache() {
  try {
    const raw = localStorage.getItem(SSOD_CACHE_KEY);
    if (!raw) return;
    const { timestamp, facts } = JSON.parse(raw);
    if (Date.now() - timestamp <= SSOD_CACHE_TTL_MS) bodyFactsCache = facts || {};
  } catch {
    // corrupted/unavailable cache — start fresh, no big deal
  }
})();

export function saveFactsCache() {
  try {
    localStorage.setItem(SSOD_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), facts: bodyFactsCache }));
  } catch {
    // storage full/disabled — fine, it's only a cache
  }
}

export function formatBodyFacts(raw) {
  if (!raw) return null;
  return {
    name: raw.englishName || raw.name,
    massText: raw.mass ? `${raw.mass.massValue}×10^${raw.mass.massExponent} kg` : null,
    gravity: typeof raw.gravity === "number" ? `${raw.gravity} m/s²` : null,
    meanRadiusKm: raw.meanRadius || null,
    moonCount: Array.isArray(raw.moons) ? raw.moons.length : 0,
    orbitalPeriodDays: raw.sideralOrbit || null,
    rotationHours: raw.sideralRotation || null,
    discoveredBy: raw.discoveredBy || null,
    avgTempK: raw.avgTemp || null,
  };
}

export async function fetchBodyFacts(name) {
  const key = name.toLowerCase();
  if (!FACTS_ELIGIBLE.has(key)) return null;
  if (bodyFactsCache[key]) return bodyFactsCache[key];
  try {
    const res = await fetch(`https://api.le-systeme-solaire.net/rest/bodies/${key}`);
    if (!res.ok) throw new Error("Solar System OpenData error " + res.status);
    const raw = await res.json();
    const facts = formatBodyFacts(raw);
    bodyFactsCache[key] = facts;
    saveFactsCache();
    return facts;
  } catch {
    return null; // fine — the app just skips the real-data chips for this body
  }
}
