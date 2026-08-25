import { useState } from "react";
import { T, FONT_DISPLAY, FONT_BODY, SPORT_OPTIONS } from "../constants.js";
import { Card, Button, TextInput, Field, Select } from "./ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/*
  Athlete profile editor. Identity + the physiological attributes the engine
  wants. Canonical storage is metric (weight_kg, threshold_pace_sec_km); when
  the athlete's unit preference is imperial we convert only at the edges — the
  DB stays single-unit. See docs/design-auth-and-profiles.md.
*/

const LB_PER_KG = 2.2046226218;
const KM_PER_MI = 1.609344;
const SEX_OPTIONS = ["—", "M", "F", "other"];
const SPORT_CHOICES = ["—", ...SPORT_OPTIONS];

// sec/km (canonical) → "mm:ss" in the athlete's unit; "" when unset.
function fmtPaceInput(secPerKm, units) {
  if (secPerKm == null || secPerKm === "") return "";
  // Round to whole seconds first, then split — avoids "m:60" at boundaries.
  const sec = Math.round(units === "imperial" ? secPerKm * KM_PER_MI : secPerKm);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// "mm:ss" (or "m:ss") in the athlete's unit → sec/km (canonical); null when blank/invalid.
function parsePaceInput(str, units) {
  const t = (str ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return Math.round(units === "imperial" ? sec / KM_PER_MI : sec);
}

function fmtWeight(kg, units) {
  if (kg == null || kg === "") return "";
  return units === "imperial" ? (kg * LB_PER_KG).toFixed(1) : String(kg);
}
function parseWeight(str, units) {
  const n = parseFloat(str);
  if (!Number.isFinite(n)) return null;
  return units === "imperial" ? +(n / LB_PER_KG).toFixed(2) : n;
}

function intOrNull(str) {
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
}

export default function ProfileForm({ onBack }) {
  const { profile, updateProfile } = useAuth();
  const [units, setUnits] = useState(profile?.units ?? "metric");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [defaultSport, setDefaultSport] = useState(profile?.default_sport ?? "—");
  const [sex, setSex] = useState(profile?.sex ?? "—");
  // These two are held as display strings in the current unit; converted on save.
  const [weight, setWeight] = useState(fmtWeight(profile?.weight_kg, profile?.units ?? "metric"));
  const [thresholdPace, setThresholdPace] = useState(fmtPaceInput(profile?.threshold_pace_sec_km, profile?.units ?? "metric"));
  const [ftp, setFtp] = useState(profile?.ftp_watts ?? "");
  const [maxHr, setMaxHr] = useState(profile?.max_hr ?? "");
  const [birthYear, setBirthYear] = useState(profile?.birth_year ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Re-express the weight/pace display fields when the unit toggle flips, so the
  // number the athlete sees always matches the selected unit.
  function changeUnits(next) {
    const curKg = parseWeight(weight, units);
    const curPace = parsePaceInput(thresholdPace, units);
    setUnits(next);
    setWeight(fmtWeight(curKg, next));
    setThresholdPace(fmtPaceInput(curPace, next));
  }

  const paceLabel = units === "imperial" ? "min/mi" : "min/km";
  const weightUnit = units === "imperial" ? "lb" : "kg";

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const paceValid = !thresholdPace.trim() || parsePaceInput(thresholdPace, units) != null;
    if (!paceValid) {
      setError(`Threshold pace must look like m:ss (${paceLabel}).`);
      setBusy(false);
      return;
    }

    const patch = {
      display_name: displayName.trim() || null,
      units,
      default_sport: defaultSport === "—" ? null : defaultSport,
      sex: sex === "—" ? null : sex,
      weight_kg: parseWeight(weight, units),
      threshold_pace_sec_km: parsePaceInput(thresholdPace, units),
      ftp_watts: intOrNull(ftp),
      max_hr: intOrNull(maxHr),
      birth_year: intOrNull(birthYear),
    };

    const { error } = await updateProfile(patch);
    setBusy(false);
    if (error) setError(error.message ?? "Could not save profile.");
    else setSaved(true);
  }

  return (
    <div style={{ animation: "slideUp 300ms ease both" }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, letterSpacing: -0.3, color: T.paper, margin: "0 0 4px" }}>
        Athlete profile
      </h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.ink, margin: "0 0 24px" }}>
        Everything here is optional. Fill in what you know — it sharpens fueling, analysis, and race plans.
      </p>

      <form onSubmit={handleSubmit}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Display name">
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Moreno" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Units">
              <Select value={units === "imperial" ? "Imperial" : "Metric"} onChange={(e) => changeUnits(e.target.value === "Imperial" ? "imperial" : "metric")} options={["Metric", "Imperial"]} />
            </Field>
            <Field label="Default sport">
              <Select value={defaultSport} onChange={(e) => setDefaultSport(e.target.value)} options={SPORT_CHOICES} />
            </Field>
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: T.inkDim }}>
            Fitness
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label={`Body weight (${weightUnit})`}>
              <TextInput inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units === "imperial" ? "150" : "68"} />
            </Field>
            <Field label={`Threshold pace (${paceLabel})`} hint="Running — the pace you can hold ~1hr.">
              <TextInput value={thresholdPace} onChange={(e) => setThresholdPace(e.target.value)} placeholder="4:15" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="FTP (watts)" hint="Cycling functional threshold power.">
              <TextInput inputMode="numeric" value={ftp} onChange={(e) => setFtp(e.target.value)} placeholder="265" />
            </Field>
            <Field label="Max HR (bpm)">
              <TextInput inputMode="numeric" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} placeholder="188" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Birth year">
              <TextInput inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1992" />
            </Field>
            <Field label="Sex">
              <Select value={sex} onChange={(e) => setSex(e.target.value)} options={SEX_OPTIONS} />
            </Field>
          </div>
        </Card>

        {error && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ember, marginTop: 16 }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
          <Button type="submit" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
          <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
          {saved && <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.green }}>Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}
