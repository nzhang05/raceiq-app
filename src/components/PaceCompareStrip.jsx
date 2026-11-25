import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import { T, FONT_MONO, COMPARE_COLORS } from "../constants.js";
import { shortDate } from "../utils/time.js";
import { fmtPace } from "../utils/pace.js";

export default function PaceCompareStrip({ races }) {
  const { t } = useTranslation();
  const W = 720, H = 220;
  const padL = 46, padR = 40, padT = 24, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const [showTempFor, setShowTempFor] = useState(0);
  const [hoveredX, setHoveredX] = useState(null);
  const svgRef = useRef(null);

  const distMin = Math.min(...races.map((r) => r.distanceKm));
  const distMax = Math.max(...races.map((r) => r.distanceKm));
  const usePercent = (distMax - distMin) / distMin > 0.15;

  const paceKey = (r) => (r.usesGap ? "gapPace" : "pace");

  const normalizedRaces = races.map((r) => {
    const total = r.splits[r.splits.length - 1].km;
    return r.splits.map((s) => ({
      ...s,
      xVal: usePercent ? (s.km / total) * 100 : s.km,
    }));
  });

  const xMax = usePercent ? 100 : distMax;

  const allPaces = races.flatMap((r, ri) => normalizedRaces[ri].map((s) => s[paceKey(r)]));
  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);
  const paceRange = Math.max(maxPace - minPace, 0.4);

  const tempRaceIdx = showTempFor >= 0 && showTempFor < races.length ? showTempFor : -1;
  const tempSplits = tempRaceIdx >= 0 ? normalizedRaces[tempRaceIdx] : null;
  const tempValues = tempSplits ? tempSplits.map((s) => s.tempC) : [];
  const minTemp = tempValues.length ? Math.min(...tempValues) : 0;
  const maxTemp = tempValues.length ? Math.max(...tempValues) : 0;
  const tempRange = Math.max(maxTemp - minTemp, 1);

  const xPos = (v) => padL + (v / xMax) * plotW;
  const yPace = (p) => padT + ((p - minPace) / paceRange) * plotH;
  const yTemp = (v) => padT + plotH - ((v - minTemp) / tempRange) * plotH * 0.45;

  function interpolatePace(raceIdx, xVal) {
    const splits = normalizedRaces[raceIdx];
    const r = races[raceIdx];
    const key = paceKey(r);
    if (!splits.length) return null;
    if (xVal > splits[splits.length - 1].xVal + 0.5) return null;
    let lo = splits[0], hi = splits[splits.length - 1];
    for (let i = 0; i < splits.length - 1; i++) {
      if (xVal >= splits[i].xVal && xVal <= splits[i + 1].xVal) {
        lo = splits[i]; hi = splits[i + 1]; break;
      }
    }
    if (lo === hi) return lo[key];
    const t = (xVal - lo.xVal) / (hi.xVal - lo.xVal);
    return lo[key] + t * (hi[key] - lo[key]);
  }

  function fmtPaceStr(v) {
    if (v == null) return "—";
    return fmtPace(v);
  }

  function handleMouseMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    setHoveredX(Math.max(0, Math.min(xMax, ((mouseX - padL) / plotW) * xMax)));
  }

  const tooltipX = hoveredX != null ? xPos(hoveredX) : null;
  const tooltipFlip = tooltipX != null && tooltipX / W > 0.62;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {races.map((r, i) => (
          <div key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="10" style={{ display: "block", flexShrink: 0 }}>
              <line x1="0" y1="5" x2="16" y2="5" stroke={COMPARE_COLORS[i]} strokeWidth={i === 0 ? 2.5 : 2} />
            </svg>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.ink }}>
              {r.name.toUpperCase()} · {shortDate(r.date)}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, letterSpacing: 0.5 }}>{t("chart.tempToggle")}</span>
          <button
            onClick={() => setShowTempFor(-1)}
            style={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.3, padding: "2px 7px",
              borderRadius: 2, border: `1px solid ${showTempFor === -1 ? T.inkDim : T.line}`,
              background: "transparent", color: showTempFor === -1 ? T.ink : T.inkDim, cursor: "pointer",
            }}
          >
            {t("chart.off")}
          </button>
          {races.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setShowTempFor(i)}
              style={{
                fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.3, padding: "2px 7px",
                borderRadius: 2, border: `1px solid ${showTempFor === i ? T.temp : T.line}`,
                background: showTempFor === i ? "rgba(123,184,200,0.12)" : "transparent",
                color: showTempFor === i ? T.temp : T.inkDim, cursor: "pointer",
              }}
            >
              {shortDate(r.date)}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredX(null)}
        style={{ cursor: "crosshair", display: "block" }}
      >
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={padL} y1={padT + plotH * f} x2={padL + plotW} y2={padT + plotH * f} stroke={T.line} strokeWidth="1" />
        ))}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={T.line} strokeWidth="1.5" />

        {tempSplits && tempValues.length > 0 && (
          <polyline
            points={tempSplits.map((s, i) => `${xPos(s.xVal)},${yTemp(tempValues[i])}`).join(" ")}
            fill="none" stroke={T.temp} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 3"
          />
        )}

        {races.map((r, ri) => {
          const splits = normalizedRaces[ri];
          const key = paceKey(r);
          return (
            <polyline
              key={r.id}
              points={splits.map((s) => `${xPos(s.xVal)},${yPace(s[key])}`).join(" ")}
              fill="none" stroke={COMPARE_COLORS[ri]} strokeWidth={ri === 0 ? 2.5 : 2}
              strokeOpacity={ri === 0 ? 1 : 0.85} strokeLinejoin="round" strokeLinecap="round"
            />
          );
        })}

        {races.map((r, ri) => {
          const splits = normalizedRaces[ri];
          const key = paceKey(r);
          return splits.map((s, si) => (
            <circle key={`${ri}-${si}`} cx={xPos(s.xVal)} cy={yPace(s[key])} r={3} fill={COMPARE_COLORS[ri]} stroke={T.bg} strokeWidth="1.5" />
          ));
        })}

        {tooltipX != null && (
          <line x1={tooltipX} y1={padT} x2={tooltipX} y2={padT + plotH} stroke={T.paper} strokeOpacity="0.18" strokeWidth="1" />
        )}

        {normalizedRaces[0].map((s, i) => (
          <text key={i} x={xPos(s.xVal)} y={H - 10} textAnchor="middle" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="10">
            {usePercent ? `${Math.round(s.xVal)}%` : s.xVal}
          </text>
        ))}

        <text x={padL - 8} y={padT + 4} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="10">{t("chart.fast")}</text>
        <text x={padL - 8} y={padT + plotH} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="10">{t("chart.slow")}</text>

        {tempSplits && tempValues.length > 0 && (
          <>
            <text x={padL + plotW + 5} y={yTemp(maxTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="10" opacity="0.85">{maxTemp}°</text>
            <text x={padL + plotW + 5} y={yTemp(minTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="10" opacity="0.85">{minTemp}°</text>
          </>
        )}
      </svg>

      {hoveredX != null && tooltipX != null && (
        <div
          style={{
            position: "absolute", top: 36,
            ...(tooltipFlip
              ? { right: `${100 - (tooltipX / W) * 100}%`, transform: "translateX(50%)" }
              : { left: `${(tooltipX / W) * 100}%`, transform: "translateX(-50%)" }),
            pointerEvents: "none",
            background: T.bg, border: `1px solid ${T.line}`,
            borderRadius: 4, padding: "9px 13px", zIndex: 10,
            minWidth: 150, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, letterSpacing: 0.6, marginBottom: 7, borderBottom: `1px solid ${T.line}`, paddingBottom: 5 }}>
            {usePercent ? t("chart.tooltipPct", { pct: hoveredX }) : t("chart.tooltipKm", { km: hoveredX })}
          </div>
          {races.map((r, ri) => {
            const pace = interpolatePace(ri, hoveredX);
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontFamily: FONT_MONO, fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: T.inkDim }}>{shortDate(r.date)}</span>
                <span style={{ color: COMPARE_COLORS[ri] }}>{fmtPaceStr(pace)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
