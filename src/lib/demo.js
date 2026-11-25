/*
  Public demo mode — the build a reviewer opens from the README link.

  Set VITE_DEMO_MODE=true at build time. The app then:
    - never talks to Supabase, even if its env vars are present, so a demo
      deployment can't create accounts or touch a database;
    - shows the sample athlete's races, labelled as sample data, and keeps
      anything a visitor adds in their own browser (localStorage);
    - answers the AI surfaces from pre-recorded responses for the sample races
      (src/demo/recordings), and only goes to the live model when the server
      grants a demo budget (see api/_lib/demo.js). The recordings are checked
      by the same grounding test as everything else (npm test).

  The server reads the same variable (VITE_ vars are visible to Vercel
  functions at runtime), so one flag switches both halves.
*/
export const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

// Everything RaceIQ keeps in localStorage is namespaced "raceiq:". A demo reset
// clears it so the visitor is back to the untouched sample athlete.
export function resetDemoData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("raceiq:") && k !== "raceiq:locale")
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing persisted, nothing to reset */
  }
}
