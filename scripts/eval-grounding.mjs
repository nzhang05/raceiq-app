#!/usr/bin/env node
/*
  Live grounding eval: asks the real model every coach suggestion and every
  debrief for the sample athlete and the fixture races, then runs the same
  number-level check the test suite runs on recordings.

    npm run eval:grounding            # ~30 live calls; needs ANTHROPIC_API_KEY in .env.local

  `npm test` proves the pipeline and the recordings; this measures the model.
  Each ungrounded number is printed with its context. Exit code is non-zero if
  any answer fails, so it can gate a model or prompt change.
*/
import { SEED_RACES } from "../src/constants.js";
import { FIXTURE_RACES } from "../src/__fixtures__/races/index.js";
import { resources } from "../src/i18n/resources.js";
import { buildDebrief } from "../src/utils/analysis.js";
import { checkGrounding, dataLinesFromSystem } from "../src/utils/grounding.js";
import { classifyIntent, gatherFor, buildCoachSystem, buildCoachContext, buildDebriefContext } from "../api/_lib/prompts.js";
import { handleCoach, handleNarrative } from "../api/claude.js";
import { MODEL } from "../api/_lib/anthropic.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set — add it to .env.local (no VITE_ prefix).");
  process.exit(1);
}

const byDateDesc = (rs) => [...rs].sort((a, b) => new Date(b.date) - new Date(a.date));
const athletes = { sample: byDateDesc(SEED_RACES), fixtures: byDateDesc(FIXTURE_RACES) };
const results = [];

async function record(label, locale, data, run) {
  try {
    const answer = await run();
    const r = checkGrounding({ data, answer, locale });
    results.push({ label, ...r });
    console.log(`${r.ok ? "✓" : "✗"} ${label} (${r.cited} numbers)`);
    for (const u of r.ungrounded) console.log(`    ${u.raw}  ${u.context}`);
  } catch (err) {
    results.push({ label, ok: false, error: err.message });
    console.log(`! ${label}: ${err.message}`);
  }
}

console.log(`Model: ${MODEL}\n`);
for (const [who, races] of Object.entries(athletes)) {
  for (const locale of Object.keys(resources)) {
    for (const [key, question] of Object.entries(resources[locale].coach.suggested)) {
      const intent = classifyIntent(question, races, null);
      const data = [dataLinesFromSystem(buildCoachSystem(races, null, locale)), buildCoachContext(intent, gatherFor(intent, races, null), question, null)];
      await record(`${who} coach ${key} ${locale}`, locale, data, async () =>
        (await handleCoach({ question, races, contextRaceId: null, history: [], profile: null, locale })).answer);
    }
    for (const race of races.filter((r) => r.splits?.length)) {
      const data = [buildDebriefContext(race, buildDebrief(race), races, null)];
      await record(`${who} debrief ${race.id} ${locale}`, locale, data, async () =>
        (await handleNarrative({ race, races, plan: null, profile: null, locale }, "debrief")).narrative);
    }
  }
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} answers grounded.`);
process.exit(passed === results.length ? 0 : 1);
