import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtDate, fmtTimeOfDay } from "../utils/time.js";
import { useAuth } from "../context/AuthContext.jsx";
import { askCoach, CoachApiError } from "../lib/coachApi.js";
import { inputStyle } from "./ui.jsx";

/*
  The coach is a thin client. Intent routing, data gathering, and prompt
  construction all live server-side in api/_lib/prompts.js — the browser sends
  the athlete's race data and a question, and never sees an Anthropic key.
*/

const COACH_HISTORY_KEY = "raceiq:coach-history";
const OOS_INTENTS = new Set(["oos_medical", "oos_training"]);

const SUGGESTED_KEYS = ["bonk", "improving", "fit", "next"];

function loadCoachHistory() {
  try { return JSON.parse(localStorage.getItem(COACH_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveCoachHistory(h) {
  try { localStorage.setItem(COACH_HISTORY_KEY, JSON.stringify(h)); } catch {}
}

function CoachMessage({ msg }) {
  const { t } = useTranslation("coach");
  const isCoach = msg.role === "coach";
  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: isCoach ? "flex-start" : "flex-end" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>
        {t(isCoach ? "coachLabel" : "youLabel")} · {fmtTimeOfDay(msg.timestamp)}
      </div>
      <div style={{ maxWidth: "82%", padding: "14px 18px", borderRadius: 4, fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: isCoach ? T.ink : T.bg, background: isCoach ? T.bg2 : T.brass, border: isCoach ? `1px solid ${T.line}` : "none", whiteSpace: "pre-wrap" }}>
        {msg.content}
      </div>
      {isCoach && msg.sources?.length > 0 && !OOS_INTENTS.has(msg.intentCategory) && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, letterSpacing: 0.5 }}>{t("basedOn")}</span>
          {/* Text is `brass`, not `brassDim`: brassDim is a border-weight colour
              and inverts to a dark green in the dark palette. */}
          {msg.sources.map((r) => (
            <span key={r.id} style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, background: `${T.brass}1A`, border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "2px 8px", letterSpacing: 0.3 }}>
              {r.name} · {fmtDate(r.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignInNotice() {
  const { t } = useTranslation("coach");
  return (
    <div style={{ padding: "16px 20px", marginBottom: 24, background: `${T.brass}12`, border: `1px solid ${T.brassDim}`, borderRadius: 4 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.brass, marginBottom: 6 }}>{t("signInRequired.title")}</div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, lineHeight: 1.55 }}>
        {t("signInRequired.body")}
      </div>
    </div>
  );
}

export default function CoachView({ races, contextRace, onBack }) {
  const { t } = useTranslation("coach");
  const { user, profile } = useAuth();
  const [history, setHistory] = useState(() => loadCoachHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const athleteName = (profile?.display_name || "").trim().split(/\s+/)[0] || t("defaultName");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, loading]);
  useEffect(() => { saveCoachHistory(history); }, [history]);

  async function handleSend(questionOverride) {
    const question = (questionOverride || input).trim();
    if (!question || loading) return;

    setInput("");
    setError("");

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
      contextRaceId: contextRace?.id || null,
    };

    const historySnapshot = history;
    setHistory((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await askCoach({
        question,
        races,
        contextRaceId: contextRace?.id || null,
        history: historySnapshot,
        profile,
      });

      const sources = (res.sourceRaceIds || [])
        .map((id) => races.find((r) => r.id === id))
        .filter(Boolean);

      setHistory((prev) => [...prev, {
        id: `msg_${Date.now() + 1}`,
        role: "coach",
        content: res.answer,
        timestamp: new Date().toISOString(),
        sources,
        intentCategory: res.intent,
      }]);
    } catch (err) {
      setError(err instanceof CoachApiError ? t(err.key, err.values) : t("errors.generic"));
      // Drop the unanswered question so a retry doesn't duplicate it.
      setHistory((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(question);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasMessages = history.length > 0;
  const canAsk = Boolean(user);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 140px)" }}>
      <div style={{ marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, marginBottom: 20 }}>
          {t(contextRace ? "backToDebrief" : "backToRaces")}
        </button>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>{t("eyebrow")}</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: 0, color: T.paper }}>{t("title")}</h1>
          </div>
          {hasMessages && (
            <button
              onClick={() => { if (window.confirm(t("clearConfirm"))) setHistory([]); }}
              style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "6px 12px", cursor: "pointer" }}
            >
              {t("clearHistory")}
            </button>
          )}
        </div>
        {contextRace && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: `${T.brass}1A`, border: `1px solid ${T.brassDim}`, borderRadius: 3, fontFamily: FONT_MONO, fontSize: 11, color: T.brass }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.brass, display: "inline-block" }} />
            {t("context", { name: contextRace.name })}
          </div>
        )}
      </div>

      {!canAsk && <SignInNotice />}

      <div style={{ flex: 1 }}>
        {!hasMessages ? (
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 16, color: T.inkDim, marginBottom: 28, lineHeight: 1.6 }}>
              {t("intro", { name: athleteName })}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, color: T.inkDim, marginBottom: 14 }}>{t("tryAsking")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED_KEYS.map((key) => t(`suggested.${key}`)).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={!canAsk}
                  style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, color: T.ink, fontFamily: FONT_BODY, fontSize: 15, padding: "13px 18px", cursor: canAsk ? "pointer" : "default", opacity: canAsk ? 1 : 0.5, textAlign: "left", transition: "border-color 120ms ease" }}
                  onMouseEnter={(e) => canAsk && (e.currentTarget.style.borderColor = T.brass)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.line)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {history.map((msg) => <CoachMessage key={msg.id} msg={msg} />)}
            {loading && (
              <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>{t("coachLabel")}</div>
                <div style={{ padding: "14px 18px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.inkDim, letterSpacing: 0.5 }}>{t("analyzing")}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
        {error && (
          <div style={{ padding: "10px 16px", background: `${T.ember}14`, border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5, marginBottom: 16 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: 8, background: T.bg, borderTop: `1px solid ${T.line}`, marginTop: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canAsk}
            placeholder={canAsk
              ? (contextRace ? t("placeholder.race", { name: contextRace.name }) : t("placeholder.general"))
              : t("placeholder.signedOut")}
            rows={1}
            style={{ ...inputStyle, flex: 1, resize: "none", lineHeight: 1.5, minHeight: 42, maxHeight: 120, overflow: "auto" }}
            onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || !canAsk}
            style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: "none", fontWeight: 600, flexShrink: 0, background: input.trim() && !loading && canAsk ? T.brass : T.line, color: input.trim() && !loading && canAsk ? T.bg : T.inkDim, cursor: input.trim() && !loading && canAsk ? "pointer" : "default" }}
          >
            {loading ? "…" : t("send")}
          </button>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 8, letterSpacing: 0.3 }}>
          {t("inputHint")}
        </div>
      </div>
    </div>
  );
}
