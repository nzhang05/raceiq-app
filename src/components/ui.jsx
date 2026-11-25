import { useState, useEffect, useRef, useId, createContext, useContext } from "react";
import { T, R, FONT_MONO, FONT_BODY, FONT_DISPLAY } from "../constants.js";
import { ArrowUpRightIcon, AlertIcon, InfoIcon } from "./icons.jsx";

export const inputStyle = {
  width: "100%",
  fontFamily: FONT_BODY,
  fontSize: 15,
  color: T.paper,
  background: T.surface,
  border: `1px solid ${T.line}`,
  borderRadius: R.sm,
  padding: "11px 12px",
  outline: "none",
  transition: "border-color 140ms ease, box-shadow 140ms ease",
};

/*
  A Field names the control(s) inside it. The label is linked by
  aria-labelledby rather than <label for>, because some fields hold more than
  one input (h / m / s) and some hold button groups, which a wrapping <label>
  would "click" on any tap of the label text. TextInput, Select and
  LocationAutocomplete pick the ids up from context; a raw <input> inside a
  Field can spread useFieldAria().
*/
const FieldContext = createContext(null);

export function useFieldAria(props = {}) {
  const ctx = useContext(FieldContext);
  if (!ctx || props["aria-label"] || props["aria-labelledby"]) return {};
  return { "aria-labelledby": ctx.labelId, ...(ctx.hintId ? { "aria-describedby": ctx.hintId } : {}) };
}

export function Field({ label, children, hint }) {
  const id = useId();
  const ctx = { labelId: `${id}label`, hintId: hint ? `${id}hint` : null };
  return (
    <div>
      <div id={ctx.labelId} style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: T.paper, marginBottom: 7 }}>
        {label}
      </div>
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {hint && (
        <div id={ctx.hintId} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginTop: 5 }}>{hint}</div>
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
    fontSize: 14.5,
    fontWeight: 600,
    padding: "11px 22px",
    borderRadius: R.pill,
    cursor: "pointer",
    transition: "all 140ms ease",
    whiteSpace: "nowrap",
  };
  const variants = {
    // White on forest is 6.5:1.
    primary: { border: `1px solid ${T.brass}`, background: T.brass, color: "#FFFFFF" },
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
  const aria = useFieldAria(props);
  return (
    <input
      {...aria}
      {...props}
      style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = T.brass; e.target.style.boxShadow = `0 0 0 3px ${T.brass}22`; }}
      onBlur={(e) => { e.target.style.borderColor = T.line; e.target.style.boxShadow = "none"; }}
    />
  );
}

// An ARIA combobox: the input owns a listbox of suggestions, and arrow keys
// move aria-activedescendant so screen readers announce the highlighted place.
export function LocationAutocomplete({ value, onChange, onSelect, placeholder, onKeyDown }) {
  const aria = useFieldAria();
  const listId = useId();
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
        {...aria}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
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
        <div id={listId} role="listbox" style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: T.bg, border: `1px solid ${T.line}`, borderTop: "none",
          borderRadius: "0 0 3px 3px", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
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

/* `options` accepts plain strings, or { value, label } when the stored value is
   data (a sport, a locale) and the label is translated. */
export function Select({ value, onChange, options, ...rest }) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const aria = useFieldAria(rest);
  return (
    <select {...aria} {...rest} value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
      {items.map((o) => (
        <option key={o.value} value={o.value} style={{ background: T.bg }}>
          {o.label}
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
        fontSize: 24,
        fontWeight: 500,
        letterSpacing: -0.3,
        lineHeight: 1.2,
        color: T.paper,
        marginTop: 48,
        marginBottom: 16,
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
            fontFamily: FONT_BODY,
            fontSize: 12,
            lineHeight: 1.5,
            color: T.ink,
            background: T.sageTint,
            borderRadius: R.pill,
            padding: "3px 10px",
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

// The debrief's three takeaways. Same content as `Finding`, laid out as a card
// for a row of three rather than as a stacked row: the kind reads from a top
// rule instead of a left one, and `body` flexes so the evidence chips line up
// along the bottom of all three cards regardless of how long the prose runs.
//
// `kindLabel` is passed in already translated — this module stays language-free.
export function FindingCard({ kind, kindLabel, title, body, evidence, style, className }) {
  const color = kind === "strength" ? T.green : kind === "limiter" ? T.ember : T.inkDim;
  const KindIcon = kind === "strength" ? ArrowUpRightIcon : kind === "limiter" ? AlertIcon : InfoIcon;
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "20px 22px 22px",
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: R.lg,
        ...style,
      }}
    >
      {/* The kind reads as a plain-language kicker with an icon, not a
          classification label shouted in capitals. */}
      {kindLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color, marginBottom: 10 }}>
          <KindIcon size={17} />
          {kindLabel}
        </div>
      )}
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 500, lineHeight: 1.25, color: T.paper, marginBottom: 8, letterSpacing: -0.2 }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: T.ink, flex: 1 }}>{body}</div>
      <EvidenceList items={evidence} />
    </div>
  );
}

export function Recommendation({ index, action, why, evidence }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 500,
          color: T.brass,
          width: 26,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {index}
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 500, letterSpacing: -0.2, lineHeight: 1.3, color: T.paper, marginBottom: 5 }}>
          {action}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.ink, lineHeight: 1.6 }}>{why}</div>
        <EvidenceList items={evidence} />
      </div>
    </div>
  );
}
