import {
  crateredPlanet, venusTexture, earthTexture, marsTexture, bandedPlanet,
  crateredHeightMap, cloudHeightMap, terrainHeightMap, bandedHeightMap,
} from "./proceduralTextures.js";

export const PLANET_TEXTURE_FACTORIES = {
  Mercury: () => crateredPlanet(1024, 512, 28, 6, 48, 480, false),
  Venus: () => venusTexture(1024, 512),
  Earth: () => earthTexture(1024, 512),
  Mars: () => marsTexture(1024, 512),
  Jupiter: () => bandedPlanet(1024, 512, 32, 35, 62, 16, 10, "hsla(8,70%,55%,0.85)"),
  Saturn: () => bandedPlanet(1024, 512, 44, 28, 70, 12, 7, null, true), // ringShadow = true
  Uranus: () => bandedPlanet(1024, 512, 185, 45, 72, 6, 4, null),
  Neptune: () => bandedPlanet(1024, 512, 225, 60, 48, 7, 5, "hsla(220,50%,30%,0.6)"),
  Moon: () => crateredPlanet(512, 256, 40, 4, 60, 300, false),
  Pluto: () => crateredPlanet(1024, 512, 30, 22, 62, 220, true),
};

// Grayscale companions used as bumpMap, so surfaces catch light like real
// terrain instead of perfectly smooth spheres. Keyed the same way as the
// color factories above; consumed in createPlanet() via data.bumpScale.
export const PLANET_BUMP_FACTORIES = {
  Mercury: () => crateredHeightMap(1024, 512, 480),
  Venus: () => cloudHeightMap(1024, 512),
  Earth: () => terrainHeightMap(1024, 512),
  Mars: () => crateredHeightMap(1024, 512, 260),
  Jupiter: () => bandedHeightMap(1024, 512, 16),
  Saturn: () => bandedHeightMap(1024, 512, 12),
  Uranus: () => bandedHeightMap(1024, 512, 6),
  Neptune: () => bandedHeightMap(1024, 512, 7),
  Moon: () => crateredHeightMap(512, 256, 300),
  Pluto: () => crateredHeightMap(1024, 512, 220),
};
