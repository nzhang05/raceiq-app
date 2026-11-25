# Deploying RaceIQ

RaceIQ deploys to Vercel as a static Vite build plus one serverless function
(`api/claude.js`). `vercel.json` holds the build settings, a 60-second cap on
the function, and security headers. There are two ways to deploy it.

| | Public demo | Full app |
|---|---|---|
| Who it's for | Reviewers opening a link from the README | Athletes with accounts |
| Sign-in | None | Supabase (email or OAuth) |
| Data | Sample athlete, plus anything the visitor adds, kept in their browser | Per-user rows protected by row-level security |
| AI | Recorded answers for the sample races; live calls only within a budget you set | Live, per-user rate limit |

Both can be separate Vercel projects pointing at the same repo.

## Public demo

### 1. Create the project

1. In Vercel, choose **Add New → Project** and import `nzhang05/raceiq-app`.
2. Leave the framework preset as **Vite**. Build settings come from `vercel.json`.
3. Under **Environment Variables**, add:

   | Name | Value | Notes |
   |---|---|---|
   | `VITE_DEMO_MODE` | `true` | Read by the bundle at build time and by the function at runtime. |

   Leave `VITE_SUPABASE_*` unset. A demo build ignores them even when they're
   present, but leaving them out keeps it obvious.
4. Deploy. The demo works now: the debrief and the coach's suggested
   questions replay recorded answers for the sample athlete, and
   free-form questions get a "live questions are off" message.

`VITE_*` variables are inlined at build time, so redeploy after you change one.

### 2. Optional: a small live budget

To let visitors ask their own questions, give the demo its own key and a
budget:

1. In the [Anthropic Console](https://console.anthropic.com), create a separate
   workspace for the demo, set a **monthly spend limit** on it, and create an API
   key there. The spend limit is the real ceiling. The counters below only slow
   down a runaway visitor.
2. Add to the Vercel project:

   | Name | Example | Notes |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-…` | The demo workspace key. **No `VITE_` prefix, ever.** |
   | `DEMO_AI_PER_CLIENT_PER_DAY` | `5` | Live calls per visitor (by hashed IP) per rolling 24 hours. |
   | `DEMO_AI_GLOBAL_PER_DAY` | `100` | Live calls for the whole deployment per UTC day. |

   Both must be above 0 for live calls to happen.
3. Redeploy.

The counters live in memory (`api/_lib/demo.js`), so each serverless instance
keeps its own, and a cold start resets them. To get an exact global cap, move
them to a shared store such as Vercel KV or Upstash Redis.

Recorded answers are always used for the sample races, even with a budget, so
the first impression costs nothing.

### 3. Point the README at it

Replace the live-demo placeholder at the top of `README.md` with the
deployment URL.

## Full app

1. Create a Supabase project and run the migrations in `supabase/migrations/`
   in order (SQL editor, or `supabase db push`).
2. In Supabase **Authentication → URL configuration**, add the Vercel URL to
   the allowed redirect URLs (needed for OAuth sign-in).
3. Create a Vercel project as above, with these variables instead:

   | Name | Notes |
   |---|---|
   | `VITE_SUPABASE_URL` | Public. |
   | `VITE_SUPABASE_ANON_KEY` | Public by design. Row-level security protects data. |
   | `ANTHROPIC_API_KEY` | Server-side only. No `VITE_` prefix. |

   Leave `VITE_DEMO_MODE` unset.
4. Deploy, sign up, and open a race debrief to check the full path end to end.
   `npm run smoke` checks both credentials locally first (it costs a few cents).

## Previewing the demo locally

```bash
npm run dev:demo     # dev server in demo mode (loads .env.demo)
npm run build:demo   # production bundle in demo mode
```

With `ANTHROPIC_API_KEY` and the two `DEMO_AI_*` variables in `.env.local`,
`dev:demo` also exercises the live demo budget through the same handler Vercel
runs.

## Re-recording the demo answers

The recordings in `src/demo/recordings/` are checked by the grounding test
(`npm test`): every number in them must appear in the data block the server
would send for that request. To replace them with fresh output from the model:

```bash
npm run record:demo   # 16 live calls; needs ANTHROPIC_API_KEY in .env.local
npm test              # fails if a new recording cites a number that isn't in the data
```
