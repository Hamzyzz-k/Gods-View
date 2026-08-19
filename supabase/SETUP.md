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

Set up **Brevo** as custom SMTP: Dashboard → **Project Settings** →
**Authentication** → **SMTP Settings**.

Get the host, port, login and key from Brevo → **SMTP & API** → **SMTP**.

Then set up **domain authentication (SPF and DKIM)** in Brevo before a real
rollout. Without it, invites to institutional addresses will very likely land
in spam — and an invite-only system where nobody receives the invite looks
exactly like a broken app.

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
