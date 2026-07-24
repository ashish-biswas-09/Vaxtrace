# Deploying to Vercel (TODO 0.8)

No `vercel.json` needed — Vercel's dashboard "Root Directory" setting handles a monorepo app
without extra config, and we have no custom redirects/headers/crons yet to justify one.

## One-time setup (you, in the Vercel dashboard)

1. **New Project** → import the `VaxTrace` GitHub repo.
2. **Root Directory**: `apps/web` (this is the one required non-default setting).
3. Framework Preset: Next.js (auto-detected).
4. **Environment Variables** — add these for Production, Preview, and Development:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ptcxxyeaakbiqhmkmgwo.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key in `apps/web/.env.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase project settings → API (server-only, never `NEXT_PUBLIC_`) |

5. Deploy. Every push to `main` redeploys to production; every PR gets a preview URL.

## After the first deploy

Come back and give me the deployment URL — I'll add it to `docs/DEMO.md` so the "how to run
the demo" doc has a live link instead of `localhost`.
