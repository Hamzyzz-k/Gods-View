# Supabase setup

Everything in the app is already written and deployed-safe. Until you do the
steps below, `SUPABASE_URL` is unset, the app detects that, and it runs exactly
as it always has — fully open, no login. **The gate turns on the moment you set
the environment variables**, with no code change and no flag to remember.

Work through this in order. Steps 1–5 take about fifteen minutes.

---

## 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Pick a strong database password and save it in your password manager — you
   will not be shown it again.
3. Choose the region closest to where you'll present.

## 2. Create the schema

Dashboard → **SQL Editor** → **New query** → paste the whole of
[`schema.sql`](schema.sql) → **Run**.

It is idempotent, so you can re-run it later after edits without losing data.

You should see `Success. No rows returned`.

## 3. Turn off public signup

This is the single setting that makes "only invited students can register"
true. Everything else is built on top of it.

Dashboard → **Authentication** → **Sign In / Providers** → **Email**:

- **Disable** "Allow new users to sign up".
- Leave "Confirm email" **enabled**.

Without this, anyone can create their own account and the invite system is
decoration.

## 3b. Point invite and reset links at the deployed site

Without this, every invite and password-reset email sends people to
`http://localhost:3000` — which works on your machine and is a dead link for
everyone else.

Dashboard → **Authentication** → **URL Configuration**:

1. **Site URL** — set to `https://gods-view-cu.netlify.app`

   This is the fallback destination for every auth email. It defaults to
   `http://localhost:3000`, which is where the localhost links come from.

2. **Redirect URLs** — add both of these:

   ```
   https://gods-view-cu.netlify.app/**
   http://localhost:8888/**
   ```

   The second is for local `netlify dev`. Port 8888, not 3000 — that is what
   `netlify dev` serves on, and the entry has to match exactly.

The allowlist is the part that catches people out. Supabase **ignores** the
`redirectTo` the app asks for unless that exact URL is on this list, and when
it rejects one it does not error — it quietly falls back to Site URL instead.
So a wrong or missing entry looks identical to the app never having asked,
which is why this shows up as "the link goes to localhost" rather than as any
kind of failure.

The app already sends the right `redirectTo` (`SITE_ORIGIN` for invites,
the current origin for password resets). This step is only about Supabase
being willing to honour it.

## 4. Get your keys

Dashboard → **Project Settings** → **API keys**.

