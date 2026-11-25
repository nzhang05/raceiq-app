import { createClient } from "@supabase/supabase-js";
import { isDemo } from "./demo.js";

// Config comes from Vite env (.env.local — gitignored):
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
// The anon key is public by design; Row-Level Security is what protects data
// (see supabase/migrations/0001_auth_and_profiles.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True once a Supabase project is wired up. Until then the app keeps running
// on the local prototype path — nothing here throws on import.
//
// A demo build never connects, even with the vars set: a public no-signup link
// must not be able to create accounts or reach the database (src/lib/demo.js).
export const isSupabaseConfigured = Boolean(url && anonKey) && !isDemo;

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
