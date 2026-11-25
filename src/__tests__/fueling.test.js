import { describe, it, expect } from "vitest";
import { fuelingBenchmarks, personalizeFueling } from "../utils/fueling.js";

describe("fuelingBenchmarks — duration bands", () => {
  it.each([
    ["0:44:59", false, 0, 0],
    ["0:45:00", false, 0, 30],
    ["1:14:59", false, 0, 30],
    ["1:15:00", true, 30, 60],
    ["2:29:59", true, 30, 60],
    ["2:30:00", true, 60, 90],
    ["3:59:59", true, 60, 90],
    ["4:00:00", true, 80, 120],
    ["12:00:00", true, 80, 120],
  ])("%s → needsCarbs %s, %i–%i g/hr", (clock, needs, low, high) => {
    const b = fuelingBenchmarks(clock);
    expect(b).toMatchObject({ needsCarbs: needs, carbsLow: low, carbsHigh: high });
    expect(b.rationaleKey).toMatch(/^fuelRationale\./);
  });
});

describe("personalizeFueling — precedence: manual > history > research", () => {
  const benchmark = fuelingBenchmarks("3:00:00"); // 60–90 g/hr
  const history = [
    { finishTime: "3:10:00", tempC: 15, fueling: { carbsPerHr: 75, sodiumPerHr: 500, fluidsPerHr: 600, caffeine: 100 } },
    { finishTime: "3:20:00", tempC: 15, fueling: { carbsPerHr: 70, sodiumPerHr: 400, fluidsPerHr: 500, caffeine: 0 } },
  ];

  it("falls back to the generic heat formula with no history", () => {
    const p = personalizeFueling({ benchmark, history: [], targetMinutes: 180, tempC: 25 });
    expect(p.sources).toEqual({ sodium: "generic", fluids: "generic", carbs: "generic", caffeine: "generic" });
    expect(p.sodiumMgHr).toBe(500 + 10 * 50);
    expect(p.fluidsMlHr).toBe(500 + 10 * 30);
    expect(p.carbsTargetNum).toBe(75); // middle of 60–90
  });

  it("uses the athlete's history, nudged only by the temperature delta", () => {
    const p = personalizeFueling({ benchmark, history, targetMinutes: 180, tempC: 15 });
    expect(p.sources.sodium).toBe("history");
    expect(p.sodiumMgHr).toBe(450);
    expect(p.fluidsMlHr).toBe(550);
    expect(p.carbsTargetNum).toBe(75); // highest proven rate that met its own band
    expect(p.basedOnRaces).toBe(2);
  });

  it("lets manual input win, and warns when manual carbs are under the band", () => {
    const p = personalizeFueling({ benchmark, history, targetMinutes: 180, manual: { carbsPerHr: "40", sodiumPerHr: 900 } });
    expect(p.sources).toMatchObject({ carbs: "manual", sodium: "manual" });
    expect(p.carbsTargetNum).toBe(40);
    expect(p.notes.map((n) => n.key)).toContain("fuelNote.manualBelowRange");
  });

  it("keeps history-based carbs inside the research band", () => {
    const heavy = [{ finishTime: "3:00:00", tempC: 15, fueling: { carbsPerHr: 110, sodiumPerHr: 500, fluidsPerHr: 500 } }];
    const p = personalizeFueling({ benchmark, history: heavy, targetMinutes: 180 });
    expect(p.carbsTargetNum).toBe(90);
    expect(p.notes.map((n) => n.key)).toContain("fuelNote.provenHigh");
  });

  it("raises an under-fueled history to the band's floor and says so", () => {
    const light = [{ finishTime: "3:00:00", tempC: 15, fueling: { carbsPerHr: 40, sodiumPerHr: 300, fluidsPerHr: 400 } }];
    const p = personalizeFueling({ benchmark, history: light, targetMinutes: 180 });
    expect(p.carbsTargetNum).toBe(60);
    expect(p.notes.map((n) => n.key)).toContain("fuelNote.historyLow");
  });
});
