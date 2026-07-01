import { useState, useEffect, useRef } from "react";
import { T, FONT_MONO, FONT_BODY, FONT_DISPLAY } from "../constants.js";

export const inputStyle = {
  width: "100%",
  fontFamily: FONT_MONO,
  fontSize: 13,
  color: T.paper,
  background: T.bg2,
  border: `1px solid ${T.line}`,
  borderRadius: 3,
  padding: "9px 10px",
  outline: "none",
};

export function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.7, color: T.inkDim, marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
      {hint && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      style={inputStyle}
      onFocus={(e) => (e.target.style.borderColor = T.brass)}
      onBlur={(e) => (e.target.style.borderColor = T.line)}
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
        fontSize: 16,
        fontWeight: 600,
        color: T.paper,
        marginTop: 32,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

export function Finding({ kind, title, body }) {
  const color = kind === "strength" ? T.green : kind === "limiter" ? T.ember : T.brass;
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ flexShrink: 0, width: 8, paddingTop: 6 }}>
        <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: T.paper, marginBottom: 5, letterSpacing: 0.1 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: T.ink }}>{body}</div>
      </div>
    </div>
  );
}

export function Recommendation({ index, action, why }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.brass, flexShrink: 0, paddingTop: 2 }}>
        {String(index).padStart(2, "0")}
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500, color: T.paper, marginBottom: 4 }}>
          {action}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, lineHeight: 1.5 }}>{why}</div>
      </div>
    </div>
  );
}
