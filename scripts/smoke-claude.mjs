#!/usr/bin/env node
/*
  Smoke test for the Claude proxy's two external dependencies, run against the
  real credentials in .env.local:

    1. Anthropic — one live call using the exact request shape api/_lib/anthropic.js
       sends (beta fallbacks, adaptive thinking, effort, cached system block,
       structured output), so a rejected parameter shows up here rather than in
       the app.
    2. Supabase — confirms the auth endpoint /api/claude verifies tokens against
       is reachable and that the anon key is accepted.

  Costs a few cents. Run with:  npm run smoke

  This checks *configuration*, not the app. For the end-to-end path (browser →
  /api/claude → Claude) sign in and open a race debrief.
*/

import Anthropic from "@anthropic-ai/sdk";

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
let failed = false;

// --- 1. Anthropic ----------------------------------------------------------
console.log("\nAnthropic");

if (!process.env.ANTHROPIC_API_KEY) {
  bad("ANTHROPIC_API_KEY is not set — add it to .env.local (no VITE_ prefix).");
  failed = true;
} else {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { verdict: { type: "string", enum: ["limiter", "strength"] } },
            required: ["verdict"],
            additionalProperties: false,
          },
        },
      },
      system: [{
        type: "text",
        text: "You classify race pacing. Reply with the required JSON only.",
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content: "Splits went 4:30, 4:32, 4:35, 5:10, 5:24 per km. Strength or limiter?",
      }],
    });

    if (res.stop_reason === "refusal") {
      bad("Request was refused by safety classifiers (unexpected for this prompt).");
      failed = true;
    } else {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      ok(`key valid · model ${res.model} · replied ${text.trim()}`);
      ok(`structured output + adaptive thinking + fallbacks all accepted`);
      const u = res.usage;
      console.log(`    tokens: ${u.input_tokens} in / ${u.output_tokens} out` +
        (u.cache_creation_input_tokens ? ` · ${u.cache_creation_input_tokens} cached` : ""));
    }
  } catch (err) {
    bad(`${err.constructor?.name || "Error"}: ${err.message}`);
    if (err instanceof Anthropic.AuthenticationError) {
      console.log("    → the key is wrong, revoked, or has a stray quote/space.");
    }
    failed = true;
  }
}

// --- 2. Supabase -----------------------------------------------------------
console.log("\nSupabase (token verification endpoint)");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  bad("No Supabase URL / anon key found — auth will reject every request.");
  failed = true;
} else {
  try {
    // Ask with no bearer token: a valid anon key gets "no_authorization", an
    // invalid one gets "Invalid API key". Both are 401, so the status alone
    // can't tell them apart — the body is what distinguishes config from user.
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey },
    });
    const body = await res.json().catch(() => ({}));
    const detail = String(body.message || body.msg || "");

    if (/invalid api key/i.test(detail)) {
      bad(`${url} rejected the anon key — check VITE_SUPABASE_ANON_KEY.`);
      failed = true;
    } else if (res.status === 401) {
      ok(`${url} reachable · anon key accepted`);
    } else {
      bad(`unexpected status ${res.status}: ${detail || "(no detail)"}`);
      failed = true;
    }
  } catch (err) {
    bad(`could not reach ${url}: ${err.message}`);
    failed = true;
  }
}

console.log(failed
  ? "\n\x1b[31mSome checks failed.\x1b[0m\n"
  : "\n\x1b[32mAll checks passed — start the app with `npm run dev`.\x1b[0m\n");
process.exit(failed ? 1 : 0);
