import { describe, it, expect } from "vitest";
import { isSampleSet, replayDebrief, replayCoach } from "../demo/replay.js";
import { SEED_RACES } from "../constants.js";

const sample = [...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));
const extra = { id: "custom-1", name: "My race" };

describe("demo replay", () => {
  it("recognises the untouched sample set in any order", () => {
    expect(isSampleSet(sample)).toBe(true);
    expect(isSampleSet([...sample].reverse())).toBe(true);
    expect(isSampleSet([...sample, extra])).toBe(false);
    expect(isSampleSet(sample.slice(1))).toBe(false);
  });

  it("has a debrief recording for every sample race in both languages", () => {
    for (const race of sample) {
      for (const locale of ["en", "fr"]) {
        const n = replayDebrief({ race, races: sample, locale });
        expect(n?.recorded, `${race.id}/${locale}`).toBe(true);
        expect(n.findings).toHaveLength(3);
      }
    }
  });

  it("stops replaying once the visitor adds a race", () => {
    expect(replayDebrief({ race: sample[0], races: [...sample, extra], locale: "en" })).toBeNull();
    expect(replayCoach({ suggestion: "fit", races: [...sample, extra], locale: "en" })).toBeNull();
  });

  it("replays a context-specific answer only in the contexts it was recorded for", () => {
    expect(replayCoach({ suggestion: "bonk", races: sample, contextRaceId: null, locale: "en" })).not.toBeNull();
    expect(replayCoach({ suggestion: "bonk", races: sample, contextRaceId: "r1", locale: "en" })).not.toBeNull();
    expect(replayCoach({ suggestion: "bonk", races: sample, contextRaceId: "r3", locale: "en" })).toBeNull();
    expect(replayCoach({ suggestion: "improving", races: sample, contextRaceId: "r3", locale: "fr" })).not.toBeNull();
  });

  it("never replays a typed question", () => {
    expect(replayCoach({ suggestion: null, races: sample, locale: "en" })).toBeNull();
  });
});
