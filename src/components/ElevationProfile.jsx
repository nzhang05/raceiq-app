import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect, useMemo } from "react";
import { T, FONT_MONO } from "../constants.js";

// Interactive elevation profile. Click to drop an aid station, drag a marker to
// move it, double-click to remove. Stations slice the course into labelled
// segments (S1, S2, …). Reads/writes the same aid-station state the form owns —
// the numeric rows below stay in sync.
export default function ElevationProfile({ splits, distanceKm, elevationM, stations, onAdd, onMove, onRemove }) {
  const { t } = useTranslation();
  const W = 640;
  const H = 190;
  const padL = 8;
  const padR = 8;
  const padT = 26;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const svgRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [hoverKm, setHoverKm] = useState(null);

  // Elevation points, anchored to km 0 and the finish so the band spans the plot.
  const points = useMemo(() => {
    const pts = (splits || []).filter((s) => s.elevM != null).map((s) => ({ km: s.km, elev: Number(s.elevM) }));
    if (pts.length < 2) return [];
    if (pts[0].km > 0.05) pts.unshift({ km: 0, elev: pts[0].elev });
    if (pts[pts.length - 1].km < distanceKm - 0.05) pts.push({ km: distanceKm, elev: pts[pts.length - 1].elev });
    return pts;
  }, [splits, distanceKm]);

  const hasProfile = points.length >= 2;

  const minElev = hasProfile ? Math.min(...points.map((p) => p.elev)) : 0;
  const maxElev = hasProfile ? Math.max(...points.map((p) => p.elev)) : 0;
  const elevRange = Math.max(maxElev - minElev, 1);

  const x = (km) => padL + (km / distanceKm) * plotW;
  const y = (elev) => padT + plotH - ((elev - minElev) / elevRange) * plotH;
  const elevAtKm = (km) => {
    if (!hasProfile) return minElev;
    for (let i = 1; i < points.length; i++) {
      if (km <= points[i].km) {
        const a = points[i - 1], b = points[i];
        const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
        return a.elev + t * (b.elev - a.elev);
      }
    }
    return points[points.length - 1].elev;
  };

  function kmFromClientX(clientX) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const km = ((px - padL) / plotW) * distanceKm;
    return Math.max(0.1, Math.min(distanceKm - 0.1, Math.round(km * 10) / 10));
  }

  // Drag handling via window listeners so the marker keeps tracking outside the SVG.
  useEffect(() => {
    if (dragId == null) return;
    function move(e) { onMove(dragId, kmFromClientX(e.clientX)); }
    function up() { setDragId(null); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragId]);

  // Valid, sorted stations for rendering markers and segment labels.
  const placed = useMemo(
    () => (stations || [])
      .map((s) => ({ ...s, kmNum: parseFloat(s.km) }))
      .filter((s) => !isNaN(s.kmNum) && s.kmNum > 0 && s.kmNum < distanceKm)
      .sort((a, b) => a.kmNum - b.kmNum),
    [stations, distanceKm]
  );

  const bandPoints = hasProfile
    ? `${padL},${padT + plotH} ` + points.map((p) => `${x(p.km)},${y(p.elev)}`).join(" ") + ` ${padL + plotW},${padT + plotH}`
    : null;
  const topLine = hasProfile ? points.map((p) => `${x(p.km)},${y(p.elev)}`).join(" ") : null;

  // Segment boundaries: [0, ...station kms, distance] → S1..Sn+1 midpoint labels.
  const bounds = [0, ...placed.map((s) => s.kmNum), distanceKm];

  if (!hasProfile) {
    return (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 16px", background: T.bg2, fontFamily: "inherit", fontSize: 13, color: T.inkDim }}>
        {t("elevation.noProfile")}
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, background: T.bg2, overflow: "hidden", userSelect: "none" }}>
      {/* Readout header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 12px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11 }}>
        <span style={{ color: T.paper, fontWeight: 500 }}>{distanceKm} km</span>
        <span style={{ color: T.green }}>+{elevationM} m</span>
        <span style={{ color: T.inkDim }}>{t("elevation.altRange", { min: Math.round(minElev), max: Math.round(maxElev) })}</span>
        <span style={{ marginLeft: "auto", color: T.inkDim, fontSize: 10 }}>
          {hoverKm != null ? t("elevation.hoverReadout", { km: hoverKm, elev: Math.round(elevAtKm(hoverKm)) }) : t("elevation.hint")}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={(e) => setHoverKm(kmFromClientX(e.clientX))}
        onMouseLeave={() => setHoverKm(null)}
      >
        <defs>
          <linearGradient id="elev-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.brass} stopOpacity="0.30" />
            <stop offset="100%" stopColor={T.brass} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Clickable band — placing a station */}
        <polygon points={bandPoints} fill="url(#elev-band)" />
        <polyline points={topLine} fill="none" stroke={T.paper} strokeWidth="1.5" strokeLinejoin="round" />
        <rect
          x={padL} y={padT} width={plotW} height={plotH}
          fill="transparent"
          style={{ cursor: "copy" }}
          onClick={(e) => onAdd(kmFromClientX(e.clientX))}
        />

        {/* Hover guide */}
        {hoverKm != null && dragId == null && (
          <line x1={x(hoverKm)} y1={padT} x2={x(hoverKm)} y2={padT + plotH} stroke={T.paper} strokeOpacity="0.14" strokeWidth="1" style={{ pointerEvents: "none" }} />
        )}

        {/* Segment labels */}
        {bounds.slice(0, -1).map((b0, i) => {
          const midKm = (b0 + bounds[i + 1]) / 2;
          return (
            <g key={`seg-${i}`} style={{ pointerEvents: "none" }}>
              <rect x={x(midKm) - 13} y={padT - 20} width={26} height={15} rx={2} fill={T.bg} stroke={T.line} />
              <text x={x(midKm)} y={padT - 9} textAnchor="middle" fill={T.ink} fontFamily={FONT_MONO} fontSize="9.5">
                S{i + 1}
              </text>
            </g>
          );
        })}

        {/* Station markers */}
        {placed.map((s) => (
          <g key={s.id ?? s.kmNum}>
            <line x1={x(s.kmNum)} y1={padT - 4} x2={x(s.kmNum)} y2={padT + plotH} stroke={T.brass} strokeWidth="1.5" strokeDasharray="3 2" style={{ pointerEvents: "none" }} />
            <circle
              cx={x(s.kmNum)} cy={y(elevAtKm(s.kmNum))} r="5"
              fill={T.brass} stroke={T.bg} strokeWidth="1.5"
              style={{ cursor: dragId === s.id ? "grabbing" : "grab" }}
              onPointerDown={(e) => { e.stopPropagation(); setDragId(s.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
            />
            <text x={x(s.kmNum)} y={padT + plotH + 15} textAnchor="middle" fill={T.brass} fontFamily={FONT_MONO} fontSize="9">
              {s.kmNum}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
