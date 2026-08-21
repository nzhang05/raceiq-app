/*
  Auth gate for the Claude proxy.

  The endpoint spends a server-held Anthropic key, so it must never be an open
  billing surface. We verify the caller's Supabase access token by asking
  Supabase who it belongs to — no JWT library, no service-role key, and
  revoked/expired tokens are rejected correctly because Supabase is the one
  answering.

  Env: SUPABASE_URL / SUPABASE_ANON_KEY, falling back to the VITE_ prefixed
  pair. Unlike ANTHROPIC_API_KEY there is no secret here to protect — the anon
  key is public by design and already in the client bundle — so requiring a
  duplicate unprefixed copy would only add a way for the two to drift apart.
  ANTHROPIC_API_KEY stays strictly unprefixed; that one must never be inlined.
*/

import { bearerToken } from "./http.js";

const AUTH_TIMEOUT_MS = 5000;

function supabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function isAuthConfigured() {
  const { url, anonKey } = supabaseConfig();
  return Boolean(url && anonKey);
}

// Resolves to { user } on success, or { error, status } on failure.
export async function authenticate(req) {
  const { url: baseUrl, anonKey } = supabaseConfig();
  if (!baseUrl || !anonKey) {
    return {
      status: 500,
      error: "Server auth is not configured (SUPABASE_URL / SUPABASE_ANON_KEY).",
    };
  }

  const token = bearerToken(req);
  if (!token) return { status: 401, error: "Sign in to use the AI coach." };

  const url = `${baseUrl.replace(/\/$/, "")}/auth/v1/user`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Supabase answers 401 both for "this user's token is no good" and for
      // "your anon key is wrong". Told apart, the second is a server config
      // error — otherwise a bad deploy shows every athlete "session expired"
      // forever and nothing points at the real cause.
      const detail = String(body.message || body.msg || "");
      if (/invalid api key/i.test(detail)) {
        console.error("[auth] Supabase rejected the anon key — check SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY.");
        return { status: 503, error: "The AI coach is misconfigured on this server." };
      }
      // Everything else is genuinely about the caller's token: 401
      // no_authorization, 403 bad_jwt, an expired or revoked session.
      return { status: 401, error: "Your session has expired — sign in again." };
    }

    if (!body?.id) return { status: 401, error: "Your session has expired — sign in again." };
    return { user: body };
  } catch {
    return { status: 503, error: "Could not verify your session. Try again." };
  } finally {
    clearTimeout(timer);
  }
}
