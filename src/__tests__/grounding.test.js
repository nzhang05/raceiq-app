/*
  The grounding check: RaceIQ's core claim, made testable.

  "Claude narrates numbers the engine computed and never invents them" is
  checked here at the number level. Every AI answer the app can show — the
  demo's recorded answers and fixture answers for awkward races — is run
  through the real server handlers with the Anthropic SDK mocked. The test
  captures the exact request the handler sent, and fails if the answer cites
  any number that request's data did not contain.

  What it proves: no invented, re-rounded or mis-copied numbers.
  What it doesn't: that a real number is attributed to the right thing ("27°C"
  in the data can't be caught being called a humidity). Attribution is what
  the prompts' evidence rules and human review are for.
*/
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { checkGrounding, extractNumbers, dataLinesFromSystem } from "../utils/grounding.js";
import { SEED_RACES } from "../constants.js";
import { FIXTURE_RACES, sectionedRide, mountainUltra } from "../__fixtures__/races/index.js";
import { rideDebrief, ultraCoachFr } from "../__fixtures__/responses.js";
import { resources } from "../i18n/resources.js";

// ---------------------------------------------------------------------------
// The Anthropic SDK, mocked: records each request and answers with whatever
// the test queued. Everything above it — handler, intent routing, data
// gathering, prompt building — is the production code path.
// ---------------------------------------------------------------------------
const sdk = vi.hoisted(() => ({ requests: [], reply: "" }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    constructor() {
      this.beta = {
        messages: {
          create: async (req) => {
            sdk.requests.push(req);
            return { stop_reason: "end_turn", model: req.model, usage: {}, content: [{ type: "text", text: sdk.reply }] };
          },
        },
      };
    }
  }
  for (const name of ["APIError", "AuthenticationError", "PermissionDeniedError", "RateLimitError", "BadRequestError", "APIConnectionError"]) {
    Anthropic[name] = class extends APIError {};
  }
  return { default: Anthropic };
});

const { handleCoach, handleNarrative } = await import("../../api/claude.js");
const { classifyIntent, buildCoachSystem, buildCoachContext, buildDebriefContext, buildPlanContext, gatherFor } = await import("../../api/_lib/prompts.js");
const { buildDebrief } = await import("../utils/analysis.js");

beforeAll(() => { process.env.ANTHROPIC_API_KEY = "test-key-not-real"; });
beforeEach(() => { sdk.requests.length = 0; });

// The data the model saw: the user turn(s) plus the data-bearing lines of the
// system prompt (athlete line, race index) — not the rule list.
function dataSent() {
  const req = sdk.requests.at(-1);
  return [dataLinesFromSystem(req.system[0].text), ...req.messages.map((m) => m.content)];
}

function expectGrounded(answer, locale) {
  const result = checkGrounding({ data: dataSent(), answer, locale });
  expect(result.ungrounded, "numbers not in the data block").toEqual([]);
  expect(result.cited, "an answer with no numbers proves nothing").toBeGreaterThan(0);
}

async function runDebrief(race, races, response, locale = "en") {
  sdk.reply = JSON.stringify(response);
  const { narrative } = await handleNarrative({ race, races, plan: null, profile: null, locale }, "debrief");
  return narrative;
}

async function runCoach(question, races, answer, { locale = "en", contextRaceId = null } = {}) {
  sdk.reply = answer;
  return handleCoach({ question, races, contextRaceId, history: [], profile: null, locale });
}

