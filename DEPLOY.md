# Waypoint PIT — Deployment Guide (Supabase + Vercel)

This takes the app from demo-mode to a live deployment: a real Supabase database
and a Vercel-hosted PWA with a server-side Claude proxy.

The app flips from demo mode to real mode automatically the moment real Supabase
credentials replace the placeholders — no code change needed (`src/lib/supabase.ts`).

---

## 0. What you'll need to create (accounts)

- A **Supabase** project — https://supabase.com (free tier is fine to start)
- A **GitHub** repo to hold this code
- A **Vercel** account — https://vercel.com (sign in with GitHub)
- A **Mapbox** public token — https://account.mapbox.com/access-tokens
- An **Anthropic API key** for the AI panel — https://console.anthropic.com

---

## 1. Supabase database

1. Create a new project. Pick a strong DB password and a region close to Miami
   (e.g. `us-east-1`). Wait for it to provision.
2. Open **SQL Editor → New query**.
3. Open `supabase/deploy.sql` from this repo, copy the **entire** file, paste it
   into the editor, and click **Run**. This creates all 8 tables, RLS policies,
   PostGIS extensions, the zone-boundary trigger, and seeds the FL-600
   organization + 8 Miami-Dade zone templates.
   - It is safe if the seed section runs more than once (idempotent). The schema
     section is **not** — only run the full bundle on a fresh project.
4. From **Settings → API**, copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon / public** key → this is `VITE_SUPABASE_ANON_KEY`
     (the anon key is safe to ship in the client bundle — RLS protects the data)

### Create the first admin user

The app expects every signed-in user to have a `profiles` row. Bootstrap yours:

1. **Authentication → Users → Add user** — create your login
   (email + password). Copy the new user's **UID**.
2. Back in **SQL Editor**, run (replace the UID + your details):
   ```sql
   INSERT INTO profiles (id, org_id, full_name, email, role)
   VALUES (
     '<paste-auth-user-UID>',
     '00000000-0000-0000-0000-000000000600',  -- FL-600 org from the seed
     'William Miranda',
     'you@miamidade.gov',
     'coc_admin'   -- or 'super_admin'
   );
   ```
3. (Optional) **Authentication → Providers → Email**: turn **off** "Confirm email"
   for now so logins work without an SMTP setup, or configure SMTP later.

---

## 2. Push this code to GitHub

This folder (`waypoint-pit/`) is already a git repo with an initial commit.

> Note: the initial commit was authored as `William Miranda
> <william.miranda@miamidade.gov>`. If that's wrong, fix it before pushing:
> `git config user.email "you@…"` then `git commit --amend --reset-author --no-edit`.

1. Create a new **empty** repo on GitHub (no README/license — keep it empty).
2. Connect and push:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

`.env`, `node_modules`, and `dist` are gitignored — no secrets are committed.

---

## 3. Deploy on Vercel

1. **vercel.com → Add New → Project → Import** your GitHub repo.
2. Vercel auto-detects Vite from `vercel.json` (build `npm run build`, output
   `dist`). Leave **Root Directory** as the repo root (this folder *is* the root).
3. Before the first deploy, add **Environment Variables** (Project → Settings →
   Environment Variables — set for **Production** and **Preview**):

   | Name | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | your Project URL | client (build-time) |
   | `VITE_SUPABASE_ANON_KEY` | your anon key | client (build-time) |
   | `VITE_MAPBOX_TOKEN` | `pk....` | client (build-time) |
   | `VITE_AI_PROXY` | `/api/insight` | client — routes Claude calls server-side |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | **server only** — never prefix with `VITE_` |

   > `VITE_`-prefixed vars are baked into the browser bundle (public). The
   > `ANTHROPIC_API_KEY` is read only by the serverless function (`api/insight.ts`)
   > and never reaches the browser.

4. Click **Deploy**. After it builds, open the URL and sign in with the admin
   user you created in step 1.

Every later `git push` to `main` triggers an automatic production redeploy.

---

## 4. Verify the live deployment

- **Login** with the bootstrapped admin → lands on `/dashboard`.
- **Maps** render with real Mapbox tiles (not the SVG fallback).
- **Analysis → AI Insights**: the panel shows "Claude connected (server)" with no
  paste-key gear. Click **Generate insights** — it calls `/api/insight`.
- **Create an event / zone** and confirm it persists across a hard refresh
  (proves Supabase writes, not localStorage).

---

## Architecture notes

- **AI proxy** (`api/insight.ts`): a Vercel serverless function that forwards
  `messages.create` params to Anthropic using the server-side key. Only the two
  models the app uses are allowed; `max_tokens` is capped. Set `VITE_AI_PROXY` to
  enable it; unset it for local dev (falls back to a localStorage key +
  `dangerouslyAllowBrowser`).
- **SPA routing** (`vercel.json`): all non-`/api` paths rewrite to `index.html`
  so React Router's client routes work on hard refresh. Static assets are served
  before the rewrite applies.
- **Boundary layers** (`src/lib/boundaries/*.ts`) are still synthetic rectangles.
  Swapping them for real Miami-Dade Open Data Portal GeoJSON is independent of
  this deploy — each layer's `load()` returns the same `BoundaryFeature[]` shape.

## Local development

```bash
cp .env.example .env   # fill in real values, or leave placeholders for demo mode
npm install
npm run dev
```
With placeholder Supabase creds the app runs in **demo mode** (localStorage data,
demo logins — any password). Leave `VITE_AI_PROXY` unset locally and paste an
Anthropic key via the AI panel gear to test real insights.
