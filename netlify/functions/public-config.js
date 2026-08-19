// Public front-end configuration.
//
// Returns the Supabase project URL and ANON key. Both are meant to be public —
// the anon key is designed to be shipped to browsers, and every table it can
// reach is governed by the row-level policies in supabase/schema.sql. Serving
// them from here rather than hardcoding them in the bundle keeps
// project-specific values out of the repository, so rotating a key or pointing
// at a different project is an environment-variable change rather than a code
// change.
//
// THIS ENDPOINT MUST NEVER RETURN SUPABASE_SERVICE_ROLE_KEY. That key bypasses
// every row-level policy in the database — it is the difference between "a
// student can read their own scores" and "anyone on the internet can read
// every student's scores". It is read only by the invite/approve functions,
// which never send it anywhere. The explicit allowlist below exists so that a
// later edit that adds "just one more field" cannot leak it by accident.

const ALLOWED_KEYS = ["supabaseUrl", "supabaseAnonKey"];

export const handler = async () => {
  const payload = {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  };

  // Belt and braces: strip anything not on the allowlist, whatever was built
  // above. Cheap, and it makes the guarantee structural rather than a comment.
  const safe = {};
  for (const key of ALLOWED_KEYS) safe[key] = payload[key];

  if (!safe.supabaseUrl || !safe.supabaseAnonKey) {
    // 503 rather than 500: the app treats this as "auth isn't set up yet" and
    // says so, instead of showing a login form that cannot work.
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Auth is not configured on this deployment." }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Short cache: long enough that entering the app doesn't re-fetch on
      // every navigation, short enough that a rotated key takes effect
      // quickly rather than being pinned in caches for a day.
      "Cache-Control": "public, max-age=300",
    },
    body: JSON.stringify(safe),
  };
};
