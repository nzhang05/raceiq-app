import { describe, it, expect } from "vitest";
import { buildCarryPlan, sanitizeAidStations, totalStopMinutes } from "../utils/aidStations.js";

const nutrition = { carbsTargetNum: 60, fluidsMlHr: 500, sodiumMgHr: 400 };

describe("sanitizeAidStations", () => {
  it("drops stations outside the course and duplicates, sorts, and names the unnamed", () => {
    const out = sanitizeAidStations(
      [{ km: 30 }, { km: 10, name: "Col" }, { km: 10 }, { km: 0 }, { km: 50 }, { km: -2 }],
      50,
    );
    expect(out.map((s) => s.km)).toEqual([10, 30]);
    expect(out.map((s) => s.name)).toEqual(["Col", "Aid 2"]);
  });

  it("never lets sleep exceed the stop it sits inside", () => {
    const [s] = sanitizeAidStations([{ km: 20, stopMinutes: 20, sleepMinutes: 90 }], 50);
    expect(s.sleepMinutes).toBe(20);
    expect(totalStopMinutes([{ km: 20, stopMinutes: 20 }, { km: 30, stopMinutes: "-5" }], 50)).toBe(20);
  });
});

describe("buildCarryPlan", () => {
  it("returns null without aid stations", () => {
    expect(buildCarryPlan([], nutrition, [], 42, 240, 1000)).toBeNull();
  });

  it("splits fuel by moving time between refill points (even pace)", () => {
    // 40 km in 240 min, stations at 10 and 30 → legs of 60, 120 and 60 minutes.
    const plan = buildCarryPlan([], nutrition, [{ km: 10 }, { km: 30 }], 40, 240, 1000);
    expect(plan.legs.map((l) => l.minutes)).toEqual([60, 120, 60]);
    expect(plan.legs.map((l) => l.carbsG)).toEqual([60, 120, 60]);
    expect(plan.legs.map((l) => l.fluidsMl)).toEqual([500, 1000, 500]);
    expect(plan.legs.map((l) => l.gels)).toEqual([3, 5, 3]); // ceil(g / 25)
    expect(plan.totals).toEqual({ carbsG: 240, fluidsMl: 2000, sodiumMg: 1600 });
    expect(plan.packAtStart).toBe(plan.legs[0]);
  });

  it("charges a climbing leg more time, and so more fuel, than a flat one", () => {
    const pacing = [{ km: 10, suggestedPace: 5 }, { km: 20, suggestedPace: 8 }];
    const plan = buildCarryPlan(pacing, nutrition, [{ km: 10 }], 20, 130, null);
    expect(plan.legs[0].minutes).toBe(50);
    expect(plan.legs[1].minutes).toBe(80);
    expect(plan.legs[1].carbsG).toBeGreaterThan(plan.legs[0].carbsG);
  });

  it("flags legs whose fluid need exceeds carry capacity", () => {
    const plan = buildCarryPlan([], nutrition, [{ km: 10 }, { km: 30 }], 40, 240, 750);
    expect(plan.legs.map((l) => l.overCapacity)).toEqual([false, true, false]);
  });

  it("notes water-only stations so the athlete carries food through them", () => {
    const plan = buildCarryPlan([], nutrition, [{ km: 10, food: false }], 20, 120, null);
    expect(plan.legs.map((l) => l.noteKey)).toEqual(["leg.fromStart", "leg.waterOnly"]);
  });
});
