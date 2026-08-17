// ElevenLabs text-to-speech proxy.
//
// Exists so the ElevenLabs key stays server-side. The browser previously
// called api.elevenlabs.io directly with the key embedded in the shipped JS,
// where anyone could lift it from devtools.
//
// The app defaults to the browser's built-in Web Speech voice; this endpoint
// is only hit when the client TTS engine is switched to "elevenlabs".
// Set ELEVENLABS_API_KEY in the Netlify dashboard to enable it.

import { guardRequest, capString } from "./lib/guard.js";

// ElevenLabs bills by character, so an uncapped `text` field is a direct
// route to spending real money on someone else's behalf. Narration in this
// app is a body name plus a short description; 800 characters is well clear
// of that and still bounds the cost of any single call.
const MAX_TEXT_CHARS = 800;

const VOICE_ID = "cT5LqmY8Y5dz4bRVJKSy"; // "Rachel" — a premade voice; only
// use ids from your dashboard's "My Voices" tab. Shared/community "Voice
// Library" voices return 402 on the free API tier.
const MODEL_ID = "eleven_turbo_v2_5"; // fast + natural; swap to
// eleven_multilingual_v2 for non-English narration.

export const handler = async (event) => {
  // Method, origin and rate-limit checks, shared with assistant.js. This
  // endpoint spends paid credits, so it is the one that most needs them.
  // Plain-text bodies here, matching what this function already returns.
  const rejected = guardRequest(event, { onReject: (message) => message });
  if (rejected) return { ...rejected, headers: { "Content-Type": "text/plain" }, body: JSON.parse(rejected.body) };

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // 503 rather than 500: the client treats this as "premium voice
    // unavailable" and silently falls back to the browser voice.
    return { statusCode: 503, body: "ELEVENLABS_API_KEY not configured" };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: "Malformed request" };
  }
  if (!text || typeof text !== "string") {
    return { statusCode: 400, body: "No text provided" };
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: capString(text, MAX_TEXT_CHARS),
          model_id: MODEL_ID,
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("ElevenLabs error", res.status, detail.slice(0, 300));
      return { statusCode: 502, body: "TTS upstream error" };
    }

    // Netlify Functions can only return binary bodies as base64, and the
    // response must be flagged with isBase64Encoded so the platform decodes
    // it back to raw bytes on the way out.
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("tts function failed:", err);
    return { statusCode: 502, body: "TTS unreachable" };
  }
};
