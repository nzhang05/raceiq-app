/*
  Recorded AI responses for the public demo.

  Each file in ./recordings is one response to one request the demo UI can
  make about the sample athlete: a race debrief, or one of the coach's
  suggested questions, in one language. The request is described, not stored —
  it is rebuilt from SEED_RACES by the grounding test (src/__tests__/grounding),
  which runs the exact server prompt builders and fails if a response cites a
  number the data block does not contain. So every answer the demo replays has
  passed the same check a live answer would be held to.

  Replay applies only while the visitor's races are exactly the sample set.
  Once they add a race, a recorded answer would silently ignore it, so the
  request goes to the live path instead (or to the rule engine when the demo
  has no live budget).

  Re-record with `npm run record:demo` (needs ANTHROPIC_API_KEY).
*/
import { SEED_RACES } from "../constants.js";

const files = import.meta.glob("./recordings/*.json", { eager: true, import: "default" });
const RECORDINGS = Object.values(files);
const SEED_IDS = new Set(SEED_RACES.map((r) => r.id));

export function isSampleSet(races) {
  return Array.isArray(races)
    && races.length === SEED_IDS.size
    && races.every((r) => SEED_IDS.has(r.id));
}

export function replayDebrief({ race, races, locale }) {
  if (!isSampleSet(races)) return null;
  const rec = RECORDINGS.find((r) => r.task === "debrief" && r.raceId === race?.id && r.locale === locale);
  return rec ? { ...rec.response, recorded: true } : null;
}

// `contextRaceIds` lists the coach contexts the recorded answer is valid for —
// a trend answer doesn't depend on which debrief the coach was opened from,
// but a "why did I bonk" answer does.
export function replayCoach({ suggestion, races, contextRaceId, locale }) {
  if (!suggestion || !isSampleSet(races)) return null;
  const rec = RECORDINGS.find((r) =>
    r.task === "coach"
    && r.suggestion === suggestion
    && r.locale === locale
    && (r.contextRaceIds === "any" || r.contextRaceIds.includes(contextRaceId ?? null)));
  return rec ? { ...rec.response, recorded: true } : null;
}
