import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { T, R, FONT_DISPLAY, FONT_BODY, SPORTS } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { findingText, recText, headlineText } from "../i18n/render.js";
import { seasonSummary, pickPattern, conditionsKey, raceInsight } from "../utils/season.js";
import { heroPhoto, racePhoto } from "../lib/photos.js";
import { Button } from "./ui.jsx";
import { PhotoSlot, TopoLines } from "./Topo.jsx";
import SportIcon from "./SportIcon.jsx";
import {
  ShoeIcon, MountainIcon, ClockIcon, ThermometerIcon, ArrowUpRightIcon, AlertIcon,
  BalanceIcon, ChevronRightIcon, CompassIcon, TrophyIcon,
} from "./icons.jsx";

/*
  Races — the home page of the endurance journal.

  Top to bottom: a short editorial hero, the season in four figures, the one
  pattern worth noting (when the data supports one), then each race as a card
  with a single insight. Every figure and every claim comes from the engine
  (src/utils/season.js, analysis.js); this file only lays them out.
*/

const HERO_SEEN_KEY = "raceiq:hero-seen";

// First visit: the full hero. Every visit after: a slim banner, so a returning
// athlete reaches their races without scrolling.
function useHeroSize() {
  const [compact] = useState(() => {
    try { return localStorage.getItem(HERO_SEEN_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(HERO_SEEN_KEY, "1"); } catch { /* storage unavailable */ }
  }, []);
  return compact;
}

function Hero({ compact }) {
  const { t } = useTranslation();
  const photo = heroPhoto();
  return (
    <section
      className={`home-hero${compact ? " is-compact" : ""}`}
      style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", alignItems: "center", minHeight: compact ? 150 : 280, margin: "0 0 36px", borderRadius: R.lg, overflow: "hidden", background: T.surface, border: `1px solid ${T.line}` }}
    >
      <div style={{ position: "relative", zIndex: 1, padding: compact ? "26px 32px" : "40px 40px 44px" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: compact ? 34 : 52, lineHeight: 1.05, letterSpacing: compact ? -0.6 : -1.2, margin: 0, color: T.paper, textWrap: "balance" }}>
          {t("raceList.hero.title")}
        </h1>
        {!compact && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 17, lineHeight: 1.55, color: T.ink, margin: "16px 0 0", maxWidth: 420 }}>
            {t("raceList.hero.sub")}
          </p>
        )}
        <div aria-hidden="true" style={{ width: 56, height: 2, background: T.brass, marginTop: compact ? 14 : 22 }} />
      </div>
      <PhotoSlot
        className="home-hero-photo"
        src={photo}
        alt={t("raceList.hero.photoAlt")}
        seed="hero"
        style={{ position: "absolute", inset: "0 0 0 42%", WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 28%)", maskImage: "linear-gradient(90deg, transparent 0, #000 28%)" }}
      />
    </section>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="season-stat" style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 28px 4px 0" }}>
      <span style={{ color: T.brass }}><Icon size={30} /></span>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500, lineHeight: 1, color: T.paper }}>{value}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function SeasonSummary({ races, onOpen }) {
  const { t } = useTranslation();
  const s = useMemo(() => seasonSummary(races), [races]);
  return (
    <section aria-labelledby="season-title" style={{ marginBottom: 28 }}>
      <h2 id="season-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 500, margin: "0 0 14px", color: T.paper }}>
        {t("raceList.season.title")}
        {s.yearsLabel && <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 400, color: T.inkDim }}> · {s.yearsLabel}</span>}
      </h2>
      <div className="season-grid" style={{ display: "grid", gridTemplateColumns: "auto auto auto minmax(0, 1fr)", alignItems: "center", gap: 0 }}>
        <Stat icon={ShoeIcon} value={s.count} label={t("raceList.season.races", { count: s.count })} />
        <Stat icon={MountainIcon} value={t("raceList.season.kmValue", { km: s.km })} label={t("raceList.season.raced")} />
        <Stat icon={ClockIcon} value={t("raceList.season.hoursValue", { hours: s.hours })} label={t("raceList.season.onCourse")} />
        {s.strongest && (
          <div className="season-strongest" style={{ borderLeft: `1px solid ${T.line}`, paddingLeft: 28 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 4 }}>{t("raceList.season.strongest")}</div>
            <button
              type="button"
              onClick={() => onOpen(s.strongest.id)}
              style={{ all: "unset", cursor: "pointer", fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 500, color: T.brass, textDecoration: "underline", textDecorationThickness: 1, textUnderlineOffset: 4 }}
            >
              {s.strongest.name}
            </button>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginTop: 4 }}>
              {s.strongest.finishTime} · {fmtDate(s.strongest.date)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// The evidence behind a pattern: one bar per race, the races it's about in
// forest and the rest in sage, against the pattern's threshold.
function PatternBars({ pattern }) {
  const { t } = useTranslation();
  const max = Math.max(pattern.threshold * 1.25, ...pattern.bars.map((b) => b.value));
  const thresholdPct = (pattern.threshold / max) * 100;
  const label = pattern.unit === "pct"
    ? t("raceList.pattern.chartFuel")
    : t("raceList.pattern.chartTemp", { threshold: pattern.threshold });
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <div role="img" aria-label={`${label}: ${pattern.bars.map((b) => `${b.name} ${b.value}${pattern.unit === "pct" ? "%" : "°C"}`).join(", ")}`} style={{ position: "relative", height: 92, display: "flex", alignItems: "flex-end", gap: 10, padding: "0 4px" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: `${thresholdPct}%`, borderTop: `1.5px dashed ${T.inkDim}` }}>
          <span style={{ position: "absolute", right: 0, top: -19, fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, background: T.sageTint, paddingLeft: 4 }}>
            {pattern.unit === "pct" ? t("raceList.pattern.target") : `${pattern.threshold}°C`}
          </span>
        </div>
        {pattern.bars.map((b) => (
          <div key={b.id} title={`${b.name}: ${b.value}${pattern.unit === "pct" ? "%" : "°C"}`} style={{ flex: "1 1 0", maxWidth: 30, height: `${Math.max(6, (b.value / max) * 100)}%`, borderRadius: "4px 4px 0 0", background: b.hit ? T.brass : T.sage, opacity: b.hit ? 1 : 0.55 }} />
        ))}
      </div>
    </figure>
  );
}