// ---------------------------------------------------------------------------
describe("the checker", () => {
  const data = "Fade +32.7% · pace 4:25/km → 6:09/km · finish 0:38:42 · 142/1850 · Apr 19, 2026 · race r1";

  it("accepts the same number written differently", () => {
    expect(checkGrounding({ data, answer: "a 32.7% fade, from 4:25 to 6:09/km, in 38:42", locale: "en" }).ok).toBe(true);
    expect(checkGrounding({ data, answer: "une dérive de +32,7 %, 142e sur 1 850", locale: "fr" }).ok).toBe(true);
    expect(checkGrounding({ data, answer: "142nd of 1,850 on April 19, 2026", locale: "en" }).ok).toBe(true);
  });

  it("rejects re-rounding, invention and near misses", () => {
    const r = checkGrounding({ data, answer: "a 33% fade, from 4:25 to 6:10/km, 20 places better", locale: "en" });
    expect(r.ungrounded.map((u) => u.raw)).toEqual(["33", "6:10", "20"]);
  });

  it("never splits a clock into numbers it could match separately", () => {
    // "25" appears only inside "4:25"; it must not ground a bare 25.
    expect(checkGrounding({ data, answer: "you lost 25 seconds", locale: "en" }).ok).toBe(false);
    expect(extractNumbers("4:25/km", "en").map((n) => n.canon)).toEqual(["c:4:25"]);
  });

  it("treats digits glued to a preceding letter as identifiers, not quantities", () => {
    expect(extractNumbers("race r1 on Opus5", "en")).toEqual([]);
    expect(extractNumbers("52g, 98.6th, 9e", "fr").map((n) => n.canon)).toEqual(["n:52", "n:98.6", "n:9"]);
  });

  it("reads the decimal comma only in French", () => {
    expect(extractNumbers("1,850", "en").map((n) => n.canon)).toEqual(["n:1850"]);
    expect(extractNumbers("32,7", "fr").map((n) => n.canon)).toEqual(["n:32.7"]);
  });

  it("checks every string in a structured answer, evidence chips included", () => {
    const r = checkGrounding({ data, answer: { headline: "fine: 32.7%", findings: [{ evidence: ["made up 41%"] }] } });
    expect(r.ungrounded.map((u) => u.raw)).toEqual(["41"]);
  });

  it("keeps the race index but drops the rule list from a system prompt", () => {
    const sys = buildCoachSystem(SEED_RACES, null, "en");
    const kept = dataLinesFromSystem(sys);
    expect(kept).toContain("Brandywine Valley Marathon");
    expect(kept).not.toMatch(/RULES|2–4 sentences/);
  });
});

// ---------------------------------------------------------------------------
describe("the demo's recorded answers are grounded in what production sends", () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../demo/recordings");
  const recordings = readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
  // The order App.jsx passes races to every surface.
  const sample = [...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));

  it("covers four debriefs and four coach questions in both languages", () => {
    expect(recordings).toHaveLength(16);
  });

  it.each(recordings.filter((r) => r.task === "debrief").map((r) => [r.id, r]))("%s", async (_, rec) => {
    const race = sample.find((r) => r.id === rec.raceId);
    const narrative = await runDebrief(race, sample, rec.response, rec.locale);
    expect(narrative.findings).toHaveLength(3);
    expectGrounded(narrative, rec.locale);
  });

  it.each(recordings.filter((r) => r.task === "coach").map((r) => [r.id, r]))("%s", async (_, rec) => {
    // The question is the catalog's current wording, not the stored copy, so a
    // reworded suggestion that routes differently fails here.
    const question = resources[rec.locale].coach.suggested[rec.suggestion];
    expect(rec.question).toBe(question);
    const contexts = rec.contextRaceIds === "any" ? [null, "r3"] : rec.contextRaceIds;
    for (const contextRaceId of contexts) {
      const res = await runCoach(question, sample, rec.response.answer, { locale: rec.locale, contextRaceId });
      expect(res.intent).toBe(rec.response.intent);
      expect(res.sourceRaceIds).toEqual(rec.response.sourceRaceIds);
      expectGrounded(res.answer, rec.locale);
    }
  });
});

// ---------------------------------------------------------------------------
describe("fixture races", () => {
  const races = [...FIXTURE_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));

  it("a debrief that cites only the data passes", async () => {
    const narrative = await runDebrief(sectionedRide, races, rideDebrief.good);
    expectGrounded(narrative, "en");
  });

  it("the same debrief with planted numbers fails on exactly those numbers", async () => {
    const narrative = await runDebrief(sectionedRide, races, rideDebrief.bad);
    const r = checkGrounding({ data: dataSent(), answer: narrative, locale: "en" });
    expect(r.ungrounded.map((u) => u.raw)).toEqual(rideDebrief.planted.map((p) => p.replace(/[^\d.:]/g, "")));
  });

  it("a French coach answer passes, and fails once numbers are altered", async () => {
    const opts = { locale: "fr", contextRaceId: mountainUltra.id };
    const good = await runCoach(ultraCoachFr.question, races, ultraCoachFr.good, opts);
    expect(good.intent).toBe("diagnostic");
    expectGrounded(good.answer, "fr");

    const bad = await runCoach(ultraCoachFr.question, races, ultraCoachFr.bad, opts);
    const r = checkGrounding({ data: dataSent(), answer: bad.answer, locale: "fr" });
    expect(r.ungrounded.map((u) => u.raw.replace(",", "."))).toEqual(ultraCoachFr.planted);
  });
});

