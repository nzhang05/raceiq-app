import { useState, useRef } from "react";
import { T, FONT_MONO } from "../constants.js";
import { hasElevationData } from "../utils/pace.js";

export default function PaceHeatStrip({ race }) {
  const W = 720;
  const H = 220;
  const padL = 46;
  const padR = 40;
  const padT = 24;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const splits = race.splits;
  const showGap = race.usesGap;
  const showElev = hasElevationData(splits);

  const [visible, setVisible] = useState({ pace: true, rawPace: true, temp: true, elev: true });
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  function toggle(key) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  const primaryKey = showGap ? "gapPace" : "pace";
  const maxKm = splits[splits.length - 1].km;
  const minPace = Math.min(...splits.map((s) => s[primaryKey]));
  const maxPace = Math.max(...splits.map((s) => s[primaryKey]));
  const paceRange = Math.max(maxPace - minPace, 0.4);

  const tempValues = splits.map((s) => s.tempC);
  const minTemp = Math.min(...tempValues);
  const maxTemp = Math.max(...tempValues);
  const tempRange = Math.max(maxTemp - minTemp, 1);

  const elevValues = showElev ? splits.map((s) => Number(s.elevM) || 0) : null;
  const minElev = elevValues ? Math.min(...elevValues) : 0;
  const maxElev = elevValues ? Math.max(...elevValues) : 0;
  const elevRange = Math.max(maxElev - minElev, 1);

  // Thin out x-axis labels so dense (1 km running) splits don't overlap.
  // Pick a "nice" km spacing that yields at most ~14 labels.
  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100];
  const labelStepKm =
    niceSteps.find((step) => maxKm / step <= 14) ?? niceSteps[niceSteps.length - 1];
  const isLabeledKm = (s, i) => {
    if (i === splits.length - 1) return true; // always label the finish
    if (Math.round(s.km) % labelStepKm !== 0) return false;
    return maxKm - s.km >= labelStepKm * 0.5; // avoid crowding the finish label
  };

  const x = (km) => padL + (km / maxKm) * plotW;
  const yPace = (pace) => padT + ((pace - minPace) / paceRange) * plotH;
  const yTemp = (v) => padT + plotH - ((v - minTemp) / tempRange) * plotH * 0.45;
  const yElev = (v) => padT + plotH - ((v - minElev) / elevRange) * plotH * 0.55;

  const primaryLine = splits.map((s) => `${x(s.km)},${yPace(s[primaryKey])}`).join(" ");
  const rawPaceLine = showGap
    ? splits.map((s) => `${x(s.km)},${yPace(Math.min(Math.max(s.pace, minPace), maxPace))}`).join(" ")
    : null;
  const tempLine = splits.map((s, i) => `${x(s.km)},${yTemp(tempValues[i])}`).join(" ");
  const elevBandPoints = showElev
    ? `${padL},${padT + plotH} ` +
      splits.map((s, i) => `${x(s.km)},${yElev(elevValues[i])}`).join(" ") +
      ` ${padL + plotW},${padT + plotH}`
    : null;

  let turnIdx = 1;
  let maxJump = -Infinity;
  for (let i = 1; i < splits.length; i++) {
    const jump = splits[i][primaryKey] - splits[i - 1][primaryKey];
    if (jump > maxJump) { maxJump = jump; turnIdx = i; }
  }
  const turnSplit = splits[turnIdx];
  const showTurn = maxJump > 0.12 && race.verdict !== "strength";

  function handleMouseMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    splits.forEach((s, i) => {
      const dist = Math.abs(x(s.km) - mouseX);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });
    setHoveredIdx(nearestIdx);
  }

  const hoveredSplit = hoveredIdx != null ? splits[hoveredIdx] : null;

  function fmtPaceStr(minPerKm) {
    const m = Math.floor(minPerKm);
    const s = String(Math.round((minPerKm - m) * 60)).padStart(2, "0");
    return `${m}:${s}/km`;
  }

  const tooltipLeftPct = hoveredSplit ? (x(hoveredSplit.km) / W) * 100 : 50;
  const tooltipFlip = tooltipLeftPct > 62;

  const legendItems = [
    { key: "pace", label: showGap ? "GAP" : "PACE", color: T.paper, dash: null, thick: true },
    ...(showGap ? [{ key: "rawPace", label: "RAW PACE", color: T.ink, dash: "1 3", thick: false, dim: true }] : []),
    { key: "temp", label: "TEMP", color: T.temp, dash: "3 3", thick: false },
    ...(showElev ? [{ key: "elev", label: "ELEV", color: T.brass, isRect: true }] : []),
  ];

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        {legendItems.map((item) => (
          <button
            key={item.key}
            onClick={() => toggle(item.key)}
            title={visible[item.key] ? `Hide ${item.label}` : `Show ${item.label}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", padding: "2px 0", cursor: "pointer",
              opacity: visible[item.key] ? 1 : 0.3, transition: "opacity 140ms ease",
            }}
          >
            {item.isRect ? (
              <span style={{ display: "inline-block", width: 14, height: 7, background: item.color, opacity: 0.3, borderRadius: 1, flexShrink: 0 }} />
            ) : (
              <svg width="16" height="10" style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
                <line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth={item.thick ? 2.5 : 1.5} strokeDasharray={item.dash || "none"} strokeOpacity={item.dim ? 0.5 : 0.9} />
              </svg>
            )}
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, color: visible[item.key] ? T.ink : T.inkDim }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`${showGap ? "Grade-adjusted pace" : "Pace"} and temperature${showElev ? " and elevation" : ""} across the race`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ cursor: "crosshair", display: "block" }}
      >
        <defs>
          <linearGradient id={`band-${race.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.brass} stopOpacity="0.32" />
            <stop offset="100%" stopColor={T.brass} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={padL} y1={padT + plotH * f} x2={padL + plotW} y2={padT + plotH * f} stroke={T.line} strokeWidth="1" />
        ))}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={T.line} strokeWidth="1.5" />

        {showElev && visible.elev && (
          <polygon points={elevBandPoints} fill={`url(#band-${race.id})`} />
        )}

        {visible.temp && (
          <polyline points={tempLine} fill="none" stroke={T.temp} strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="3 3" />
        )}

        {showGap && visible.rawPace && (
          <polyline points={rawPaceLine} fill="none" stroke={T.ink} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="1 3" />
        )}

        {visible.pace && (
          <polyline points={primaryLine} fill="none" stroke={T.paper} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {hoveredSplit && (
          <line x1={x(hoveredSplit.km)} y1={padT} x2={x(hoveredSplit.km)} y2={padT + plotH} stroke={T.paper} strokeOpacity="0.18" strokeWidth="1" />
        )}

        {visible.pace && splits.map((s, i) => {
          const isHovered = i === hoveredIdx;
          const isTurn = i === turnIdx && showTurn;
          return (
            <circle key={i} cx={x(s.km)} cy={yPace(s[primaryKey])} r={isHovered ? 5.5 : isTurn ? 4.5 : 3} fill={isTurn ? T.ember : T.paper} stroke={T.bg} strokeWidth="1.5" />
          );
        })}

        {hoveredSplit && visible.temp && (
          <circle cx={x(hoveredSplit.km)} cy={yTemp(hoveredSplit.tempC)} r={4} fill={T.temp} stroke={T.bg} strokeWidth="1.5" />
        )}

        {hoveredSplit && showElev && visible.elev && hoveredSplit.elevM != null && (
          <circle cx={x(hoveredSplit.km)} cy={yElev(Number(hoveredSplit.elevM))} r={4} fill={T.brass} fillOpacity="0.7" stroke={T.bg} strokeWidth="1.5" />
        )}

        {showTurn && (
          <g>
            <line x1={x(turnSplit.km)} y1={yPace(turnSplit[primaryKey])} x2={x(turnSplit.km)} y2={padT - 2} stroke={T.ember} strokeWidth="1" strokeDasharray="2 2" />
            <text x={x(turnSplit.km)} y={padT - 8} textAnchor="middle" fill={T.ember} fontFamily={FONT_MONO} fontSize="10" letterSpacing="0.5">
              KM {turnSplit.km} — TURN
            </text>
          </g>
        )}

        {splits.map((s, i) =>
          isLabeledKm(s, i) || i === hoveredIdx ? (
            <text key={i} x={x(s.km)} y={H - 10} textAnchor="middle" fill={i === hoveredIdx ? T.paper : T.inkDim} fontFamily={FONT_MONO} fontSize="10">
              {s.km}
            </text>
          ) : null
        )}

        <text x={padL - 8} y={padT + 4} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">fast</text>
        <text x={padL - 8} y={padT + plotH} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">slow</text>

        {visible.temp && (
          <>
            <text x={padL + plotW + 5} y={yTemp(maxTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{maxTemp}°</text>
            <text x={padL + plotW + 5} y={yTemp(minTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{minTemp}°</text>
          </>
        )}
      </svg>

      {hoveredSplit && (
        <div
          style={{
            position: "absolute", top: 36,
            ...(tooltipFlip
              ? { right: `${100 - tooltipLeftPct}%`, transform: "translateX(50%)" }
              : { left: `${tooltipLeftPct}%`, transform: "translateX(-50%)" }),
            pointerEvents: "none",
            background: T.bg, border: `1px solid ${T.line}`, borderRadius: 4,
            padding: "9px 13px", zIndex: 10, minWidth: 130,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.brass, letterSpacing: 0.6, marginBottom: 7, borderBottom: `1px solid ${T.line}`, paddingBottom: 5 }}>
            KM {hoveredSplit.km}
          </div>
          {visible.pace && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.paper, marginBottom: 4 }}>
              <span style={{ color: T.inkDim }}>{showGap ? "GAP " : "PACE"} </span>
              {fmtPaceStr(hoveredSplit[primaryKey])}
            </div>
          )}
          {showGap && visible.rawPace && hoveredSplit.pace != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginBottom: 4 }}>
              <span>RAW  </span>{fmtPaceStr(hoveredSplit.pace)}
            </div>
          )}
          {visible.temp && hoveredSplit.tempC != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.temp, marginBottom: 4 }}>
              <span style={{ color: T.inkDim }}>TEMP </span>{hoveredSplit.tempC}°C
            </div>
          )}
          {showElev && visible.elev && hoveredSplit.elevM != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, marginBottom: showGap && hoveredSplit.gradePct != null ? 4 : 0 }}>
              <span style={{ color: T.inkDim }}>ELEV </span>{hoveredSplit.elevM}m
            </div>
          )}
          {showGap && hoveredSplit.gradePct != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
              <span>GRD  </span>{hoveredSplit.gradePct > 0 ? "+" : ""}{hoveredSplit.gradePct}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
