import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { narrateDebrief, narratePlan } from "../lib/coachApi.js";

/*
  Runs the Claude analysis for a debrief or a race plan.

  The rule-engine findings always render first and immediately; this replaces
  them once the fuller analysis arrives. Every failure mode — signed out, server
  unconfigured, rate limited, offline — resolves to `status: "unavailable"` and
  the caller keeps showing the rule-engine view. The analysis is the better
  answer, never the only one.

  `args` must be memoised by the caller — it participates in the effect's
  dependencies, and a fresh object each render would re-request on every render.
*/
export function useNarrative(kind, args) {
  const { user, profile } = useAuth();
  const [narrative, setNarrative] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | unavailable

  useEffect(() => {
    const subject = kind === "plan" ? args?.plan : args?.race;
    if (!user || !subject) {
      setNarrative(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    const run = kind === "plan" ? narratePlan : narrateDebrief;
    run({ ...args, profile })
      .then((result) => {
        if (cancelled) return;
        setNarrative(result);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setNarrative(null);
        setStatus("unavailable");
      });

    return () => { cancelled = true; };
  }, [kind, args, user, profile]);

  return { narrative, status };
}
