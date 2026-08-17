# Design Doc: User Auth & Athlete Profiles

**Status:** Draft
**Author:** RaceIQ
**Date:** 2026-07-29

---

## 1. Problem

RaceIQ explains *why* an athlete performed the way they did on race day. Today it does
that for exactly one imaginary person: the identity is hardcoded in the header —

```jsx
<span>Alex Moreno</span>
<span>1842</span>
```
— [`src/App.jsx:206-207`](../src/App.jsx#L206-L207), and every race lives in a single
browser's `localStorage` under one key:

```js
export const STORAGE_KEY = "raceiq:custom-races";
```
— [`src/utils/storage.js:1`](../src/utils/storage.js#L1).

This blocks three things at once:

1. **No real users.** There is no sign-up, no login, no way for two people to have
   separate race resumes. Clear your browser and your history is gone; open the app on
   your phone and it's empty.
2. **No athlete model.** The engine has no idea who's racing. Fueling, analysis, and
   race plans are all duration-based because there's nowhere to store body weight,
   threshold pace/FTP, or unit preferences —
   [`fueling.js`](../src/utils/fueling.js) and [`racePlan.js`](../src/utils/racePlan.js)
   never read a single athlete attribute today (confirmed: no `weight`/`ftp`/`threshold`
   references exist in either file).
3. **No durable home for data.** Everything is client-only. There's no backend at all,
   so nothing can be personalized, shared, or trusted across devices.

**The insight this design unlocks:** once RaceIQ knows *who* is racing — their body,
their thresholds, their units — the same analysis engine that today says "most often" can
start saying "for *you*." Auth is the enabler; the athlete profile is the payoff.

## 2. Goals / Non-Goals

**Goals**
- Real accounts: sign up, log in, log out. Email/password + at least one OAuth provider.
- A per-user **athlete profile** carrying identity *and* the physiological attributes the
  engine wants: display name, avatar, home units, default sport, body weight, threshold
  pace / FTP, max HR, birth year/sex (for future HR & calorie models).
- Move race storage from a single shared `localStorage` key to **per-user, server-owned**
  data, isolated so no user can read another's races.
- **Migrate existing local data on first login** so nobody who used the prototype loses
  their races.
- Keep the app deployable as a static SPA on Vercel — no self-managed servers.
- Replace the hardcoded "Alex Moreno / 1842" identity with the signed-in user.

**Non-Goals**
- Public/shareable athlete pages, following, or any social graph. (Explicitly deferred —
  see Open Questions.)
- Offline-first bidirectional sync. v1 is server-as-source-of-truth with a one-time
  local import; a local write cache can come later.
- Teams / coach-athlete multi-account relationships.
- Rebuilding the analysis engine to *consume* the new profile fields. This doc **stores**
  them and wires them into context; using body weight in the fueling math is a fast-follow
  (see §9).
- Payments / subscription tiers.

## 3. Current State

| Piece | Where | Behavior |
|---|---|---|
| Identity | [`App.jsx:203-208`](../src/App.jsx#L203-L208) | Hardcoded name + rating in the header |
| Race storage | [`storage.js`](../src/utils/storage.js) | `localStorage`, one shared key, no user scoping |
| Load/save | [`App.jsx:113-127`](../src/App.jsx#L113-L127) | `loadCustomRaces()` on mount, `saveCustomRaces()` on change |
| Race data | [`constants.js:82`](../src/constants.js#L82) `SEED_RACES` + custom races | Merged & sorted client-side |
| Backend | — | **None.** Static Vite build on Vercel (`.vercel/project.json`) |
| Athlete attrs in engine | [`fueling.js`](../src/utils/fueling.js), [`racePlan.js`](../src/utils/racePlan.js) | None — everything is duration/history-based |

Two properties of the current design make this migration cheap:

- **Storage is already async.** `loadCustomRaces`/`saveCustomRaces` return promises
  ([`storage.js:3,13`](../src/utils/storage.js#L3)), even though they wrap synchronous
  `localStorage`. Swapping the body for network calls needs **no signature change** and
  no change to the two `useEffect`s in [`App.jsx`](../src/App.jsx#L113).
- **Races carry a stable `id`** (`custom-…` prefix distinguishes user races from seeds —
  [`App.jsx:245`](../src/App.jsx#L245)), so a row maps cleanly to a DB primary key.

## 4. Chosen Stack

**Supabase** — Postgres + built-in Auth + Row-Level Security (RLS).

Rationale, given this app:
- **Least new code.** Supabase Auth ships hosted sign-up/login, email verification,
  password reset, magic links, and OAuth. We call a client SDK from the SPA; there's no
  server to run, which keeps the Vercel static-deploy model intact.
- **Relational fit.** Race + splits + fueling is relational data with a natural owner.
  Postgres + RLS lets us enforce "a user sees only their own rows" *in the database*,
  not in app code we have to remember to write.
- **Clean migration.** `saveCustomRaces` becomes an upsert; `loadCustomRaces` becomes a
  `select`. The async contract already exists.
- **Cost/ops.** Generous free tier, managed, good Vercel story.

Client dependency: `@supabase/supabase-js`. Config via `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (already gitignored: `.env`, `.env.local`). The anon key is
public by design — RLS is what protects data, so **RLS is not optional.**

## 5. Data Model

### 5.1 `profiles`
One row per user, keyed to the Supabase Auth user id. Created automatically on sign-up
via a Postgres trigger on `auth.users`.

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  -- athlete attributes (all optional; engine degrades gracefully when null)
  units         text default 'metric',      -- 'metric' | 'imperial'
  default_sport text,                        -- one of SPORT_OPTIONS (constants.js)
  weight_kg     numeric,
  threshold_pace_sec_km integer,             -- running: threshold pace, sec/km
  ftp_watts     integer,                     -- cycling: functional threshold power
  max_hr        integer,
  birth_year    integer,
  sex           text,                         -- 'M' | 'F' | 'other' | null
  rating        integer default 1500,        -- replaces hardcoded 1842
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

Notes:
- `units` finally gives the app a real home for the metric/imperial and
  km-per-hr-vs-min-per-km distinction the design already cares about (cycling shows
  km/hr, running shows min/km — see the speed-units convention in
  [`constants.js`](../src/constants.js) `isCyclingSport`).
- `rating` moves the header number off a hardcode. Seed at 1500; the rating engine can
  own it later.
- Every athlete field is nullable. The engine must treat "unknown" as "fall back to the
  current duration-based behavior," so a profile with nothing filled in behaves exactly
  like today.

### 5.2 `races`
One row per race, owned by a user. The JSON shape the app already uses
([`constants.js:82+`](../src/constants.js#L82)) is preserved so components don't change.

```sql
create table races (
  id          text primary key,              -- keep existing 'custom-…' ids
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,
  sport       text,
  date        date,
  data        jsonb not null,                -- full race object: splits, fueling, etc.
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index races_user_id_idx on races(user_id);
```

**Why `jsonb` for the body instead of fully normalized tables?** The race object is
deeply nested (`splits[]`, `fueling{}`, section fueling from the nutrition-by-section
doc) and read/written as a whole unit by the components. Normalizing it now buys us
nothing and forces a schema migration every time the race shape evolves (which it does —
see the section-fueling design). A few promoted top-level columns (`sport`, `date`) cover
the sort/filter the app actually does ([`App.jsx:130`](../src/App.jsx#L130)); the rest
stays in `data`. Revisit if we need server-side per-split queries.

### 5.3 Row-Level Security
```sql
alter table profiles enable row level security;
alter table races    enable row level security;

-- a user reads/writes only their own rows
create policy "own profile"  on profiles for all using (auth.uid() = id);
create policy "own races"    on races    for all using (auth.uid() = user_id)
                                         with check (auth.uid() = user_id);
```
This is the security boundary. The client uses the public anon key; **RLS is what makes
that safe.**

## 6. Auth Flows

| Flow | Mechanism |
|---|---|
| Sign up | Email + password (Supabase `signUp`), with email verification; **+** Google OAuth |
| Log in | `signInWithPassword` / `signInWithOAuth` |
| Session | Supabase stores/refreshes the JWT; SDK exposes `onAuthStateChange` |
| Log out | `signOut`, clear client state |
| Password reset | Supabase hosted reset email → in-app update form |

**Gating:** the app becomes auth-gated. Unauthenticated users see a `SignIn` view; the
rest of the app renders only once a session exists. `SEED_RACES` become **demo data on a
signed-out landing/preview**, not something merged into a real account.

## 7. Data Migration (first login)

The one-time import that preserves prototype data:

1. On first authenticated load, check a per-user flag (`profiles.migrated_local` or a
   `localStorage` sentinel).
2. If unmigrated and local races exist under `raceiq:custom-races`, upsert them into
   `races` with the new `user_id`, keeping their existing `custom-…` ids.
3. Mark migrated; leave the local copy in place (harmless) but stop reading from it.
4. Thereafter the server is the single source of truth.

Idempotent by construction: re-running upserts the same primary keys.

## 8. App Changes

Deliberately small, because the async storage contract already exists.

| File | Change |
|---|---|
| `src/lib/supabase.js` *(new)* | Create and export the Supabase client from env vars |
| `src/context/AuthContext.jsx` *(new)* | Session state, `onAuthStateChange`, `user`, `profile`, `signOut` |
| `src/components/SignIn.jsx` *(new)* | Sign-up / log-in / reset UI, styled with existing `T` tokens + `ui.jsx` |
| `src/components/ProfileForm.jsx` *(new)* | Edit athlete profile fields |
| [`storage.js`](../src/utils/storage.js) | Reimplement `load/saveCustomRaces` as Supabase `select`/`upsert` — **same signatures** |
| [`App.jsx`](../src/App.jsx) | Wrap in `AuthProvider`; gate on session; replace hardcoded identity ([`App.jsx:203-208`](../src/App.jsx#L203-L208)) with `profile`; add a "profile" view + header menu |
| [`constants.js`](../src/constants.js) | Keep `SEED_RACES` but reclass as signed-out demo data |

The two `useEffect`s that drive persistence ([`App.jsx:113-127`](../src/App.jsx#L113-L127))
stay as-is — they already `await` the storage layer.

## 9. Feeding the Profile into the Engine (fast-follow)

Storing athlete attributes is only worth it if the engine reads them. This doc lands the
data; the immediate follow-ups:

- **Units** → thread `profile.units` through pace/speed rendering so imperial users see
  mi/lb, honoring the existing cycling-vs-running speed convention.
- **Body weight** → `personalizeFueling({ ... })`
  ([`fueling.js:87`](../src/utils/fueling.js#L87)) can move from pure duration benchmarks
  toward g-carb-per-kg and ml-per-kg targets.
- **Threshold pace / FTP** → `estimateTargetTime`
  ([`racePlan.js:37`](../src/utils/racePlan.js#L37)) gets a real fitness anchor instead of
  inferring everything from race history.

These are called out so the schema is designed for them now, but they are **separate
PRs** — not in scope for the auth landing.

## 10. Rollout

1. **Schema + RLS** in Supabase; verify policies with two test users (each must be unable
   to read the other's rows).
2. **Read path**: swap `loadCustomRaces` to `select`; app still renders.
3. **Write path**: swap `saveCustomRaces` to `upsert`.
4. **Auth gate + SignIn**; wire `AuthContext`.
5. **Migration** of local → server on first login.
6. **Profile UI**; replace hardcoded identity.
7. Ship. Engine-consumption follow-ups (§9) as their own PRs.

## 11. Open Questions

- **Public profiles / sharing.** Deferred here, but the schema should not preclude it. A
  later `public_slug` + a read policy for `is_public` rows would cover shareable race
  resumes without a rewrite.
- **Rating ownership.** `rating` now lives on `profiles`, but races also carry a
  `rating`/`ratingDelta` ([`constants.js:98`](../src/constants.js#L98)). Which is source
  of truth, and does a rating engine recompute `profiles.rating` from race history?
- **Seed data for new accounts.** Do brand-new users start empty, or do we offer to load
  the demo races as a sandbox they can clear?
- **Imperial threshold input.** Store canonical metric (`threshold_pace_sec_km`,
  `weight_kg`) and convert at the edges — confirm the profile form does the conversion so
  the DB stays single-unit.
- **Email deliverability.** Supabase default SMTP is fine for dev; production needs a
  custom SMTP (e.g. Resend) before real sign-ups.
