import { fetchBodyFacts, FACTS_ELIGIBLE, formatNumber } from "../data/bodyFacts.js";
import { fetchISSLive } from "../data/issLive.js";
import { speak } from "../voice/tts.js";
import { AmbientAudio } from "../audio/ambientAudio.js";
// Info-panel DOM references. Owned here so both this module and focus.js
// (which clears the panel) read them from one place.
export const infoPanel = document.getElementById("infoPanel");
export const infoName = document.getElementById("infoName");
export const infoMeta = document.getElementById("infoMeta");
export const infoDesc = document.getElementById("infoDesc");
export const infoCredit = document.getElementById("infoCredit");
export const infoClose = document.getElementById("infoClose");
export const infoReset = document.getElementById("infoReset");


// Chips are built as real nodes with .textContent rather than assembled into
// an HTML string. The body metadata itself comes from local data files and is
// trusted, but the live chips below (appendLiveChips) carry values straight
// from third-party APIs — and mixing "safe here, unsafe there" invites the
// wrong one getting copied later. One construction path, always safe.
function renderChips(container, entries) {
  const frag = document.createDocumentFragment();
  entries.forEach((text) => {
    const chip = document.createElement("span");
    chip.textContent = text;
    frag.appendChild(chip);
  });
  container.replaceChildren(frag);
}

// Live values from an external API (the ISS tracker, Solar System OpenData).
// Grouped in their own row and appended after the static metadata.
function appendLiveChips(container, texts) {
  const row = document.createElement("div");
  row.className = "real-data-row";
  texts.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "real-data";
    chip.textContent = text; // never innerHTML: these strings are not ours
    row.appendChild(chip);
  });
  container.appendChild(row);
}

export function showInfoFor(obj) {
  const data = obj.userData.info;
  infoName.textContent = data.name;
  renderChips(
    infoMeta,
    Object.entries(data.meta).map(([k, v]) => `${k}: ${v}`)
  );
  infoDesc.textContent = data.info;
  infoCredit.textContent = "";
  infoPanel.classList.add("visible");
  speak(`${data.name}. ${data.info}`);

  const factKey = data.name.toLowerCase();
  AmbientAudio.start(factKey);

  if (factKey === "iss") {
    fetchISSLive()
      .then((live) => {
        if (!live || infoName.textContent !== data.name) return;
        const chips = [
          `Altitude: ${formatNumber(live.altitudeKm)} km`,
          `Speed: ${formatNumber(live.velocityKph)} km/h`,
          live.visibility ? `Currently: ${live.visibility === "daylight" ? "in sunlight" : "in Earth's shadow"}` : null,
          `Position: ${live.latitude.toFixed(1)}°, ${live.longitude.toFixed(1)}°`,
        ].filter(Boolean);
        appendLiveChips(infoMeta, chips);
        infoCredit.textContent = "Live tracking: wheretheiss.at (updates every ~12s)";
      })
      .catch(() => {
        infoCredit.textContent = "Live ISS tracking unavailable right now.";
      });
    return;
  }

  if (FACTS_ELIGIBLE.has(factKey)) {
    fetchBodyFacts(factKey).then((facts) => {
      // bail if the panel has since moved on to a different body
      if (!facts || infoName.textContent !== data.name) return;
      const chips = [
        facts.moonCount ? `Moons: ${facts.moonCount}` : null,
        facts.gravity ? `Gravity: ${facts.gravity}` : null,
        facts.orbitalPeriodDays ? `Orbit: ${formatNumber(facts.orbitalPeriodDays)} days` : null,
      ].filter(Boolean);
      if (chips.length) {
        appendLiveChips(infoMeta, chips);
        infoCredit.textContent = "Verified stats: Solar System OpenData";
      }
    });
  }
}
