// Assistant backend endpoint.
//
// Lives in its own module because both runCommand.js (which calls it) and
// localParser.js (which changes its hint text depending on whether a backend
// is configured) need it. Importing it from either would create a cycle.
//
// This is a Netlify Function, so the Gemini API key stays server-side. The
// function is always present in a deployed build; if it errors or the site is
// served statically without functions, runCommand falls back to the local
// regex parser in localParser.js.
export const ASSISTANT_ENDPOINT = "/.netlify/functions/assistant";
