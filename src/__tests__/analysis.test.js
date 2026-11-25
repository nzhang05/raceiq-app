import { describe, it, expect } from "vitest";
import { analyzeSplits, deriveVerdict, derivePercentile, deriveRating, enrichRace } from "../utils/ratings.js";
import { buildDebrief, toThreeFindings, gatherTrendData } from "../utils/analysis.js";
import { SEED_RACES } from "../constants.js";
import { splitsFromPaces } from "./helpers.js";

const race = (over = {}) => ({
  id: "t", name: "Test", sport: "Road Running", date: "2026-01-01",
  distanceKm: 9, elevationM: 0, finishTime: "0:45:00", tempC: 15,
  splits: splitsFromPaces([5, 5, 5, 5, 5, 5, 5, 5, 5]),
  fueling: null,
  ...over,
});

describe("analyzeSplits — whole-series pacing metrics", () => {
  it("reads a dead-even race as zero fade, drift and variation", () => {
    const m = analyzeSplits(splitsFromPaces([5, 5, 5, 5, 5, 5]), "Road Running");
    expect(m).toMatchObject({ fadePct: 0, driftPct: 0, cvPct: 0, useGap: false, n: 6 });
  });

  it("computes fade as last third vs first third", () => {
    // first third avg 5.0, last third avg 5.5 → +10%
    const m = analyzeSplits(splitsFromPaces([5, 5, 5.2, 5.3, 5.5, 5.5]), "Road Running");
    expect(m.firstAvg).toBe(5);
    expect(m.lastAvg).toBe(5.5);
    expect(m.fadePct).toBeCloseTo(10, 10);
  });

  it("measures drift with a least-squares slope, so one bad split can't flip it", () => {
    // A single blow-up in the middle: first-to-last is flat, the fit barely moves.
    const m = analyzeSplits(splitsFromPaces([5, 5, 5, 7, 5, 5, 5]), "Road Running");
    expect(Math.abs(m.driftPct)).toBeLessThan(1);
    expect(m.cvPct).toBeGreaterThan(10);
  });

  it("reads a negative split as negative fade", () => {
    const m = analyzeSplits(splitsFromPaces([5.2, 5.1, 5.0, 4.9, 4.8, 4.7]), "Road Running");
    expect(m.fadePct).toBeLessThan(0);
    expect(m.driftPct).toBeLessThan(0);
  });

  it("switches to grade-adjusted pace for a hilly trail race with elevation", () => {
    const climbing = splitsFromPaces([6, 6.5, 7, 7.5], (i) => ({ elevM: i * 60 }));
    const m = analyzeSplits(climbing, "Trail Running");
    expect(m.useGap).toBe(true);
    // Raw pace fades 25%; most of that is the 6% grade, not fatigue.
    expect(m.fadePct).toBeLessThan(analyzeSplits(climbing, "Road Running").fadePct);
  });

  it("returns null with fewer than two splits", () => {
    expect(analyzeSplits([{ km: 1, pace: 5 }], "Road Running")).toBeNull();
    expect(analyzeSplits(undefined, "Road Running")).toBeNull();
  });
});

describe("deriveVerdict", () => {
  it("calls even pacing a strength", () => {
    expect(deriveVerdict(splitsFromPaces([5, 5, 5.05, 5.05, 5.1, 5.1]), 15, "Road Running")).toBe("strength");
  });

  it("calls a heavy fade a limiter", () => {
    expect(deriveVerdict(splitsFromPaces([5, 5, 5.5, 6, 6.5, 7]), 15, "Road Running")).toBe("limiter");
  });

  it("uses a lower limiter threshold in heat (≥24°C)", () => {
    // ~9% blended drift: mixed when cool, limiter when hot.
    const splits = splitsFromPaces([5, 5.05, 5.15, 5.3, 5.4, 5.5]);
    expect(deriveVerdict(splits, 15, "Road Running")).toBe("mixed");
    expect(deriveVerdict(splits, 26, "Road Running")).toBe("limiter");
  });
});

describe("sample athlete", () => {
  it.each(SEED_RACES.map((r) => [r.name, r]))("%s carries the verdict the engine derives", (_, r) => {
    expect(r.verdict).toBe(deriveVerdict(r.splits, r.tempC, r.sport));
  });
});

