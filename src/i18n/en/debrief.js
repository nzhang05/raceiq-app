/*
  Debrief findings and recommendations.

  These are the sentence templates that `src/utils/analysis.js` selects between.
  The engine returns { key, values, context } and never prose, so each entry
  below is a whole, self-contained sentence — a translator may reorder it
  freely. Never split one sentence across two keys.

  The `_gap` variants are chosen when the pace being quoted is grade-adjusted
  (i18next `context`). They exist so the qualifier can sit wherever the target
  language wants it rather than being concatenated after the pace.

  Number placeholders use i18next's Intl formatting so French renders a comma
  decimal separator. Paces ("4:42/km") and clock times are pre-formatted by the
  engine and are deliberately not number-formatted.
*/
export default {
  pacing: {
    even: {
      title: "Pacing held even through the finish",
      body: "Your closing third averaged {{lastPace}} against {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change — with split-to-split variation of just {{cv, number(maximumFractionDigits: 1)}}%. That control is the signature of a well-judged effort.",
      body_gap: "Your closing third averaged {{lastPace}} grade-adjusted against {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change — with split-to-split variation of just {{cv, number(maximumFractionDigits: 1)}}%. That control is the signature of a well-judged effort.",
    },
    faded: {
      title: "Pace faded through the back third",
      body: "Your closing third averaged {{lastPace}}, up from {{firstPace}} across the opening third — a {{fade, number}}% slowdown. It built progressively rather than appearing in one bad split, which points to accumulating fatigue, fueling, or heat rather than a single section.",
      body_gap: "Your closing third averaged {{lastPace}} grade-adjusted, up from {{firstPace}} across the opening third — a {{fade, number}}% slowdown. It built progressively rather than appearing in one bad split, which points to accumulating fatigue, fueling, or heat rather than a single section.",
    },
    drift: {
      title: "Some late-race drift, but no collapse",
      body: "Closing third {{lastPace}} vs {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change, variation {{cv, number(maximumFractionDigits: 1)}}%. Solid, with a little time still available from tighter back-half pacing.",
      body_gap: "Closing third {{lastPace}} grade-adjusted vs {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change, variation {{cv, number(maximumFractionDigits: 1)}}%. Solid, with a little time still available from tighter back-half pacing.",
    },
    steady: {
      title: "Reasonably even pacing",
      body: "Closing third {{lastPace}} vs {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change, variation {{cv, number(maximumFractionDigits: 1)}}%. Solid, with a little time still available from tighter back-half pacing.",
      body_gap: "Closing third {{lastPace}} grade-adjusted vs {{firstPace}} in the opening third — a {{fade, number(signDisplay: exceptZero)}}% change, variation {{cv, number(maximumFractionDigits: 1)}}%. Solid, with a little time still available from tighter back-half pacing.",
    },
  },

  heat: {
    tracked: {
      title: "Your slowdown tracked the rising course temperature",
      body: "Course temperature climbed from {{tmin, number}}°C to {{tmax, number}}°C over the race, and your pace gave way as it did. A {{rose, number}}°C rise into the mid-20s is enough to drive cardiovascular drift independent of fitness.",
    },
    cool: {
      title: "Cool conditions played to your pacing",
      body: "Temperatures stayed between {{tmin, number}}°C and {{tmax, number}}°C — below the band where heat becomes a limiter — and your even splits reflect it.",
    },
  },

  fuel: {
    light: {
      title: "Carbohydrate intake was light for the duration",
      body: "You took {{taken, number}}g/hr; the evidence-backed range for a {{durationMin, number}}-minute effort is {{carbsLow, number}}–{{carbsHigh, number}}g/hr. That {{gap, number}}g/hr shortfall most often shows up late, where glycogen runs thin.",
    },
    matched: {
      title: "Fueling matched the demand of the distance",
      body: "{{taken, number}}g/hr sits inside the {{carbsLow, number}}–{{carbsHigh, number}}g/hr range for this duration and you held pace to the line — carry the same rate into your next effort of similar length.",
    },
  },

  section: {
    fuelDropped: {
      title: "Fuel dropped where your pace did",
      body: "Over km {{fromKm, number(maximumFractionDigits: 1)}}–{{toKm, number(maximumFractionDigits: 1)}} your carb intake was {{carbRate, number}}g/hr — {{gap, number}}g/hr under the {{carbsLow, number}}–{{carbsHigh, number}}g/hr range for a {{durationMin, number}}-minute effort — and that's exactly where your pace slipped from {{firstPace}} to {{lastPace}}. The fade tracks the fuel, not just the distance.",
    },
    fuelledClose: {
      title: "You fuelled the back section and it held",
      body: "Through the closing km {{fromKm, number(maximumFractionDigits: 1)}}–{{toKm, number(maximumFractionDigits: 1)}} you took {{carbRate, number}}g/hr — inside the {{carbsLow, number}}–{{carbsHigh, number}}g/hr range — and pace held at {{lastPace}}. Fuelling late is exactly where it pays off.",
    },
    fluidFell: {
      title: "Fluid intake fell as it got hotter",
      body: "Over km {{fromKm, number(maximumFractionDigits: 1)}}–{{toKm, number(maximumFractionDigits: 1)}} the course averaged {{curTemp, number}}°C — up from {{prevTemp, number}}°C — yet your fluid intake dropped to {{curFluid, number}}ml/hr from {{prevFluid, number}}ml/hr. Hydration should rise with temperature, not fall.",
    },
  },

  climb: {
    matched: {
      title: "Climbing effort matched your flat pace",
      body: "Across sections averaging {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}}% grade, your grade-adjusted pace tracked within {{deltaPct, number(maximumFractionDigits: 0)}}% of your flat effort — strong climbing economy for this course.",
    },
    costly: {
      title: "Climbing cost more than the flats account for",
      body: "Across sections averaging {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}}% grade, your grade-adjusted effort ran {{deltaPct, number(maximumFractionDigits: 0)}}% slower than your flat splits — more than the grade alone explains, which usually means power or form broke down on the climbs specifically.",
    },
  },

  descent: {
    efficient: {
      title: "Descents recovered time efficiently",
      body: "On grades averaging {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}}%, raw pace ran roughly {{recovered, number(maximumFractionDigits: 0)}}% faster than effort-adjusted pace — gravity was doing the work the way it should, with no sign of over-braking.",
    },
  },

  rec: {
    heatPlan: {
      action: "Build a heat-specific pacing plan for races above 24°C",
      why: "Your fade this race coincided with temperatures peaking at {{tmax, number}}°C. Starting 4–6% slower through halfway preserves more time than it costs once it's warm.",
    },
    raiseCarbs: {
      action: "Raise carbohydrate intake toward {{carbsLow, number}}–{{carbsHigh, number}}g/hr",
      why: "At {{taken, number}}g/hr you were {{gap, number}}g/hr under the low end of the {{carbsLow, number}}–{{carbsHigh, number}}g/hr range for {{durationMin, number}}-minute efforts. {{rationale}}",
    },
    holdCarbs: {
      action: "Hold {{carbsLow, number}}–{{carbsHigh, number}}g/hr through km {{fromKm, number(maximumFractionDigits: 1)}}–{{toKm, number(maximumFractionDigits: 1)}}",
      why: "You under-fuelled that section by {{gap, number}}g/hr and it's where the wheels came off. Carrying the target rate through it is the highest-leverage change for this course. {{rationale}}",
    },
    climbIntervals: {
      action: "Train climbing-specific intervals at race grade",
      why: "Your grade-adjusted pace on this course's climbs is the clearest signal for where to focus — hill repeats at a similar {{grade, number(maximumFractionDigits: 0)}}% grade will transfer more directly than flat tempo work.",
    },
    openEasier: {
      action: "Hold the opening third 3–5 sec/km slower than target",
      why: "Your {{fade, number}}% positive split this race is the classic signature of starting too fast. Banking a few seconds early is the cheapest time you'll find.",
    },
  },

  // deriveHeadline() in src/utils/ratings.js — the one-line verdict summary.
  headline: {
    strengthCool: "Even pacing in cool conditions produced a strong result.",
    strengthWarm: "Pace held steady through the finish — a well-executed race.",
    limiterHot: "Heat drove a significant slowdown in the closing stages.",
    limiterCool: "Pace faded notably in the closing stages.",
    mixed: "A mixed result — some splits held, others slipped.",
  },

  // SEED_RACES headlines (src/constants.js) — demo data, but user-visible prose.
  seed: {
    r1: "Heat and a fast first half cost you the back nine.",
    r2: "Even effort on the climbs delivered your best ultra to date.",
    r3: "Strong legs, but headwind sectors leaked more time than fueling did.",
    r4: "Negative split in cool conditions — your fitness is ahead of your race calendar.",
  },

  /*
    Not findings — statements about coverage.

    The debrief shows exactly three takeaways because it lays them out as three
    cards. When the rule engine can produce fewer than three (see
    toThreeFindings in src/utils/analysis.js), the remaining slots say which
    analysis could not run and what would unlock it. Padding with a real-looking
    finding would be a lie in a product whose whole claim is that it only says
    what the data supports.
  */
  context: {
    noSplits: {
      title: "No splits for this race",
      body: "Pacing, fade and heat analysis all read the split series. Add splits to this race and the debrief can tell you how the effort was distributed.",
    },
    noElevation: {
      title: "No elevation data",
      body: "Without per-split elevation there is no grade-adjusted pace, so climbing and descending cannot be separated from the flat sections.",
    },
    noFueling: {
      title: "No fueling logged",
      body: "Carbohydrate, fluid and sodium intake are the most common explanation for a late fade. Log what you took and it can be checked against the target for this duration.",
    },
    thinData: {
      title: "Not much to go on yet",
      body: "This race's data supports the findings above and no more. More detail here, or more races to compare against, is what turns a single result into a pattern.",
    },
  },

};
