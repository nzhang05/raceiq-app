/*
  Live-AI budget for the public demo.

  A demo deployment (VITE_DEMO_MODE=true) has no accounts, so the usual gate —
  a verified Supabase session plus a per-user rate limit — has nobody to key
  on. Instead an unauthenticated request is allowed only when the operator has
  explicitly granted a budget, and only within it:

    DEMO_AI_PER_CLIENT_PER_DAY   live calls one visitor may make per rolling 24h
    DEMO_AI_GLOBAL_PER_DAY       live calls the whole deployment may make per UTC day

  Both default to 0, which means the demo never spends a token: the AI surfaces
  replay recorded responses for the sample athlete (src/demo/recordings) and
  anything else falls back to the deterministic engine.

  The counters are in memory, so like rateLimit.js they are per serverless
  instance — a cold start resets them and parallel instances each keep their
  own. They bound a runaway visitor; they are not a hard spend ceiling. The
  ceiling is a dedicated Anthropic API key in a workspace with a monthly spend
  limit (docs/deploy.md). Move these counters to a shared store (Vercel KV /
  Upstash) if the demo ever needs an exact global cap.
*/

import { createHash } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

// Requests from the demo are sample-sized. Anything far larger is not the demo
// UI talking, so refuse it before it reaches a prompt.
export const DEMO_LIMITS = {
  maxBodyChars: 200_000,
  maxQuestionChars: 500,
  maxRaces: 25,
};

function nonNegativeInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function demoConfig(env = process.env) {
  const enabled = env.VITE_DEMO_MODE === "true";
  const perClient = nonNegativeInt(env.DEMO_AI_PER_CLIENT_PER_DAY);
  const global = nonNegativeInt(env.DEMO_AI_GLOBAL_PER_DAY);
  return { enabled, perClient, global, live: enabled && perClient > 0 && global > 0 };
}

// The visitor's address, hashed: it is only ever a counter key, so there is no
// reason to hold the raw IP even in memory. Vercel sets x-real-ip; the first
// x-forwarded-for hop covers other proxies and the Vite dev server.
export function clientKey(req) {
  const headers = req.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = headers["x-real-ip"] || forwarded || req.socket?.remoteAddress || "unknown";
  return createHash("sha256").update(`raceiq-demo:${ip}`).digest("hex").slice(0, 32);
}

/*
  A small stateful budget. `createDemoBudget()` returns a fresh one so tests do
  not share counters with each other or with the module-level instance below.
*/
export function createDemoBudget() {
  const perClientHits = new Map(); // key -> number[] (timestamps)
  let globalDay = null;
  let globalCount = 0;

  return function check(key, { perClient, global }, now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== globalDay) {
      globalDay = day;
      globalCount = 0;
    }

    if (globalCount >= global) {
      const nextUtcMidnight = Date.parse(`${day}T00:00:00Z`) + DAY_MS;
      return { ok: false, reason: "global", retryAfter: Math.ceil((nextUtcMidnight - now) / 1000) };
    }

    const recent = (perClientHits.get(key) || []).filter((t) => now - t < DAY_MS);
    if (recent.length >= perClient) {
      perClientHits.set(key, recent);
      return { ok: false, reason: "client", retryAfter: Math.ceil((DAY_MS - (now - recent[0])) / 1000) };
    }

    recent.push(now);
    perClientHits.set(key, recent);
    globalCount++;

    if (perClientHits.size > 5000) {
      for (const [k, times] of perClientHits) {
        if (!times.some((t) => now - t < DAY_MS)) perClientHits.delete(k);
      }
    }
    return { ok: true, remaining: perClient - recent.length };
  };
}

export const checkDemoBudget = createDemoBudget();

// Shape checks for an unauthenticated demo request. Returns a catalog key on
// failure, null when the body is acceptable.
export function demoBodyProblem(body) {
  if (JSON.stringify(body ?? {}).length > DEMO_LIMITS.maxBodyChars) return "errors.malformedBody";
  if (Array.isArray(body?.races) && body.races.length > DEMO_LIMITS.maxRaces) return "errors.malformedBody";
  if (typeof body?.question === "string" && body.question.length > DEMO_LIMITS.maxQuestionChars) {
    return "errors.questionTooLong";
  }
  return null;
}
