// Fuel-kit builder catalogue. Per-unit macros for the common things an endurance
// athlete actually carries, so the plan's abstract "carry 145 g carbs" can be
// assembled into "3 gels + 1 flask + 1 bar." Values are typical/representative —
// the point is planning, not label-accurate nutrition tracking.
// `label` is the English fallback and a readable identifier for this table; the
// UI renders t(`plan:fuelItem.${key}`) instead, so translations live in the
// catalogs alongside everything else.
export const FUEL_ITEMS = [
  { key: "gel",    label: "Energy gel",              carbs: 25, sodiumMg: 50,  fluidMl: 0 },
  { key: "flask",  label: "Flask w/ sports mix",     carbs: 40, sodiumMg: 400, fluidMl: 500 },
  { key: "bottle", label: "Water bottle",            carbs: 0,  sodiumMg: 0,   fluidMl: 500 },
  { key: "chews",  label: "Chews (packet)",          carbs: 45, sodiumMg: 100, fluidMl: 0 },
  { key: "bar",    label: "Energy bar",              carbs: 40, sodiumMg: 80,  fluidMl: 0 },
  { key: "banana", label: "Banana",                  carbs: 27, sodiumMg: 1,   fluidMl: 0 },
  { key: "salt",   label: "Salt / electrolyte tab",  carbs: 0,  sodiumMg: 250, fluidMl: 0 },
];

// Sum the selected quantities into carb/sodium/fluid totals plus a flat item list.
export function tallyKit(quantities) {
  const totals = { carbsG: 0, sodiumMg: 0, fluidsMl: 0, count: 0 };
  const items = [];
  for (const item of FUEL_ITEMS) {
    const qty = quantities[item.key] || 0;
    if (qty <= 0) continue;
    totals.carbsG += item.carbs * qty;
    totals.sodiumMg += item.sodiumMg * qty;
    totals.fluidsMl += item.fluidMl * qty;
    totals.count += qty;
    items.push({ ...item, qty });
  }
  return { totals, items };
}

// Look up an item definition by key. Drop bags store bare `{ gel: 4 }` maps, so
// anything reading them back needs this to recover the macros.
export function fuelItem(key) {
  return FUEL_ITEMS.find((i) => i.key === key) ?? null;
}

/*
  Tally the fuel staged in drop bags across the whole race, plus a per-bag
  breakdown for the crew sheet.

  The distinction that matters on an ultra: what's *on your body* (the kit
  builder) versus what's *waiting for you* (this). Adding them together would
  tell an athlete they have 900 g of carbs when 700 of it is in a truck.
*/
export function tallyDropBags(stations) {
  const bags = [];
  const totals = { carbsG: 0, sodiumMg: 0, fluidsMl: 0, count: 0, gearCount: 0 };

  for (const station of stations ?? []) {
    if (!station.dropBag) continue;
    const { totals: bagTotals, items } = tallyKit(station.dropBag.items ?? {});
    const gear = station.dropBag.gear ?? [];
    bags.push({
      km: station.km,
      name: station.name,
      crewAccess: station.crewAccess === true,
      items,
      gear,
      notes: station.dropBag.notes ?? "",
      totals: bagTotals,
    });
    totals.carbsG += bagTotals.carbsG;
    totals.sodiumMg += bagTotals.sodiumMg;
    totals.fluidsMl += bagTotals.fluidsMl;
    totals.count += bagTotals.count;
    totals.gearCount += gear.length;
  }

  return { bags, totals };
}
