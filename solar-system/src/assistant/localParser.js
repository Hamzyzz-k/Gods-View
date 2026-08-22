import { ASSISTANT_ENDPOINT } from "./config.js";
import { issProxyMesh } from "../scene/planetFactory.js";
import { sun } from "../scene/sun.js";
import { planets } from "../scene/planetFactory.js";
import { planetData, sunInfo, ISS_INFO } from "../scene/planetData.js";
import { sceneRegistry, PLANET_NAMES, INNER_PLANETS, OUTER_PLANETS, MOON_NAMES, setGroupVisible, setAllPlanetsVisible, setOrbitLinesVisible } from "./sceneRegistry.js";
import { focusOnObject, clearFocus } from "../interaction/focus.js";
import { AppState } from "../core/state.js";
import { startTour, nextStop, prevStop, pauseTour, resumeTour, exitTour, jumpToPlanet } from "../tour/tourMode.js";
import { enterSurface, exitSurface } from "../surface/surfaceMode.js";
import { getSurfaceData } from "../surface/surfaceData.js";
import { getTierLadder } from "../cosmos/tierNavigation.js";
import { ascendTierCinematic, descendTierCinematic, jumpToTierCinematic } from "../cosmos/tierTransition.js";
import { getTierById } from "../cosmos/tierData.js";
import { exitLandmark } from "../landmark/landmarkMode.js";
import { locateAndShow, normalize } from "./entityLocator.js";
import { GALAXY_DATA } from "../cosmos/galaxyData.js";

// Short, sayable aliases per tier — the real labels (cosmos/tierData.js)
// are used for replies, but "go to the supercluster" is how someone would
// actually phrase it, not "go to the Local Supercluster".
const TIER_ALIASES = {
  solarSystem: ["solar system", "home"],
  milkyWay: ["milky way"],
  localGroup: ["local group"],
  supercluster: ["supercluster", "local supercluster"],
  observableUniverse: ["observable universe", "the universe", "edge of the universe"],
};

// Resolve every recognizable target mentioned in the text (planets, sun, moon, rings, groups).
export function extractTargets(text) {
  const found = new Set();
  PLANET_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  MOON_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  if (/\bsun\b/.test(text)) found.add("sun");
  if (/\bmoons\b/.test(text)) {
    found.add("moon");
    MOON_NAMES.forEach((n) => found.add(n));
  } else if (/\bmoon\b/.test(text)) {
    found.add("moon");
  }
  if (/\bring/.test(text)) found.add("rings");
  if (/\basteroid|asteroids|rocks|neos?\b/.test(text)) found.add("asteroids");
  if (/\bbelt\b/.test(text)) found.add("belt");
  if (/\biss\b|\bspace station\b/.test(text)) found.add("iss");
  if (/\bconstellations?\b/.test(text)) found.add("constellations");
  if (/\bgalax(?:y|ies)\b/.test(text)) found.add("galaxies");
  // A specific galaxy/cluster by name (not just the collective "galaxies"
  // above) — matches sceneRegistry.js's per-entry registration, keyed
  // consistently on entry.name regardless of which form the text actually
  // used: the full name, the short form people actually say ("andromeda"
  // for "Andromeda Galaxy", via entityLocator.js's normalize()), or the
  // altName ("m31").
  GALAXY_DATA.forEach((entry) => {
    const full = entry.name.toLowerCase();
    const short = normalize(full);
    const altShort = entry.altName ? entry.altName.toLowerCase() : null;
    if (text.includes(full) || (short && text.includes(short)) || (altShort && text.includes(altShort))) {
      found.add(full);
    }
  });
  if (/\binner planets?\b/.test(text)) INNER_PLANETS.forEach((n) => found.add(n));
  if (/\bouter planets?\b/.test(text)) OUTER_PLANETS.forEach((n) => found.add(n));
  if (/\ball planets?\b|\beverything\b|\ball\b/.test(text)) PLANET_NAMES.forEach((n) => found.add(n));
  return [...found];
}

export let lastReplyWasAnswer = false; // set by interpretCommand so the UI can style facts differently from command confirmations

