#!/usr/bin/env node
/*
  Re-records the demo's AI answers (src/demo/recordings) from the live model.

  For every existing recording it rebuilds the request the demo UI makes — the
  sample athlete's races, the race or the suggested question, the locale — and
  runs it through the same handler functions /api/claude uses, so the prompt is
  byte-for-byte what production sends. The answer replaces the stored one.

    npm run record:demo            # all 16
    npm run record:demo -- coach   # only ids containing "coach"

  Then run `npm test`: the grounding test fails if a new answer cites a number
  that is not in its data block. Review the diff before committing.
*/
import fs from "node:fs";
import path from "node:path";
import { SEED_RACES } from "../src/constants.js";
import { tFor } from "../src/i18n/server.js";
import { handleCoach, handleNarrative } from "../api/claude.js";
import { MODEL } from "../api/_lib/anthropic.js";

const DIR = path.resolve("src/demo/recordings");
const filter = process.argv[2] || "";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set — add it to .env.local (no VITE_ prefix).");
  process.exit(1);
}

// The order App.jsx hands races to every surface: newest first.
const races = [...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const rec = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  if (!rec.id.includes(filter)) continue;
  process.stdout.write(`${rec.id} … `);

  let response;
  if (rec.task === "debrief") {
    const race = races.find((r) => r.id === rec.raceId);
    const { narrative } = await handleNarrative({ race, races, plan: null, profile: null, locale: rec.locale }, "debrief");
    response = narrative;
  } else {
    const question = tFor(rec.locale)(`suggested.${rec.suggestion}`, { ns: "coach" });
    const { answer, intent, sourceRaceIds } = await handleCoach({ question, races, contextRaceId: null, history: [], profile: null, locale: rec.locale });
    response = { answer, intent, sourceRaceIds };
    rec.question = question;
  }

  const next = {
    ...rec,
    source: "live",
    model: MODEL,
    recordedAt: new Date().toISOString().slice(0, 10),
    note: undefined,
    response,
  };
  fs.writeFileSync(path.join(DIR, file), `${JSON.stringify(next, null, 2)}\n`);
  console.log("done");
}