// ---------------------------------------------------------------------------
// A number the model can't trust is as bad as one it invents. Every data block
// for every awkward race must be free of template leaks.
describe("data blocks are clean", () => {
  const LEAKS = /undefined|NaN|\bnull|\[object Object\]|Infinity/;
  const all = [...FIXTURE_RACES, ...SEED_RACES];
  const questions = [
    "Why did I slow down?", "Am I improving?", "Which races fit me best?",
    "What should I change before my next race?", "How do I compare to other athletes?",
  ];

  it.each(all.map((r) => [r.name, r]))("debrief: %s", (_, race) => {
    expect(buildDebriefContext(race, buildDebrief(race), all, null)).not.toMatch(LEAKS);
  });

  it.each(all.map((r) => [r.name, r]))("coach, every intent, opened from %s", (_, race) => {
    for (const q of questions) {
      const intent = classifyIntent(q, all, race.id);
      const text = buildCoachSystem(all, null, "en") + buildCoachContext(intent, gatherFor(intent, all, race), q, race.id);
      expect(text, q).not.toMatch(LEAKS);
    }
  });

  it("coach system prompt reads naturally without a profile name", () => {
    const sys = buildCoachSystem(SEED_RACES, null, "en");
    expect(sys).toContain("the athlete's race performance");
    expect(sys).not.toMatch(/\bthere's\b|Address there/);
    expect(buildCoachSystem(SEED_RACES, { display_name: "Noah Zhang" }, "en")).toContain("Address Noah by first name");
  });

  it("plan context renders without leaks", () => {
    const plan = {
      course: { name: "Test 50K", distanceKm: 50, elevationM: 1800 },
      targetClock: "5:30:00",
      nutrition: { carbsPerHr: "80–120g", sodiumMgHr: 600, fluidsMlHr: 650, caffeineMg: 200, sources: { carbs: "history" }, basedOnRaces: 2, notes: [] },
      weather: { tempC: 18, wind: 10, simulated: true },
      recommendations: [],
      referenceRace: SEED_RACES[1],
      pacing: [{ km: 10, label: "CLIMB", gradePct: 6 }, { km: 20, label: "FLAT", gradePct: 0 }],
    };
    expect(buildPlanContext(plan, all)).not.toMatch(LEAKS);
  });
});

// ---------------------------------------------------------------------------
// The checker works on numbers, not meaning. This pins that limit down so
// nobody reads more into a green run than it proves.
describe("what the check does not catch", () => {
  it("a real number attached to the wrong claim still passes", async () => {
    const races = [...FIXTURE_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));
    const misattributed = structuredClone(rideDebrief.good);
    misattributed.recommendations[1].why = "Raising fluids by 12% would have offset most of the heat."; // 12 is the wind speed
    const narrative = await runDebrief(sectionedRide, races, misattributed);
    expect(checkGrounding({ data: dataSent(), answer: narrative }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Intent routing decides what data the model receives — and whether a medical
// question reaches the model at all.
describe("intent routing", () => {
  const races = [{ id: "a", name: "Lakeside Half" }, { id: "b", name: "Ridge Trail 30K" }];
  it.each([
    ["My injury is bothering me, what happened?", "oos_medical"],
    ["Is my tendonitis why I faded?", "oos_medical"],
    ["My knees ached from km 30", "oos_medical"],
    ["J'ai une blessure au genou", "oos_medical"],
    ["Malgré la chaleur, pourquoi ai-je ralenti ?", "diagnostic"],
    ["Can you write me a training plan?", "oos_training"],
    ["Fais-moi un programme pour le marathon", "oos_training"],
    ["Am I improving?", "trend"],
    ["Est-ce que je m'améliore ?", "trend"],
    ["Which races suit me best?", "fit"],
    ["Quelles courses me conviennent ?", "fit"],
    ["How should I prepare for my next race?", "planning"],
    ["Comment me préparer pour la prochaine ?", "planning"],
    ["How do I compare to my age group?", "benchmarking"],
    ["Why did I fade at Ridge Trail?", "diagnostic"],
    ["That was a pretty rough day — why did I bonk?", "diagnostic"],
  ])("%s → %s", (q, intent) => {
    // Opened from a race's debrief, the hardest case: any miss falls through to "diagnostic".
    expect(classifyIntent(q, races, "a").category).toBe(intent);
  });
});

// ---------------------------------------------------------------------------
// Intent routing runs on the raw question, so a translation can silently send
// a French athlete to different data than an English one asking the same thing.
describe("suggested questions route the same in every language", () => {
  it.each(Object.keys(resources.en.coach.suggested))("%s", (key) => {
    const intents = Object.keys(resources).map((lng) =>
      classifyIntent(resources[lng].coach.suggested[key], SEED_RACES, null).category);
    expect(new Set(intents).size, intents.join(" / ")).toBe(1);
  });
});
