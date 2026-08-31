import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { T, R, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtSigned } from "../i18n/format.js";
import { gatherTrendData, gatherLimiterPatterns } from "../utils/analysis.js";
import { Card } from "./ui.jsx";

const W = 380;
const H = 92;
const PAD_Y = 12;

// The rating trend. `points` are already date-ascending — gatherTrendData sorts
// them — so index is time and no x scale beyond the count is needed.
function TrendLine({ ratings, up }) {
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = max - min || 1;
  const x = (i) => (i / (ratings.length - 1)) * W;
  const y = (v) => PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2);
  const pts = ratings.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const color = up ? T.green : T.ember;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ display: "block", overflow: "visible" }}>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={color} opacity="0.09" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {ratings.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === ratings.length - 1 ? 4 : 2.5}
          fill={i === ratings.length - 1 ? color : T.surface}
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function PatternLine({ color, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 10 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0, marginTop: 7 }} />
      <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: T.ink }}>{children}</span>
    </div>
  );
}

/*
  What the season says, in place of four static counters.

  `races` arrives already filtered by the sport chips. gatherTrendData() takes a
  sportFilter of its own, but it matches loosely — "road cycling" and "gravel
  cycling" both fall through to `sport.includes("Cycling")` and select each
  other's races — so the filtering stays in RaceList where the chip values are
  exact, and this passes null.

  A pattern is only stated when it holds across at least two races AND accounts
  for at least half of the relevant set. One hot race that went badly is a race,
  not a pattern, and claiming otherwise is the failure mode this whole product
  exists to avoid.
*/
export default function SeasonForm({ races }) {
  const { t } = useTranslation();
  const trend = useMemo(() => gatherTrendData(races, null), [races]);
  const patterns = useMemo(() => gatherLimiterPatterns(races), [races]);

  if (trend.insufficient) {
    return (
      <Card style={{ padding: "22px 24px", marginBottom: 28 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.brass, marginBottom: 8 }}>
          {t("raceList.seasonForm.title")}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim }}>{t("raceList.seasonForm.empty")}</div>
      </Card>
    );
  }

  const ratings = trend.filtered.map((r) => r.rating);
  // Not a sum of ratingDelta: that field is hardcoded to 0 on every race entered
  // by hand (ratings.js), so summing it reports "no change" for most athletes.
  // First-to-last on the rating itself is right for seed and custom races alike.
  const delta = trend.ratingTrend;
  const up = delta >= 0;

  const lines = [];
  const nLimiters = patterns.limiters.length;
  const nStrengths = patterns.strengths.length;
  const holds = (n, total) => n >= 2 && n * 2 >= total;

  if (holds(patterns.hotLimiters.length, nLimiters)) {
    lines.push(
      <PatternLine key="hot" color={T.ember}>
        {t("raceList.seasonForm.hotLimiters", { count: patterns.hotLimiters.length, total: nLimiters })}
      </PatternLine>,
    );
  }
  if (holds(patterns.underFueled.length, nLimiters)) {
    lines.push(
      <PatternLine key="fuel" color={T.ember}>
        {t("raceList.seasonForm.underFueled", { count: patterns.underFueled.length, total: nLimiters })}
      </PatternLine>,
    );
  }
  if (holds(patterns.coolStrengths.length, nStrengths)) {
    lines.push(
      <PatternLine key="cool" color={T.green}>
        {t("raceList.seasonForm.coolStrengths", { count: patterns.coolStrengths.length, total: nStrengths })}
      </PatternLine>,
    );
  }

  return (
    <Card className="season-form" style={{ padding: "22px 24px", marginBottom: 28, display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 36, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.brass }}>
            {t("raceList.seasonForm.title")}
          </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, color: T.paper, letterSpacing: -0.5, lineHeight: 1 }}>
            {trend.lastRating}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: up ? T.green : T.ember }}>
            {fmtSigned(delta)}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim }}>
            {t("raceList.seasonForm.overRaces", { count: ratings.length })}
          </span>
        </div>
        <TrendLine ratings={ratings} up={up} />
      </div>

      <div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: T.inkDim, marginBottom: 12 }}>
          {t("raceList.seasonForm.patternsTitle")}
        </div>
        {lines.length ? lines : (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: T.inkDim }}>
            {t("raceList.seasonForm.noPatterns")}
          </div>
        )}
      </div>
    </Card>
  );
}
