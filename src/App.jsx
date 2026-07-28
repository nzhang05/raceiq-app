import { useState, useMemo, useEffect } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SEED_RACES } from "./constants.js";
import { loadCustomRaces, saveCustomRaces } from "./utils/storage.js";
import RaceList from "./components/RaceList.jsx";
import AddRaceForm from "./components/AddRaceForm.jsx";
import RaceDebrief from "./components/RaceDebrief.jsx";
import CoachView from "./components/Coach.jsx";
import CompareView from "./components/Compare.jsx";
import RacePlanForm from "./components/RacePlanForm.jsx";
import RacePlanView from "./components/RacePlanView.jsx";

const FONT_IMPORT = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

    :root {
      --bg: ${T.bg};
      --bg2: ${T.bg2};
      --paper: ${T.paper};
      --ink: ${T.ink};
      --ink-dim: ${T.inkDim};
      --line: ${T.line};
      --brass: ${T.brass};
      --brass-dim: ${T.brassDim};
      --green: ${T.green};
      --ember: ${T.ember};
    }

    * { box-sizing: border-box; }
    html, body {
      background: ${T.bg};
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    ::selection { background: ${T.brass}; color: #fff; }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeInView {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(14px) saturate(140%);
      -webkit-backdrop-filter: blur(14px) saturate(140%);
      /* tracks light T.bg (#F4F6F8) at ~72% — update alongside theme toggle */
      background: rgba(244, 246, 248, 0.72) !important;
    }

    .view-enter {
      animation: fadeInView 220ms ease both;
    }

    .race-row {
      transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
    }
    .race-row:hover {
      background: ${T.surfaceHi} !important;
      border-color: ${T.brass}44 !important;
      transform: translateY(-1px);
    }
    .race-row .delete-btn {
      opacity: 0;
      transition: opacity 120ms ease, color 120ms ease;
    }
    .race-row:hover .delete-btn {
      opacity: 1;
    }

    .race-row .select-cb {
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .race-row:hover .select-cb,
    .race-row.is-selected .select-cb {
      opacity: 1;
    }

    .stat-enter {
      animation: slideUp 300ms ease both;
    }

    .score-badge {
      display: inline-block;
      background: ${T.brass}1A;
      border: 1px solid ${T.brass}44;
      border-radius: 999px;
      padding: 2px 10px;
      line-height: 1;
    }

    button { font-family: inherit; }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
    }
  `}</style>
);

export default function RaceIQApp() {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [coachContextRaceId, setCoachContextRaceId] = useState(null);
  const [customRaces, setCustomRaces] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [planData, setPlanData] = useState(null);

  useEffect(() => {
    loadCustomRaces().then((races) => {
      setCustomRaces(races);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveCustomRaces(customRaces);
  }, [customRaces, loaded]);

  const allRaces = useMemo(
    () => [...customRaces, ...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [customRaces]
  );

  const activeRace = allRaces.find((r) => r.id === activeId);
  const coachContextRace = coachContextRaceId ? allRaces.find(r => r.id === coachContextRaceId) : null;

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  function openRace(id) {
    setActiveId(id);
    setView("debrief");
  }

  function openCoach(raceId = null) {
    setCoachContextRaceId(raceId);
    setView("coach");
  }

  function handleSaveRace(race) {
    setCustomRaces((prev) => [...prev, race]);
    setActiveId(race.id);
    setView("debrief");
  }

  function handleEditRace(race) {
    setCustomRaces((prev) => prev.map((r) => (r.id === race.id ? race : r)));
    setActiveId(race.id);
    setView("debrief");
  }

  function handlePlanGenerated(plan) {
    setPlanData(plan);
    setView("plan-view");
  }

  function handleCoachBack() {
    if (coachContextRaceId) setView("debrief");
    else setView("list");
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.paper, fontFamily: FONT_BODY, padding: "0" }}>
      {FONT_IMPORT}

      <div className="app-header" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => setView("list")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 1 }}
          >
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, color: T.paper }}>Race</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, color: T.brass }}>IQ</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => openCoach(null)}
              style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 999, border: `1px solid ${view === "coach" ? T.brass : T.line}`, background: view === "coach" ? `${T.brass}1A` : "transparent", color: view === "coach" ? T.brass : T.ink, cursor: "pointer", transition: "all 140ms ease" }}
            >
              Ask RaceIQ
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 8px 5px 12px", borderRadius: 999, background: T.surface, border: `1px solid ${T.line}` }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: T.ink }}>Alex Moreno</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, color: T.brass, background: `${T.brass}1A`, borderRadius: 999, padding: "3px 9px" }}>1842</span>
            </div>
          </div>
        </div>

        {view !== "list" && (
          <div style={{ padding: "0 32px 12px", display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13 }}>
            <button onClick={() => setView("list")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
              Races
            </button>
            {(view === "debrief" || view === "add" || view === "coach" || view === "compare" || view === "plan" || view === "plan-view") && (
              <>
                <span style={{ color: T.line }}>/</span>
                {view === "debrief" && activeRace && <span style={{ color: T.ink }}>{activeRace.name}</span>}
                {view === "add" && <span style={{ color: T.ink }}>Add race</span>}
                {view === "compare" && <span style={{ color: T.ink }}>Compare</span>}
                {view === "plan" && <span style={{ color: T.ink }}>Plan a race</span>}
                {view === "plan-view" && (
                  <>
                    <button onClick={() => setView("plan")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      Plan a race
                    </button>
                    <span style={{ color: T.line }}>/</span>
                    <span style={{ color: T.ink }}>{planData?.course?.name ?? "Race plan"}</span>
                  </>
                )}
                {view === "coach" && coachContextRace && (
                  <>
                    <button onClick={() => setView("debrief")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      {coachContextRace.name}
                    </button>
                    <span style={{ color: T.line }}>/</span>
                    <span style={{ color: T.ink }}>Ask RaceIQ</span>
                  </>
                )}
                {view === "coach" && !coachContextRace && <span style={{ color: T.ink }}>Ask RaceIQ</span>}
              </>
            )}
          </div>
        )}
      </div>

      <div key={view} className="view-enter" style={{ maxWidth: 920, margin: "0 auto", padding: "40px 32px 80px" }}>
        {view === "list" && (
          <RaceList
            races={allRaces}
            onOpen={openRace}
            onAddRace={() => setView("add")}
            onPlanRace={() => setView("plan")}
            onDelete={(id) => setCustomRaces((prev) => prev.filter((r) => r.id !== id))}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onCompare={() => setView("compare")}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
        {view === "compare" && (
          <CompareView
            races={allRaces.filter((r) => selectedIds.has(r.id))}
            onBack={() => setView("list")}
            onOpenDebrief={(id) => { setActiveId(id); setView("debrief"); }}
            onAskCoach={() => openCoach(null)}
          />
        )}
        {view === "add" && (
          <AddRaceForm onSave={handleSaveRace} onCancel={() => setView("list")} />
        )}
        {view === "edit" && activeRace && (
          <AddRaceForm initialRace={activeRace} onSave={handleEditRace} onCancel={() => setView("debrief")} />
        )}
        {view === "debrief" && activeRace && (
          <RaceDebrief
            race={activeRace}
            onBack={() => setView("list")}
            onAskCoach={() => openCoach(activeRace.id)}
            onEdit={activeRace.id.startsWith("custom-") ? () => setView("edit") : undefined}
          />
        )}
        {view === "coach" && (
          <CoachView races={allRaces} contextRace={coachContextRace} onBack={handleCoachBack} />
        )}
        {view === "plan" && (
          <RacePlanForm
            allRaces={allRaces}
            onPlanGenerated={handlePlanGenerated}
            onCancel={() => setView("list")}
          />
        )}
        {view === "plan-view" && planData && (
          <RacePlanView
            plan={planData}
            onBack={() => setView("list")}
            onLogRace={() => setView("add")}
            onAskCoach={() => openCoach(null)}
          />
        )}
      </div>
    </div>
  );
}
