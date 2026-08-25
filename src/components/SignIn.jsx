import { useState } from "react";
import { T, R, FONT_DISPLAY, FONT_BODY } from "../constants.js";
import { Card, Button, TextInput, Field } from "./ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/*
  Auth gate: sign up / log in / password reset. Styled with the existing
  design tokens and ui primitives. See docs/design-auth-and-profiles.md.
*/
export default function SignIn() {
  const { signInWithPassword, signUp, resetPassword, signInWithOAuth } = useAuth();
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

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setNotice(null);
    // Redirects the browser to Google; on return, AuthProvider picks up the
    // session (supabase-js parses it from the URL). No further code needed here.
    const { error } = await signInWithOAuth("google");
    if (error) {
      setError(error.message ?? "Could not start Google sign-in.");
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

          {mode !== "reset" && (
            <>
              <button type="button" onClick={handleGoogle} disabled={busy} style={googleBtn}>
                <GoogleG />
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
                <span style={{ flex: 1, height: 1, background: T.line }} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: T.inkDim }}>or</span>
                <span style={{ flex: 1, height: 1, background: T.line }} />
              </div>
            </>
          )}

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

const googleBtn = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  fontWeight: 600,
  color: T.paper,
  background: T.surface,
  border: `1px solid ${T.line}`,
  borderRadius: R.pill,
  padding: "10px 18px",
  cursor: "pointer",
  transition: "all 140ms ease",
};

// Google "G" mark, inline so there's no external asset dependency.
function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
