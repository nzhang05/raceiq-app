/*
  Race planning: the plan form, the plan view, the carry plan, the fuelling
  rationale, and the printable export.

  `fuelRationale.*` is referenced by nesting from the debrief catalog
  ($t(plan:fuelRationale.…) — see fuelValues() in src/utils/analysis.js), so
  these entries must stay whole sentences that read correctly mid-paragraph.
*/
export default {
  form: {
    title: "Plan a Race",
    intro: "Upload your course GPX to get a personalised pacing strategy, nutrition targets, and tactical tips derived from your past results.",

    section: {
      course: "1 — Course",
      referenceRaces: "2 — Reference Races",
      conditions: "3 — Conditions",
      targetTime: "4 — Target Time",
      fueling: "5 — Fueling",
      aidStations: "6 — Aid Stations",
    },

    sport: "Sport",
    raceDate: "Race Date",
    upload: "Upload GPX or TCX",
    chooseFile: "CHOOSE FILE",
    noFile: "No file selected",
    loaded: "Loaded {{distanceKm, number}} km course with {{elevationM, number}}m elevation gain.",
    routeOnlyNote: " Route-only file (no timestamps) — pacing will use flat distribution.",
    parseError: "Could not parse this file.",
    stat: {
      distance: "Distance",
      elevation: "Elevation",
      profile: "Profile",
      hilly: "Hilly",
      rolling: "Rolling",
      flat: "Flat",
    },

    noPastRaces: "No past {{sport}} races in your history — the plan will use a generic pace baseline.",
    selectedCount: "{{selected, number}} of {{total, number}} selected",
    selectAll: "SELECT ALL",
    deselectAll: "DESELECT ALL",
    percentileShort: "{{pct, number(maximumFractionDigits: 1)}}th",
    noneSelected: "No races selected — plan will fall back to a generic baseline.",

    location: "Location (for forecast)",
    locationPlaceholder: "e.g. Chamonix, France",
    lookUp: "LOOK UP",
    forecastNote: "Forecast for {{place}} on {{date}}: {{tempC, number}}°C{{windPart}}. Adjust below if needed.",
    forecastWindPart: ", {{wind, number}} km/h wind",
    weatherError: "Couldn't look up weather — enter conditions manually below.",
    temp: "Temp (°C)",
    humidity: "Humidity (%)",
    wind: "Wind (km/h)",

    estimate: "ESTIMATE",
    estimateAi: "AI",
    estimateThinking: "THINKING…",
    genericPaceNote: "No races selected — using a generic pace of {{pace}}.",
    genericPaceRun: "5:00/km",
    genericPaceRide: "25 km/h",
    referenceNote: "Based on your best selected result: {{name}} ({{finishTime}} over {{refKm, number}} km), scaled to {{courseKm, number}} km.",
    targetLabel: "Your Target (H:MM:SS)",
    targetHint: "Edit to override the estimate above.",
    targetPlaceholder: "e.g. 3:45:00",

    fuelingIntro: "RaceIQ derives your nutrition targets from the fueling you actually logged in the reference races above{{defaultsPart}}. Override any field with a rate you know works for you — leave blank to keep the derived value.",
    fuelingIntroDefaults: " (research defaults until you have race history)",
    carbs: "Carbs/hr (g)",
    sodium: "Sodium/hr (mg)",
    fluids: "Fluids/hr (ml)",
    caffeine: "Caffeine (mg total)",
    fuelHint: {
      needTarget: "Enter a target time to derive this.",
      history_one: "Your average across {{count}} reference race.",
      history_other: "Your average across {{count}} reference races.",
      generic: "Research default — no history to draw from.",
    },

    aidIntro: "Mark where you can refill. RaceIQ works out how much food and fluid to carry on each leg between stations. Leave empty to skip.",
    aidNoCourse: "Upload a course above to place aid stations on the elevation profile.",
    addStation: "+ ADD STATION",
    autoSpace: "AUTO-SPACE",
    autoSpaceDisabled: "Upload a course first",
    colKm: "KM",
    colName: "NAME",
    colWater: "WATER",
    colFood: "FOOD",
    removeStation: "Remove station",
    carryCapacity: "Carry Capacity (ml)",
    carryCapacityHint: "Fluid you can hold between stations. Legs that exceed it get flagged.",
    carryCapacityPlaceholder: "e.g. 1000",

    waypoints: {
      foundNone_one: " Found {{count}} waypoint in the file, none recognisable as aid stations — check them in Section 6.",
      foundNone_other: " Found {{count}} waypoints in the file, none recognisable as aid stations — check them in Section 6.",
      seeded_one: " Found {{count}} aid station in the file and filled in Section 6.",
      seeded_other: " Found {{count}} aid stations in the file and filled in Section 6.",
      offered_one: " Found {{count}} aid station in the file — import it from Section 6 to replace your current list.",
      offered_other: " Found {{count}} aid stations in the file — import them from Section 6 to replace your current list.",
      ambiguousCaveat_one: " {{count}} sits near the course more than once, so the distance is a guess — check it.",
      ambiguousCaveat_other: " {{count}} sit near the course more than once, so the distance is a guess — check them.",
      replaceConfirm_one: "Replace your {{current, number}} station with the {{count}} from the course file?",
      replaceConfirm_other: "Replace your {{current, number}} stations with the {{count}} from the course file?",
      importButton: "IMPORT {{count, number}} FROM FILE",
      importTitle: "Use the aid stations marked in the uploaded course file",
      autoSpaceTitle: "Space stations evenly — a fallback for files that don't mark them",
      otherToggle_one: "{{count}} OTHER WAYPOINT IN THIS FILE",
      otherToggle_other: "{{count}} OTHER WAYPOINTS IN THIS FILE",
      otherIntro: "Cols, parking and anything RaceIQ didn't recognise. Tick one to add it as a station.",
      unnamed: "Unnamed waypoint",
      offCourse: " — not on this course{{distancePart}}",
      offCourseDistance: " ({{m, number}}m away)",
      ambiguousTitle: "This waypoint passes close to the course more than once — check the distance is the right one.",
    },
    errorNoCourse: "Upload a GPX file first.",
    errorNoTarget: "Enter a target time.",
    building: "BUILDING PLAN...",
    build: "BUILD MY PLAN →",
  },

  view: {
    eyebrow: "RACE PLAN",
    summary: {
      targetTime: "Target Time",
      courseProfile: "Course Profile",
      conditions: "Est. Conditions",
      basedOn: "Based On",
    },
    profile: {
      mountain: "Mountain",
      hilly: "Hilly",
      rolling: "Rolling/Flat",
    },
    elevGain: "+{{elevationM, number}}m gain",
    windSub: "{{wind, number}} km/h wind",
    genericPace: "Generic pace",
    referenceSub: "{{finishTime}} / {{distanceKm, number}}km",
    course: {
      title: "Course",
      showElevation: "SHOW ELEVATION",
      hideElevation: "HIDE ELEVATION",
      sub_one: "Your course, split into the {{count}} segment you planned.",
      sub_other: "Your course, split into the {{count}} segments you planned.",
      gradientNote: " The profile below is coloured by gradient.",
    },
    pacing: {
      title: "Pacing Plan",
      sub: "Target pace for each section between aid stations.",
      colSection: "SECTION",
      colDist: "DIST",
      colGrade: "GRADE %",
      colTargetPace: "TARGET PACE",
      colTime: "TIME",
      colKm: "KM",
      colElev: "ELEV (M)",
      colSegment: "SEGMENT",
    },
    nutrition: {
      title: "Nutrition Plan",
      carbsPerHr: "Carbs/hr",
      sodiumPerHr: "Sodium/hr",
      fluidsPerHr: "Fluids/hr",
      caffeine: "Caffeine",
      rationale: "RATIONALE",
      personalised_one: "Personalised from {{count}} of your races.",
      personalised_other: "Personalised from {{count}} of your races.",
    },
    carry: {
      title: "Fuel & Carry Plan",
      sub_one: "How much to carry out of each refill point across {{count}} aid station{{capacityPart}}.",
      sub_other: "How much to carry out of each refill point across {{count}} aid stations{{capacityPart}}.",
      capacityPart: " · {{capacity, number}} ml carry capacity",
      packAtStart: "PACK AT THE START",
      // <1> emphasises the two quantities; <2> is the optional gel count.
      packLine_one: "Leave the start line with <1>{{carbsG, number}} g carbs</1> (~{{gels, number}} gel) and <1>{{fluidsMl, number}} ml fluid</1> to reach {{toName}} at km {{toKm, number(maximumFractionDigits: 1)}}.",
      packLine_other: "Leave the start line with <1>{{carbsG, number}} g carbs</1> (~{{gels, number}} gels) and <1>{{fluidsMl, number}} ml fluid</1> to reach {{toName}} at km {{toKm, number(maximumFractionDigits: 1)}}.",
      packLine_none: "Leave the start line with <1>{{carbsG, number}} g carbs</1> and <1>{{fluidsMl, number}} ml fluid</1> to reach {{toName}} at km {{toKm, number(maximumFractionDigits: 1)}}.",
      colLeg: "LEG",
      colDist: "DIST",
      colTime: "TIME",
      colCarbs: "CARRY CARBS",
      colFluid: "CARRY FLUID",
      gels_one: "{{count}} gel",
      gels_other: "{{count}} gels",
      raceTotal: "RACE TOTAL",
    },
    kit: {
      title: "Build Your Kit",
      sub: "Assemble what you'll actually carry and check it against your targets.",
      vsTarget: "KIT VS TARGET",
      vsTargetRaceTotal: "KIT VS TARGET (RACE TOTAL)",
      carbs: "Carbs",
      fluids: "Fluids",
      sodium: "Sodium",
      addOne: "Add one {{item}}",
      removeOne: "Remove one {{item}}",
      packed_one: "{{count}} item packed",
      packed_other: "{{count}} items packed",
      empty: "Add items to start building your kit.",
    },
    recommendations: { title: "Tactical Recommendations" },
    logRace: "LOG THIS RACE AFTER →",
    downloadPdf: "↓ DOWNLOAD PDF",
    askCoach: "ASK RACEIQ",
  },

  segment: {
    FLAT: "FLAT",
    CLIMB: "CLIMB",
    DESCENT: "DESCENT",
  },

  point: {
    start: "Start",
    finish: "Finish",
    aid: "Aid {{n, number}}",
  },

  source: {
    manual: "YOU",
    history: "HISTORY",
    generic: "DEFAULT",
    manualTag: " (your input)",
    historyTag: " (from your history)",
  },

  fuelItem: {
    gel: "Energy gel",
    flask: "Flask w/ sports mix",
    bottle: "Water bottle",
    chews: "Chews (packet)",
    bar: "Energy bar",
    banana: "Banana",
    salt: "Salt / electrolyte tab",
  },

  // Carry-plan leg notes. `leg.overCapacity` is appended as a second sentence
  // by legNoteText() in src/i18n/render.js.
  leg: {
    fromStart: "Leave the start line carrying this.",
    waterOnly: "{{name}} is water-only — carry the carbs out from your previous stop.",
    restock: "Restock at {{name}}.",
    overCapacity: "Leg needs {{fluidsMl, number}} ml but you carry {{capacity, number}} ml — plan to drink to empty and refill.",
  },

  // Duration-banded carbohydrate guidance (src/utils/fueling.js).
  fuelRationale: {
    under45: "Efforts under 45 minutes don't require carbohydrate intake — glycogen stores are more than sufficient. Water is appropriate.",
    under75: "For 45–75 minute efforts, exogenous carbohydrate has minimal performance benefit. Small amounts (0–30g/hr) may help gut comfort but aren't required.",
    under150: "For 75–150 minute efforts, 30–60g/hr of carbohydrate supports performance. Single-source carbs (glucose) work well at this rate.",
    under240: "For efforts over 2.5 hours, 60–90g/hr is the research-backed range. Multiple transportable carbs (glucose + fructose, 2:1 ratio) allow higher absorption rates.",
    over240: "For efforts over 4 hours, 80–120g/hr is achievable with a trained gut and glucose:fructose mix. Sodium replacement also becomes important at this duration.",
  },

  fuelNote: {
    manualBelowRange: "Your {{target, number}}g/hr carb target sits below the {{low, number}}–{{high, number}}g/hr research range for this duration — fine if it's what your gut tolerates, but there's headroom to push.",
    provenHigh: "You've comfortably taken ~{{proven, number}}g/hr before, so the plan targets the top of the {{low, number}}–{{high, number}}g/hr range.",
    historyLow: "Your history averages ~{{typical, number}}g/hr — under the {{low, number}}–{{high, number}}g/hr range this duration calls for. The plan targets the low end; build the gut up toward it.",
  },

  // Pre-race tactical recommendations (src/utils/racePlan.js).
  rec: {
    heatStart: {
      action: "Start conservatively — your past heat races show a late fade",
      why: "You have historically underperformed in warm conditions. Dial back the opening third by 5–8 sec/km and bank the energy.",
    },
    fuelEarly: {
      action: "Fuel in the first 20 minutes, before you feel hungry",
      why: "Your past limiters include under-fueled races. Starting carbohydrate intake early prevents the late-race wall.",
    },
    preCool: {
      action: "Pre-cool before the start and add {{extraMl, number}} ml/hr extra fluids",
      why: "At {{tempC, number}}°C expect a ~{{penaltyPct, number}}% heat tax. Early hydration and active cooling are the highest-leverage mitigation.",
    },
    climbByEffort: {
      action: "Race by effort on the climbs, not by target pace",
      why: "{{elevationM, number}}m of gain means per-km pace will swing widely. Chase grade-adjusted effort on the uphills and let the descents pay you back.",
    },
    evenStart: {
      action: "Stick to your target splits in the opening third",
      why: "Going out too fast is the single most common cause of late-race fade, regardless of fitness level.",
    },
  },

  // The printable / PDF export (src/utils/planPdf.js).
  pdf: {
    title: "{{course}} — Race Plan",
    heading: "Race Plan",
    summary: {
      targetTime: "Target time",
      distance: "Distance",
      elevation: "Elevation",
      conditions: "Est. conditions",
      basedOn: "Based on",
      conditionsValue: "{{tempC, number}}°C{{windPart}}",
      windPart: ", {{wind, number}} km/h wind",
      basedOnValue: "{{name}} ({{finishTime}} / {{distanceKm, number}} km)",
      genericPace: "Generic pace",
    },
    summaryHeading: "Summary",
    kitItem: "Item",
    kitQty: "Qty",
    kitTotal: "Kit total",
    pacing: "Pacing",
    nutrition: "Nutrition",
    carry: "Carry plan",
    kit: "Kit",
    recommendations: "Recommendations",
    carbsPerHr: "Carbs / hr",
    sodiumPerHr: "Sodium / hr",
    fluidsPerHr: "Fluids / hr",
    caffeine: "Caffeine",
    footer: "Generated by RaceIQ",
  },

  // gpx.js / weather.js failures surfaced in the plan and add-race forms.
  errors: {
    unreadableFile: "Could not read this file — make sure it's a valid GPX or TCX export.",
    noTrackPoints: "No track points found in this file.",
    noTimestamps: "This file has GPS points but no timestamps, so RaceIQ can't compute pace from it. Try a file exported with time data, or enter splits manually.",
    weatherLookupFailed: "Weather lookup failed ({{status, number}}).",
    noHistoricalWeather: "No historical weather available for this date and location.",
    noWeatherForTime: "Weather data wasn't available for this exact time and place.",
    locationLookupFailed: "Location lookup failed.",
    locationNotFound: "Couldn't find a location matching \"{{query}}\". Try a nearby city name.",
  },
};