| Value | Where it goes | Sensitivity |
|---|---|---|
| Project URL | `SUPABASE_URL` | public |
| `anon` / publishable key | `SUPABASE_ANON_KEY` | public — safe in a browser |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY` | **secret — server only** |

The `service_role` key bypasses every access rule in the database. It belongs
only in Netlify's environment variables. If it ever reaches the browser, every
student's data is readable by anyone. Do not paste it into a chat, a commit, or
any file under `solar-system/`.

## 5. Set the environment variables

Run these in the project folder. They set the values on Netlify without the
keys ever appearing in the repository:

```bash
netlify env:set SUPABASE_URL "https://YOUR-PROJECT.supabase.co"
```

```bash
netlify env:set SUPABASE_ANON_KEY "your-anon-key"
```

```bash
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-service-role-key"
```

```bash
netlify env:set SITE_ORIGIN "https://gods-view-cu.netlify.app"
```

`SITE_ORIGIN` is where invite and password-reset links send people back to. Get
it wrong and the links land on the wrong site.

For local `netlify dev`, add the same four to `.env`.

Then redeploy: `netlify deploy --prod`

## 6. Make yourself the super admin

There is deliberately no way to create a super admin over HTTP — it is the one
account that can approve institutes, so it is created by hand, once.

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new
   user**. Use your own email, set a password, and tick *Auto Confirm User*.
2. Copy the new user's UUID.
3. SQL Editor → run this with your UUID pasted in:

```sql
update public.profiles
set role = 'super_admin'
where id = 'PASTE-THE-UUID-HERE';
```

4. Confirm it took:

```sql
select id, role from public.profiles where role = 'super_admin';
```

## 7. Email delivery (before inviting a real class)

Supabase's built-in email sender is rate-limited to a handful per hour and is
meant for development. Inviting a class will hit that limit immediately.

**Your situation**: another project already sends mail through the same Brevo
account, and God's View has no custom domain yet — only
`gods-view-cu.netlify.app`. That second fact matters more than it looks: SPF
and DKIM authenticate a *domain* by adding DNS records to it, and you can't add
DNS records to `netlify.app` — Netlify owns that domain, not you. Real domain
authentication has to wait until God's View has a domain of its own. Steps
7a–7c below are the path that works today without one; 7d is what to do once
you have a domain.

### 7a. One Brevo account, two identities — no conflict

Brevo lets one account hold several **verified senders**. Your other project
keeps its sender; this section adds a second, separate one just for God's
View, so invite emails don't arrive looking like they're from your other
project. The **SMTP login** you authenticate with stays the same for both —
that's your Brevo account email, and recipients never see it — only the
**From address** differs per project, and that's what this section sets up.

### 7b. Add and verify a sender for this project

You need a dedicated inbox for this — reusing your personal email would mean
students' "reply" ends up in your regular inbox forever. A free, purpose-made
address works fine (e.g. `godsview.notifications@gmail.com`); you just need to
be able to receive one confirmation email in it.

1. Brevo dashboard → your profile icon (top right) → **Senders, Domains &
   Dedicated IPs** → **Senders** tab → **Add a sender**.
2. Enter that dedicated address as the sender email, and a From name students
   will recognise — e.g. "God's View".
3. Brevo emails that inbox a 6-digit code. Open it, paste the code back into
   Brevo, click **Verify**.

Sender is now usable — but see 7d for what "usable" doesn't yet mean.

### 7c. Get SMTP credentials and wire them into Supabase

1. Brevo dashboard → profile icon → **SMTP & API** → **SMTP** tab.
2. Note the host and port shown (`smtp-relay.brevo.com`, port `587`), and your
   **SMTP login** (your Brevo account email — same one your other project
   uses, that's expected).
3. Click **Generate a new SMTP key** (not an API key — API keys are for
   Brevo's HTTP API, not SMTP, and won't authenticate here). Copy it now; Brevo
   only shows it once.
4. Supabase dashboard → **Authentication** → **Emails** → **SMTP Settings**
   (Supabase has moved this menu before — if it's not there, check **Project
   Settings → Authentication**).
5. Toggle **Enable Custom SMTP** on, then fill in:

   | Field | Value |
   |---|---|
   | Sender email | the address you verified in 7b |
   | Sender name | e.g. `God's View` |
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | your Brevo SMTP login (account email) |
   | Password | the SMTP key from step 3 |

6. Save, then use Supabase's own "send test email" if it offers one, or just
   invite yourself as a test student and confirm it arrives.

### 7d. The honest limitation right now, and the real fix later

A sender verified by confirmation code (7b) proves you control that *mailbox*,
not that you control a *domain* — so there is nothing for SPF/DKIM to
authenticate yet, and mail clients know it. Practically: some recipients (Gmail
in particular) may show the message as sent **"via brevo.com"**, and it has a
higher chance of landing in spam than a fully authenticated domain would. This
is a real limitation, not a formality — treat it as good enough to get invites
flowing now, not as done.

**When you're ready to fix it properly**: buy a cheap domain (Cloudflare or
Namecheap, roughly $10–15/year — Cloudflare's registrar sells at cost, no
markup), then in Brevo go to **Senders, Domains & Dedicated IPs** → **Domains**
→ **Add a domain**, and add the TXT/CNAME/DKIM records it gives you at your
registrar's DNS settings. Once verified there, update the sender email in 7b
to use an address on that domain (e.g. `invites@yourdomain.com`) and repeat
7c with the new sender. Tell me when you have a domain and I'll walk through
the exact DNS records with you.

### Shared capacity

Both projects draw from the same 300-emails/day free-tier pool — it's per
Brevo account, not per project or per sender. You confirmed combined volume is
well under that, so no action needed now; if invite volume grows later, check
current usage under Brevo's dashboard home before assuming there's headroom.

---

## Verifying it actually works

Do not take the policies on trust. Run
[`verify-isolation.sql`](verify-isolation.sql) in the SQL editor — it creates
two institutes with a student each, attempts to read across the boundary as
each one, and fails loudly if either can see the other. Re-run it after any
policy change.

## Before every demo

**Free Supabase projects pause after 7 days of inactivity**, and a paused
project cannot log anyone in. This is the most likely way this setup fails at
the worst possible moment.

Open the dashboard and confirm the project is awake before you present. Then
sign in early — a session lasts about an hour, so a network drop mid-demo is
survivable, but a drop before you have logged in is not. Carry a hotspot.

## Turning the gate back off

Unset `SUPABASE_URL` and redeploy. The app returns to fully open. Useful if
something goes wrong an hour before a presentation.
