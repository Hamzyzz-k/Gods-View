// AI scene assistant, backed by the Google Gemini API.
//
// Replaces the old n8n webhook. The client contract is unchanged:
//   request : { command, context }  where context =
//             { visible, hidden, orbitLinesVisible, focused, focusedFacts,
//               mode, tourState, tier }
//   response: { reply: string, actions: [...] }
//
// The GEMINI_API_KEY is read from the environment and never reaches the
// browser. Set it in the Netlify dashboard under
// Site settings -> Environment variables.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// gemini-3.6-flash is the current stable balanced model. Swap to
// gemini-3.5-flash-lite for lower cost/latency if the replies stay good.
const MODEL = "gemini-3.6-flash";

// The scene's full target vocabulary. Kept in sync by hand with
// src/assistant/sceneRegistry.js — if a body is added there, add it here too,
// otherwise the model can emit a target the client will silently ignore.
const TARGETS = [
  "mercury", "venus", "earth", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto",
  "sun", "moon", "moons", "rings", "asteroids", "belt", "iss", "constellations", "galaxies",
];

// The cosmic scale ladder's tier ids (cosmos/tierData.js) and the galaxy
// roster (cosmos/galaxyData.js) — kept in sync by hand, same convention
// TARGETS above already documents, since this function has no build step
// to import them from src/ directly.
const TIER_IDS = ["solarSystem", "milkyWay", "localGroup", "supercluster", "observableUniverse"];
const GALAXY_NAMES = [
  "andromeda galaxy", "triangulum galaxy", "large magellanic cloud", "small magellanic cloud",
  "whirlpool galaxy", "sombrero galaxy", "centaurus a", "virgo cluster", "cartwheel galaxy",
  "bullet cluster", "sagittarius a*",
];

const SYSTEM_INSTRUCTION = `
You control a 3D solar system visualisation and answer astronomy questions.

Return EITHER scene-control actions OR an answer — not both.

Valid action objects:
  {"type":"show","targets":[...]}
  {"type":"hide","targets":[...]}
  {"type":"showOnly","targets":[...]}
  {"type":"focus","target":"saturn"}
  {"type":"orbitLines","visible":true|false}
  {"type":"reset"}
  {"type":"startTour"}
  {"type":"nextStop"}
  {"type":"prevStop"}
  {"type":"pauseTour"}
  {"type":"resumeTour"}
  {"type":"exitTour"}
  {"type":"jumpToPlanet","target":"saturn"}
  {"type":"land","target":"mars"}
  {"type":"exitSurface"}
  {"type":"ascendTier"}
  {"type":"descendTier"}
  {"type":"jumpToTier","target":"milkyWay"}
  {"type":"startCosmicTour"}
  {"type":"focusGalaxy","target":"andromeda galaxy"}

Valid targets: ${TARGETS.join(", ")}.

Cosmic scale ladder, a third feature alongside scene visibility and Guided
Tour/Surface Mode. The app has FIVE nested scales, innermost to outermost:
solarSystem -> milkyWay -> localGroup -> supercluster -> observableUniverse
(context.tier tells you which one is currently active — these exact
strings, case-sensitive, are the only valid "target" values for
jumpToTier).
  - "zoom out"/"pull back"/"go further out" -> {"type":"ascendTier"}.
    "zoom in"/"go further in" -> {"type":"descendTier"}. Both refuse
    silently at either end of the ladder or mid-transition — say so if the
    reply implies nothing happened.
  - "go to the milky way"/"take me to the local group"/"show me the
    observable universe" (naming a SCALE, not a body within one) ->
    {"type":"jumpToTier","target":"milkyWay"} (etc. — use the exact tier id).
    "go home"/"back to the solar system" -> {"type":"jumpToTier",
    "target":"solarSystem"}.
  - "start the cosmic tour" -> {"type":"startCosmicTour"} — a single guided
    journey from Earth out through every tier to the observable universe,
    distinct from the planet-only "startTour" above.
  - Galaxies only exist in ONE specific tier each and are only focusable
    while that tier is the active one (context.tier) — trying to focus one
    from elsewhere does nothing useful, so first emit
    {"type":"jumpToTier","target":"..."} for its tier (or
    {"type":"startCosmicTour"}), and only emit
    {"type":"focusGalaxy","target":"andromeda galaxy"} once you know
    context.tier will already be correct, or explain the mismatch in "reply"
    instead of emitting a focusGalaxy action that won't do anything.
    Valid galaxy names: ${GALAXY_NAMES.join(", ")} (all lowercase; "sagittarius
    a*" is the Milky Way's own central black hole, only in the milkyWay tier).
  - "hide the galaxies"/"show galaxies" (the whole roster, not one by name)
    -> {"type":"hide"/"show","targets":["galaxies"]}, same as any other group.

Guided Tour and Surface Mode, a second feature alongside scene visibility:
  - "start the tour"/"begin the tour" -> {"type":"startTour"} (Mercury through
    Pluto in order, no Sun stop; refuses if context.mode is "surface").
  - "next planet"/"skip ahead"/"skip forward" while a tour is running (see
    context.tourState) -> {"type":"nextStop"}.
  - "previous planet"/"go back"/"skip back" while a tour is running ->
    {"type":"prevStop"}.
  - "pause the tour" -> {"type":"pauseTour"}; "resume the tour" ->
    {"type":"resumeTour"}; "stop the tour"/"exit the tour" -> {"type":"exitTour"}.
  - "jump to Saturn"/"skip ahead to Saturn" (jumping mid-tour to a specific
    planet) -> {"type":"jumpToPlanet","target":"saturn"}.
  - "land on Mars"/"walk on the surface of Mars"/"take me down to Mars" (a
    close-up walkable surface, distinct from "focus" which only moves the
    orbital camera) -> {"type":"land","target":"mars"}. Only mercury through
    pluto are landable — the sun, moons, and iss have no surface scene; if
    asked to land on one of those, explain why instead of emitting the action.
  - "exit the surface"/"leave the surface"/"back to free-roam"/"back to orbit"
    while context.mode is "surface" -> {"type":"exitSurface"}.
context.mode ("orbital" or "surface"), context.tourState ("idle", "playing",
or "paused"), and context.tier (see the cosmic scale ladder section below)
tell you the current state — use them to give an accurate confirmation (e.g.
don't say "starting the tour" if context.mode is already "surface", since
startTour will be a no-op there).

Phrase shortcuts you must expand yourself:
  "inner planets" -> mercury, venus, earth, mars
  "outer planets" -> jupiter, saturn, uranus, neptune, pluto
  "everything"/"all planets" -> all nine planets

"show"/"hide"/"showOnly" only change what's VISIBLE — they never move the
camera. "focus" is the ONLY action that moves the camera to a body. These are
easy to conflate because they share the word "show", so route by the user's
actual intent, not just keyword matching:
  - Personal/deictic phrasing ("show ME saturn", "take me to saturn", "let's
    see saturn", "zoom in on saturn", "look at saturn", "go to saturn") means
    the user wants the CAMERA there -> emit {"type":"focus","target":"saturn"}.
  - Impersonal phrasing with no travel intent ("show saturn", "show only the
    inner planets", "hide the asteroid belt") means a pure visibility change
    -> emit {"type":"show"/"hide"/"showOnly",...}, no focus action.
If your reply text says anything like "focusing on X" or "here's X" or "let's
look at X", you MUST include the matching {"type":"focus","target":"X"}
action — never describe a camera move in the reply without actually emitting
the action that performs it.

If the user asks a question rather than issuing a command, return
"actions": [] and put a concise 2-4 sentence answer in "reply". When
context.focusedFacts is present and relevant, ground the answer in those real
numbers rather than from memory.

If the user issues a command, apply it and put a short confirmation in
"reply" (e.g. "Hiding the outer planets.").
`.trim();

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "show", "hide", "showOnly", "focus", "orbitLines", "reset",
              "startTour", "nextStop", "prevStop", "pauseTour", "resumeTour", "exitTour", "jumpToPlanet",
              "land", "exitSurface",
              "ascendTier", "descendTier", "jumpToTier", "startCosmicTour", "focusGalaxy",
            ],
          },
          targets: { type: "array", items: { type: "string" } },
          target: { type: "string" },
          visible: { type: "boolean" },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

