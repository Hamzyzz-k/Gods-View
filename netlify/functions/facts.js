// Solar System OpenData proxy.
//
// This API made bearer-token auth mandatory in v2.0.0 (Sept 2025), which is
// why direct browser calls started returning 401. Tokens are free:
//   https://api.le-systeme-solaire.net/generatekey.html
// Set it as SOLAR_SYSTEM_API_TOKEN in the Netlify dashboard.
//
// Proxying (rather than putting the token in client JS) keeps it off the
// wire the same way the Gemini and ElevenLabs keys are handled.

const UPSTREAM = "https://api.le-systeme-solaire.net/rest/bodies";

export const handler = async (event) => {
  const body = (event.queryStringParameters?.body || "").toLowerCase();
  // Only allow simple names through — this value is interpolated into the
  // upstream URL, so reject anything that could alter the path.
  if (!/^[a-z]+$/.test(body)) {
    return json(400, { error: "Invalid body name" });
  }

  const token = process.env.SOLAR_SYSTEM_API_TOKEN;
  if (!token) {
    // 204: the client treats "no facts" as normal and simply omits the
    // verified-stats chips, rather than surfacing an error to the user.
    return { statusCode: 204, body: "" };
  }

  try {
    const res = await fetch(`${UPSTREAM}/${body}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error("Solar System OpenData error", res.status);
      return { statusCode: 204, body: "" };
    }
    const data = await res.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // This data essentially never changes — let the CDN hold it a day.
        "Cache-Control": "public, max-age=86400",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("facts function failed:", err);
    return { statusCode: 204, body: "" };
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
