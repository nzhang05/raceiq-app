import { useState, useEffect, useRef } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { fmtPace } from "../utils/pace.js";
import { fuelingBenchmarks } from "../utils/fueling.js";
import {
  buildDebrief,
  gatherDiagnosticData,
  gatherTrendData,
  gatherFitData,
  gatherLimiterPatterns,
} from "../utils/analysis.js";
import { inputStyle } from "./ui.jsx";

const COACH_HISTORY_KEY = "raceiq:coach-history";
const COACH_APIKEY_KEY = "raceiq:apikey";
const OOS_INTENTS = new Set(["oos_medical", "oos_training"]);

const SUGGESTED_QUESTIONS = [
  "Why did I bonk at my last race?",
  "Am I improving across my race history?",
  "Which types of races fit me best?",
  "What should I change before my next marathon?",
];

function loadCoachHistory() {
  try { return JSON.parse(localStorage.getItem(COACH_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveCoachHistory(h) {
  try { localStorage.setItem(COACH_HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function loadStoredApiKey() {
  try { return localStorage.getItem(COACH_APIKEY_KEY) || ""; } catch { return ""; }
}
function persistApiKey(key) {
  try { localStorage.setItem(COACH_APIKEY_KEY, key); } catch {}
}

function classifyIntent(question, races, contextRaceId) {
  const q = question.toLowerCase();

  if (/\b(pain|hurt|ache|injur|knee|ankle|shin|tendon|blister|medical|doctor|physio|cramp)\b/.test(q)) {
    return { category: "oos_medical" };
  }
  if (/\b(training plan|workout plan|program|weekly plan|base building|periodization)\b/.test(q)) {
    return { category: "oos_training" };
  }
  if (/\b(improv|trend|better|faster|progress|getting|how has|over time|this year|season|am i getting)\b/.test(q)) {
    const sportHint = ["road running", "trail running", "gravel cycling", "marathon", "trail", "ultra"]
      .find(s => q.includes(s));
    return { category: "trend", sportFilter: sportHint || null };
  }
  if (/\b(fit|which race|best race|suited|which course|should i do|trail or road|road or trail|type of race|best at|excel)\b/.test(q)) {
    return { category: "fit" };
  }
  if (/\b(next|prepare|change|before|upcoming|should i|ready|goal race|what to|how to improve)\b/.test(q)) {
    return { category: "planning" };
  }
  if (/\b(compar|similar athlete|how do i rank|versus|\bvs\b|peer|age group|cohort|other athlete)\b/.test(q)) {
    return { category: "benchmarking" };
  }
  if (/\b(bonk|what went wrong|why did|this race|faded|died|collapsed|blew up|slowed|second half|late)\b/.test(q) || contextRaceId) {
    let raceId = contextRaceId;
    if (!raceId) {
      const matched = races.find(r =>
        q.includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().split(" ").some(word => word.length > 4 && q.includes(word.toLowerCase()))
      );
      raceId = matched?.id || races[0]?.id;
    }
    return { category: "diagnostic", raceId };
  }
  if (races.length >= 2) return { category: "trend", sportFilter: null };
  return { category: "diagnostic", raceId: races[0]?.id };
}

function buildSystemPrompt(athleteName, races) {
  const sports = [...new Set(races.map(r => r.sport))].join(", ");
  const sorted = [...races].sort((a, b) => new Date(a.date) - new Date(b.date));
  const range = races.length >= 2
    ? `${fmtDate(sorted[0].date)} – ${fmtDate(sorted[sorted.length - 1].date)}`
    : races.length === 1 ? fmtDate(sorted[0].date) : "no races logged";

  return `You are RaceIQ's AI Coach — a race intelligence system for endurance athletes. You answer questions about ${athleteName}'s race performance using only the structured data provided with each question. You never invent splits, times, percentiles, or comparisons.

ATHLETE: ${athleteName} · ${races.length} races logged (${sports}) · ${range}

RULES:
1. Only cite numbers from the DATA block provided. Never fabricate statistics.
2. Name which race(s) every substantive claim comes from.
3. If a question involves pain, injury, or medical symptoms: decline clearly, suggest a sports medicine professional.
4. If asked for a training plan or weekly program: decline, explain you analyze races not build plans.
5. If data is insufficient, say so plainly — never invent a trend from one data point.
6. Be conversational and precise. Address ${athleteName} by first name. Avoid bullet lists unless summarizing 3+ races.
7. Aim for 2–4 sentences for simple questions, up to 3 focused paragraphs for trend or fit analysis.
8. If the question references a debrief the athlete has already seen, refer to it ("same pattern the debrief flagged") rather than restating it verbatim.`;
}

function buildQuestionContext(intent, data, question, contextRaceId) {
  let ctx = `QUESTION: ${question}\n\n`;

  switch (intent.category) {
    case "diagnostic": {
      if (!data.race) { ctx += "DATA: No matching race found.\n"; break; }
      const { race, durationMin, drift, hot, fuelingGap, fuelRange, fuelLow, needsCarbs, firstPace, lastPace, turnKm, limiters, strengths } = data;
      ctx += `DATA FOR THIS RACE:\n`;
      ctx += `Race: ${race.name} (${fmtDate(race.date)})\n`;
      ctx += `Sport: ${race.sport} · ${race.distanceKm}km · +${race.elevationM}m · ${race.surface}\n`;
      ctx += `Finish: ${race.finishTime} (${durationMin} min) · Place: ${race.placement}/${race.field} (${race.percentile}th percentile)\n`;
      ctx += `RaceIQ Score: ${race.rating} (${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta})\n`;
      ctx += `Conditions: ${race.tempC}°C, ${race.humidity}% humidity, ${race.wind}km/h wind${hot ? " — HEAT STRESS (≥24°C)" : ""}\n`;
      ctx += `Pace: first split ${firstPace} → last split ${lastPace} (${drift > 0 ? "+" : ""}${drift}% drift${race.usesGap ? ", grade-adjusted" : ""})\n`;
      if (turnKm) ctx += `Largest pace drop: at km ${turnKm}\n`;
      ctx += `Verdict: ${race.verdict.toUpperCase()}\n`;
      if (needsCarbs) {
        ctx += `Fueling: ${race.fueling.carbsPerHr}g carbs/hr (target for ${durationMin}-min effort: ${fuelRange}`;
        ctx += fuelingGap != null && fuelingGap < 0 ? `; ${Math.abs(fuelingGap)}g/hr below minimum)\n` : "; within range)\n";
        ctx += `Sodium: ${race.fueling.sodiumPerHr}mg/hr · Fluids: ${race.fueling.fluidsPerHr}ml/hr · Caffeine: ${race.fueling.caffeine}mg\n`;
        if (race.fueling.inputMode === "sections" && race.fueling.sections?.length) {
          ctx += `Fueling by section:\n`;
          for (const s of race.fueling.sections) {
            const flag = s.carbsPerHr < fuelLow ? "  ⚠ below range" : "";
            ctx += `  ${s.fromKm}–${s.toKm}km: ${s.carbsPerHr}g carbs/hr, ${s.sodiumPerHr}mg Na/hr, ${s.fluidsPerHr}ml/hr${flag}\n`;
          }
        }
      }
      if (strengths.length) ctx += `\nSTRENGTHS: ${strengths.map(s => s.title).join("; ")}\n`;
      if (limiters.length) ctx += `LIMITERS: ${limiters.map(l => l.title).join("; ")}\n`;
      if (contextRaceId === race.id) ctx += `\nThis race's debrief is already loaded — reference findings conversationally, don't re-deliver them verbatim.\n`;
      break;
    }
    case "trend": {
      const { filtered, insufficient, ratingTrend, percentileTrend, strengthCount, limiterCount, firstRating, lastRating, firstPct, lastPct } = data;
      if (insufficient) {
        ctx += `DATA: Only ${filtered.length} race(s) match — need at least 2 for a trend. Tell the athlete clearly.\n`;
      } else {
        ctx += `TREND DATA (${filtered.length} races, oldest→newest):\n`;
        for (const r of filtered) {
          ctx += `  ${fmtDate(r.date)} · ${r.name}: ${r.percentile}th pct, RaceIQ ${r.rating} [${r.verdict}], ${r.tempC}°C, ${r.distanceKm}km, ${r.surface}\n`;
        }
        ctx += `\nSUMMARY:\n`;
        ctx += `RaceIQ Score: ${firstRating} → ${lastRating} (${ratingTrend >= 0 ? "+" : ""}${ratingTrend})\n`;
        ctx += `Percentile: ${firstPct}th → ${lastPct}th (${percentileTrend >= 0 ? "+" : ""}${percentileTrend} pts)\n`;
        ctx += `Verdicts: ${strengthCount} strength / ${limiterCount} limiter / ${filtered.length - strengthCount - limiterCount} mixed\n`;
        ctx += `\nIMPORTANT: Account for course and weather variation. Don't equate faster raw times with improved fitness if conditions or course difficulty differ.\n`;
      }
      break;
    }
    case "fit": {
      const { byVerdict, avgStrengthTemp, avgLimiterTemp, sportVerdicts, topRaces, races } = data;
      ctx += `RACE FIT DATA (${races.length} races total):\n`;
      ctx += `Top 3 by percentile:\n`;
      for (const r of topRaces) {
        ctx += `  ${r.name}: ${r.percentile}th pct [${r.verdict}], ${r.tempC}°C, ${r.surface}, ${r.distanceKm}km\n`;
      }
      ctx += `Strengths (${byVerdict.strength.length}): ${byVerdict.strength.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      ctx += `Limiters (${byVerdict.limiter.length}): ${byVerdict.limiter.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      ctx += `Mixed (${byVerdict.mixed.length}): ${byVerdict.mixed.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      if (avgStrengthTemp != null) ctx += `Avg temp on strength races: ${avgStrengthTemp}°C\n`;
      if (avgLimiterTemp != null) ctx += `Avg temp on limiter races: ${avgLimiterTemp}°C\n`;
      ctx += `Sport breakdown: ${Object.entries(sportVerdicts).map(([s, v]) => `${s}: ${v.count} races (${v.strength}S/${v.limiter}L/${v.mixed}M)`).join("; ")}\n`;
      break;
    }
    case "planning": {
      const { races, hotLimiters, underFueled, coolStrengths } = data;
      ctx += `HISTORICAL PATTERNS (${races.length} races):\n`;
      if (hotLimiters.length) ctx += `Heat-driven limiters (≥24°C): ${hotLimiters.map(r => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      if (underFueled.length) ctx += `Under-fueling limiters: ${underFueled.map(r => `${r.name} (${r.fueling.carbsPerHr}g/hr)`).join(", ")}\n`;
      if (coolStrengths.length) ctx += `Cool-condition strengths (≤14°C): ${coolStrengths.map(r => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      ctx += `No upcoming race is logged yet. Answer from historical limiter patterns and suggest logging the upcoming race for a more specific answer.\n`;
      break;
    }
    case "benchmarking": {
      ctx += `PERCENTILE DATA (${data.races.length} races):\n`;
      for (const r of data.races) {
        ctx += `  ${r.name}: ${r.percentile}th pct of ${r.field} finishers · ${r.sport}\n`;
      }
      ctx += `Full cohort benchmarking (age/sex-matched) is not yet implemented. Answer from available percentile data and note the limitation.\n`;
      break;
    }
  }

  return ctx;
}

async function callCoachLLM(apiKey, systemPrompt, priorMsgs, contextAndQuestion) {
  const messages = [
    ...priorMsgs.slice(-6).map(m => ({
      role: m.role === "coach" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: contextAndQuestion },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API error ${res.status}`);
  }
  const json = await res.json();
  return json.content?.[0]?.text || "No response received.";
}

function buildFallbackAnswer(intent, data) {
  switch (intent.category) {
    case "oos_medical":
      return "That sounds like it could involve a medical or injury concern — outside what RaceIQ can help with. Please consult a sports medicine professional or physiotherapist who can evaluate you in person.";
    case "oos_training":
      return "RaceIQ focuses on race analysis and readiness — generating a training plan is outside its scope. A coach can use these race insights as input, but the planning decisions belong with them.";
    case "diagnostic": {
      if (!data.race) return "I couldn't identify which race you're asking about. Try mentioning the race name.";
      const { race, limiters, strengths } = data;
      const parts = [`Looking at ${race.name} (${fmtDate(race.date)}):`];
      if (strengths.length) parts.push(`Strengths — ${strengths.map(s => s.title).join("; ")}.`);
      if (limiters.length) parts.push(`Limiters — ${limiters.map(l => l.title).join("; ")}.`);
      parts.push(`Add an Anthropic API key to get a full natural-language analysis.`);
      return parts.join(" ");
    }
    case "trend": {
      if (data.insufficient) return `Not enough races to show a trend yet — log at least 2 comparable races first.`;
      const { ratingTrend, filtered } = data;
      return `Across your ${filtered.length} races, your RaceIQ Score moved ${ratingTrend >= 0 ? "+" : ""}${ratingTrend} points. Add an Anthropic API key for full trend analysis.`;
    }
    case "fit": {
      if (data.insufficient) return "Log at least 2 races to see fit patterns.";
      const { byVerdict, topRaces } = data;
      return `Best result: ${topRaces[0]?.name} (${topRaces[0]?.percentile}th percentile). You have ${byVerdict.strength.length} strength and ${byVerdict.limiter.length} limiter races logged. Add an API key for detailed fit analysis.`;
    }
    case "planning":
      return "Your clearest limiters appear in hot conditions. Add an Anthropic API key for specific pre-race recommendations based on your full pattern history.";
    case "benchmarking": {
      const pcts = data.races?.map(r => r.percentile) || [];
      if (!pcts.length) return "No races logged yet.";
      return `Your percentile rankings range from ${Math.min(...pcts).toFixed(1)}th to ${Math.max(...pcts).toFixed(1)}th across your logged races. Add an API key for detailed benchmarking analysis.`;
    }
    default:
      return "Try asking about a specific race, your progress over time, or which race conditions suit you best.";
  }
}

function getSourceRaces(intent, data) {
  if (OOS_INTENTS.has(intent.category)) return [];
  switch (intent.category) {
    case "diagnostic": return data.race ? [data.race] : [];
    case "trend": return data.filtered || [];
    case "fit": case "planning": case "benchmarking": return data.races || [];
    default: return [];
  }
}

function CoachMessage({ msg }) {
  const isCoach = msg.role === "coach";
  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: isCoach ? "flex-start" : "flex-end" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>
        {isCoach ? "RACEIQ COACH" : "YOU"} · {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ maxWidth: "82%", padding: "14px 18px", borderRadius: 4, fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: isCoach ? T.ink : T.bg, background: isCoach ? T.bg2 : T.brass, border: isCoach ? `1px solid ${T.line}` : "none", whiteSpace: "pre-wrap" }}>
        {msg.content}
      </div>
      {isCoach && msg.sources?.length > 0 && !OOS_INTENTS.has(msg.intentCategory) && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.inkDim, letterSpacing: 0.5 }}>BASED ON:</span>
          {msg.sources.map(r => (
            <span key={r.id} style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.brassDim, background: "rgba(201,162,75,0.1)", border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "2px 8px", letterSpacing: 0.3 }}>
              {r.name} · {fmtDate(r.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeyBanner({ onSave }) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ padding: "16px 20px", marginBottom: 24, background: "rgba(201,162,75,0.07)", border: `1px solid ${T.brassDim}`, borderRadius: 4 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.6, color: T.brass, marginBottom: 6 }}>CONNECT ANTHROPIC API KEY</div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 12, lineHeight: 1.55 }}>
        The AI Coach needs an Anthropic API key to generate natural-language answers. Without one you'll see deterministic findings only. Your key is stored in this browser's local storage and sent only to Anthropic.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type={visible ? "text" : "password"}
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && key.trim() && onSave(key.trim())}
          placeholder="sk-ant-..."
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          onFocus={e => (e.target.style.borderColor = T.brass)}
          onBlur={e => (e.target.style.borderColor = T.line)}
        />
        <button onClick={() => setVisible(v => !v)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, fontFamily: FONT_MONO, fontSize: 11, padding: "9px 10px", cursor: "pointer" }}>
          {visible ? "HIDE" : "SHOW"}
        </button>
        <button
          onClick={() => key.trim() && onSave(key.trim())}
          disabled={!key.trim()}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 16px", borderRadius: 3, border: "none", fontWeight: 600, whiteSpace: "nowrap", background: key.trim() ? T.brass : T.line, color: key.trim() ? T.bg : T.inkDim, cursor: key.trim() ? "pointer" : "default" }}
        >
          SAVE KEY
        </button>
      </div>
    </div>
  );
}

export default function CoachView({ races, contextRace, onBack }) {
  const [history, setHistory] = useState(() => loadCoachHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(() => loadStoredApiKey());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const athleteName = "Alex";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, loading]);
  useEffect(() => { saveCoachHistory(history); }, [history]);

  function handleSaveApiKey(key) {
    persistApiKey(key);
    setApiKey(key);
  }

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
    setHistory(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const intent = classifyIntent(question, races, contextRace?.id || null);
      let answer;
      let sources = [];

      if (OOS_INTENTS.has(intent.category)) {
        answer = buildFallbackAnswer(intent, {});
      } else {
        let gatheredData;
        switch (intent.category) {
          case "diagnostic": {
            const race = races.find(r => r.id === intent.raceId) || contextRace || races[0];
            gatheredData = race ? gatherDiagnosticData(race) : { race: null };
            break;
          }
          case "trend":
            gatheredData = gatherTrendData(races, intent.sportFilter);
            break;
          case "fit":
            gatheredData = gatherFitData(races);
            break;
          case "planning":
            gatheredData = gatherLimiterPatterns(races);
            break;
          default:
            gatheredData = { races };
        }

        sources = getSourceRaces(intent, gatheredData);

        if (apiKey) {
          try {
            const systemPrompt = buildSystemPrompt(athleteName, races);
            const ctxBlock = buildQuestionContext(intent, gatheredData, question, contextRace?.id || null);
            const priorMsgs = historySnapshot.filter(m => m.role === "user" || m.role === "coach").slice(-6);
            answer = await callCoachLLM(apiKey, systemPrompt, priorMsgs, ctxBlock);
          } catch (llmErr) {
            answer = buildFallbackAnswer(intent, gatheredData) + `\n\n[API error: ${llmErr.message}]`;
          }
        } else {
          answer = buildFallbackAnswer(intent, gatheredData);
        }
      }

      setHistory(prev => [...prev, {
        id: `msg_${Date.now() + 1}`,
        role: "coach",
        content: answer,
        timestamp: new Date().toISOString(),
        sources,
        intentCategory: intent.category,
      }]);
    } catch (err) {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasMessages = history.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 140px)" }}>
      <div style={{ marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, marginBottom: 20 }}>
          ← {contextRace ? "BACK TO DEBRIEF" : "BACK TO RACE RESUME"}
        </button>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>AI COACH</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: 0, color: T.paper }}>Ask RaceIQ</h1>
          </div>
          {hasMessages && (
            <button
              onClick={() => { if (window.confirm("Clear conversation history?")) setHistory([]); }}
              style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.4, padding: "6px 12px", cursor: "pointer" }}
            >
              CLEAR HISTORY
            </button>
          )}
        </div>
        {contextRace && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "rgba(201,162,75,0.1)", border: `1px solid ${T.brassDim}`, borderRadius: 3, fontFamily: FONT_MONO, fontSize: 10.5, color: T.brass }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.brass, display: "inline-block" }} />
            CONTEXT: {contextRace.name}
          </div>
        )}
      </div>

      {!apiKey && <ApiKeyBanner onSave={handleSaveApiKey} />}

      <div style={{ flex: 1 }}>
        {!hasMessages ? (
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 16, color: T.inkDim, marginBottom: 28, lineHeight: 1.6 }}>
              Ask anything about your race history. Every answer is drawn from your logged data.
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1, color: T.inkDim, marginBottom: 14 }}>TRY ASKING</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, color: T.ink, fontFamily: FONT_BODY, fontSize: 15, padding: "13px 18px", cursor: "pointer", textAlign: "left", transition: "border-color 120ms ease" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.brass)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.line)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {history.map(msg => <CoachMessage key={msg.id} msg={msg} />)}
            {loading && (
              <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>RACEIQ COACH</div>
                <div style={{ padding: "14px 18px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.inkDim, letterSpacing: 0.5 }}>Analyzing your data…</span>
                </div>
              </div>
            )}
            {error && (
              <div style={{ padding: "10px 16px", background: "rgba(255,106,57,0.08)", border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: 8, background: T.bg, borderTop: `1px solid ${T.line}`, marginTop: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contextRace ? `Ask about ${contextRace.name}…` : "Ask about your race history…"}
            rows={1}
            style={{ ...inputStyle, flex: 1, resize: "none", lineHeight: 1.5, minHeight: 42, maxHeight: 120, overflow: "auto" }}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: "none", fontWeight: 600, flexShrink: 0, background: input.trim() && !loading ? T.brass : T.line, color: input.trim() && !loading ? T.bg : T.inkDim, cursor: input.trim() && !loading ? "pointer" : "default" }}
          >
            {loading ? "…" : "SEND"}
          </button>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.inkDim, marginTop: 8, letterSpacing: 0.3 }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
