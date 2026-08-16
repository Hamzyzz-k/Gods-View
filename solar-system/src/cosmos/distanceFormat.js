// ---------- distance formatting ----------
// Formats a real light-year figure into a short, readable string for the
// running scale-bar label shown during a tier transition (tierTransition.js's
// getTransitionProgress(), ui/scaleBar.js, xr/vrScalePanel.js). A distinct
// helper from sizeCompare/sizeCompareScene.js's own formatDiameterKm() — that one formats a
// body's km-scale DIAMETER (and converts to ly only above a threshold); this
// one always takes a ly-scale DISTANCE, since every cosmos/tierData.js
// realDistanceLy bound is already in light-years.
export function formatDistanceLy(ly) {
  if (ly < 0.01) return "within the Solar System";
  if (ly < 1) return `${Math.round(ly * 63241)} AU`; // sub-light-year distances read better in astronomical units
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(ly >= 1e10 ? 0 : 1)} billion ly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million ly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(ly >= 1e4 ? 0 : 1)}k ly`;
  return `${ly.toFixed(ly >= 100 ? 0 : 1)} ly`;
}
