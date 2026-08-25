/*
  POST /api/claude — the only path from RaceIQ to Claude.

  Everything is behind one endpoint so auth, rate limiting, and error shaping
  live in exactly one place. The `task` field selects the surface:

    task: "coach"    { question, races, contextRaceId?, history?, profile? }
    task: "debrief"  { race, races (history), plan?, profile? }
    task: "plan"     { plan, races (history), profile? }
    task: "estimate" { course, sport, tempC, races, isCycling, profile? }

  The browser sends *data*, never prompt text — see api/_lib/prompts.js.
*/

import { send, readJsonBody } from "./_lib/http.js";
import { authenticate } from "./_lib/auth.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
import { callClaude, callClaudeJson, ClaudeError, isClaudeConfigured } from "./_lib/anthropic.js";
import {
  OOS_INTENTS,
  NARRATIVE_SCHEMA,
  ESTIMATE_SCHEMA,
  buildEstimateSystem,
  buildEstimateContext,
  classifyIntent,
  gatherFor,
  sourceRaceIds,
  buildCoachSystem,
  buildCoachContext,
  buildNarrativeSystem,
  buildDebriefContext,
  buildPlanContext,
  fallbackAnswer,
} from "./_lib/prompts.js";
import { buildDebrief } from "../src/utils/analysis.js";
import { tFor, normalizeLocale } from "../src/i18n/server.js";

const MAX_HISTORY_TURNS = 6;

/*
  Errors go back as a catalog key plus its values, so the browser renders them
  in the athlete's language (see CoachApiError in src/lib/coachApi.js). `error`
  carries the English text too, for logs and for any client that predates this.
*/
function fail(res, status, key, values = {}) {
  return send(res, status, {
    error: tFor("en")(key, { ns: "coach", ...values }),
    errorKey: key,
    errorValues: values,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return fail(res, 405, "errors.methodNotAllowed");
  }

  if (!isClaudeConfigured()) {
    return fail(res, 503, "errors.notConfigured");
  }

  const auth = await authenticate(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });

  const limit = checkRateLimit(auth.user.id);
  if (!limit.ok) {
    res.setHeader("retry-after", String(limit.retryAfter));
    return fail(res, 429, "errors.rateLimited", { seconds: limit.retryAfter });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return fail(res, 400, "errors.malformedBody");
  }

  try {
    switch (body.task) {
      case "coach": return send(res, 200, await handleCoach(body));
      case "debrief": return send(res, 200, await handleNarrative(body, "debrief"));
      case "plan": return send(res, 200, await handleNarrative(body, "plan"));
      case "estimate": return send(res, 200, await handleEstimate(body));
      default: return fail(res, 400, "errors.unknownTask", { task: String(body.task) });
    }
  } catch (err) {
    if (err instanceof ClaudeError) return send(res, err.status, { error: err.message });
    console.error("[api/claude]", err);
    return fail(res, 500, "errors.serverError");
  }
}

async function handleCoach({ question, races = [], contextRaceId = null, history = [], profile = null, locale }) {
  const lng = normalizeLocale(locale);
  if (typeof question !== "string" || !question.trim()) {
    return { error: "Ask a question first." };
  }

  const intent = classifyIntent(question, races, contextRaceId);

  // Medical and training-plan questions are refused deterministically — no
  // reason to spend a token round-trip to say the same sentence.
  if (OOS_INTENTS.has(intent.category)) {
    return { answer: fallbackAnswer(intent, {}, lng), intent: intent.category, sourceRaceIds: [] };
  }

  const contextRace = races.find((r) => r.id === contextRaceId) || null;
  const data = gatherFor(intent, races, contextRace);

  const priorMessages = history
    .filter((m) => m.role === "user" || m.role === "coach")
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role === "coach" ? "assistant" : "user", content: String(m.content) }));

  const { text, usage } = await callClaude({
    system: buildCoachSystem(races, profile, lng),
    messages: [...priorMessages, { role: "user", content: buildCoachContext(intent, data, question, contextRaceId) }],
    effort: "low", // conversational answers; the analysis is already computed
  });

  return {
    answer: text,
    intent: intent.category,
    sourceRaceIds: sourceRaceIds(intent, data),
    usage,
  };
}

async function handleEstimate({ course, sport, tempC, races = [], isCycling = false, profile = null, locale }) {
  if (!course?.distanceKm) return { error: "No course supplied." };
  if (!races.length) return { error: "Select at least one reference race." };

  const { data } = await callClaudeJson({
    system: buildEstimateSystem(profile, normalizeLocale(locale)),
    messages: [{ role: "user", content: buildEstimateContext({ course, sport, tempC, races, isCycling }) }],
    schema: ESTIMATE_SCHEMA,
    effort: "low",
    maxTokens: 4000,
  });

  // The schema guarantees the shape but not that the number is sane; the caller
  // falls back to the deterministic estimate when this rejects.
  if (!(data.estimatedMinutes > 0)) {
    throw new ClaudeError("The estimate came back unusable.", 502);
  }
  return { estimate: data };
}

/*
  Debrief and plan share one analyst and one schema — the difference is whether
  the evidence is a race that happened or a course that hasn't yet.

  Both get the athlete's full history, so cross-race patterns ("third race
  running you've faded above 24°C") are available rather than structurally
  invisible. The debrief also gets the pre-race plan when the caller has one,
  which makes planned-vs-actual an explicit input.
*/
async function handleNarrative(body, kind) {
  const history = Array.isArray(body.races) ? body.races : [];
  let context;

  if (kind === "debrief") {
    const race = body.race;
    if (!race?.splits?.length) return { error: "That race has no splits to analyse." };
    context = buildDebriefContext(race, buildDebrief(race), history, body.plan || null);
  } else {
    const plan = body.plan;
    if (!plan?.course) return { error: "No race plan supplied." };
    context = buildPlanContext(plan, history);
  }

  const { data, usage } = await callClaudeJson({
    system: buildNarrativeSystem(body.profile, normalizeLocale(body.locale)),
    messages: [{ role: "user", content: context }],
    schema: NARRATIVE_SCHEMA,
    // Measured on seed data: "high" costs ~43s and ~2.7k output tokens, "medium"
    // ~26s and ~1.8k for findings of comparable quality — both located the same
    // step change at km 20–25 and the same cross-race heat pattern. Raise this
    // to "high" if debriefs start reading thin.
    effort: "medium",
    maxTokens: 16000,
  });

  return { narrative: data, usage };
}
