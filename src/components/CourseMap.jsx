import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { T, FONT_MONO, FONT_BODY, R } from "../constants.js";
import { buildSegments } from "../utils/courseColors.js";

// Cut the course path between two km marks, interpolating the exact boundary
// points so neighbouring segments meet rather than leaving a gap at each aid
// station.
// [lat, lon] at an exact distance along the course, interpolated between the two
// track points either side of it.
function pointAtKm(path, km) {
  for (let i = 1; i < path.length; i++) {
    if (km <= path[i].km) {
      const a = path[i - 1];
      const b = path[i];
      const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
      return [a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t];
    }
  }
  const last = path[path.length - 1];
  return [last.lat, last.lon];
}

function slicePath(path, fromKm, toKm) {
  const coords = [pointAtKm(path, fromKm)];
  for (const p of path) {
    if (p.km > fromKm && p.km < toKm) coords.push([p.lat, p.lon]);
  }
  coords.push(pointAtKm(path, toKm));
  return coords;
}

// Small round map pin. Built as a divIcon rather than Leaflet's default marker
// image, which doesn't survive bundling without an asset shim.
function pinIcon(label, background, color) {
  const w = label.length > 1 ? 34 : 22; // "S/F" on a loop needs the extra room
  return L.divIcon({
    className: "",
    iconSize: [w, 22],
    iconAnchor: [w / 2, 11],
    html: `<div style="width:${w}px;height:22px;border-radius:999px;background:${background};color:${color};
      border:2px solid ${T.surface};box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;
      align-items:center;justify-content:center;font-family:${FONT_MONO};font-size:9px;font-weight:600;">${label}</div>`,
  });
}

/*
  Course map — the route drawn over OpenStreetMap tiles, one coloured polyline
  per user-defined segment.

  Every segment line is drawn twice: a wide surface-coloured casing underneath,
  then the segment colour on top. That casing is what keeps the route legible
  over arbitrary tile content, since we can't control what's underneath the way
  we can on a chart's flat surface.
*/
export default function CourseMap({ path, distanceKm, stations, height = 320, activeSegment = null }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  const segments = useMemo(() => buildSegments(distanceKm, stations), [distanceKm, stations]);
  const hasPath = Array.isArray(path) && path.length >= 2;

  // Create the map once.
  useEffect(() => {
    if (!hasPath || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false, // don't hijack page scrolling inside a long form
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on("tileerror", () => setTilesFailed(true))
      .addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [hasPath]);

  // Redraw route + markers whenever the segments change — in the plan form this
  // runs live as the athlete drags an aid station on the elevation profile.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !hasPath) return;
    layer.clearLayers();

    for (const seg of segments) {
      const coords = slicePath(path, seg.fromKm, seg.toKm);
      if (coords.length < 2) continue;
      const dimmed = activeSegment != null && activeSegment !== seg.index;
      L.polyline(coords, { color: T.surface, weight: 8, opacity: dimmed ? 0.35 : 0.9, lineCap: "round", lineJoin: "round" }).addTo(layer);
      L.polyline(coords, {
        color: seg.color,
        weight: activeSegment === seg.index ? 6 : 4,
        opacity: dimmed ? 0.35 : 1,
        lineCap: "round",
        lineJoin: "round",
      })
        .bindTooltip(`${seg.label} · ${seg.fromName} → ${seg.toName} · km ${seg.fromKm.toFixed(1)}–${seg.toKm.toFixed(1)}`, { sticky: true })
        .addTo(layer);
    }

    // Aid stations sit on segment boundaries; number them in course order.
    segments.slice(1).forEach((seg, i) => {
      L.marker(pointAtKm(path, seg.fromKm), { icon: pinIcon(String(i + 1), T.brass, T.surface) })
        .bindTooltip(`${seg.fromName} · km ${seg.fromKm.toFixed(1)}`)
        .addTo(layer);
    });

    // On a loop course the start and finish are the same point, so one marker
    // carries both rather than the finish silently covering the start.
    const start = path[0];
    const finish = path[path.length - 1];
    const isLoop = Math.abs(start.lat - finish.lat) < 2e-4 && Math.abs(start.lon - finish.lon) < 2e-4;
    if (isLoop) {
      L.marker([start.lat, start.lon], { icon: pinIcon(t("map.startFinishInitial"), T.green, "#FFFFFF") })
        .bindTooltip(t("map.startFinish"))
        .addTo(layer);
    } else {
      L.marker([start.lat, start.lon], { icon: pinIcon(t("map.startInitial"), T.green, "#FFFFFF") }).bindTooltip(t("map.start")).addTo(layer);
      L.marker([finish.lat, finish.lon], { icon: pinIcon(t("map.finishInitial"), T.paper, T.surface) }).bindTooltip(t("map.finish")).addTo(layer);
    }

    map.fitBounds(L.latLngBounds(path.map((p) => [p.lat, p.lon])), { padding: [24, 24] });
  }, [segments, path, hasPath, activeSegment, t]);

  // Leaflet measures its container on creation; if it was laid out after that
  // (a collapsed panel opening, a resize) the tiles come back grey until told.
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [hasPath]);

  if (!hasPath) {
    return (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: R.sm, padding: "18px 16px", background: T.surface, fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim }}>
        {t("map.noTrack")}
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: R.sm, background: T.surface, overflow: "hidden" }}>
      <div ref={containerRef} style={{ height, width: "100%", background: T.surfaceHi }} />

      {tilesFailed && (
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.line}`, fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim }}>
          {t("map.tilesFailed")}
        </div>
      )}

      {/* Segment legend — identity is never carried by colour alone. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "10px 12px", borderTop: `1px solid ${T.line}` }}>
        {segments.map((seg) => (
          <span key={seg.index} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 12.5, color: T.ink }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            {seg.label}
            <span style={{ color: T.inkDim }}>
              {seg.fromKm.toFixed(1)}–{seg.toKm.toFixed(1)} km
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
