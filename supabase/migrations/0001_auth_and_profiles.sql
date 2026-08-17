-- RaceIQ — Auth & Athlete Profiles
-- See docs/design-auth-and-profiles.md
--
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run:
-- every statement is guarded so applying twice is a no-op.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Identity + athlete attributes.
-- All athlete fields are nullable — a blank profile behaves exactly like the
-- pre-auth prototype (engine falls back to duration/history-based behavior).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text,
  avatar_url            text,
  units                 text    not null default 'metric',  -- 'metric' | 'imperial'
  default_sport         text,                               -- one of SPORT_OPTIONS (constants.js)
  weight_kg             numeric,
  threshold_pace_sec_km integer,                            -- running threshold pace, sec/km (canonical metric)
  ftp_watts             integer,                            -- cycling functional threshold power
  max_hr                integer,
  birth_year            integer,
  sex                   text,                               -- 'M' | 'F' | 'other' | null
  rating                integer not null default 1500,      -- replaces the hardcoded 1842 header value
  migrated_local        boolean not null default false,     -- first-login localStorage import guard
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- races: one row per race, owned by a user. The nested race object
-- (splits[], fueling{}, section fueling, …) stays in `data` jsonb so the
-- React components read/write it unchanged; sport/date are promoted for
-- the client-side sort & filter the app already does (App.jsx).
-- ---------------------------------------------------------------------------
create table if not exists public.races (
  id         text primary key,                              -- keep existing 'custom-…' ids
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text,
  sport      text,
  date       date,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists races_user_id_idx on public.races(user_id);

-- ---------------------------------------------------------------------------
-- keep updated_at fresh on any row update
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists races_touch on public.races;
create trigger races_touch before update on public.races
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-Level Security — THE security boundary. The SPA uses the public anon
-- key, so these policies are what keep one user from reading another's data.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.races    enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own races" on public.races;
create policy "own races" on public.races
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
