/*
  Prompt construction for every Claude-backed surface. This lives server-side on
  purpose: the browser sends race data, never prompt text, so a client can't
  rewrite the system prompt or the grounding rules.

  It reuses the same deterministic analysis the UI renders (`src/utils/*`) —
  Claude's job on every surface is to *narrate and prioritise* numbers the
  engine already computed, never to produce new ones.
*/

import { fmtDate, parseClockToMinutes } from "../../src/utils/time.js";
import { fmtPace } from "../../src/utils/pace.js";
import { analyzeSplits } from "../../src/utils/ratings.js";
import { fuelingBenchmarks } from "../../src/utils/fueling.js";
import { tFor } from "../../src/i18n/server.js";
import { findingText, recText } from "../../src/i18n/render.js";
import {
  buildDebrief,
  gatherDiagnosticData,
  gatherTrendData,
  gatherFitData,
  gatherLimiterPatterns,
} from "../../src/utils/analysis.js";

export const OOS_INTENTS = new Set(["oos_medical", "oos_training"]);

/*
  Appended to every system prompt so Claude answers in the athlete's language.
  The DATA block stays English on purpose: it is structured data, and
  translating its field labels only degrades grounding.
*/
function languageDirective(locale) {
  return `\n\nLANGUAGE\n${tFor(locale)("systemDirective", { ns: "coach" })}`;
}

const GROUNDING_RULES = `RULES:
1. Only cite numbers present in the DATA block. Never invent or extrapolate a statistic.
2. Name which race every substantive claim comes from.
3. Pain, injury, or medical symptoms: decline clearly and point to a sports medicine professional.
4. Requests for a training plan or weekly program: decline — you analyse races, you don't write plans.
5. If the data is insufficient, say so plainly. Never infer a trend from one data point.`;

// ---------------------------------------------------------------------------
// Athlete profile — collected in ProfileForm and previously unused by analysis.
// Everything here is optional, so emit only the fields that are actually set.
// ---------------------------------------------------------------------------
function profileBlock(profile) {
  if (!profile) return "";
  const bits = [];
  if (profile.weight_kg) bits.push(`${profile.weight_kg} kg`);
  if (profile.birth_year) bits.push(`born ${profile.birth_year}`);
  if (profile.sex) bits.push(profile.sex);
  if (profile.threshold_pace_sec_km) {
    const s = Math.round(profile.threshold_pace_sec_km);
    bits.push(`threshold pace ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`);
  }
  if (profile.ftp_watts) bits.push(`FTP ${profile.ftp_watts} W`);
  if (profile.max_hr) bits.push(`max HR ${profile.max_hr} bpm`);
  return bits.length ? `\nATHLETE PROFILE: ${bits.join(" · ")}\n` : "";
}

// null when there is no name to use — the demo's sample athlete, or a profile
// without a display name. Callers phrase around it rather than splicing a
// placeholder like "there" into "there's race performance".
function athleteFirstName(profile) {
  const name = (profile?.display_name || "").trim();
  return name ? name.split(/\s+/)[0] : null;
}

