import { describe, it, expect } from "vitest";
import {
  runningCostMultiplier, cyclingCostMultiplier, gradePercent, gapPaceForSplit,
  withGap, hasElevationData, sportUsesGap, fmtPace, paceDriftPct,
} from "../utils/pace.js";

describe("runningCostMultiplier (Minetti 2002, normalised to flat)", () => {
  it("is exactly 1 on the flat", () => {
    expect(runningCostMultiplier(0)).toBe(1);
  });

  it("rises monotonically with uphill grade", () => {
    const grades = [0, 2, 5, 10, 20];
    const costs = grades.map(runningCostMultiplier);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
  });

  it("pins the polynomial at +10%", () => {
    // 155.4g⁵ − 30.4g⁴ − 43.3g³ + 46.3g² + 19.5g + 3.6 at g = 0.10 is 5.968
    // J/kg/m, against 3.6 on the flat.
    expect(runningCostMultiplier(10)).toBeCloseTo(5.968 / 3.6, 3);
  });

  it("makes gentle downhills cheaper than flat", () => {
    expect(runningCostMultiplier(-5)).toBeLessThan(1);
  });

  it("clamps grade to ±30% and the multiplier to a 0.45 floor", () => {
    expect(runningCostMultiplier(45)).toBe(runningCostMultiplier(30));
    expect(runningCostMultiplier(-30)).toBeGreaterThanOrEqual(0.45);
  });
});

describe("cyclingCostMultiplier", () => {
  it("adds 11% per percent of climb and gives back 4.5% per percent of descent", () => {
    expect(cyclingCostMultiplier(0)).toBe(1);
    expect(cyclingCostMultiplier(5)).toBeCloseTo(1.55, 10);
    expect(cyclingCostMultiplier(-4)).toBeCloseTo(0.82, 10);
  });

  it("floors descents at 0.55 and clamps grade at ±20%", () => {
    expect(cyclingCostMultiplier(-20)).toBe(0.55);
    expect(cyclingCostMultiplier(30)).toBe(cyclingCostMultiplier(20));
  });
});

describe("gradePercent", () => {
  it("is rise over run between two splits", () => {
    expect(gradePercent({ km: 2, elevM: 150 }, { km: 1, elevM: 100 })).toBeCloseTo(5, 10);
    expect(gradePercent({ km: 2, elevM: 80 }, { km: 1, elevM: 100 })).toBeCloseTo(-2, 10);
  });

  it("is 0 for the first split, missing elevation, or zero distance", () => {
    expect(gradePercent({ km: 1, elevM: 100 }, undefined)).toBe(0);
    expect(gradePercent({ km: 2, elevM: null }, { km: 1, elevM: 100 })).toBe(0);
    expect(gradePercent({ km: 1, elevM: 120 }, { km: 1, elevM: 100 })).toBe(0);
  });
});

describe("grade-adjusted pace", () => {
  it("credits a climb: GAP is faster than raw pace uphill", () => {
    const { gradePct, gapPace } = gapPaceForSplit({ km: 2, pace: 6, elevM: 150 }, { km: 1, pace: 5, elevM: 100 }, "Trail Running");
    expect(gradePct).toBe(5);
    expect(gapPace).toBeCloseTo(6 / runningCostMultiplier(5), 10);
    expect(gapPace).toBeLessThan(6);
  });

  it("uses the cycling curve for cycling sports", () => {
    const { gapPace } = gapPaceForSplit({ km: 10, pace: 2.4, elevM: 600 }, { km: 5, pace: 2, elevM: 500 }, "Gravel Cycling");
    expect(gapPace).toBeCloseTo(2.4 / cyclingCostMultiplier(2), 10);
  });

  it("withGap annotates every split and leaves raw pace untouched", () => {
    const splits = [{ km: 1, pace: 5, elevM: 100 }, { km: 2, pace: 6, elevM: 150 }];
    const out = withGap(splits, "Trail Running");
    expect(out.map((s) => s.pace)).toEqual([5, 6]);
    expect(out[0].gapPace).toBe(5); // first split: no previous point, grade 0
    expect(out[1].gradePct).toBe(5);
  });

  it("applies only to sports where terrain matters, and only with elevation", () => {
    expect(sportUsesGap("Trail Running")).toBe(true);
    expect(sportUsesGap("Gravel Cycling")).toBe(true);
    expect(sportUsesGap("Road Running")).toBe(false);
    expect(hasElevationData([{ km: 1, pace: 5 }])).toBe(false);
    expect(hasElevationData([{ km: 1, pace: 5, elevM: 0 }])).toBe(true);
  });
});

describe("fmtPace", () => {
  it("formats min/km as m:ss", () => {
    expect(fmtPace(4.5)).toBe("4:30/km");
    expect(fmtPace(4.42)).toBe("4:25/km");
  });

  it("carries a rounded-up 60 seconds into the minute", () => {
    expect(fmtPace(4.999)).toBe("5:00/km");
    expect(fmtPace(5.9917)).toBe("6:00/km");
  });
});

describe("paceDriftPct", () => {
  it("is the first-to-last change, preferring grade-adjusted pace when present", () => {
    expect(paceDriftPct([{ pace: 5 }, { pace: 5.5 }])).toBe(10);
    expect(paceDriftPct([{ pace: 5, gapPace: 4 }, { pace: 6, gapPace: 4.2 }])).toBe(5);
  });

  it("is 0 with fewer than two splits", () => {
    expect(paceDriftPct([])).toBe(0);
    expect(paceDriftPct(null)).toBe(0);
  });
});
