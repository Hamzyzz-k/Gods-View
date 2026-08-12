import { startAlignAnimation } from "../scene/alignmentsAndEclipses.js";

document.getElementById("alignBtn")?.addEventListener("click", startAlignAnimation);
document.getElementById("solarEclipseBtn")?.addEventListener("click", () => previewEclipse("solar"));
document.getElementById("lunarEclipseBtn")?.addEventListener("click", () => previewEclipse("lunar"));

// ---- real eclipse calendar (static, curated data — NOT a live API) ----
// Solar/lunar eclipse predictions are exact years in advance, so unlike the
// live feeds elsewhere in this file there's no live source worth fetching
// here — this list is transcribed from NASA/USNO eclipse predictions and is
// accurate through early 2028. Extend it by hand for eclipses beyond that.
export const REAL_ECLIPSES = [
  { date: "2026-08-12", kind: "solar", type: "Total", visibility: "Totality crosses Greenland, Iceland, northern Spain, a small part of Portugal, and a remote part of Arctic Russia. Partial phases visible across much of Europe, Africa, North America, and the Arctic/Atlantic/Pacific." },
  { date: "2026-08-27", kind: "lunar", type: "Partial", visibility: "Visible from the Americas, Europe, Africa, and western Asia." },
  { date: "2027-02-06", kind: "solar", type: "Annular", visibility: "Annularity crosses Chile, Argentina, Uruguay, Brazil, and parts of West Africa (Ivory Coast, Ghana, Togo, Benin, Nigeria). Partial phases visible across much of South America, Africa, and Antarctica." },
  { date: "2027-02-20", kind: "lunar", type: "Penumbral", visibility: "Visible from the Americas, Europe, Africa, Asia, Australia, and Antarctica — subtle dimming only." },
  { date: "2027-07-18", kind: "lunar", type: "Penumbral", visibility: "A very shallow, brief penumbral eclipse — barely noticeable to the eye." },
  { date: "2027-08-02", kind: "solar", type: "Total", visibility: "Totality crosses southern Spain, Morocco, Algeria, Tunisia, Libya, Egypt, Saudi Arabia, and Yemen. Partial phases visible across most of Europe, Africa, the Middle East, and parts of Southeast Asia." },
  { date: "2027-08-16", kind: "lunar", type: "Penumbral", visibility: "Visible from eastern North America, South America, Europe, Africa, and western Asia." },
  { date: "2028-01-12", kind: "lunar", type: "Partial", visibility: "Visible from the eastern Pacific, the Americas, the Atlantic, Europe, Africa, and western Asia." },
];

export const eclipseCalModal = document.getElementById("eclipseCalModal");
export const eclipseCalBody = document.getElementById("eclipseCalBody");
export const eclipseCalBtn = document.getElementById("eclipseCalBtn");
export const eclipseCalClose = document.getElementById("eclipseCalClose");
export const eclipseCalBackdrop = document.getElementById("eclipseCalBackdrop");

export function renderEclipseCalendar() {
  if (!eclipseCalBody) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const upcoming = REAL_ECLIPSES.filter((e) => e.date >= todayStr);
  const list = upcoming.length ? upcoming : REAL_ECLIPSES; // fall back to the full list once we're past the last entry
  eclipseCalBody.innerHTML = list
    .map((e) => {
      const label = e.kind === "solar" ? "Solar" : "Lunar";
      const d = new Date(e.date + "T00:00:00Z");
      const dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
      return `<div class="eclipse-row">
        <div class="eclipse-row-head"><strong>${e.type} ${label} Eclipse</strong> — ${dateStr}</div>
        <div class="eclipse-row-body">${e.visibility}</div>
      </div>`;
    })
    .join("");
}

export function openEclipseCalModal() {
  renderEclipseCalendar();
  eclipseCalModal?.classList.add("visible");
}
export function closeEclipseCalModal() {
  eclipseCalModal?.classList.remove("visible");
}
eclipseCalBtn?.addEventListener("click", openEclipseCalModal);
eclipseCalClose?.addEventListener("click", closeEclipseCalModal);
eclipseCalBackdrop?.addEventListener("click", closeEclipseCalModal);
