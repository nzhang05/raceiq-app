import { describe, it, expect } from "vitest";
import { seasonSummary, pickPattern, conditionsKey, raceInsight } from "../utils/season.js";
import { SEED_RACES } from "../constants.js";
import { FIXTURE_RACES } from "../__fixtures__/races/index.js";

describe("seasonSummary", () => {
  it("totals the sample athlete's season", () => {
    const s = seasonSummary(SEED_RACES);
    expect(s.count).toBe(4);
    expect(s.km).toBe(207);            // 42.2 + 50 + 105 + 10
    expect(s.hours).toBe(14);          // 3:24:51 + 5:48:12 + 3:51:09 + 0:38:42 ≈ 13.7 h
    expect(s.strongest.name).toBe("Tunkhannock Trail 50K"); // highest RaceIQ score, 1910
    expect(s.yearsLabel).toBe("2025–26");
  });

  it("copes with no races", () => {
    expect(seasonSummary([])).toMatchObject({ count: 0, km: 0, hours: 0, strongest: null, yearsLabel: "" });
  });
});

describe("pickPattern", () => {
  it("finds the sample athlete's cool-weather strength, with its evidence", () => {
    const p = pickPattern(SEED_RACES);
    expect(p.key).toBe("coolStrengths");
    expect([p.count, p.total]).toEqual([2, 2]);
    expect(p.races.map((r) => r.name).sort()).toEqual(["Lakefront 10K", "Tunkhannock Trail 50K"]);
    expect(p.bars.map((b) => b.value)).toEqual([14, 11, 6, 27]); // oldest first
    expect(p.bars.filter((b) => b.hit)).toHaveLength(2);
  });

  it("puts a fueling pattern first when it holds", () => {
    const hungry = (id, date) => ({ id, name: id, date, verdict: "limiter", finishTime: "3:30:00", tempC: 12, fueling: { carbsPerHr: 40 } });
    const p = pickPattern([hungry("a", "2026-01-01"), hungry("b", "2026-02-01"), { ...hungry("c", "2026-03-01"), fueling: { carbsPerHr: 70 } }]);
    expect(p.key).toBe("underFueled");
    expect([p.count, p.total]).toEqual([2, 3]);
    expect(p.bars.map((b) => b.value)).toEqual([67, 67, 117]); // % of the 60 g/hr floor
  });

  it("says nothing from a single race", () => {
    expect(pickPattern([SEED_RACES[0]])).toBeNull();
    expect(pickPattern([])).toBeNull();
  });
});

describe("conditionsKey", () => {
  it.each([[-2, 50, "cold"], [6, 58, "cool"], [18, 80, "mild"], [23, 60, "warm"], [23, 75, "warmHumid"], [27, 71, "hotHumid"], [31, 38, "hot"], [null, 50, null]])(
    "%s°C at %s%% → %s", (t, h, key) => expect(conditionsKey(t, h)).toBe(key),
  );
});

describe("raceInsight", () => {
  it("leads a limiter race with its top finding and first recommendation", () => {
    const brandywine = SEED_RACES.find((r) => r.id === "r1");
    const i = raceInsight(brandywine);
    expect(i.tone).toBe("limiter");
    expect(i.topLimiter.key).toBe("pacing.faded");
    expect(i.firstRec).not.toBeNull();
  });

  it("states a strong race's verdict without inventing a limiter", () => {
    const i = raceInsight(SEED_RACES.find((r) => r.id === "r4"));
    expect(i).toEqual({ tone: "strength", topLimiter: null, firstRec: null });
  });

  it("handles a hand-entered race with no splits", () => {
    expect(() => raceInsight(FIXTURE_RACES[0])).not.toThrow();
  });
});
