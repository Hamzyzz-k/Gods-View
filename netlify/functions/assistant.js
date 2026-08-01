// AI scene assistant, backed by the Google Gemini API.
//
// Replaces the old n8n webhook. The client contract is unchanged:
//   request : { command, context }  where context =
//             { visible, hidden, orbitLinesVisible, focused, focusedFacts }
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
  "sun", "moon", "moons", "rings", "asteroids", "belt", "iss", "constellations",
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

Valid targets: ${TARGETS.join(", ")}.

Phrase shortcuts you must expand yourself:
  "inner planets" -> mercury, venus, earth, mars
  "outer planets" -> jupiter, saturn, uranus, neptune, pluto
  "everything"/"all planets" -> all nine planets

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
          type: { type: "string", enum: ["show", "hide", "showOnly", "focus", "orbitLines", "reset"] },
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
