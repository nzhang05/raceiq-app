/*
  Best-effort per-user rate limit.

  This is in-memory, so it is per serverless instance — it will not hold a hard
  global ceiling across a scaled-out deployment. It exists to blunt a runaway
  client loop, not to be an authoritative quota. If real quota enforcement is
  needed later, move the counter into Supabase (a `coach_usage` table with an
  RLS policy) and keep this as the cheap first line.
*/

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const hits = new Map(); // userId -> number[] (timestamps)

export function checkRateLimit(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, retryAfter };
  }

  recent.push(now);
  hits.set(userId, recent);

  // Opportunistic cleanup so the map doesn't grow without bound.
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }

  return { ok: true };
}
