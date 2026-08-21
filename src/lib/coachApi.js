/*
  Client side of the Claude proxy. The browser never holds an Anthropic key —
  it sends its Supabase access token, and the server spends the key.

  Narrative results (debrief / plan) are cached in localStorage keyed by a hash
  of the deterministic payload, so revisiting a race doesn't re-bill a call.
  Editing the race changes the payload, changes the key, and re-generates.
*/

import { supabase, isSupabaseConfigured } from "./supabase.js";

const ENDPOINT = "/api/claude";
const CACHE_PREFIX = "raceiq:narrative:v1:";
const CACHE_MAX_ENTRIES = 40;

export class CoachApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CoachApiError";
    this.status = status;
  }
}

async function accessToken() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post(payload) {
  const token = await accessToken();
  if (!token) {
    throw new CoachApiError("Sign in to use the AI coach.", 401);
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CoachApiError("Couldn't reach the coach. Check your connection.", 0);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new CoachApiError(body.error || `Request failed (${res.status}).`, res.status);
  }
  return body;
}

export async function askCoach({ question, races, contextRaceId, history, profile }) {
  return post({ task: "coach", question, races, contextRaceId, history, profile });
}

// Returns { estimatedMinutes, reasoning }. Callers fall back to the
// deterministic estimate in racePlan.js when this rejects.
export async function estimateFinishTime({ course, sport, tempC, races, isCycling, profile }) {
  const { estimate } = await post({ task: "estimate", course, sport, tempC, races, isCycling, profile });
  return estimate;
}

// True when the signed-in state allows a Claude-backed call at all — lets a
// caller skip the round trip and go straight to its deterministic path.
export async function canUseClaude() {
  return Boolean(await accessToken());
}

// ---------------------------------------------------------------------------
// Narrative generation, with a content-addressed cache
// ---------------------------------------------------------------------------

// FNV-1a — not cryptographic, just needs to change whenever the payload does.
function hashPayload(value) {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    // Cheap eviction: once over the cap, drop the oldest half by insertion order.
    if (keys.length > CACHE_MAX_ENTRIES) {
      keys.slice(0, keys.length - CACHE_MAX_ENTRIES).forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    /* quota or private mode — the cache is an optimisation, not a requirement */
  }
}

async function narrate(payload, cacheSeed) {
  const key = hashPayload(cacheSeed);
  const cached = readCache(key);
  if (cached) return cached;

  const { narrative } = await post(payload);
  writeCache(key, narrative);
  return narrative;
}

// A one-line fingerprint per race, so the cache key changes when the history
// the analysis was drawn from changes — logging a new race genuinely alters
// what the cross-race findings can say, and should regenerate.
function historyFingerprint(races) {
  return (races || [])
    .map((r) => `${r.id}:${r.finishTime}:${r.verdict}:${r.tempC}:${r.fueling?.carbsPerHr ?? ""}`)
    .sort()
    .join("|");
}

export function narrateDebrief({ race, races, plan, profile }) {
  // Only the inputs the analysis actually reads participate in the key, so a
  // cosmetic edit (renaming a race) doesn't force a regeneration.
  const seed = [
    "debrief:v2", race.id, race.finishTime, race.tempC, race.humidity, race.wind,
    race.distanceKm, race.elevationM, race.splits, race.fueling,
    historyFingerprint(races), plan?.targetClock ?? null,
  ];
  return narrate({ task: "debrief", race, races, plan, profile }, seed);
}

export function narratePlan({ plan, races, profile }) {
  const seed = [
    "plan:v2", plan.course?.name, plan.course?.distanceKm, plan.course?.elevationM,
    plan.targetMinutes, plan.weather?.tempC, plan.nutrition, plan.recommendations,
    historyFingerprint(races),
  ];
  return narrate({ task: "plan", plan, races, profile }, seed);
}
