import { useState } from "react";
import { T, R, FONT_DISPLAY, FONT_BODY } from "../constants.js";
import { Card, Button, TextInput, Field } from "./ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/*
  Auth gate: sign up / log in / password reset. Styled with the existing
  design tokens and ui primitives. See docs/design-auth-and-profiles.md.
*/
export default function SignIn() {
  const { signInWithPassword, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'reset'
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setNotice("Check your email for a password reset link.");
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, displayName.trim());
        if (error) throw error;
        setNotice("Account created. Check your email to confirm, then log in.");
        setMode("login");
      } else {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
        // On success the AuthProvider swaps this screen out automatically.
      }
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your account" : mode === "reset" ? "Reset password" : "Welcome back";
  const cta = mode === "signup" ? "Sign up" : mode === "reset" ? "Send reset link" : "Log in";

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, justifyContent: "center", marginBottom: 28 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: T.paper }}>Race</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: T.brass }}>IQ</span>
        </div>

        <Card>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600, color: T.paper, margin: "0 0 18px" }}>{title}</h1>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (
              <Field label="Name">
                <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Moreno" autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </Field>
            {mode !== "reset" && (
              <Field label="Password">
                <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              </Field>
            )}

            {error && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ember }}>{error}</div>}
            {notice && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.green }}>{notice}</div>}

            <Button type="submit" disabled={busy} style={{ width: "100%", opacity: busy ? 0.6 : 1, marginTop: 4 }}>
              {busy ? "…" : cta}
            </Button>
          </form>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT_BODY, fontSize: 12.5, color: T.ink }}>
            {mode === "login" && (
              <>
                <button type="button" onClick={() => switchMode(setMode, setError, setNotice, "reset")} style={linkBtn}>Forgot your password?</button>
                <div>New here? <button type="button" onClick={() => switchMode(setMode, setError, setNotice, "signup")} style={linkBtnAccent}>Create an account</button></div>
              </>
            )}
            {mode === "signup" && (
              <div>Already have an account? <button type="button" onClick={() => switchMode(setMode, setError, setNotice, "login")} style={linkBtnAccent}>Log in</button></div>
            )}
            {mode === "reset" && (
              <button type="button" onClick={() => switchMode(setMode, setError, setNotice, "login")} style={linkBtn}>Back to log in</button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function switchMode(setMode, setError, setNotice, next) {
  setError(null);
  setNotice(null);
  setMode(next);
}

const linkBtn = { background: "none", border: "none", padding: 0, textAlign: "left", color: T.ink, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 12.5 };
const linkBtnAccent = { ...linkBtn, color: T.brass, fontWeight: 600 };
