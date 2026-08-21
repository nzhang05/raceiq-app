import { useState, useEffect, useRef } from "react";
import { T, R, FONT_MONO, FONT_BODY, FONT_DISPLAY } from "../constants.js";

export const inputStyle = {
  width: "100%",
  fontFamily: FONT_MONO,
  fontSize: 13.5,
  color: T.paper,
  background: T.bg,
  border: `1px solid ${T.line}`,
  borderRadius: R.sm,
  padding: "11px 12px",
  outline: "none",
  transition: "border-color 140ms ease, box-shadow 140ms ease",
};

export function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: T.ink, marginBottom: 7 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginTop: 5 }}>{hint}</div>
      )}
    </div>
  );
}

/* Reusable card surface for the rounded-panel language. */
export function Card({ children, style, className, ...rest }) {
  return (
    <div
      className={className}
      style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: R.lg,
        padding: 20,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* Primary / secondary / ghost pill button. */
export function Button({ children, variant = "primary", style, ...rest }) {
  const base = {
    fontFamily: FONT_BODY,
    fontSize: 13.5,
    fontWeight: 600,
    padding: "10px 18px",
    borderRadius: R.pill,
    cursor: "pointer",
    transition: "all 140ms ease",
    whiteSpace: "nowrap",
  };
  const variants = {
    primary: { border: "none", background: T.brass, color: "#1A0E08" },
    secondary: { border: `1px solid ${T.line}`, background: T.surface, color: T.paper },
    ghost: { border: `1px solid ${T.brass}55`, background: `${T.brass}14`, color: T.brass },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

/* Small status pill (verdict, tags). */
export function Pill({ color = T.ink, children, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        color,
        background: `${color}18`,
        border: `1px solid ${color}33`,
        borderRadius: R.pill,
        padding: "4px 11px",
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {children}
    </span>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = T.brass; e.target.style.boxShadow = `0 0 0 3px ${T.brass}22`; }}
      onBlur={(e) => { e.target.style.borderColor = T.line; e.target.style.boxShadow = "none"; }}
    />
  );
}

export function LocationAutocomplete({ value, onChange, onSelect, placeholder, onKeyDown }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6`);
        const data = await res.json();
        const results = (data?.results || []).map(r => ({
          label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
          inputLabel: [r.name, r.country].filter(Boolean).join(", "),
          lat: r.latitude,
          lon: r.longitude,
        }));
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIdx(-1);
      } catch { /* network unavailable */ }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(s) {
    onChange({ target: { value: s.inputLabel } });
    onSelect?.({ label: s.inputLabel, lat: s.lat, lon: s.lon });
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    onKeyDown?.(e);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { e.target.style.borderColor = T.brass; if (suggestions.length > 0) setOpen(true); }}
        onBlur={(e) => (e.target.style.borderColor = T.line)}
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: T.bg, border: `1px solid ${T.line}`, borderTop: "none",
          borderRadius: "0 0 3px 3px", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "8px 12px",
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: i === activeIdx ? T.bg : T.ink,
                background: i === activeIdx ? T.brass : "transparent",
                cursor: "pointer",
                borderBottom: i < suggestions.length - 1 ? `1px solid ${T.line}` : "none",
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
      {options.map((o) => (
        <option key={o} value={o} style={{ background: T.bg }}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function FormSectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: -0.2,
        color: T.paper,
        marginTop: 34,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

// `evidence` is the list of data points a finding rests on. It's what makes an
// AI-written claim checkable, so it renders rather than staying in the payload.
export function EvidenceList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: T.inkDim,
            background: T.surfaceHi,
            border: `1px solid ${T.line}`,
            borderRadius: R.sm,
            padding: "3px 8px",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function Finding({ kind, title, body, evidence }) {
  const color = kind === "strength" ? T.green : kind === "limiter" ? T.ember : T.brass;
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: 16,
        marginBottom: 10,
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: R.md,
      }}
    >
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: T.paper, marginBottom: 5, letterSpacing: -0.1 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: T.ink }}>{body}</div>
        <EvidenceList items={evidence} />
      </div>
    </div>
  );
}

export function Recommendation({ index, action, why, evidence }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 13,
          fontWeight: 500,
          color: T.brass,
          background: `${T.brass}18`,
          borderRadius: R.pill,
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {index}
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, letterSpacing: -0.1, color: T.paper, marginBottom: 4 }}>
          {action}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, lineHeight: 1.55 }}>{why}</div>
        <EvidenceList items={evidence} />
      </div>
    </div>
  );
}