// ---------------------------------------------------------------------------
// Intent routing
// ---------------------------------------------------------------------------
/*
  Keyword routing runs on the raw question, so every pattern needs its French
  equivalents alongside the English ones. The first two are the out-of-scope
  guards: without the French terms a question about knee pain asked in French
  would fall through to the analyst path instead of the medical referral.
  Accents are stripped first so "blessé"/"blesse" and "côté"/"cote" both match.
*/
// Each pattern is anchored at a word start. Entries ending in \w* are stems and
// match their inflections ("injur\w*" → injury, injured; "improv\w*" →
// improving). The rest are whole words, kept exact where a prefix would
// misfire: "mal" must not match "malgré", "prepa" (training block) must not
// swallow "préparer" (planning). These used to be wrapped in \b(...)\b, which
// made every stem unmatchable — "my injury" skipped the medical referral and
// "am I improving?" never reached the trend path. See the routing table in
// src/__tests__/grounding.test.js.
const OOS_MEDICAL = /\b(?:pain\w*|hurt\w*|aches?|aching|injur\w*|knees?|ankles?|shins?|tendon\w*|blisters?|medical|doctors?|physio\w*|cramp\w*|douleurs?|mal|blessur\w*|blesse\w*|genoux?|chevilles?|tibias?|ampoules?|medecins?|kine\w*|courbatures?|entorses?)\b/;
const OOS_TRAINING = /\b(?:training plans?|workout plans?|program\w*|weekly plans?|base building|periodi[sz]ation|plans? d.?entrainement|seances?|planification|semaine type|prepa)\b/;
// "mieux" alone is "better" (a trend question), but "le mieux" is "best" — the
// French for "which races fit me best?" must route to FIT like the English does.
const TREND = /\b(?:improv\w*|trend\w*|better|faster|progress\w*|getting|how has|over time|this year|seasons?|amelior\w*|(?<!le )mieux|plus vite|tendances?|evolution|au fil|cette annee|saisons?)\b/;
const FIT = /\b(?:fits?|which races?|best races?|suited|which courses?|should i do|trail or road|road or trail|types? of races?|best at|excels?|excelle\w*|convien\w*|quelles? courses?|quels types de courses?|meilleures? courses?|adapte\w*|quels? parcours|types? de courses?|points? forts?)\b/;
const PLANNING = /\b(?:next|prepar\w*|change|before|upcoming|should i|ready|goal race|what to|how to improve|prochain\w*|changer|avant|a venir|dois.?je|pret(?:e|s|es)?|course objectif|comment m.?ameliorer)\b/;
const BENCHMARKING = /\b(?:compar\w*|similar athletes?|how do i rank|versus|vs|peers?|age groups?|cohorts?|other athletes?|classe\w*|me situe|par rapport|categories?|autres athletes)\b/;
const DIAGNOSTIC = /\b(?:bonk\w*|what went wrong|why did|this race|faded|died|collapsed|blew up|slowed|second half|late|explos\w*|fringale|mur|qu.?est.?ce qui|pourquoi|cette course|craque\w*|ralenti\w*|seconde moitie|deuxieme moitie|fin de course)\b/;
const SPORT_HINTS = [
  "road running", "trail running", "gravel cycling", "marathon", "trail", "ultra",
  "course sur route", "sur route", "cyclisme", "gravel", "velo",
];

