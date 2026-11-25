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
import { SparkIcon } from "./components/icons.jsx";

// "Noah Zhang" → "NZ"; "noah@example.com" → "N".
function initials(name) {
  const parts = String(name || "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

const FONT_IMPORT = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400&display=swap');

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
      color: ${T.paper};
      margin: 0;
      font-family: ${FONT_BODY};
      /* Tabular figures everywhere: finish times, paces and distances line up
         in columns without a monospace face. */
      font-variant-numeric: tabular-nums;
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
      /* T.bg (#F6F4ED) at ~86% — update alongside a theme toggle */
      background: rgba(246, 244, 237, 0.86) !important;
    }

    .view-enter {
      animation: fadeInView 220ms ease both;
    }

    .app-tab:hover { color: ${T.paper} !important; }

    /* Gentle motion only, and none for people who ask for none. */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 1ms !important; animation-delay: 0ms !important; transition-duration: 1ms !important; }
    }

    .race-row {
      transition: box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease;
    }
    .race-row:hover {
      border-color: ${T.brass}55 !important;
      box-shadow: 0 8px 24px rgba(30, 41, 35, 0.08);
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
    @media (max-width: 900px) and (min-width: 641px) {
      .race-card {
        grid-template-columns: 150px minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.9fr) 28px !important;
        grid-template-areas: "photo name time cond chev" "photo insight insight insight chev";
      }
      .race-card .rc-photo { grid-area: photo; }
      .race-card .rc-name { grid-area: name; }
      .race-card .rc-time { grid-area: time; }
      .race-card .rc-cond { grid-area: cond; }
      .race-card .rc-insight { grid-area: insight; border-left: none !important; border-top: 1px solid ${T.line}; margin: 0 22px 18px !important; padding: 12px 0 0 !important; }
      .race-card .rc-chevron { grid-area: chev; }
      .pattern-panel { grid-template-columns: auto minmax(0, 1fr) !important; }
      .pattern-panel figure { grid-column: 1 / -1; }
    }
    @media (max-width: 900px) {
      .debrief-head { grid-template-columns: 1fr !important; gap: 22px !important; }
      .debrief-head .debrief-photo { min-height: 180px !important; order: -1; }
      .takeaway-grid,
      .fueling-grid {
        grid-template-columns: 1fr !important;
      }
      .season-grid { grid-template-columns: repeat(3, auto) !important; row-gap: 18px; }
      .season-strongest { grid-column: 1 / -1; border-left: none !important; padding-left: 0 !important; }
    }

    /* Phones (checked at 390px). Fixed inline grids reflow here; selectors
       match classNames in App, RaceList, RaceDebrief, Compare and the forms. */
    @media (max-width: 640px) {
      .app-header-row { padding: 10px 16px 0 !important; flex-wrap: wrap; column-gap: 10px !important; row-gap: 6px !important; }
      .app-header-actions { gap: 8px !important; flex-wrap: wrap; justify-content: flex-end; }
      .app-header-actions .nav-pill { padding: 6px 12px !important; }
      /* Tabs drop to their own full-width row under the wordmark. */
      .app-tabs { order: 3; flex: 1 0 100%; min-height: 40px; margin: 0 -16px; padding: 0 6px; overflow-x: auto; }
      .app-breadcrumb { padding: 0 16px 10px !important; flex-wrap: wrap; }
      .demo-banner { padding: 8px 16px !important; }
      .app-main { padding: 24px 16px 72px !important; }

      .home-hero { grid-template-columns: 1fr !important; min-height: 0 !important; }
      .home-hero > div:first-child { padding: 24px 22px 26px !important; }
      .home-hero h1 { font-size: 34px !important; letter-spacing: -0.6px !important; }
      .home-hero .home-hero-photo { inset: 0 !important; opacity: 0.35; }
      .season-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; row-gap: 18px !important; }
      .season-stat { flex-direction: column; align-items: flex-start !important; gap: 6px !important; padding-right: 8px !important; }
      .season-stat svg { width: 24px; height: 24px; }
      .season-stat > div > div:first-child { font-size: 26px !important; }
      .season-strongest { grid-column: 1 / -1; border-left: none !important; border-top: 1px solid ${T.line}; padding: 14px 0 0 !important; }
      .pattern-panel { grid-template-columns: 1fr !important; padding: 20px !important; gap: 14px !important; }
      .pattern-panel > span:first-child { display: none !important; }
      .race-card {
        grid-template-columns: 96px minmax(0, 1fr) auto 28px !important;
        grid-template-areas: "photo name name chev" "time time cond cond" "insight insight insight insight";
      }
      .race-card .rc-photo { grid-area: photo; min-height: 96px; }
      .race-card .rc-name { grid-area: name; padding: 14px 14px !important; }
      .race-card .rc-name h3 button { font-size: 19px !important; white-space: normal !important; }
      .race-card .rc-chevron { grid-area: chev; }
      .race-card .rc-time { grid-area: time; justify-content: flex-start !important; gap: 18px; border-left: none !important; border-top: 1px solid ${T.line}; margin: 0 0 0 14px !important; padding: 12px 0; font-size: 24px !important; }
      .race-card .rc-cond { grid-area: cond; border-left: none !important; border-top: 1px solid ${T.line}; margin: 0 14px 0 0 !important; padding: 10px 0 0 !important; align-items: flex-end; text-align: right; }
      .race-card .rc-insight { grid-area: insight; border-left: none !important; border-top: 1px solid ${T.line}; margin: 0 14px 14px !important; padding: 12px 0 0 !important; }

      .stat-strip { grid-template-columns: 1fr 1fr !important; }
      .stat-strip > :nth-child(odd) { border-left: none !important; }
      .stat-strip > :nth-child(n+3) { border-top: 1px solid ${T.line}; }

      .form-grid-2, .form-grid-3, .form-grid-4 { grid-template-columns: 1fr !important; }
      .page-title { font-size: 30px !important; }
      .debrief-head h1 { font-size: 34px !important; }
      .plan-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .debrief-head p { font-size: 22px !important; }
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

  // Header identity. A signed-in athlete sees their initials (linking to their
  // profile); everyone else is looking at the sample athlete, and the header
  // says so.
  const signedIn = isConfigured && Boolean(user);
  const athleteName = signedIn ? (profile?.display_name || user.email) : t("nav.sampleAthlete");

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
        <div className="app-header-row" style={{ padding: "0 32px", minHeight: 64, display: "flex", alignItems: "center", gap: 40 }}>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label={t("nav.home")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 500, letterSpacing: -0.4, color: T.brass, lineHeight: 1 }}
          >
            RaceIQ
          </button>

          {/* Top-level sections. The tab underline marks where you are; nested
              views (a race, the compare page) still belong to Races. */}
          <nav aria-label={t("nav.main")} className="app-tabs" style={{ display: "flex", alignSelf: "stretch", gap: 4 }}>
            {[
              { key: "races", label: t("nav.races"), views: ["list", "debrief", "add", "compare"], go: () => setView("list") },
              { key: "plan", label: t("nav.plan"), views: ["plan", "plan-view"], go: () => setView("plan") },
              ...(signedIn ? [{ key: "profile", label: t("nav.profile"), views: ["profile"], go: () => setView("profile") }] : []),
            ].map((tab) => {
              const active = tab.views.includes(view);
              return (
                <button
                  key={tab.key}
                  type="button"
                  className="app-tab"
                  aria-current={active ? "page" : undefined}
                  onClick={tab.go}
                  style={{ background: "none", border: "none", borderBottom: `2px solid ${active ? T.brass : "transparent"}`, padding: "0 14px", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: active ? 600 : 500, color: active ? T.paper : T.ink, transition: "color 140ms ease, border-color 140ms ease" }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="app-header-actions" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
            <LanguageToggle />
            <button
              type="button"
              className="nav-pill"
              aria-current={view === "coach" ? "page" : undefined}
              onClick={() => openCoach(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 500, padding: "8px 16px", borderRadius: 999, border: `1px solid ${view === "coach" ? T.brass : T.line}`, background: view === "coach" ? `${T.brass}14` : T.surface, color: view === "coach" ? T.brass : T.paper, cursor: "pointer", transition: "all 140ms ease" }}
            >
              <SparkIcon size={15} />
              {t("nav.askRaceIQ")}
            </button>
            {signedIn ? (
              <button
                type="button"
                onClick={() => setView("profile")}
                aria-label={t("nav.profileOf", { name: athleteName })}
                title={athleteName}
                style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${view === "profile" ? T.brass : T.line}`, background: T.sageTint, color: T.brassDim, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {initials(athleteName)}
              </button>
            ) : (
              // The sample athlete is a label, not a link to a profile that
              // can't be saved without an account.
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: T.ink, padding: "7px 12px", borderRadius: 999, background: T.sageTint }}>
                {athleteName}
              </span>
            )}
            {signedIn && (
              <button
                type="button"
                onClick={signOut}
                style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, padding: 0, border: "none", background: "none", color: T.inkDim, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {t("nav.signOut")}
              </button>
            )}
          </div>
        </div>

        {["debrief", "add", "compare", "plan-view"].includes(view) || (view === "coach" && coachContextRace) ? (
          <nav aria-label={t("nav.breadcrumb")} className="app-breadcrumb" style={{ padding: "10px 32px", borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13 }}>
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
        ) : null}

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

      <main key={view} className="view-enter app-main" style={{ maxWidth: view === "list" ? 1160 : 1040, margin: "0 auto", padding: "40px 32px 80px" }}>
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
