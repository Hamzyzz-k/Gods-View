# Security — Audit Findings and Hardening Plan

Companion to `backend-plan.md`.

**Status: S1–S4 are fixed and verified. S5 accepted as low risk.** Items 1 and
2 of the hardening plan (XSS fixes, Content Security Policy) are done; the
rest apply when the backend is built. Findings are kept below with their fixes
recorded, because the reasoning is worth preserving — these are the exact
mistakes most likely to be reintroduced later.

## What was actually checked

- Dependency vulnerabilities (`npm audit`)
- Every HTML-injection sink in the codebase (`innerHTML`, `insertAdjacentHTML`,
  `eval`, `document.write`, `dangerouslySetInnerHTML`)
- All three Netlify Functions: input validation, secret handling, abuse
  controls
- Git history and all tracked files, for committed secrets
- Whether AI-returned actions are validated before the client executes them

## Findings

### S1 — Cross-site scripting via the news ticker (High, live today)

`src/data/spaceNews.js:45`

Article titles, URLs, and site names come from a third-party API
(`api.spaceflightnewsapi.net`) and are written straight into `innerHTML`
without escaping:

```js
`<a href="${a.url}" ...>${a.title} <span ...>— ${a.site}</span></a>`
```

A title containing `<img src=x onerror="...">` executes as script in your
page. You do not control that API, so you are trusting a third party not to
be compromised and not to let a malicious title through.

**This is the single most important finding, because of what it becomes once
you add login.** The Supabase session token lives in `localStorage`. A script
running on your page can read it and impersonate that student — their
account, their scores, and whatever their role can reach. An XSS hole on an
authenticated page defeats the entire login system no matter how good the
database rules are. It must be fixed before auth ships, not after.

**FIXED.** The ticker is now built with `createElement` and `textContent`, and
`safeHttpUrl()` rejects any URL that is not `http:`/`https:` before it can
become an `href`. Titles are also length-capped so a hostile feed cannot blow
out the layout.

Verified by simulating a compromised feed — injecting
`<img src=x onerror="window.__pwned=true">` as an article title and a
`javascript:` URL, then rendering:

| Check | Result |
|---|---|
| Payload executed | no |
| `<img>` elements created | 0 |
| Payload visible as literal text | yes |
| `javascript:` URL became an href | no |

### S2 — Cross-site scripting via live fact chips (Medium)

`src/ui/infoPanel.js:40` and `:62`

Same class of bug, smaller surface. Values from the ISS tracker and the Solar
System OpenData API — `facts.gravity` in particular — are interpolated into
`insertAdjacentHTML` unescaped. Most of the neighbouring values are numbers
passed through `formatNumber` or `.toFixed()`, which would throw rather than
inject, but `gravity` is used as-is.

**FIXED.** Both call sites now go through `appendLiveChips()`, which builds
each chip as an element and sets `textContent`. The static metadata chips were
converted too — they read from trusted local data, but leaving one safe path
and one unsafe path beside each other is how the unsafe one gets copied later.

### S3 — Open, unmetered AI and TTS proxies (High — cost and abuse)

`netlify/functions/assistant.js`, `netlify/functions/tts.js`

Both are public POST endpoints with no origin check, no rate limit, and no
cap on input size. The keys are correctly kept server-side, but the
*endpoints* are not protected. Anyone who opens devtools once and copies the
URL can:

- use your Gemini key as a free general-purpose LLM, since `command` is
  free-form text that goes to the model,
- drain your quota to zero, taking the feature down for your actual users,
- run up genuine cost on ElevenLabs, where credits are paid.

This needs no skill to exploit and no login to reach.

**FIXED**, with a stated limit. `netlify/functions/lib/guard.js` now applies a
method check, an origin allowlist, and a per-IP rate limit (20/min) to both
functions.

Be precise about what this buys, because it is easy to overrate:

- The origin check **does** stop browser-based abuse from another site
  outright — browsers set `Origin` themselves and page script cannot forge it.
- It **does not** stop a direct scripted call (curl, a server), which can send
  any `Origin` it likes. The rate limit and size caps blunt that case.
- The rate limit is per warm serverless instance, not global, so the true
  ceiling is higher than 20/min. It stops casual hammering, not a determined
  distributed effort.

The robust fix remains requiring a signed-in user, which becomes available
with the backend. These guards then become the second layer rather than the
only one.

### S4 — No input length caps (Medium — cost)

`assistant.js` forwarded `command` and `JSON.stringify(context)` to the model
at whatever size the client posted, so request size set token cost directly.

**FIXED.** `command` is capped at 500 characters and `context` at 4000 before
either reaches the model. `tts.js` caps `text` at 800 characters — ElevenLabs
bills per character, making that the one endpoint where an uncapped field
spends real money.

### S5 — Prompt injection reaching scene actions (Low)

A crafted command could persuade the model to emit actions the user did not
ask for. Impact is genuinely small: `src/assistant/runCommand.js` dispatches
on `action.type` through a `switch`, so anything outside the known set is
ignored. The blast radius is "the app hides Jupiter unexpectedly", not code
execution. Worth knowing, not worth blocking the backend on.

## What is already clean

Worth stating, because these are the things that usually go wrong:

