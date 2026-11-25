/*
  Client side of the Claude proxy. The browser never holds an Anthropic key —
  it sends its Supabase access token, and the server spends the key.

  Narrative results (debrief / plan) are cached in localStorage keyed by a hash
  of the deterministic payload, so revisiting a race doesn't re-bill a call.
  Editing the race changes the payload, changes the key, and re-generates.
*/

import { supabase, isSupabaseConfigured } from "./supabase.js";
import { isDemo } from "./demo.js";
import { activeLocale } from "../i18n/index.js";

// Only a demo build loads the recordings (src/demo/replay.js); `isDemo` is a
// build-time constant, so a regular build drops this import entirely.
const replay = isDemo ? import("../demo/replay.js") : null;

const ENDPOINT = "/api/claude";
const CACHE_PREFIX = "raceiq:narrative:v1:";
const CACHE_MAX_ENTRIES = 40;

/*
  Carries a `coach` catalog key rather than a sentence — Coach.jsx renders it
  with t(). The server returns its own `errorKey` where it has one; when it
  doesn't, we fall back to a generic key and keep the server's English text in
  `message` for logging.
*/
export class CoachApiError extends Error {
  constructor(key, status, values = {}, message = key) {
    super(message);
    this.name = "CoachApiError";
    this.key = key;
    this.values = values;
    this.status = status;
  }
}

async function accessToken() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post(payload) {
  // The locale rides along on every request: it selects the language Claude
  // answers in and the language of the server's canned fallbacks.
  payload = { ...payload, locale: activeLocale() };
  const token = await accessToken();
  // A demo visitor has no session; the server decides whether its demo budget
  // covers the call (api/_lib/demo.js).
  if (!token && !isDemo) {
    throw new CoachApiError("errors.signedOut", 401);
  }

  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CoachApiError("errors.unreachable", 0);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new CoachApiError(
      body.errorKey || "errors.requestFailed",
      res.status,
      { status: res.status, ...body.errorValues },
      body.error,
    );
  }
  return body;
}

// `suggestion` is the catalog key of a suggested question when the athlete
// clicked one; the demo uses it to find a recorded answer.
export async function askCoach({ question, races, contextRaceId, history, profile, suggestion = null }) {
  if (replay) {
    const recorded = (await replay).replayCoach({ suggestion, races, contextRaceId, locale: activeLocale() });
    if (recorded) return recorded;
  }
  return post({ task: "coach", question, races, contextRaceId, history, profile });
}

// A parsed course carries its full GPS track (up to ~1500 points) so the app can
// draw the course map. None of the prompts read it — they work off distance,
// elevation and the splits — so it's dropped before anything goes over the wire
// rather than shipping tens of KB of coordinates on every call.
function withoutGeometry(course) {
  if (!course) return course;
  const { path, ...rest } = course;
  return rest;
}

// Returns { estimatedMinutes, reasoning }. Callers fall back to the
// deterministic estimate in racePlan.js when this rejects.
export async function estimateFinishTime({ course, sport, tempC, races, isCycling, profile }) {
  const { estimate } = await post({ task: "estimate", course: withoutGeometry(course), sport, tempC, races, isCycling, profile });
  return estimate;
}

// True when the signed-in state allows a Claude-backed call at all — lets a
// caller skip the round trip and go straight to its deterministic path. A demo
// visitor may have a live budget, so the demo always tries.
export async function canUseClaude() {
  return isDemo || Boolean(await accessToken());
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

export async function narrateDebrief({ race, races, plan, profile }) {
  if (replay) {
    const recorded = (await replay).replayDebrief({ race, races, locale: activeLocale() });
    if (recorded) return recorded;
  }
  // Only the inputs the analysis actually reads participate in the key, so a
  // cosmetic edit (renaming a race) doesn't force a regeneration.
  const seed = [
    "debrief:v3", activeLocale(), race.id, race.finishTime, race.tempC, race.humidity, race.wind,
    race.distanceKm, race.elevationM, race.splits, race.fueling,
    historyFingerprint(races), plan?.targetClock ?? null,
  ];
  return narrate({ task: "debrief", race, races, plan, profile }, seed);
}

export function narratePlan({ plan, races, profile }) {
  const seed = [
    "plan:v3", activeLocale(), plan.course?.name, plan.course?.distanceKm, plan.course?.elevationM,
    plan.targetMinutes, plan.weather?.tempC, plan.nutrition, plan.recommendations,
    historyFingerprint(races),
  ];
  return narrate({ task: "plan", plan: { ...plan, course: withoutGeometry(plan.course) }, races, profile }, seed);
}
