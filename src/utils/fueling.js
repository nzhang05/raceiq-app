import { parseClockToMinutes } from "./time.js";

// Carbohydrate targets derived from Jeukendrup 2014, Burke 2011.
// Gut absorption caps single-source carbs at ~60g/hr; higher rates require
// multiple transportable carbs (glucose + fructose).
export function fuelingBenchmarks(finishTime) {
  const durationMin = parseClockToMinutes(finishTime);

  if (durationMin < 45) {
    return {
      needsCarbs: false,
      carbsLow: 0,
      carbsHigh: 0,
      carbsLabel: "none",
      peerAvg: null,
      rationaleKey: "fuelRationale.under45",
    };
  }
  if (durationMin < 75) {
    return {
      needsCarbs: false,
      carbsLow: 0,
      carbsHigh: 30,
      carbsLabel: "0–30g/hr",
      peerAvg: 15,
      rationaleKey: "fuelRationale.under75",
    };
  }
  if (durationMin < 150) {
    return {
      needsCarbs: true,
      carbsLow: 30,
      carbsHigh: 60,
      carbsLabel: "30–60g/hr",
      peerAvg: 45,
      rationaleKey: "fuelRationale.under150",
    };
  }
  if (durationMin < 240) {
    return {
      needsCarbs: true,
      carbsLow: 60,
      carbsHigh: 90,
      carbsLabel: "60–90g/hr",
      peerAvg: 72,
      rationaleKey: "fuelRationale.under240",
    };
  }
  return {
    needsCarbs: true,
    carbsLow: 80,
    carbsHigh: 120,
    carbsLabel: "80–120g/hr",
    peerAvg: 90,
    rationaleKey: "fuelRationale.over240",
  };
}

// Gentle heat slopes used to nudge sodium/fluid targets for the temperature *delta*
// between the athlete's historical races and the planned conditions. Because the base
// comes from real history rather than a formula, these only touch the marginal delta,
// so they stay far tamer than the whole-cloth generic slopes below.
const SODIUM_DELTA_PER_DEG = 40; // mg/hr per °C above the historical baseline
const FLUID_DELTA_PER_DEG = 25;  // ml/hr per °C above the historical baseline

// Whole-cloth generic slopes — the original heuristic, kept as the no-history fallback.
const SODIUM_GENERIC_PER_DEG = 50;
const FLUID_GENERIC_PER_DEG = 30;

function numOrNull(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && !isNaN(n) ? n : null;
}

