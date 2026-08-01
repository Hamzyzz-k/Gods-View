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


export function showInfoFor(obj) {
  const data = obj.userData.info;
  infoName.textContent = data.name;
  infoMeta.innerHTML = Object.entries(data.meta)
    .map(([k, v]) => `<span>${k}: ${v}</span>`)
    .join("");
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
          live.visibility ? `Currently: ${live.visibility === "daylight" ? "in sunlight ☀️" : "in Earth's shadow 🌑"}` : null,
          `Position: ${live.latitude.toFixed(1)}°, ${live.longitude.toFixed(1)}°`,
        ].filter(Boolean);
        infoMeta.insertAdjacentHTML(
          "beforeend",
          `<div class="real-data-row">${chips.map((t) => `<span class="real-data">${t}</span>`).join("")}</div>`
        );
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
        infoMeta.insertAdjacentHTML(
          "beforeend",
          `<div class="real-data-row">${chips.map((t) => `<span class="real-data">${t}</span>`).join("")}</div>`
        );
        infoCredit.textContent = "Verified stats: Solar System OpenData";
      }
    });
  }
}
