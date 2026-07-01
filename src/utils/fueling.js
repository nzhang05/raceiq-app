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
      rationale: "Efforts under 45 minutes don't require carbohydrate intake — glycogen stores are more than sufficient. Water is appropriate.",
    };
  }
  if (durationMin < 75) {
    return {
      needsCarbs: false,
      carbsLow: 0,
      carbsHigh: 30,
      carbsLabel: "0–30g/hr",
      peerAvg: 15,
      rationale: "For 45–75 minute efforts, exogenous carbohydrate has minimal performance benefit. Small amounts (0–30g/hr) may help gut comfort but aren't required.",
    };
  }
  if (durationMin < 150) {
    return {
      needsCarbs: true,
      carbsLow: 30,
      carbsHigh: 60,
      carbsLabel: "30–60g/hr",
      peerAvg: 45,
      rationale: "For 75–150 minute efforts, 30–60g/hr of carbohydrate supports performance. Single-source carbs (glucose) work well at this rate.",
    };
  }
  if (durationMin < 240) {
    return {
      needsCarbs: true,
      carbsLow: 60,
      carbsHigh: 90,
      carbsLabel: "60–90g/hr",
      peerAvg: 72,
      rationale: "For efforts over 2.5 hours, 60–90g/hr is the research-backed range. Multiple transportable carbs (glucose + fructose, 2:1 ratio) allow higher absorption rates.",
    };
  }
  return {
    needsCarbs: true,
    carbsLow: 80,
    carbsHigh: 120,
    carbsLabel: "80–120g/hr",
    peerAvg: 90,
    rationale: "For efforts over 4 hours, 80–120g/hr is achievable with a trained gut and glucose:fructose mix. Sodium replacement also becomes important at this duration.",
  };
}