export function interpretCommand(raw) {
  lastReplyWasAnswer = false;
  const text = raw.toLowerCase().trim();

  // Reset / show everything
  if (/^(reset|show everything|show all|reset view|start over)/.test(text)) {
    setAllPlanetsVisible(true);
    sceneRegistry.sun.setVisible(true);
    sceneRegistry.moons.setVisible(true);
    sceneRegistry.rings.setVisible(true);
    sceneRegistry.asteroids.setVisible(true);
    sceneRegistry.belt.setVisible(true);
    sceneRegistry.iss.setVisible(true);
    setOrbitLinesVisible(true);
    clearFocus();
    return "Showing everything again — full solar system restored.";
  }

  // Guided Tour commands. Placed before the focus-intent block below since a
  // couple of tour/surface phrasings ("go to the surface of Mars") would
  // otherwise get swallowed by hasFocusIntent's "go to" trigger.
  if (/^(start|begin) (the )?tour\b/.test(text)) {
    const started = startTour();
    return started ? "Starting the guided tour — Mercury first." : "Can't start the tour from the surface — exit back to free-roam first.";
  }
  if (/\b(next (planet|stop)|skip forward|skip ahead)\b/.test(text) && AppState.tourState !== "idle") {
    nextStop();
    return "Moving to the next stop.";
  }
  if (/\b(previous (planet|stop)|go back|skip back|last stop)\b/.test(text) && AppState.tourState !== "idle") {
    prevStop();
    return "Going back to the previous stop.";
  }
  if (/\bpause (the )?tour\b/.test(text)) {
    pauseTour();
    return "Tour paused.";
  }
  if (/\bresume (the )?tour\b/.test(text)) {
    resumeTour();
    return "Resuming the tour.";
  }
  if (/\b(exit|stop|end) (the )?tour\b/.test(text)) {
    exitTour();
    return "Exiting the tour.";
  }
  const jumpMatch = text.match(/\bjump (?:ahead )?to\s+(\w+)\b/);
  if (jumpMatch) {
    const name = jumpMatch[1];
    return jumpToPlanet(name) ? `Jumping to ${name}.` : `${name} isn't on the tour itinerary — try a planet from Mercury to Pluto.`;
  }

  // Surface Mode commands.
  const landMatch = text.match(/\b(?:land on|walk on|go (?:down )?to the surface of|surface of)\s+(?:the\s+)?(\w+)\b/);
  if (landMatch) {
    const name = planets.find((p) => p.data.name.toLowerCase() === landMatch[1])?.data.name;
    if (name && getSurfaceData(name)) {
      enterSurface(name);
      return `Landing on ${name}.`;
    }
    return `Can't land on ${landMatch[1]} — try a planet from Mercury to Pluto.`;
  }
  if (/\b(exit|leave) (the )?surface\b|\bback to (free[- ]roam|orbit|space)\b/.test(text)) {
    if (AppState.mode === "surface") {
      exitSurface();
      return "Leaving the surface, back to free-roam.";
    }
    return "You're not currently on a surface.";
  }

  // Any named galaxy, black hole, or Earth landmark, from anywhere — locates
  // it and takes the user there, jumping tiers (or back to the solar system
  // for a landmark) first if needed (assistant/entityLocator.js). This is
  // also the only voice/VR entry point into landmark mode besides the
  // desktop picker (landmark/desktopLandmarkUI.js), which has no
  // #landmarksBtn to click. Requires an explicit visit/travel verb so "tell
  // me about the colosseum" stays a question rather than teleporting the
  // viewer somewhere.
  if (/\b(?:visit|take me to|go to|show me)\b/.test(text)) {
    const reply = locateAndShow(text);
    if (reply) return reply;
  }
  if (/\b(exit|leave) (the )?landmark\b/.test(text)) {
    if (AppState.mode === "landmark") {
      exitLandmark();
      return "Leaving the landmark, back to free-roam.";
    }
    return "You're not currently visiting a landmark.";
  }

  // Cosmic scale-ladder navigation (cosmos/tierTransition.js). Checked
  // before the generic focus-intent block below, since "show me the milky
  // way" should navigate there, not fall through to "I'm not sure which
  // body you mean" (the milky way has no single focusable mesh the way a
  // planet does — it's a whole tier, not a body within one).
  if (/^(start|begin) (the )?cosmic tour\b/.test(text)) {
    const started = startTour("cosmic");
    return started
      ? "Starting the Cosmic Tour — Earth first, all the way out to the observable universe."
      : "Can't start the tour from the surface — exit back to free-roam first.";
  }
  if (/\bzoom out\b|\b(go|zoom|move|pull back)\s+(?:further |farther )?out\b/.test(text)) {
    const ok = ascendTierCinematic();
    return ok ? "Zooming out." : "Already at the outermost scale, or busy with another transition.";
  }
  if (/\bzoom in\b|\b(go|zoom|move)\s+(?:further |farther )?in\b/.test(text)) {
    const ok = descendTierCinematic();
    return ok ? "Zooming in." : "Already at the innermost scale, or busy with another transition.";
  }
  if (/\b(go home|go back home)\b/.test(text) || (/\bback to\b/.test(text) && /\bsolar system\b/.test(text))) {
    const ok = jumpToTierCinematic("solarSystem");
    return ok ? "Heading back to the Solar System." : "Already there, or busy with another transition.";
  }
  if (/\b(go to|take me to|show me|jump to|navigate to)\b/.test(text)) {
    const matchedTierId = Object.entries(TIER_ALIASES).find(([, aliases]) => aliases.some((a) => text.includes(a)))?.[0];
    if (matchedTierId) {
      const label = getTierById(matchedTierId)?.label || matchedTierId;
      const ok = jumpToTierCinematic(matchedTierId);
      return ok ? `Heading to ${label}.` : `Already at ${label}, or busy with another transition.`;
    }
  }

  // Informational questions ("tell me about Saturn", "what is this?") — answered
  // from local planet data so this works even with no backend configured.
  const questionMatch = text.match(
    /\b(?:tell me about|what is|what's|who is|who's|explain)\s+(?:the\s+)?(international space station|space station|\w+)/
  );
  if (questionMatch) {
    const word = questionMatch[1];
    const target =
      word === "this" || word === "it" ? AppState.focusedTarget?.name?.toLowerCase() : word.includes("station") ? "iss" : word;
    const info =
      target === "sun"
        ? sunInfo
        : target === "iss"
        ? ISS_INFO
        : planets.find((p) => p.data.name.toLowerCase() === target)?.data;
    if (info) {
      lastReplyWasAnswer = true;
      return ASSISTANT_ENDPOINT ? info.info : `${info.info} (Connect the AI assistant for open-ended astronomy questions beyond the planets.)`;
    }
    // A focused galaxy (or the Milky Way's own core) isn't in the
    // planets/sun/iss data above, but already carries the exact same
    // {name, meta, info} shape (cosmos/galaxyFactory.js, cosmos/milkyWay.js)
    // — reused directly here instead of a second lookup table.
    if ((word === "this" || word === "it") && AppState.focusedTarget?.userData?.info?.info) {
      lastReplyWasAnswer = true;
      return AppState.focusedTarget.userData.info.info;
    }
  }

  // Focus / zoom on a specific body. "show me X" is included here, not in the
  // generic show/hide handling below: the personal framing ("me") signals
  // "take me there" (a camera move), whereas bare "show X" — especially
  // "show only X" or "show X and Y" — is a visibility toggle with no camera
  // intent. Without this, "show me Saturn" fell through to the visibility
  // branch, silently toggled Saturn's (already-true) visibility, and never
  // moved the camera at all — the reply just said "Showing: saturn" instead
  // of actually flying there, which is not what "show ME" means.
  //
  // The trigger phrase is only tested for presence, not used to capture the
  // target positionally — an earlier version captured "the very next word",
  // which broke on anything with words in between, like "show me a planet
  // like Jupiter" (captured "a"). extractTargets() already knows how to find
  // a real target anywhere in the sentence, so it's reused here instead.
  const hasFocusIntent = /\b(?:focus on|zoom (?:in )?on|take me to|look at|go to|show me)\b/.test(text);
  if (hasFocusIntent) {
    // Only single, focusable bodies make sense here — group/aggregate matches
    // (rings, belt, constellations, "moons" as a group) have no one mesh to
    // fly to, so they're excluded rather than silently focusing on whichever
    // happened to match first.
    const focusable = extractTargets(text).filter(
      (t) => PLANET_NAMES.includes(t) || t === "sun" || t === "iss"
    );
    if (focusable.length > 0) {
      const target = focusable[0];
      const mesh = target === "sun" ? sun : target === "iss" ? issProxyMesh : planets.find((p) => p.data.name.toLowerCase() === target)?.mesh;
      if (mesh) {
        if (sceneRegistry[target] && !sceneRegistry[target].isVisible()) sceneRegistry[target].setVisible(true); // reveal if hidden
        focusOnObject(mesh);
        return `Focusing on ${mesh.name}.`;
      }
    }

    // Any named galaxy, black hole, or landmark, from wherever the user
    // currently is (assistant/entityLocator.js) — jumps tiers first if
    // needed rather than only working when the right tier already happens
    // to be active.
    const reply = locateAndShow(text);
    if (reply) return reply;

    return "I'm not sure which body you mean — try naming one, like \"show me Saturn\" or \"focus on the Sun\".";
  }

  const isHide = /\b(hide|remove|turn off|disable|don't show|get rid of)\b/.test(text);
  const isShow = /\b(show|display|turn on|enable|reveal|bring back|add)\b/.test(text);
  const isOnly = /\bonly\b|\bjust\b/.test(text);

  const targets = extractTargets(text);

  // Standalone orbit-line toggle
  if (/orbit lines?|orbits|paths/.test(text)) {
    if (isHide) {
      setOrbitLinesVisible(false);
      return "Hid the orbit lines.";
    }
    if (isShow) {
      setOrbitLinesVisible(true);
      return "Orbit lines are back on.";
    }
  }

  if (targets.length === 0) {
    return "I'm not sure what to show or hide — try something like \"hide Mars\", \"show only the outer planets\", or \"focus on Saturn\".";
  }

  if (isOnly) {
    // Hide every planet, then reveal only the mentioned ones
    setAllPlanetsVisible(false);
    setGroupVisible(targets, true);
    return `Showing only: ${targets.join(", ")}.`;
  }

  if (isHide) {
    setGroupVisible(targets, false);
    return `Hid: ${targets.join(", ")}.`;
  }

  if (isShow) {
    setGroupVisible(targets, true);
    return `Showing: ${targets.join(", ")}.`;
  }

  // Mentioned a target with no clear verb — default to showing it
  setGroupVisible(targets, true);
  return `Showing: ${targets.join(", ")}.`;
}
