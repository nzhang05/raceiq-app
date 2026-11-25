/*
  Fixture races for the grounding tests — deliberately awkward inputs the
  sample athlete doesn't cover. Each goes through enrichRace(), the same path a
  race entered in the app takes, so verdict, rating and GAP are engine-made.
*/
import { enrichRace } from "../../utils/ratings.js";

// Hand-entered result: no splits, no fueling. Every prompt builder must cope
// without printing "undefined" or "NaN" into the data block.
export const handEntered = enrichRace({
  id: "custom-hand",
  name: "Riverside Parkrun",
  sport: "Road Running",
  date: "2026-03-07",
  distanceKm: 5,
  elevationM: 12,
  surface: "Road",
  finishTime: "0:21:40",
  placement: 23,
  field: 310,
  tempC: 9,
  humidity: 70,
  wind: 11,
  splits: [],
  fueling: { carbsPerHr: null, sodiumPerHr: null, fluidsPerHr: null, caffeine: null },
});

// Long, hot ride with fueling logged by section: carbs fall away in the
// middle section exactly where pace fades and the temperature climbs.
export const sectionedRide = enrichRace({
  id: "custom-ride",
  name: "Valle Verde Gran Fondo",
  sport: "Road Cycling",
  date: "2026-07-12",
  distanceKm: 120,
  elevationM: 1450,
  surface: "Road",
  finishTime: "4:12:30",
  placement: 88,
  field: 900,
  tempC: 31,
  humidity: 38,
  wind: 12,
  splits: [
    { km: 20, pace: 1.85, tempC: 22, elevM: 210 },
    { km: 40, pace: 1.9, tempC: 25, elevM: 480 },
    { km: 60, pace: 2.05, tempC: 28, elevM: 650 },
    { km: 80, pace: 2.3, tempC: 31, elevM: 820 },
    { km: 100, pace: 2.35, tempC: 33, elevM: 700 },
    { km: 120, pace: 2.2, tempC: 32, elevM: 380 },
  ],
  fueling: {
    inputMode: "sections",
    sections: [
      { fromKm: 0, toKm: 40, carbsPerHr: 75, sodiumPerHr: 600, fluidsPerHr: 700, caffeineMg: 0 },
      { fromKm: 40, toKm: 80, carbsPerHr: 38, sodiumPerHr: 400, fluidsPerHr: 450, caffeineMg: 100 },
      { fromKm: 80, toKm: 120, carbsPerHr: 70, sodiumPerHr: 650, fluidsPerHr: 800, caffeineMg: 0 },
    ],
  },
});

// Hilly ultra with per-split elevation — grade-adjusted pace applies.
export const mountainUltra = enrichRace({
  id: "custom-ultra",
  name: "Crête des Aiguilles 80K",
  sport: "Trail Running",
  date: "2026-08-30",
  distanceKm: 80,
  elevationM: 4200,
  surface: "Singletrack",
  finishTime: "11:05:00",
  placement: 41,
  field: 380,
  tempC: 19,
  humidity: 55,
  wind: 15,
  splits: [
    { km: 10, pace: 6.9, tempC: 12, elevM: 900 },
    { km: 20, pace: 9.4, tempC: 15, elevM: 1650 },
    { km: 30, pace: 6.2, tempC: 18, elevM: 1200 },
    { km: 40, pace: 9.8, tempC: 21, elevM: 2050 },
    { km: 50, pace: 7.0, tempC: 23, elevM: 1500 },
    { km: 60, pace: 10.9, tempC: 22, elevM: 2200 },
    { km: 70, pace: 8.1, tempC: 18, elevM: 1600 },
    { km: 80, pace: 7.6, tempC: 15, elevM: 1050 },
  ],
  fueling: { carbsPerHr: 65, sodiumPerHr: 450, fluidsPerHr: 550, caffeine: 200 },
});

export const FIXTURE_RACES = [handEntered, sectionedRide, mountainUltra];