function PatternPanel({ races, onOpen }) {
  const { t } = useTranslation();
  const pattern = useMemo(() => pickPattern(races), [races]);
  return (
    <section
      aria-labelledby="pattern-title"
      className="pattern-panel"
      style={{ display: "grid", gridTemplateColumns: pattern ? "auto minmax(0, 1fr) minmax(160px, 220px)" : "auto minmax(0, 1fr)", gap: 22, alignItems: "center", background: T.sageTint, borderRadius: R.lg, padding: "22px 26px", marginBottom: 36 }}
    >
      <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 999, display: "grid", placeItems: "center", background: T.surface, color: T.brass }}>
        <CompassIcon size={28} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: T.brass, marginBottom: 6 }}>
          {t("raceList.pattern.eyebrow")}
        </div>
        {pattern ? (
          <>
            <h2 id="pattern-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, lineHeight: 1.25, margin: "0 0 6px", color: T.paper }}>
              {t(`raceList.pattern.${pattern.key}.title`)}
            </h2>
            <p style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: T.ink, margin: "0 0 8px" }}>
              {t(`raceList.pattern.${pattern.key}.body`, { count: pattern.count, total: pattern.total })}
            </p>
            <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.ink }}>
              {t("raceList.pattern.racesBehind")}{" "}
              {pattern.races.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <button type="button" onClick={() => onOpen(r.id)} style={{ all: "unset", cursor: "pointer", color: T.brass, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {r.name}
                  </button>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p id="pattern-title" style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: T.ink, margin: 0 }}>{t("raceList.pattern.none")}</p>
        )}
      </div>
      {pattern && <PatternBars pattern={pattern} />}
    </section>
  );
}

const TONE = {
  strength: { color: T.green, Icon: ArrowUpRightIcon },
  mixed: { color: T.neutral, Icon: BalanceIcon },
  limiter: { color: T.ember, Icon: AlertIcon },
};