// The Interactions API returns a `steps` timeline rather than the legacy
// `candidates` array, and the SDKs expose an `output_text` convenience field.
// The REST envelope is not pinned down precisely in the public docs, so pull
// the text out defensively rather than assuming one shape: check the
// convenience field, then walk the steps timeline, then fall back to the
// legacy generateContent shape.
function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const fromSteps = (data?.steps || [])
    .flatMap((step) => step?.content || [])
    .filter((block) => typeof block?.text === "string")
    .map((block) => block.text)
    .join("");
  if (fromSteps.trim()) return fromSteps;

  // Legacy generateContent envelope, in case the endpoint is switched back.
  const legacy = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text || "")
    .join("");
  return legacy || "";
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { reply: "Method not allowed.", actions: [] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Not an error the user can fix from the browser — tell the client
    // plainly so it falls back to the local parser instead of looking broken.
    return json(200, {
      reply: "The AI assistant isn't configured on the server (missing GEMINI_API_KEY).",
      actions: [],
    });
  }

  let command, context;
  try {
    ({ command, context } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { reply: "Malformed request.", actions: [] });
  }
  if (!command || typeof command !== "string") {
    return json(400, { reply: "No command provided.", actions: [] });
  }

  const input = [
    `User command: ${command}`,
    `Current scene state: ${JSON.stringify(context ?? {})}`,
  ].join("\n\n");

  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        system_instruction: SYSTEM_INSTRUCTION,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Gemini error", res.status, detail.slice(0, 500));
      // Return 502 so the client's catch path runs and the local parser
      // handles the command instead.
      return json(502, { reply: "The AI service returned an error.", actions: [] });
    }

    const data = await res.json();
    const text = extractText(data);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Structured output should make this impossible, but if the model ever
      // wraps the JSON in prose, salvage the first {...} block.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Model did not return JSON");
      parsed = JSON.parse(match[0]);
    }

    return json(200, {
      reply: typeof parsed.reply === "string" ? parsed.reply : "Done.",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    });
  } catch (err) {
    console.error("assistant function failed:", err);
    return json(502, { reply: "The AI assistant is unreachable.", actions: [] });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
