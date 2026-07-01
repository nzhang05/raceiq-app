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
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=IBM+Plex+Mono:wght@400;500&display=swap');

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
    html, body { background: ${T.bg}; margin: 0; }
    ::selection { background: ${T.brass}; color: ${T.bg}; }

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
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: rgba(19, 32, 27, 0.88) !important;
    }

    .view-enter {
      animation: fadeInView 220ms ease both;
    }

    .race-row {
      transition: background 120ms ease, transform 120ms ease;
    }
    .race-row:hover {
      background: rgba(244, 240, 228, 0.04) !important;
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
      background: rgba(201, 162, 75, 0.1);
      border: 1px solid ${T.brassDim};
      border-radius: 4px;
      padding: 2px 10px;
      line-height: 1;
    }

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
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <button
              onClick={() => setView("list")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 0 }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: 0.5, color: T.paper }}>RACE</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: 0.5, color: T.brass, border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "0 4px", marginLeft: 1, lineHeight: 1 }}>IQ</span>
            </button>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.inkDim, letterSpacing: 0.6, marginLeft: 8 }}>PROTOTYPE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              onClick={() => openCoach(null)}
              style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "6px 14px", borderRadius: 3, border: `1px solid ${view === "coach" ? T.brass : T.line}`, background: view === "coach" ? "rgba(201,162,75,0.12)" : "transparent", color: view === "coach" ? T.brass : T.inkDim, cursor: "pointer" }}
            >
              ASK RACEIQ
            </button>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim }}>
              ALEX MORENO · RATING <span style={{ color: T.brass }}>1842</span>
            </div>
          </div>
        </div>

        {view !== "list" && (
          <div style={{ padding: "0 32px 10px", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5 }}>
            <button onClick={() => setView("list")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}>
              RACES
            </button>
            {(view === "debrief" || view === "add" || view === "coach" || view === "compare" || view === "plan" || view === "plan-view") && (
              <>
                <span style={{ color: T.line, fontSize: 12 }}>›</span>
                {view === "debrief" && activeRace && <span style={{ color: T.ink }}>{activeRace.name.toUpperCase()}</span>}
                {view === "add" && <span style={{ color: T.ink }}>ADD RACE</span>}
                {view === "compare" && <span style={{ color: T.ink }}>COMPARE</span>}
                {view === "plan" && <span style={{ color: T.ink }}>PLAN A RACE</span>}
                {view === "plan-view" && (
                  <>
                    <button onClick={() => setView("plan")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}>
                      PLAN A RACE
                    </button>
                    <span style={{ color: T.line, fontSize: 12 }}>›</span>
                    <span style={{ color: T.ink }}>{planData?.course?.name?.toUpperCase() ?? "RACE PLAN"}</span>
                  </>
                )}
                {view === "coach" && coachContextRace && (
                  <>
                    <button onClick={() => setView("debrief")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}>
                      {coachContextRace.name.toUpperCase()}
                    </button>
                    <span style={{ color: T.line, fontSize: 12 }}>›</span>
                    <span style={{ color: T.ink }}>ASK RACEIQ</span>
                  </>
                )}
                {view === "coach" && !coachContextRace && <span style={{ color: T.ink }}>ASK RACEIQ</span>}
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
