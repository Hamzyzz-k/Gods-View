// ---------- shared abuse guards for the API-proxy functions ----------
// assistant.js and tts.js both forward requests to paid third-party APIs
// using keys held server-side. The keys were never exposed, but for a long
// time the ENDPOINTS were: no origin check, no rate limit, no size cap. Any
// person who opened devtools once and copied the URL could use the Gemini key
// as a free general-purpose LLM, drain the quota so the feature broke for
// real users, or run up real money on ElevenLabs credits.
//
// Lives in lib/ rather than beside the functions because Netlify turns each
// top-level file in the functions directory into its own endpoint. A
// subdirectory only becomes one if it holds an index.js or a file matching
// the directory name, so lib/guard.js is bundled into its importers and never
// published as a callable function of its own.
//
// HOW STRONG THIS ACTUALLY IS — worth being precise, because it is easy to
// mistake for more than it is:
//
//   * The origin check stops browser-based abuse from another site outright,
//     because browsers set Origin themselves and script cannot forge it.
//   * It does NOT stop a script hitting the endpoint directly (curl, Postman,
//     a server), which can send any Origin header it likes. The rate limit
//     and size caps are what blunt that case.
//   * The rate limit is per warm instance, not global — serverless containers
//     are ephemeral and several may run at once, so the real ceiling is
//     higher than MAX_REQUESTS suggests. It reliably stops casual hammering,
//     not a determined distributed effort.
//
// The genuinely robust fix is requiring a signed-in user, which becomes
// possible once accounts exist (see tasks/backend-plan.md). At that point
// these guards become the second layer rather than the only one.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20; // per IP per minute, per warm instance

// Recent hits per IP. A module-level Map persists only as long as the
// container stays warm, which is exactly the lifetime this needs.
const hits = new Map();

function tooManyRequests(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the Map can't grow without bound on a
  // long-lived instance being probed from many addresses.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }

  return recent.length > MAX_REQUESTS;
}

// Requests from the site itself carry no Origin header (same-origin fetch
// often omits it), so a missing Origin is allowed — the check exists to
// reject OTHER sites' pages, not to demand a header the browser may not send.
function originAllowed(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  if (!origin) return true;

  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false; // an unparseable Origin is not something to wave through
  }

  if (host === "localhost" || host === "127.0.0.1") return true; // local dev
  // Any netlify.app subdomain covers this project's deploy previews and
  // branch deploys as well as production, without hardcoding one site name
  // that breaks the moment the site is renamed.
  if (host === "netlify.app" || host.endsWith(".netlify.app")) return true;

  // Set SITE_ORIGIN in the Netlify dashboard once a custom domain is added.
  const configured = process.env.SITE_ORIGIN;
  if (configured) {
    try {
      if (host === new URL(configured).hostname) return true;
    } catch {
      // a malformed SITE_ORIGIN shouldn't take the endpoint down
    }
  }
  return false;
}

function clientIp(event) {
  return (
    event.headers?.["x-nf-client-connection-ip"] ||
    (event.headers?.["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown"
  );
}

// Runs every guard in order. Returns an error response to return directly,
// or null when the request is fine to process.
//
// onReject builds the body, because each function has its own response shape
// its client already understands — assistant.js must return { reply, actions }
// even for errors, or the browser's fallback parser breaks.
export function guardRequest(event, { onReject }) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders(), body: JSON.stringify(onReject("Method not allowed.")) };
  }
  if (!originAllowed(event)) {
    return { statusCode: 403, headers: jsonHeaders(), body: JSON.stringify(onReject("Forbidden.")) };
  }
  if (tooManyRequests(clientIp(event))) {
    return {
      statusCode: 429,
      headers: { ...jsonHeaders(), "Retry-After": "60" },
      body: JSON.stringify(onReject("Too many requests — please slow down.")),
    };
  }
  return null;
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

// Caps a value's length before it is forwarded to a metered API. Without
// this, request size directly sets token cost, so an oversized payload is
// both a cost and a denial-of-service lever.
export function capString(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
