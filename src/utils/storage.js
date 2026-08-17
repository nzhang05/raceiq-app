import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

export const STORAGE_KEY = "raceiq:custom-races";

/*
  Race persistence. Two backends behind one async contract (unchanged from the
  pre-auth prototype, so App.jsx's load/save effects don't change):

  - Supabase configured  → per-user rows in the `races` table, isolated by RLS.
  - Not configured       → localStorage (the original prototype path).

  See docs/design-auth-and-profiles.md.
*/

// --- localStorage fallback ---------------------------------------------------
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(races) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(races));
  } catch {
    /* storage unavailable — state still works for this session */
  }
}

// --- Supabase helpers --------------------------------------------------------
async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Map a race object to a `races` row. `data` holds the full object (source of
// truth); name/sport/date are promoted columns for querying/sorting.
function toRow(race, userId) {
  return {
    id: race.id,
    user_id: userId,
    name: race.name ?? null,
    sport: race.sport ?? null,
    date: race.date || null, // '' → null so the `date` column doesn't choke
    data: race,
  };
}

// --- public API --------------------------------------------------------------
export async function loadCustomRaces() {
  if (!isSupabaseConfigured) return loadLocal();

  const uid = await currentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("races")
    .select("data")
    .eq("user_id", uid)
    .order("date", { ascending: false });

  if (error) {
    console.error("loadCustomRaces:", error.message);
    return [];
  }
  return data.map((row) => row.data);
}

export async function saveCustomRaces(races) {
  if (!isSupabaseConfigured) return saveLocal(races);

  const uid = await currentUserId();
  if (!uid) return;

  // Upsert everything currently in state.
  if (races.length) {
    const { error } = await supabase
      .from("races")
      .upsert(races.map((r) => toRow(r, uid)));
    if (error) console.error("saveCustomRaces (upsert):", error.message);
  }

  // Reconcile deletes: remove server rows no longer present locally.
  const { data: existing, error: selErr } = await supabase
    .from("races")
    .select("id")
    .eq("user_id", uid);
  if (selErr) {
    console.error("saveCustomRaces (reconcile):", selErr.message);
    return;
  }
  const present = new Set(races.map((r) => r.id));
  const toDelete = existing.map((r) => r.id).filter((id) => !present.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("races").delete().in("id", toDelete);
    if (error) console.error("saveCustomRaces (delete):", error.message);
  }
}

// One-time import of any localStorage races into the signed-in user's account.
// Idempotent: guarded by `profiles.migrated_local`. Returns the count imported.
export async function migrateLocalRaces() {
  if (!isSupabaseConfigured) return { migrated: 0 };

  const uid = await currentUserId();
  if (!uid) return { migrated: 0 };

  const { data: prof } = await supabase
    .from("profiles")
    .select("migrated_local")
    .eq("id", uid)
    .maybeSingle();
  if (prof?.migrated_local) return { migrated: 0 };

  const local = loadLocal();
  if (local.length) {
    const { error } = await supabase
      .from("races")
      .upsert(local.map((r) => toRow(r, uid)));
    if (error) {
      console.error("migrateLocalRaces:", error.message);
      return { migrated: 0, error };
    }
  }

  await supabase.from("profiles").update({ migrated_local: true }).eq("id", uid);
  return { migrated: local.length };
}
