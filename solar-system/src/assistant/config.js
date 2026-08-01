// Assistant backend endpoint.
//
// Lives in its own module because both runCommand.js (which calls it) and
// localParser.js (which changes its "connect a backend" hint text depending
// on whether one is configured) need it. Importing it from either of those
// would create a cycle between them.
export const ASSISTANT_ENDPOINT = "https://hamzah-07.app.n8n.cloud/webhook/solar-system-agent";
