import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SEED_RACES } from "./constants.js";
import { loadCustomRaces, saveCustomRaces, migrateLocalRaces } from "./utils/storage.js";
import { useAuth } from "./context/AuthContext.jsx";
import SignIn from "./components/SignIn.jsx";
import ProfileForm from "./components/ProfileForm.jsx";
import RaceList from "./components/RaceList.jsx";
import AddRaceForm from "./components/AddRaceForm.jsx";
import RaceDebrief from "./components/RaceDebrief.jsx";
import CoachView from "./components/Coach.jsx";
import CompareView from "./components/Compare.jsx";
import RacePlanForm from "./components/RacePlanForm.jsx";
import RacePlanView from "./components/RacePlanView.jsx";
import LanguageToggle from "./components/LanguageToggle.jsx";
import { isDemo, resetDemoData } from "./lib/demo.js";

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
    /* The row's secondary controls appear on hover — and also whenever the
       row holds keyboard focus, and always on touch screens, which have no
       hover to reveal them. */
    .race-row .delete-btn,
    .race-row .select-cb {
      opacity: 0;
      transition: opacity 120ms ease, color 120ms ease;
    }
    .race-row:hover .delete-btn,
    .race-row:focus-within .delete-btn,
    .race-row:hover .select-cb,
    .race-row:focus-within .select-cb,
    .race-row.is-selected .select-cb {
      opacity: 1;
    }
    @media (hover: none) {
      .race-row .delete-btn,
      .race-row .select-cb { opacity: 1; }
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

    /* Keyboard focus is always visible. Many controls set outline: none inline
       to drop the mouse-click ring, so this needs !important to win; it only
       applies to :focus-visible, so mouse users don't see it. */
    :focus-visible {
      outline: 2px solid ${T.brass} !important;
      outline-offset: 2px;
      border-radius: 4px;
    }
    input:focus-visible, select:focus-visible, textarea:focus-visible {
      outline-offset: 0;
    }

    .visually-hidden {
      position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }

    /* The only responsive rules in the app. Layout is otherwise fixed
       gridTemplateColumns in inline styles, which cannot carry a media query —
       so the multi-column blocks that genuinely break below ~900px collapse
       here instead. Keep the selectors in sync with the components that set
       these classNames (RaceDebrief, SeasonForm). */
    @media (max-width: 900px) {
      .takeaway-grid,
      .fueling-grid,
      .season-form {
        grid-template-columns: 1fr !important;
      }
    }

    /* Phones (checked at 390px). Fixed inline grids reflow here; selectors
       match classNames in App, RaceList, RaceDebrief, Compare and the forms. */
    @media (max-width: 640px) {
      .app-header-row { padding: 12px 16px !important; flex-wrap: wrap; gap: 10px; }
      .app-header-actions { gap: 8px !important; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
      .app-header-actions .nav-pill { padding: 6px 12px !important; }
      .app-breadcrumb { padding: 0 16px 10px !important; flex-wrap: wrap; }
      .demo-banner { padding: 8px 16px !important; }
      .app-main { padding: 24px 16px 72px !important; }

      .race-list-head { display: none !important; }
      .race-row {
        grid-template-columns: 22px minmax(0, 1fr) auto auto !important;
        grid-template-areas: "cb name name del" "cb dist finish verdict";
        column-gap: 12px !important; row-gap: 8px !important; padding: 12px !important;
      }
      .race-row .rl-cb { grid-area: cb; align-self: start; padding-top: 2px; }
      .race-row .rl-name { grid-area: name; }
      .race-row .rl-dist { grid-area: dist; }
      .race-row .rl-finish { grid-area: finish; font-size: 15px !important; }
      .race-row .rl-verdict { grid-area: verdict; }
      .race-row .rl-del { grid-area: del; align-self: start; }
      .race-row .rl-cond, .race-row .rl-shape { display: none !important; }

      .stat-strip { grid-template-columns: 1fr 1fr !important; }
      .stat-strip > :nth-child(odd) { border-left: none !important; }
      .stat-strip > :nth-child(n+3) { border-top: 1px solid ${T.line}; }

      .form-grid-2, .form-grid-3, .form-grid-4 { grid-template-columns: 1fr !important; }
      .page-title { font-size: 28px !important; }
      .compare-bar { left: 16px !important; right: 16px; transform: none !important; justify-content: space-between; }
      /* Compare tables keep their columns and scroll sideways inside their own
         box (a focusable region), rather than squeezing figures or pushing the
         page wider than the screen. */
      .compare-table { overflow-x: auto !important; }
      .compare-row { min-width: 500px; }
      .weather-lookup { flex-wrap: wrap; }
      .weather-lookup > button { flex: 1 1 100% !important; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
    }
  `}</style>
);

// RaceIQ used to ask athletes for their own Anthropic key and keep it in
// localStorage. Claude calls now run server-side (api/claude.js), so any key
// left behind by that flow is a credential sitting in the browser for no
// reason — clear it once, on load.
function purgeLegacyApiKey() {
  try { localStorage.removeItem("raceiq:apikey"); } catch {}
}

export default function RaceIQApp() {
  const { t } = useTranslation();
  const { ready, isConfigured, user, profile, signOut } = useAuth();
  useEffect(purgeLegacyApiKey, []);
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [coachContextRaceId, setCoachContextRaceId] = useState(null);
  const [customRaces, setCustomRaces] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [planData, setPlanData] = useState(null);

  // Load races for the current context. When Supabase is configured, this
  // re-runs on sign-in/out (keyed on user id) and imports any localStorage
  // races into the account once, on first login.
  useEffect(() => {
    if (isConfigured && !user) {
      setCustomRaces([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (isConfigured && user) await migrateLocalRaces();
      const races = await loadCustomRaces();
      if (!cancelled) {
        setCustomRaces(races);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isConfigured, user?.id]);

  useEffect(() => {
    if (!loaded) return;
    saveCustomRaces(customRaces);
  }, [customRaces, loaded]);

  // The sample athlete belongs to local and demo mode only. A signed-in
  // athlete sees their own races — the coach and the cross-race analysis would
  // otherwise treat four strangers' results as theirs — and a new account
  // starts at the first-race empty state instead.
  const allRaces = useMemo(
    () => [...customRaces, ...(isConfigured ? [] : SEED_RACES)].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [customRaces, isConfigured]
  );

  const activeRace = allRaces.find((r) => r.id === activeId);

  // Header identity. A signed-in athlete sees their own name; everyone else is
  // looking at the sample athlete, and the header says so. The number beside
  // it is season form — the latest race's RaceIQ score, the same figure the
  // season card on the race list leads with — not a stored constant.
  const signedIn = isConfigured && Boolean(user);
  const athleteName = signedIn ? (profile?.display_name || user.email) : t("nav.sampleAthlete");
  const seasonRating = allRaces[0]?.rating ?? null;

  function handleResetDemo() {
    if (!window.confirm(t("demo.resetConfirm"))) return;
    resetDemoData();
    window.location.reload();
  }
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

  // Auth gate (only when a backend is configured). While the session resolves
  // we render a neutral background; unauthenticated users get the SignIn screen.
  if (isConfigured && !ready) {
    return <div style={{ minHeight: "100vh", background: T.bg }}>{FONT_IMPORT}</div>;
  }
  if (isConfigured && !user) {
    return <>{FONT_IMPORT}<SignIn /></>;
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.paper, fontFamily: FONT_BODY, padding: "0" }}>
      {FONT_IMPORT}

      <header className="app-header" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div className="app-header-row" style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => setView("list")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 1 }}
          >
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, color: T.paper }}>Race</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, color: T.brass }}>IQ</span>
          </button>
          <div className="app-header-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageToggle />
            <button
              type="button"
              className="nav-pill"
              aria-current={view === "coach" ? "page" : undefined}
              onClick={() => openCoach(null)}
              style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 999, border: `1px solid ${view === "coach" ? T.brass : T.line}`, background: view === "coach" ? `${T.brass}1A` : "transparent", color: view === "coach" ? T.brass : T.ink, cursor: "pointer", transition: "all 140ms ease" }}
            >
              {t("nav.askRaceIQ")}
            </button>
            {(() => {
              // Only a signed-in athlete has a profile to edit; the sample
              // athlete's chip is a label, not a link to a form that can't save.
              const Chip = signedIn ? "button" : "div";
              return (
                <Chip
                  {...(signedIn ? { type: "button", onClick: () => setView("profile") } : {})}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 8px 5px 12px", borderRadius: 999, background: view === "profile" ? T.surfaceHi : T.surface, border: `1px solid ${view === "profile" ? T.brass : T.line}`, cursor: signedIn ? "pointer" : "default", transition: "all 140ms ease" }}
                >
                  <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: T.ink }}>
                    {athleteName}
                  </span>
                  {seasonRating != null && (
                    <span
                      aria-label={t("nav.seasonForm", { rating: seasonRating })}
                      role="img"
                      style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, color: T.brass, background: `${T.brass}1A`, borderRadius: 999, padding: "3px 9px" }}
                    >
                      {seasonRating}
                    </span>
                  )}
                </Chip>
              );
            })()}
            {isConfigured && user && (
              <button
                onClick={signOut}
                style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, padding: "7px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer", transition: "all 140ms ease" }}
              >
                {t("nav.signOut")}
              </button>
            )}
          </div>
        </div>

        {view !== "list" && (
          <nav aria-label={t("nav.breadcrumb")} className="app-breadcrumb" style={{ padding: "0 32px 12px", display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13 }}>
            <button onClick={() => setView("list")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
              {t("nav.races")}
            </button>
            {view === "profile" && <><span style={{ color: T.line }}>/</span><span style={{ color: T.ink }}>{t("nav.profile")}</span></>}
            {(view === "debrief" || view === "add" || view === "coach" || view === "compare" || view === "plan" || view === "plan-view") && (
              <>
                <span style={{ color: T.line }}>/</span>
                {view === "debrief" && activeRace && <span style={{ color: T.ink }}>{activeRace.name}</span>}
                {view === "add" && <span style={{ color: T.ink }}>{t("nav.addRace")}</span>}
                {view === "compare" && <span style={{ color: T.ink }}>{t("nav.compare")}</span>}
                {view === "plan" && <span style={{ color: T.ink }}>{t("nav.planRace")}</span>}
                {view === "plan-view" && (
                  <>
                    <button onClick={() => setView("plan")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      {t("nav.planRace")}
                    </button>
                    <span style={{ color: T.line }}>/</span>
                    <span style={{ color: T.ink }}>{planData?.course?.name ?? t("nav.racePlan")}</span>
                  </>
                )}
                {view === "coach" && coachContextRace && (
                  <>
                    <button onClick={() => setView("debrief")} style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      {coachContextRace.name}
                    </button>
                    <span style={{ color: T.line }}>/</span>
                    <span style={{ color: T.ink }}>{t("nav.askRaceIQ")}</span>
                  </>
                )}
                {view === "coach" && !coachContextRace && <span style={{ color: T.ink }}>{t("nav.askRaceIQ")}</span>}
              </>
            )}
          </nav>
        )}

        {isDemo && (
          <div role="note" className="demo-banner" style={{ borderTop: `1px solid ${T.line}`, padding: "8px 32px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: FONT_BODY, fontSize: 13, color: T.ink }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: T.brass, background: `${T.brass}1A`, borderRadius: 999, padding: "2px 8px" }}>{t("demo.badge")}</span>
            <span style={{ flex: "1 1 240px" }}>{t("demo.banner")}</span>
            <button
              type="button"
              onClick={handleResetDemo}
              style={{ background: "none", border: "none", padding: 0, color: T.brass, fontFamily: "inherit", fontSize: "inherit", fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {t("demo.reset")}
            </button>
          </div>
        )}
      </header>

      <main key={view} className="view-enter app-main" style={{ maxWidth: 920, margin: "0 auto", padding: "40px 32px 80px" }}>
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
        {view === "profile" && (
          <ProfileForm onBack={() => setView("list")} />
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
            allRaces={allRaces}
            // The in-memory plan is only the athlete's most recent one, so pass
            // it as planned-vs-actual context only when the course actually
            // matches this race. Plans aren't persisted or linked to a race yet.
            plan={planData?.course?.name === activeRace.name ? planData : null}
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
            allRaces={allRaces}
            onBack={() => setView("list")}
            onLogRace={() => setView("add")}
            onAskCoach={() => openCoach(null)}
          />
        )}
      </main>
    </div>
  );
}