describe("percentile and rating", () => {
  it("derives percentile from placement and field size", () => {
    expect(derivePercentile(1, 100)).toBe(100);
    expect(derivePercentile(51, 100)).toBe(50);
    expect(derivePercentile(null, 100)).toBeNull();
  });

  it("clamps the rating to 1000–3000 and caps the distance bonus at 100 km", () => {
    expect(deriveRating(0, 0)).toBe(1000);
    expect(deriveRating(100, 500)).toBe(deriveRating(100, 100));
    expect(deriveRating(null, 10)).toBe(1500);
  });

  it("enrichRace fills verdict, rating and GAP from raw input", () => {
    const r = enrichRace({ ...race(), placement: 10, field: 200, splits: splitsFromPaces([6, 6.5], (i) => ({ elevM: i * 50 })), sport: "Trail Running" });
    expect(r.usesGap).toBe(true);
    expect(r.splits[1].gapPace).toBeLessThan(6.5);
    expect(r.percentile).toBe(95.5);
    expect(["strength", "mixed", "limiter"]).toContain(r.verdict);
  });
});

describe("buildDebrief — fade detection", () => {
  const keys = (list) => list.map((f) => f.key);

  it("flags a >8% fade as a limiter and recommends a slower opening", () => {
    const d = buildDebrief(race({ splits: splitsFromPaces([5, 5, 5, 5.3, 5.5, 5.6, 5.8, 5.9, 6]) }));
    expect(keys(d.limiters)).toContain("pacing.faded");
    expect(keys(d.recs)).toContain("rec.openEasier");
    const f = d.limiters.find((x) => x.key === "pacing.faded");
    expect(f.values.firstPace).toBe("5:00/km");
    expect(f.values.lastPace).toBe("5:54/km");
    expect(f.values.fade).toBe(18);
  });

  it("calls a 4–8% fade drift, not a collapse", () => {
    const d = buildDebrief(race({ splits: splitsFromPaces([5, 5, 5, 5.1, 5.15, 5.2, 5.3, 5.3, 5.3]) }));
    expect(keys(d.limiters)).toContain("pacing.drift");
    expect(keys(d.recs)).not.toContain("rec.openEasier");
  });

  it("calls tight, even splits a strength", () => {
    const d = buildDebrief(race());
    expect(keys(d.strengths)).toContain("pacing.even");
  });

  it("links the fade to heat only when split temperatures actually rose into the 20s", () => {
    const paces = [5, 5, 5, 5.3, 5.5, 5.6, 5.8, 5.9, 6];
    const hot = buildDebrief(race({ splits: splitsFromPaces(paces, (i) => ({ tempC: 18 + i })) }));
    expect(keys(hot.limiters)).toContain("heat.tracked");
    const flat = buildDebrief(race({ splits: splitsFromPaces(paces, () => ({ tempC: 26 })) }));
    expect(keys(flat.limiters)).not.toContain("heat.tracked");
  });

  it("flags carbs below the duration band and quantifies the gap", () => {
    const d = buildDebrief(race({ finishTime: "3:00:00", fueling: { carbsPerHr: 50 } }));
    const f = d.limiters.find((x) => x.key === "fuel.light");
    expect(f.values).toMatchObject({ taken: 50, gap: 10, carbsLow: 60, carbsHigh: 90, durationMin: 180 });
  });

  it("asserts nothing it can't compute: no splits, no pacing finding", () => {
    const d = buildDebrief(race({ splits: [] }));
    expect(d.strengths).toEqual([]);
    expect(d.limiters).toEqual([]);
  });
});

describe("toThreeFindings", () => {
  it("always returns exactly three, padding with what's missing rather than inventing", () => {
    const r = race({ splits: [], fueling: null });
    const out = toThreeFindings([], [], r);
    expect(out).toHaveLength(3);
    expect(out.every((f) => f.kind === "context")).toBe(true);
    expect(out.map((f) => f.key)).toEqual(["context.noSplits", "context.noElevation", "context.noFueling"]);
  });

  it("leads with limiters and truncates to three", () => {
    const s = [{ key: "a" }, { key: "b" }];
    const l = [{ key: "x" }, { key: "y" }];
    expect(toThreeFindings(s, l, race()).map((f) => f.key)).toEqual(["x", "a", "y"]);
  });
});

describe("gatherTrendData", () => {
  it("needs two races for a trend and reports first-to-last change", () => {
    expect(gatherTrendData([SEED_RACES[0]], null).insufficient).toBe(true);
    const t = gatherTrendData(SEED_RACES, null);
    expect(t.firstRating).toBe(1830); // Lakefront, the oldest
    expect(t.lastRating).toBe(1842);  // Brandywine, the newest
    expect(t.ratingTrend).toBe(12);
  });
});
