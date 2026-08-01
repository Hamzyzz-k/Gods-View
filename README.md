# Immersive VR Solar System

A Three.js solar system that runs both as a desktop web app (mouse orbit,
click-to-focus) and as an immersive WebXR VR experience (free-flight
locomotion, controller laser-pointer selection, voice control).

Static site, no build step — ES modules loaded via an importmap, plus two
Netlify Functions that hold API keys server-side.

## Running locally

Any static file server works for the front end alone:

```bash
npx serve solar-system
```

To exercise the AI assistant and ElevenLabs TTS you need the functions too,
which means the Netlify CLI:

```bash
netlify dev
```

Copy `.env.example` to `.env` first and fill in the keys.

## Environment variables

Set these in the Netlify dashboard under **Site settings → Environment
variables**. Neither is ever exposed to the browser — both are read only
inside the serverless functions.

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | `netlify/functions/assistant.js` | Google Gemini call that powers the AI scene assistant. Without it the app still works — the client falls back to its local regex command parser. |
| `ELEVENLABS_API_KEY` | No | `netlify/functions/tts.js` | High-quality voice narration. Optional: the app defaults to the browser's built-in Web Speech voice and only calls this when TTS is switched to `elevenlabs`. |
| `SOLAR_SYSTEM_API_TOKEN` | No | `netlify/functions/facts.js` | Real planetary stats in the info panel. [Solar System OpenData](https://api.le-systeme-solaire.net/generatekey.html) made bearer tokens mandatory in Sept 2025; tokens are free. Without it the app just omits the "verified stats" chips. |

## VR

The "Enter VR" button only appears when the browser reports genuine
`immersive-vr` support. Without a headset, test using the
[WebXR API Emulator](https://chromewebstore.google.com/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje)
Chrome extension.

Controls in VR:

| Input | Action |
|---|---|
| Left thumbstick | Fly forward/back, strafe (relative to where you're looking) |
| Right thumbstick | Vertical movement (Y) and turning (X) |
| Trigger | Select the body your laser is pointing at |
| Grip / squeeze | Hold to talk — push-to-talk voice commands |
