import { useState, useEffect, useMemo } from "react";
import { SPORT_OPTIONS } from "../../constants.js";

/*
  Which past races the plan learns from. Candidates are the athlete's finished
  races in the chosen sport; all of them start selected, and changing sport
  reselects the new sport's set.
*/
export default function useReferenceRaces(allRaces, sport) {
  const candidateRaces = useMemo(
    () => allRaces.filter((r) => r.sport === sport && r.finishTime && r.distanceKm > 0),
    [allRaces, sport]
  );
  const [selectedRaceIds, setSelectedRaceIds] = useState(() => new Set(allRaces.filter(r => r.sport === SPORT_OPTIONS[0] && r.finishTime && r.distanceKm > 0).map(r => r.id)));

  // When sport changes, select all candidates of the new sport
  useEffect(() => {
    setSelectedRaceIds(new Set(candidateRaces.map((r) => r.id)));
  }, [sport]);

  const selectedRaces = useMemo(
    () => candidateRaces.filter((r) => selectedRaceIds.has(r.id)),
    [candidateRaces, selectedRaceIds]
  );

  function toggleRace(id) {
    setSelectedRaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = candidateRaces.length > 0 && candidateRaces.every((r) => selectedRaceIds.has(r.id));

  function toggleAll() {
    if (allSelected) setSelectedRaceIds(new Set());
    else setSelectedRaceIds(new Set(candidateRaces.map((r) => r.id)));
  }

  return { candidateRaces, selectedRaceIds, selectedRaces, toggleRace, allSelected, toggleAll };
}