- **`npm audit`: 0 vulnerabilities.**
- **No secrets committed, ever.** `.env` has never been in git history, and no
  secret-shaped strings exist in any tracked file.
- **`facts.js` validates input before interpolating it into a URL**
  (`/^[a-z]+$/`), which is exactly right and blocks path traversal against the
  upstream API. It is the model the other functions should follow.
- **All three functions keep their API keys server-side** and never expose
  them to the browser.
- **AI-returned actions are dispatched through a `switch`**, an implicit
  allowlist.

## Hardening plan for the backend

Ordered by what actually reduces risk, not by what is easiest.

**1. Fix S1 and S2 before auth ships.** An XSS hole on a logged-in page hands
over session tokens. Every other control below assumes this is done.

**2. Content Security Policy. DONE.** `netlify.toml` now sends a CSP allowing
only the four origins the app genuinely uses (jsDelivr, Wikimedia, the news
API, the ISS tracker), plus `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and HSTS. This turns most *future*
XSS bugs into nothing happening, which is why it was worth doing before the
backend rather than after.

Two details that matter for maintenance:

- The inline import map is whitelisted **by SHA-256 hash**, not by
  `'unsafe-inline'` — the latter would also permit injected `onerror=`
  handlers and defeat most of the point. Editing the import map means
  recomputing that hash; the command is in `netlify.toml`'s comment.
- `.gitattributes` pins `index.html` to LF endings. Without it a fresh clone
  on Windows would convert to CRLF, change the hashed bytes, and the browser
  would block the import map — taking three.js down with it.
- `Permissions-Policy` deliberately keeps `microphone` and
  `xr-spatial-tracking` enabled for self. Denying those would silently break
  voice commands and VR.

Verified against the running app: no CSP violations, three.js resolves through
the import map, Wikimedia textures load, and the news ticker fetches normally.

**3. Row Level Security, deny by default.** Enable RLS on every table at
creation, before inserting a single row. The default must be "no access", with
policies granting the narrow cases. A table with RLS left off is readable by
anyone holding the public anon key — which, by design, is in your frontend.

**4. Never ship the service-role key.** It bypasses RLS entirely. It belongs
only in Netlify Function environment variables, never in `landing-src/` or
`solar-system/src/`, and never in a `VITE_`-prefixed variable — Vite inlines
those into the public bundle.

**5. Test isolation as a real test, not an assumption.** Create two institutes
with a student each, then attempt to read across the boundary with a genuine
session. It should fail. Do this again after every policy change; it is the
one test that proves the tenant model actually holds.

**6. Turn on Supabase's leaked-password protection.** It checks new passwords
against HaveIBeenPwned. Free, one toggle, and it removes the most common
account-compromise route — students reusing a password that is already in a
public breach dump.

**7. Rate-limit authentication endpoints.** Supabase applies some limits by
default; confirm them rather than assuming. This blocks credential stuffing
and stops your Brevo quota being burned by repeated invite or reset requests.

**8. Keep invitation server-side, and never expose an invited-emails table to
the client.** Already the design in `backend-plan.md`; restating because it is
the control that prevents someone enumerating who belongs to an institute.

**9. Log security-relevant events.** Who invited whom, who approved which
institute, failed login bursts. If something does go wrong, the difference
between a bad afternoon and a bad month is whether you can reconstruct what
happened.

**10. Decide data retention before real students exist.** What happens to a
student's scores when they leave, and who can delete them. Much easier to
decide now than to retrofit around real data.

## Email: Brevo

Brevo works well here and is a better fit than the alternatives I suggested
earlier — its free tier allows roughly 300 emails/day, comfortably more than
Resend's or SendGrid's free tiers, which matters when inviting a class at once.

Configure it as Supabase's **custom SMTP** provider (Supabase project settings
→ Auth → SMTP). Two notes:

- Put the Brevo SMTP key in Supabase's settings only. It is a sending
  credential; treat it like any other secret and keep it out of the repo.
- Set up domain authentication (SPF and DKIM) in Brevo before a real rollout.
  Without it, invite emails to institutional addresses will very likely land
  in spam — and an invite-only system where nobody receives the invite fails
  in a way that looks like your app is broken.

## Limits I cannot engineer around

Stated plainly so there are no surprises at review.

**The app's code cannot be protected.** Every line of JavaScript, every
shader, and every asset is downloaded by the browser to run, so anyone can
save it. Minifying and obfuscating raises the effort and nothing more.
If replication is a real concern, the answer is legal rather than technical —
a `LICENSE` file stating the terms, and a copyright header. That gives you
standing if someone republishes it; no code change can.

**"No cyber attack threats" is not a state any system reaches.** What the plan
above achieves is: no *known* vulnerabilities, no *unprotected* user data, and
defence in depth so that a single mistake does not become a breach. That is
the real target, and it is a high one. Treat security as maintenance —
`npm audit` periodically, and re-run the isolation test after policy changes —
rather than a box that gets ticked once.

**The genuinely sensitive asset here is student data, not the code.** Names,
email addresses, and quiz performance belong to real people, some of them
minors. That is what the database rules, the CSP, and fixing S1 protect. It is
worth more than the source, and unlike the source, it *can* be protected
properly.
