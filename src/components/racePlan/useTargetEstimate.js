import { useState, useEffect } from "react";
import { isCyclingSport } from "../../constants.js";
import { estimateTargetTime, minutesToClock } from "../../utils/racePlan.js";
import { parseClockToMinutes } from "../../utils/time.js";
import { estimateFinishTime } from "../../lib/coachApi.js";

/*
  A suggested finish time for the loaded course, re-estimated whenever the
  course, sport, temperature or reference races change. The suggestion is also
  written into the target field through `setTargetClock`, which the athlete
  can then overwrite.
*/
export default function useTargetEstimate({ gpxData, sport, tempC, selectedRaces, allRaces, user, profile, setTargetClock, P }) {
  const [derivedClock, setDerivedClock] = useState("");
  const [derivedNote, setDerivedNote] = useState("");
  const [estimateSource, setEstimateSource] = useState(null); // null | "ai" | "fallback" | "loading"

  useEffect(() => {
    if (!gpxData) return;
    const plannedTempC = tempC !== "" ? parseFloat(tempC) : 15;
    const weather = tempC !== "" ? { tempC: plannedTempC } : null;
    const racesForEstimate = selectedRaces.length > 0 ? selectedRaces : allRaces;

    function applyDeterministic() {
      const result = estimateTargetTime(gpxData, sport, weather, racesForEstimate);
      setDerivedClock(result.clock);
      setTargetClock(result.clock);
      if (selectedRaces.length === 0) {
        setDerivedNote(P("form.genericPaceNote", { pace: P(isCyclingSport(sport) ? "form.genericPaceRide" : "form.genericPaceRun") }));
      } else {
        const ref = [...selectedRaces].sort((a, b) => {
          const aPace = parseClockToMinutes(a.finishTime) / a.distanceKm;
          const bPace = parseClockToMinutes(b.finishTime) / b.distanceKm;
          return aPace - bPace;
        })[0];
        setDerivedNote(P("form.referenceNote", { name: ref.name, finishTime: ref.finishTime, refKm: ref.distanceKm, courseKm: gpxData.distanceKm }));
      }
      setEstimateSource("fallback");
    }

    // The AI estimate runs server-side (see api/claude.js) and needs a signed-in
    // athlete. Any failure — signed out, unconfigured, rate limited, offline —
    // falls back to the deterministic estimate rather than surfacing an error.
    if (user && selectedRaces.length > 0) {
      setEstimateSource("loading");
      setDerivedNote("");
      estimateFinishTime({
        course: gpxData,
        sport,
        tempC: plannedTempC,
        races: selectedRaces,
        isCycling: isCyclingSport(sport),
        profile,
      })
        .then(({ estimatedMinutes, reasoning }) => {
          setDerivedClock(minutesToClock(estimatedMinutes));
          setTargetClock(minutesToClock(estimatedMinutes));
          setDerivedNote(reasoning || "");
          setEstimateSource("ai");
        })
        .catch(() => applyDeterministic());
    } else {
      applyDeterministic();
    }
  }, [gpxData, sport, tempC, selectedRaces, user, profile]);

  return { derivedClock, derivedNote, estimateSource };
}