function RaceCard({ race, isBest, onOpen, onDelete, onToggleSelect, isSelected, index }) {
  const { t } = useTranslation();
  const isCustom = race.id.startsWith("custom-");
  const insight = useMemo(() => raceInsight(race), [race]);
  const { color, Icon } = TONE[insight.tone];
  const title = insight.topLimiter ? findingText(t, insight.topLimiter).title : t(`raceList.card.${insight.tone}`);
  const body = insight.firstRec ? recText(t, insight.firstRec).action : headlineText(t, race);
  const cond = conditionsKey(race.tempC, race.humidity);

  return (
    <article
      onClick={() => onOpen(race.id)}
      className={`race-row race-card${isSelected ? " is-selected" : ""}`}
      style={{ display: "grid", gridTemplateColumns: "190px minmax(0, 1.55fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1.5fr) 32px", alignItems: "stretch", minHeight: 124, background: T.surface, border: `1px solid ${isSelected ? T.brass : T.line}`, borderRadius: R.lg, overflow: "hidden", marginBottom: 12, cursor: "pointer", animation: "fadeIn 280ms ease both", animationDelay: `${index * 40}ms` }}
    >
      <PhotoSlot className="rc-photo" src={racePhoto(race)} alt={race.name} seed={race.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={t("raceList.selectAria", { name: race.name })}
          className="select-cb"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(race.id); }}
          style={{ position: "absolute", top: 10, left: 10, width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${isSelected ? T.brass : T.surface}`, background: isSelected ? T.brass : "rgba(255,253,248,0.9)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
        >
          {isSelected && <span aria-hidden="true" style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
        </button>
      </PhotoSlot>

      <div className="rc-name" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        {isBest && (
          <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: "#fff", background: T.brass, borderRadius: 999, padding: "3px 10px 3px 8px", marginBottom: 8 }}>
            <TrophyIcon size={13} />{t("raceList.card.best")}
          </span>
        )}
        <h3 style={{ margin: 0, minWidth: 0, overflow: "hidden" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(race.id); }}
            style={{ all: "unset", cursor: "pointer", maxWidth: "100%", boxSizing: "border-box", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, lineHeight: 1.2, color: T.paper, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            {race.name}
          </button>
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginTop: 5, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ display: "flex" }}><SportIcon sport={race.sport} size={14} /></span>
          <span>{fmtDate(race.date)} · {race.distanceKm} km · +{race.elevationM} m</span>
        </div>
      </div>

      <div className="rc-time rc-cell" style={{ display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `1px solid ${T.line}`, margin: "18px 0", fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500, color: T.paper }}>
        {race.finishTime}
      </div>

      <div className="rc-cond rc-cell" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: `1px solid ${T.line}`, margin: "18px 0", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontSize: 16, fontWeight: 500, color: T.paper }}>
          <span aria-hidden="true" style={{ color: race.tempC >= 24 ? T.ember : T.temp, display: "flex" }}><ThermometerIcon size={19} /></span>
          {race.tempC}°C
        </div>
        {cond && <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginTop: 3 }}>{t(`raceList.conditions.${cond}`)}</div>}
      </div>

      <div className="rc-insight rc-cell" style={{ display: "flex", gap: 10, borderLeft: `1px solid ${T.line}`, margin: "18px 0", padding: "0 0 0 20px", minWidth: 0 }}>
        <span aria-hidden="true" style={{ color, display: "flex", paddingTop: 2 }}><Icon size={19} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, lineHeight: 1.25, color }}>{title}</div>
          {body && <div className="rc-insight-body" style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.45, color: T.ink, marginTop: 3 }}>{body}</div>}
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: T.brass, marginTop: 6 }}>{t("raceList.card.viewAnalysis")}</div>
        </div>
      </div>

      <div className="rc-chevron" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: T.inkDim, paddingRight: 8 }}>
        {isCustom && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // Visible on touch screens, so one stray tap mustn't lose a race.
              if (window.confirm(t("raceList.deleteConfirm", { name: race.name }))) onDelete(race.id);
            }}
            aria-label={t("raceList.deleteRaceAria", { name: race.name })}
            title={t("raceList.deleteRace")}
            className="delete-btn"
            style={{ background: "none", border: "none", color: T.inkDim, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 2, borderRadius: 6 }}
          >
            ×
          </button>
        )}
        <ChevronRightIcon size={20} />
      </div>
    </article>
  );
}

// A signed-in athlete with nothing logged yet: what the app does with a race,
// and both ways in, under the same hero a returning athlete sees.
function FirstRaceEmptyState({ onAddRace, onPlanRace }) {
  const { t } = useTranslation();
  return (
    <div style={{ position: "relative", overflow: "hidden", background: T.sageTint, borderRadius: R.lg, padding: "40px 28px", textAlign: "center" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}><TopoLines seed="empty" opacity={0.14} /></div>
      <div style={{ position: "relative" }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 500, color: T.paper, margin: "0 0 8px" }}>{t("raceList.first.title")}</h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: T.ink, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 22px" }}>{t("raceList.first.body")}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={onAddRace}>{t("raceList.addRace")}</Button>
          <Button variant="secondary" onClick={onPlanRace}>{t("nav.planRace")}</Button>
        </div>
      </div>
    </div>
  );
}

const SORTS = {
  newest: (a, b) => new Date(b.date) - new Date(a.date),
  oldest: (a, b) => new Date(a.date) - new Date(b.date),
  best: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

export default function RaceList({ races, onOpen, onAddRace, onPlanRace, onDelete, selectedIds, onToggleSelect, onCompare, onClearSelection }) {
  const { t } = useTranslation();
  const heroCompact = useHeroSize();
  const [sport, setSport] = useState("All");
  const [sort, setSort] = useState("newest");
  // Only the sports this athlete has raced, so no chip leads to an empty list.
  const sports = useMemo(() => SPORTS.filter((s) => s === "All" || races.some((r) => r.sport === s)), [races]);
  const filtered = useMemo(
    () => (sport === "All" ? races : races.filter((r) => r.sport === sport)),
    [sport, races],
  );
  const shown = useMemo(() => [...filtered].sort(SORTS[sort]), [filtered, sort]);
  const bestId = useMemo(() => (races.length >= 2 ? seasonSummary(races).strongest?.id : null), [races]);

  if (races.length === 0) {
    return (
      <div>
        <Hero compact={heroCompact} />
        <FirstRaceEmptyState onAddRace={onAddRace} onPlanRace={onPlanRace} />
      </div>
    );
  }

  return (
    <div>
      <Hero compact={heroCompact} />
      <SeasonSummary races={filtered} onOpen={onOpen} />
      <PatternPanel races={filtered} onOpen={onOpen} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <div role="group" aria-label={t("raceList.filterAria")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sports.map((s) => {
            const on = sport === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSport(s)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, padding: "8px 16px", borderRadius: R.pill, border: `1px solid ${on ? T.brass : T.line}`, background: on ? T.brass : T.surface, color: on ? "#fff" : T.paper, cursor: "pointer", transition: "all 140ms ease" }}
              >
                {s !== "All" && <SportIcon sport={s} size={15} />}
                {s === "All" ? t("raceList.filterAll") : t(`sport.${s}`)}
              </button>
            );
          })}
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: FONT_BODY, fontSize: 14, color: T.ink }}>
          {t("raceList.sort.label")}
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.paper, background: T.surface, border: `1px solid ${T.line}`, borderRadius: R.pill, padding: "8px 14px", cursor: "pointer" }}>
            {Object.keys(SORTS).map((k) => <option key={k} value={k}>{t(`raceList.sort.${k}`)}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, letterSpacing: -0.4, margin: 0, color: T.paper }}>{t("raceList.recent")}</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onPlanRace}>{t("nav.planRace")}</Button>
          <Button onClick={onAddRace}>{t("raceList.addRace")}</Button>
        </div>
      </div>

      <div>
        {shown.map((r, i) => (
          <RaceCard key={r.id} race={r} isBest={r.id === bestId} onOpen={onOpen} onDelete={onDelete} onToggleSelect={onToggleSelect} isSelected={selectedIds.has(r.id)} index={i} />
        ))}
      </div>

      {selectedIds.size >= 2 && (
        <div className="compare-bar" role="region" aria-label={t("raceList.compare")} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: T.surface, border: `1px solid ${T.line}`, borderRadius: R.pill, padding: "10px 12px 10px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 10px 34px rgba(30,41,35,0.16)" }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: T.ink }}>
            {t("raceList.selected", { count: selectedIds.size })}
          </span>
          {selectedIds.size > 3 && (
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ember }}>{t("raceList.maxThree")}</span>
          )}
          <Button onClick={onCompare} disabled={selectedIds.size > 3} style={{ opacity: selectedIds.size > 3 ? 0.5 : 1 }}>{t("raceList.compare")}</Button>
          <button
            type="button"
            onClick={onClearSelection}
            style={{ fontFamily: FONT_BODY, fontSize: 14, padding: "8px 12px", borderRadius: R.pill, border: "none", background: "transparent", color: T.ink, cursor: "pointer" }}
          >
            {t("actions.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