function mean(nums) {
  const v = nums.filter((n) => typeof n === "number" && !isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Blend the generic duration benchmark with the athlete's actual fueling history and
// any manual "known-good" overrides they typed. Precedence per metric:
//   1. manual input (what the athlete says works for them)
//   2. their history (averaged from the reference races)
//   3. the research benchmark / heat formula (backstop)
// Carbs are special: history *informs* but the research range still bounds the target,
// since carb need scales with duration and a short race can't vouch for a long one.
export function personalizeFueling({ benchmark, history = [], targetMinutes, tempC = 18, manual = {} }) {
  const withFuel = history.filter((r) => r && r.fueling);
  const sources = {};
  const notes = [];
  const heatExtra = Math.max(0, tempC - 15);
  const histTemp = mean(withFuel.map((r) => r.tempC)) ?? 15;
  const tempDelta = heatExtra - Math.max(0, histTemp - 15);

  // --- Sodium (mg/hr) ---
  let sodiumMgHr;
  const manualSodium = numOrNull(manual.sodiumPerHr);
  const histSodium = mean(withFuel.map((r) => r.fueling.sodiumPerHr).filter((n) => n > 0));
  if (manualSodium != null) {
    sodiumMgHr = Math.round(manualSodium);
    sources.sodium = "manual";
  } else if (histSodium != null) {
    sodiumMgHr = Math.max(200, Math.round(histSodium + tempDelta * SODIUM_DELTA_PER_DEG));
    sources.sodium = "history";
  } else {
    sodiumMgHr = Math.round(500 + heatExtra * SODIUM_GENERIC_PER_DEG);
    sources.sodium = "generic";
  }

  // --- Fluids (ml/hr) ---
  let fluidsMlHr;
  const manualFluids = numOrNull(manual.fluidsPerHr);
  const histFluids = mean(withFuel.map((r) => r.fueling.fluidsPerHr).filter((n) => n > 0));
  if (manualFluids != null) {
    fluidsMlHr = Math.round(manualFluids);
    sources.fluids = "manual";
  } else if (histFluids != null) {
    fluidsMlHr = Math.max(250, Math.round(histFluids + tempDelta * FLUID_DELTA_PER_DEG));
    sources.fluids = "history";
  } else {
    fluidsMlHr = Math.round(500 + heatExtra * FLUID_GENERIC_PER_DEG);
    sources.fluids = "generic";
  }

  // --- Carbs (g/hr numeric target for carry math; label still shows the research range) ---
  let carbsTargetNum;
  const manualCarbs = numOrNull(manual.carbsPerHr);
  if (manualCarbs != null) {
    carbsTargetNum = Math.round(manualCarbs);
    sources.carbs = "manual";
    if (benchmark.needsCarbs && manualCarbs < benchmark.carbsLow) {
      notes.push({ key: "fuelNote.manualBelowRange", values: { target: carbsTargetNum, low: benchmark.carbsLow, high: benchmark.carbsHigh } });
    }
  } else if (!benchmark.needsCarbs) {
    carbsTargetNum = Math.round((benchmark.carbsLow + benchmark.carbsHigh) / 2);
    sources.carbs = "generic";
  } else {
    // Proven tolerance: the highest carb rate the athlete sustained in a race whose own
    // duration benchmark it met — evidence they took that much without under-fueling.
    const provenRates = withFuel
      .filter((r) => {
        const b = fuelingBenchmarks(r.finishTime);
        return b.needsCarbs && r.fueling.carbsPerHr >= b.carbsLow;
      })
      .map((r) => r.fueling.carbsPerHr);
    const proven = provenRates.length ? Math.max(...provenRates) : 0;
    const typical = mean(withFuel.map((r) => r.fueling.carbsPerHr).filter((n) => n > 0));
    if (proven > 0) {
      carbsTargetNum = Math.round(Math.min(benchmark.carbsHigh, Math.max(benchmark.carbsLow, proven)));
      sources.carbs = "history";
      if (proven >= benchmark.carbsHigh) {
        notes.push({ key: "fuelNote.provenHigh", values: { proven: Math.round(proven), low: benchmark.carbsLow, high: benchmark.carbsHigh } });
      }
    } else if (typical != null && typical < benchmark.carbsLow) {
      carbsTargetNum = benchmark.carbsLow;
      sources.carbs = "history";
      notes.push({ key: "fuelNote.historyLow", values: { typical: Math.round(typical), low: benchmark.carbsLow, high: benchmark.carbsHigh } });
    } else {
      carbsTargetNum = Math.round((benchmark.carbsLow + benchmark.carbsHigh) / 2);
      sources.carbs = "generic";
    }
  }

  // --- Caffeine (total mg) ---
  let caffeineMg;
  const manualCaffeine = numOrNull(manual.caffeineMg);
  const histCaffeine = mean(withFuel.map((r) => r.fueling.caffeine).filter((n) => n > 0));
  if (manualCaffeine != null) {
    caffeineMg = Math.round(manualCaffeine);
    sources.caffeine = "manual";
  } else if (histCaffeine != null) {
    caffeineMg = Math.round(histCaffeine);
    sources.caffeine = "history";
  } else {
    caffeineMg = targetMinutes > 60 ? 200 : null;
    sources.caffeine = "generic";
  }

  return {
    carbsPerHr: benchmark.needsCarbs ? `${benchmark.carbsLow}–${benchmark.carbsHigh}g` : "~30g",
    carbsTargetNum,
    sodiumMgHr,
    fluidsMlHr,
    caffeineMg,
    rationaleKey: benchmark.rationaleKey,
    carbsLabel: benchmark.carbsLabel,
    sources,
    notes,
    basedOnRaces: withFuel.length,
  };
}