// Lowercase and strip diacritics so the French patterns above can stay unaccented.
function normalizeQuestion(question) {
  return (question || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function classifyIntent(question, races, contextRaceId) {
  const q = normalizeQuestion(question);

  if (OOS_MEDICAL.test(q)) {
    return { category: "oos_medical" };
  }
  if (OOS_TRAINING.test(q)) {
    return { category: "oos_training" };
  }
  if (TREND.test(q)) {
    const sportHint = SPORT_HINTS.find((s) => q.includes(s));
    return { category: "trend", sportFilter: sportHint || null };
  }
  if (FIT.test(q)) {
    return { category: "fit" };
  }
  if (PLANNING.test(q)) {
    return { category: "planning" };
  }
  if (BENCHMARKING.test(q)) {
    return { category: "benchmarking" };
  }
  if (DIAGNOSTIC.test(q) || contextRaceId) {
    let raceId = contextRaceId;
    if (!raceId) {
      const matched = races.find((r) => {
        const name = normalizeQuestion(r.name);
        return q.includes(name) || name.split(" ").some((w) => w.length > 4 && q.includes(w));
      });
      raceId = matched?.id || races[0]?.id;
    }
    return { category: "diagnostic", raceId };
  }
  if (races.length >= 2) return { category: "trend", sportFilter: null };
  return { category: "diagnostic", raceId: races[0]?.id };
}

export function gatherFor(intent, races, contextRace) {
  switch (intent.category) {
    case "diagnostic": {
      const race = races.find((r) => r.id === intent.raceId) || contextRace || races[0];
      return race ? gatherDiagnosticData(race) : { race: null };
    }
    case "trend":
      return gatherTrendData(races, intent.sportFilter);
    case "fit":
      return gatherFitData(races);
    case "planning":
      return gatherLimiterPatterns(races);
    default:
      return { races };
  }
}

export function sourceRaceIds(intent, data) {
  if (OOS_INTENTS.has(intent.category)) return [];
  switch (intent.category) {
    case "diagnostic": return data.race ? [data.race.id] : [];
    case "trend": return (data.filtered || []).map((r) => r.id);
    case "fit":
    case "planning":
    case "benchmarking": return (data.races || []).map((r) => r.id);
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Coach chat
// ---------------------------------------------------------------------------
export function buildCoachSystem(races, profile, locale = "en") {
  const name = athleteFirstName(profile);
  const subject = name ? `${name}'s` : "the athlete's";
  const sports = [...new Set(races.map((r) => r.sport))].join(", ") || "none";
  const sorted = [...races].sort((a, b) => new Date(a.date) - new Date(b.date));
  const range = races.length >= 2
    ? `${fmtDate(sorted[0].date)} – ${fmtDate(sorted[sorted.length - 1].date)}`
    : races.length === 1 ? fmtDate(sorted[0].date) : "no races logged";

  return `You are RaceIQ's AI Coach — a race intelligence system for endurance athletes. You answer questions about ${subject} race performance using only the structured data provided with each question. You never invent splits, times, percentiles, or comparisons.

ATHLETE: ${name ?? "(no name on file)"} · ${races.length} races logged (${sports}) · ${range}
${profileBlock(profile)}
${GROUNDING_RULES}
6. Be conversational and precise. ${name ? `Address ${name} by first name.` : "Address the athlete as \"you\"; there is no name on file."} Avoid bullet lists unless summarising 3+ races.
7. Aim for 2–4 sentences on simple questions, up to 3 focused paragraphs for trend or fit analysis.
8. If the question references a debrief the athlete has already seen, refer to it ("the same pattern the debrief flagged") rather than restating it verbatim.

RACE INDEX (oldest first):
${sorted.map((r) => `  ${r.id} · ${fmtDate(r.date)} · ${r.name} · ${r.sport} · ${r.distanceKm}km`).join("\n") || "  (none)"}${languageDirective(locale)}`;
}

export function buildCoachContext(intent, data, question, contextRaceId) {
  let ctx = `QUESTION: ${question}\n\n`;

  switch (intent.category) {
    case "diagnostic": {
      if (!data.race) { ctx += "DATA: No matching race found.\n"; break; }
      const {
        race, durationMin, drift, hot, fuelingGap, fuelRange, fuelLow,
        needsCarbs, firstPace, lastPace, turnKm, limiters, strengths,
      } = data;
      ctx += `DATA FOR THIS RACE:\n`;
      ctx += `Race: ${race.name} (${fmtDate(race.date)})\n`;
      ctx += `Sport: ${race.sport} · ${race.distanceKm}km · +${race.elevationM}m · ${race.surface}\n`;
      ctx += `Finish: ${race.finishTime} (${durationMin} min) · Place: ${race.placement}/${race.field} (${race.percentile}th percentile)\n`;
      ctx += `RaceIQ Score: ${race.rating} (${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta})\n`;
      ctx += `Conditions: ${race.tempC}°C, ${race.humidity}% humidity, ${race.wind}km/h wind${hot ? " — HEAT STRESS (≥24°C)" : ""}\n`;
      ctx += `Pace: first split ${firstPace} → last split ${lastPace} (${drift > 0 ? "+" : ""}${drift}% drift${race.usesGap ? ", grade-adjusted" : ""})\n`;
      if (turnKm) ctx += `Largest pace drop: at km ${turnKm}\n`;
      ctx += `Verdict: ${race.verdict.toUpperCase()}\n`;
      if (needsCarbs && race.fueling?.carbsPerHr != null) {
        ctx += `Fueling: ${race.fueling.carbsPerHr}g carbs/hr (target for ${durationMin}-min effort: ${fuelRange}`;
        ctx += fuelingGap != null && fuelingGap < 0 ? `; ${Math.abs(fuelingGap)}g/hr below minimum)\n` : "; within range)\n";
        const extras = [
          race.fueling.sodiumPerHr != null && `Sodium: ${race.fueling.sodiumPerHr}mg/hr`,
          race.fueling.fluidsPerHr != null && `Fluids: ${race.fueling.fluidsPerHr}ml/hr`,
          race.fueling.caffeine != null && `Caffeine: ${race.fueling.caffeine}mg`,
        ].filter(Boolean);
        if (extras.length) ctx += `${extras.join(" · ")}\n`;
        if (race.fueling.inputMode === "sections" && race.fueling.sections?.length) {
          ctx += `Fueling by section:\n`;
          for (const s of race.fueling.sections) {
            const flag = s.carbsPerHr < fuelLow ? "  ⚠ below range" : "";
            ctx += `  ${s.fromKm}–${s.toKm}km: ${s.carbsPerHr}g carbs/hr, ${s.sodiumPerHr}mg Na/hr, ${s.fluidsPerHr}ml/hr${flag}\n`;
          }
        }
      }
      if (strengths.length) ctx += `\nSTRENGTHS: ${strengths.map((f) => findingText(EN, f).title).join("; ")}\n`;
      if (limiters.length) ctx += `LIMITERS: ${limiters.map((f) => findingText(EN, f).title).join("; ")}\n`;
      if (contextRaceId === race.id) {
        ctx += `\nThis race's debrief is already loaded — reference findings conversationally, don't re-deliver them verbatim.\n`;
      }
      break;
    }

    case "trend": {
      const {
        filtered, insufficient, ratingTrend, percentileTrend,
        strengthCount, limiterCount, firstRating, lastRating, firstPct, lastPct,
      } = data;
      if (insufficient) {
        ctx += `DATA: Only ${filtered.length} race(s) match — at least 2 are needed for a trend. Tell the athlete clearly.\n`;
        break;
      }
      ctx += `TREND DATA (${filtered.length} races, oldest→newest):\n`;
      for (const r of filtered) {
        ctx += `  ${fmtDate(r.date)} · ${r.name}: ${r.percentile}th pct, RaceIQ ${r.rating} [${r.verdict}], ${r.tempC}°C, ${r.distanceKm}km, ${r.surface}\n`;
      }
      ctx += `\nSUMMARY:\n`;
      ctx += `RaceIQ Score: ${firstRating} → ${lastRating} (${ratingTrend >= 0 ? "+" : ""}${ratingTrend})\n`;
      ctx += `Percentile: ${firstPct}th → ${lastPct}th (${percentileTrend >= 0 ? "+" : ""}${percentileTrend} pts)\n`;
      ctx += `Verdicts: ${strengthCount} strength / ${limiterCount} limiter / ${filtered.length - strengthCount - limiterCount} mixed\n`;
      ctx += `\nIMPORTANT: Account for course and weather variation. Don't equate faster raw times with improved fitness if conditions or course difficulty differ.\n`;
      break;
    }

    case "fit": {
      // gatherFitData returns { insufficient: true } alone below 2 races — the
      // other fields don't exist, so this guard has to come first.
      if (data.insufficient) {
        ctx += `DATA: Fewer than 2 races logged — not enough to identify which race types suit this athlete. Say so plainly.\n`;
        break;
      }
      const { byVerdict, avgStrengthTemp, avgLimiterTemp, sportVerdicts, topRaces, races } = data;
      ctx += `RACE FIT DATA (${races.length} races total):\n`;
      ctx += `Top 3 by percentile:\n`;
      for (const r of topRaces) {
        ctx += `  ${r.name}: ${r.percentile}th pct [${r.verdict}], ${r.tempC}°C, ${r.surface}, ${r.distanceKm}km\n`;
      }
      const list = (arr) => arr.map((r) => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none";
      ctx += `Strengths (${byVerdict.strength.length}): ${list(byVerdict.strength)}\n`;
      ctx += `Limiters (${byVerdict.limiter.length}): ${list(byVerdict.limiter)}\n`;
      ctx += `Mixed (${byVerdict.mixed.length}): ${list(byVerdict.mixed)}\n`;
      if (avgStrengthTemp != null) ctx += `Avg temp on strength races: ${avgStrengthTemp}°C\n`;
      if (avgLimiterTemp != null) ctx += `Avg temp on limiter races: ${avgLimiterTemp}°C\n`;
      ctx += `Sport breakdown: ${Object.entries(sportVerdicts).map(([s, v]) => `${s}: ${v.count} races (${v.strength}S/${v.limiter}L/${v.mixed}M)`).join("; ")}\n`;
      break;
    }

    case "planning": {
      const { races, hotLimiters, underFueled, coolStrengths } = data;
      ctx += `HISTORICAL PATTERNS (${races.length} races):\n`;
      if (hotLimiters.length) ctx += `Heat-driven limiters (≥24°C): ${hotLimiters.map((r) => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      if (underFueled.length) ctx += `Under-fueling limiters: ${underFueled.map((r) => `${r.name} (${r.fueling.carbsPerHr}g/hr)`).join(", ")}\n`;
      if (coolStrengths.length) ctx += `Cool-condition strengths (≤14°C): ${coolStrengths.map((r) => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      ctx += `No upcoming race is logged yet. Answer from historical limiter patterns and suggest logging the upcoming race for a more specific answer.\n`;
      break;
    }

    case "benchmarking": {
      ctx += `PERCENTILE DATA (${data.races.length} races):\n`;
      for (const r of data.races) {
        ctx += `  ${r.name}: ${r.percentile}th pct of ${r.field} finishers · ${r.sport}\n`;
      }
      ctx += `Full cohort benchmarking (age/sex-matched) is not implemented. Answer from available percentile data and note the limitation.\n`;
      break;
    }
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Race analysis — Claude does the analysis itself.
//
// It receives the raw evidence (every split, the fueling log, the conditions),
// the athlete's other races so cross-race patterns are visible, the pre-race
// plan when one exists, and a block of DERIVED METRICS the deterministic engine
// computed. Those metrics matter: least-squares drift over 40 splits and
// duration-banded carb ranges are arithmetic, and arithmetic is the one thing
// a language model should not be doing by hand here. It reasons; the engine
// supplies the numbers it reasons over.
//
// Groundedness is enforced by requiring every finding to cite the specific
// data points it rests on, not by forbidding new findings.
// ---------------------------------------------------------------------------
export const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One sentence naming the single biggest driver of this result.",
    },
    findings: {
      type: "array",
      // Exactly three. The debrief renders them as a fixed row of three cards,
      // so the count is a layout contract, not a preference. See the matching
      // directive in buildNarrativeSystem() and toThreeFindings() on the client,
      // which holds the same guarantee for the rule-engine path.
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["strength", "limiter"] },
          title: { type: "string" },
          body: { type: "string" },
          evidence: {
            type: "array",
            // Two chips is what a third-width card fits without wrapping to a
            // third line — especially in French, which runs ~20% longer.
            maxItems: 2,
            description: "The one or two most important data points this rests on, quoted from the DATA block — e.g. 'km 22–32: 5:12→5:48/km', 'carbs 31g/hr vs 60–90 target', 'Ridgeline 2025 fade 11% at 26°C'. Each must be checkable against the supplied data.",
            items: { type: "string" },
          },
        },
        required: ["kind", "title", "body", "evidence"],
        additionalProperties: false,
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", description: "Imperative, specific, one line." },
          why: { type: "string", description: "The evidence that motivates it, in one sentence." },
          evidence: {
            type: "array",
            description: "Data points supporting this recommendation, same rules as findings.",
            items: { type: "string" },
          },
        },
        required: ["action", "why", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "findings", "recommendations"],
  additionalProperties: false,
};

export function buildNarrativeSystem(profile, locale = "en") {
  return `You are RaceIQ's race analyst. You explain why ${athleteFirstName(profile) ?? "the athlete"} performed the way they did on race day, working from the athlete's own data.

You are given, for the race in question: every split, the fueling log, the conditions, the result — plus DERIVED METRICS already computed for you, this athlete's other races, and the pre-race plan when one exists. Analyse it yourself. Find what is actually there.

${GROUNDING_RULES}
${profileBlock(profile)}
WHAT TO LOOK FOR — this is not a checklist to work through, it is a reminder of what the data can support. Follow the evidence:
- The shape of the pace curve, not just its slope: a steady bleed, a single cliff at one km, a surge-then-collapse, and a negative split all mean different things.
- Conditions beyond temperature. Humidity changes what a given temperature costs. Wind matters most in cycling and on exposed courses. A rising temperature curve during the race is different from a hot start.
- Fueling as a time series, not a single average: where carbs, fluids, and sodium went in relative to where the pace changed.
- Terrain: how climbs and descents were ridden or run relative to the flats, using grade-adjusted pace where it is supplied.
- Cross-race patterns. This is often the most valuable thing you can say: a limiter that has now appeared three races running is a different message from a one-off. Only claim a pattern when the supplied history actually shows it.
- The plan versus what happened, when a plan is supplied. Where execution diverged from target is directly actionable.

HARD CONSTRAINTS:
- Every number you write must be present in the DATA block or in DERIVED METRICS. Do not compute new percentages, averages, or paces yourself, and do not re-round the ones supplied.
- Every finding and recommendation must carry evidence entries quoting the specific data points behind it. If you cannot cite it, do not claim it.
- Correlation within a single race is not proof of cause. Say "tracks with" or "coincides with" unless the pattern repeats across races or the mechanism is unambiguous.
- Absence of data is not evidence. RaceIQ holds no training, sleep, or HR data — never infer fitness, fatigue, or overtraining. If the most likely explanation is something you cannot see, say so plainly rather than blaming what you can see.
- Return exactly three findings, ordered by impact on the result, most consequential first. They are displayed side by side, so the first is the one that mattered most.
- Where the data supports fewer than three causal claims, an observation about what the data rules out, or about what it cannot show, is a valid finding provided it is evidenced. Never invent a mechanism to fill a slot, and never restate one finding as two.
- Order recommendations by impact too, most consequential first.
- Write in second person, plain and specific. No hedging, no filler, no motivational language.
- Each finding body is ONE sentence, under about 110 characters — it has to fit a narrow card. Each recommendation "why" is one sentence.${languageDirective(locale)}`;
}

// Compact split table. Only emits columns that carry data, so a flat road race
// doesn't spend tokens on empty grade and temperature columns.
function splitsTable(race) {
  const splits = race.splits ?? [];
  if (!splits.length) return "No splits recorded for this race.\n";

  const hasGap = splits.some((s) => s.gapPace != null);
  const hasGrade = splits.some((s) => s.gradePct != null);
  const hasTemp = splits.some((s) => s.tempC != null);

  // Column widths match the padStart() calls below so the header lines up with
  // the rows — a table the model can read down cleanly.
  const header = [
    "km".padStart(5),
    "pace".padStart(7),
    hasGap && "gap-adj".padStart(7),
    hasGrade && "grade".padStart(6),
    hasTemp && "temp".padStart(5),
  ].filter(Boolean).join("  ");
  const rows = splits.map((s) => [
    String(s.km).padStart(5),
    fmtPace(s.pace).padStart(7),
    hasGap && (s.gapPace != null ? fmtPace(s.gapPace) : "—").padStart(7),
    hasGrade && (s.gradePct != null ? `${s.gradePct > 0 ? "+" : ""}${s.gradePct.toFixed(1)}%` : "—").padStart(6),
    hasTemp && (s.tempC != null ? `${s.tempC}°C` : "—").padStart(5),
  ].filter((v) => v !== false).join("  "));

  return `${header}\n${rows.join("\n")}\n`;
}

function derivedMetrics(race) {
  const m = analyzeSplits(race.splits, race.sport);
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));
  const lines = [`Duration: ${durationMin} min`];

  if (m) {
    lines.push(
      `Pace basis: ${m.useGap ? "grade-adjusted (course has elevation data)" : "raw pace"}`,
      `Opening third avg: ${fmtPace(m.firstAvg)} · closing third avg: ${fmtPace(m.lastAvg)}`,
      `Fade (last third vs first third): ${m.fadePct >= 0 ? "+" : ""}${m.fadePct.toFixed(1)}%`,
      `Full-series drift (least-squares slope across all splits): ${m.driftPct >= 0 ? "+" : ""}${m.driftPct.toFixed(1)}%`,
      `Split-to-split variation (coefficient of variation): ${m.cvPct.toFixed(1)}%`,
    );
  } else {
    lines.push("Too few splits to compute pacing metrics.");
  }

  lines.push(
    fuel.needsCarbs
      ? `Carbohydrate target for this duration: ${fuel.carbsLabel}. ${EN(`plan:${fuel.rationaleKey}`)}`
      : `Carbohydrate: ${EN(`plan:${fuel.rationaleKey}`)}`,
  );
  return lines.map((l) => `  ${l}`).join("\n");
}

// One line per past race, with each one's own computed pacing and fuel numbers
// so cross-race claims have something concrete to cite.
function historyBlock(race, history) {
  const others = (history || [])
    .filter((r) => r.id !== race.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!others.length) return "  No other races logged for this athlete.\n";

  return others.map((r) => {
    const m = analyzeSplits(r.splits, r.sport);
    const fuel = fuelingBenchmarks(r.finishTime);
    const bits = [
      `${fmtDate(r.date)} · ${r.name}`,
      `${r.sport}, ${r.distanceKm}km +${r.elevationM ?? 0}m`,
      `${r.finishTime} (${r.percentile}th pct) [${r.verdict}]`,
      `${r.tempC}°C${r.humidity != null ? `/${r.humidity}%rh` : ""}${r.wind != null ? `, ${r.wind}km/h wind` : ""}`,
    ];
    if (m) bits.push(`fade ${m.fadePct >= 0 ? "+" : ""}${m.fadePct.toFixed(1)}%, cv ${m.cvPct.toFixed(1)}%`);
    if (fuel.needsCarbs && r.fueling?.carbsPerHr != null) {
      bits.push(`${r.fueling.carbsPerHr}g/hr carbs (target ${fuel.carbsLabel})`);
    }
    return `  ${bits.join(" · ")}`;
  }).join("\n") + "\n";
}

// "52g/hr carbs · 280mg/hr sodium", skipping fields that weren't logged. A
// hand-entered race can carry nulls, which would otherwise reach the model as
// "nullg/hr carbs".
function fuelParts(f, { caffeine = true } = {}) {
  const parts = [];
  if (f?.carbsPerHr != null) parts.push(`${f.carbsPerHr}g/hr carbs`);
  if (f?.sodiumPerHr != null) parts.push(`${f.sodiumPerHr}mg/hr sodium`);
  if (f?.fluidsPerHr != null) parts.push(`${f.fluidsPerHr}ml/hr fluid`);
  if (caffeine && f?.caffeine != null) parts.push(`${f.caffeine}mg caffeine total`);
  return parts;
}

function fuelingBlock(race) {
  const f = race.fueling;
  if (!f || !fuelParts(f).length && !f.sections?.length) return "  No fueling logged for this race.\n";

  if (f.inputMode === "sections" && f.sections?.length) {
    const rows = f.sections.map((s) =>
      `  km ${s.fromKm}–${s.toKm}: ${s.carbsPerHr}g/hr carbs · ${s.sodiumPerHr}mg/hr sodium · ${s.fluidsPerHr}ml/hr fluid`
    ).join("\n");
    const avg = [f.carbsPerHr != null && `${f.carbsPerHr}g/hr carbs`, f.caffeine != null && `${f.caffeine}mg caffeine total`].filter(Boolean);
    return `${rows}\n${avg.length ? `  Race average: ${avg.join(" · ")}\n` : ""}`;
  }
  return `  ${fuelParts(f).join(" · ")}\n`;
}

// The deterministic engine's own output, supplied as a floor rather than an
// answer — it encodes rules worth not missing, but it only knows six patterns.
//
// buildDebrief() returns { key, values }, so the sentences are rendered here.
// Deliberately in English: this is grounding context for the model, which
// answers in the athlete's language via the LANGUAGE directive.
const EN = tFor("en");
function engineBlock(debrief) {
  const all = [
    ...debrief.strengths.map((f) => { const x = findingText(EN, f); return `[strength] ${x.title}: ${x.body}`; }),
    ...debrief.limiters.map((f) => { const x = findingText(EN, f); return `[limiter] ${x.title}: ${x.body}`; }),
    ...debrief.recs.map((r) => { const x = recText(EN, r); return `[rec] ${x.action}: ${x.why}`; }),
  ];
  if (!all.length) return "  (the rule engine found nothing it recognises)\n";
  return all.map((l) => `  ${l}`).join("\n") + "\n";
}

function planBlock(plan) {
  if (!plan?.course) return null;
  const lines = [
    `  Target finish: ${plan.targetClock}`,
    `  Planned fueling: ${plan.nutrition?.carbsPerHr} carbs/hr · ${plan.nutrition?.sodiumMgHr}mg/hr sodium · ${plan.nutrition?.fluidsMlHr}ml/hr fluid`,
  ];
  if (plan.weather?.tempC != null) {
    lines.push(`  Forecast at planning time: ${plan.weather.tempC}°C${plan.weather.simulated ? " (simulated)" : ""}`);
  }
  if (plan.recommendations?.length) {
    lines.push(`  Pre-race tactical plan:`);
    lines.push(...plan.recommendations.map((r) => `    - ${recText(EN, r, "plan").action}`));
  }
  return lines.join("\n") + "\n";
}

export function buildDebriefContext(race, debrief, history = [], plan = null) {
  let ctx = `RACE UNDER ANALYSIS: ${race.name} (${fmtDate(race.date)})\n`;
  ctx += `${race.sport} · ${race.distanceKm}km · +${race.elevationM}m · ${race.surface}\n`;
  ctx += `Finish ${race.finishTime} · ${race.placement}/${race.field} (${race.percentile}th percentile)\n`;
  ctx += `Conditions: ${race.tempC}°C · ${race.humidity}% humidity · ${race.wind}km/h wind\n`;

  ctx += `\nSPLITS\n${splitsTable(race)}`;
  ctx += `\nFUELING LOG\n${fuelingBlock(race)}`;
  ctx += `\nDERIVED METRICS (computed by RaceIQ — trust these over your own arithmetic)\n${derivedMetrics(race)}\n`;

  const planText = planBlock(plan);
  if (planText) ctx += `\nPRE-RACE PLAN (what was intended)\n${planText}`;

  ctx += `\nTHIS ATHLETE'S OTHER RACES (for cross-race patterns — cite by name and date)\n${historyBlock(race, history)}`;
  ctx += `\nRULE-ENGINE OUTPUT (a floor, not a ceiling — it only recognises six patterns; keep what holds, discard what the fuller picture contradicts, and go beyond it)\n${engineBlock(debrief)}`;
  ctx += `\nAnalyse this race and return the required JSON.\n`;
  return ctx;
}

// The forward-looking twin of buildDebriefContext: same analyst, same grounding
// rules, but the evidence is the athlete's history against an upcoming course
// rather than splits from a race already run.
export function buildPlanContext(plan, history = []) {
  const { course, targetClock, nutrition, weather, recommendations, referenceRace, pacing } = plan;

  let ctx = `UPCOMING RACE — TACTICAL PLAN\n`;
  ctx += `Course: ${course.name} · ${course.distanceKm}km · +${course.elevationM}m\n`;
  ctx += `Target finish: ${targetClock}\n`;
  if (weather?.tempC != null) {
    ctx += `Forecast: ${weather.tempC}°C${weather.wind != null ? `, ${weather.wind}km/h wind` : ""}${weather.simulated ? " (SIMULATED — treat as a rough estimate, not a forecast)" : ""}\n`;
  }

  ctx += `\nPLANNED FUELING\n`;
  ctx += `  ${nutrition.carbsPerHr} carbs/hr · ${nutrition.sodiumMgHr}mg/hr sodium · ${nutrition.fluidsMlHr}ml/hr fluid`;
  ctx += nutrition.caffeineMg ? ` · ${nutrition.caffeineMg}mg caffeine\n` : `\n`;
  ctx += `  Basis per metric: ${Object.entries(nutrition.sources || {}).map(([k, v]) => `${k}=${v}`).join(", ")} (drawn from ${nutrition.basedOnRaces} logged races; "generic" means no history informed it)\n`;
  if (nutrition.notes?.length) ctx += `  Notes: ${nutrition.notes.join(" ")}\n`;

  // Terrain shape matters for pacing advice, but a per-km table for a 160km
  // course is mostly noise — summarise instead.
  if (pacing?.length) {
    const climbs = pacing.filter((p) => p.label === "CLIMB");
    const descents = pacing.filter((p) => p.label === "DESCENT");
    ctx += `\nCOURSE SHAPE\n`;
    ctx += `  ${pacing.length} segments · ${climbs.length} climbing (>4% grade) · ${descents.length} descending (<-4%)\n`;
    if (climbs.length) {
      const steepest = climbs.reduce((a, b) => (b.gradePct > a.gradePct ? b : a));
      ctx += `  Steepest climb: ${steepest.gradePct}% at km ${steepest.km}\n`;
    }
  }

  if (referenceRace) {
    ctx += `\nCLOSEST REFERENCE RACE\n  ${referenceRace.name} — ${referenceRace.finishTime} over ${referenceRace.distanceKm}km, +${referenceRace.elevationM ?? 0}m (${referenceRace.percentile}th pct)\n`;
  }

  ctx += `\nTHIS ATHLETE'S RACE HISTORY (the evidence for what will decide this one — cite by name and date)\n${historyBlock({ id: null }, history)}`;
  ctx += `\nRULE-ENGINE OUTPUT (a floor, not a ceiling — go beyond it where the history supports it)\n`;
  ctx += (recommendations || [])
    .map((r) => { const x = recText(EN, r, "plan"); return `  [rec] ${x.action}: ${x.why}`; })
    .join("\n") || "  (none)";

  ctx += `\n\nThis race has not happened yet, so there is nothing to diagnose: return an empty "findings" array. The headline names the single thing most likely to decide this race for this athlete. The recommendations are what they should do about it — specific to this course, this forecast, and this athlete's demonstrated pattern of limiters, not generic race advice.\n`;
  return ctx;
}

// ---------------------------------------------------------------------------
// Finish-time estimation for an upcoming course (RacePlanForm)
// ---------------------------------------------------------------------------
export const ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    estimatedMinutes: { type: "number", description: "Projected finish time in minutes." },
    reasoning: {
      type: "string",
      description: "One concise sentence naming the key factor — trend, best result, or course adjustment.",
    },
  },
  required: ["estimatedMinutes", "reasoning"],
  additionalProperties: false,
};

export function buildEstimateSystem(profile, locale = "en") {
  return `You are a sports performance analyst estimating a finish time for an endurance athlete.

METHOD:
1. With 2+ reference races, assess whether there is a meaningful improvement trend (pace improving race to race at comparable distance and elevation). Project a real trend forward; if it is noisy or inconsistent, anchor to the best performance instead.
2. Adjust for the distance difference using the Riegel exponent (1.06 for running, 1.0 for cycling).
3. Add roughly 1 minute per 100 m of elevation gain above the reference race's elevation.
4. Apply a small heat penalty above 20°C.
5. Be realistic. Do not extrapolate a trend beyond what the data supports.
${profileBlock(profile)}
Return the estimate in the required JSON shape. The reasoning is shown to the athlete — one sentence, specific, no hedging.${languageDirective(locale)}`;
}

export function buildEstimateContext({ course, sport, tempC, races, isCycling }) {
  const sorted = [...races].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const history = sorted.map((r) => {
    const min = parseClockToMinutes(r.finishTime);
    const pace = min / r.distanceKm;
    const paceStr = isCycling
      ? `${(r.distanceKm / (min / 60)).toFixed(1)} km/h`
      : `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")} min/km`;
    return `- ${r.date || "unknown date"}: ${r.distanceKm} km, +${r.elevationM ?? 0}m elev, ${r.finishTime} (${paceStr}), ~${r.tempC ?? "?"}°C`;
  }).join("\n");

  const elevDensity = course.distanceKm > 0 ? (course.elevationM / course.distanceKm).toFixed(1) : "?";

  return `PAST ${String(sport).toUpperCase()} RACES (chronological, all selected by the athlete as reference):
${history || "None."}

UPCOMING RACE:
- Distance: ${course.distanceKm} km
- Elevation: +${course.elevationM}m (${elevDensity} m/km density)
- Temp: ${tempC}°C
- Course: ${course.name || "unknown"}`;
}

export function fallbackAnswer(intent, data, locale = "en") {
  const t = tFor(locale);
  switch (intent.category) {
    case "oos_medical":
      return t("fallback.medical", { ns: "coach" });
    case "oos_training":
      return t("fallback.training", { ns: "coach" });
    default:
      return null;
  }
}
