/*
  The single place RaceIQ talks to Claude. The API key lives here, server-side,
  and never reaches the browser.

  Conventions used throughout:
    - Model is Claude Opus 5 (`claude-opus-5`). Thinking is on by default on
      this model, and `max_tokens` caps thinking + response text *together*, so
      every call leaves real headroom rather than sizing to the answer alone.
    - The stable half of each prompt (rules + athlete profile + race index) goes
      in `system` with a cache breakpoint; the volatile half (this question,
      this race) goes in `messages`. Repeat calls in a session then read the
      prefix from cache instead of re-paying for it. Prefixes under ~512 tokens
      silently won't cache — that's fine, it just means no saving.
    - Opus 5's safety classifiers can decline a request (HTTP 200 with
      `stop_reason: "refusal"`), so we opt into server-side fallbacks and check
      `stop_reason` before ever reading `content`.
*/

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client = null;

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export class ClaudeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClaudeError";
    this.status = status;
  }
}

/*
  `system` is the cacheable prefix, `userContent` the per-request tail.
  `format` (optional) is a JSON schema — pass it when the caller wants
  structured output rather than prose.
*/
export async function callClaude({
  system,
  messages,
  maxTokens = 8000,
  effort = "medium",
  format = null,
}) {
  if (!isClaudeConfigured()) {
    throw new ClaudeError("The AI coach is not configured on this server.", 503);
  }

  const outputConfig = { effort };
  if (format) outputConfig.format = format;

  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: outputConfig,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    });
  } catch (err) {
    throw toClaudeError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new ClaudeError(
      "Claude declined to answer that one. Try rephrasing the question.",
      422,
    );
  }

  const text = (response.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new ClaudeError("The coach returned an empty response. Try again.", 502);
  }

  return {
    text,
    stopReason: response.stop_reason,
    model: response.model,
    usage: response.usage,
  };
}

// Same call, but parses the response as JSON against a schema.
export async function callClaudeJson({ system, messages, schema, maxTokens, effort }) {
  const { text, ...rest } = await callClaude({
    system,
    messages,
    maxTokens,
    effort,
    format: { type: "json_schema", schema },
  });

  try {
    return { data: JSON.parse(text), ...rest };
  } catch {
    throw new ClaudeError("The coach returned malformed output. Try again.", 502);
  }
}

// Map the SDK's typed errors onto statuses the client can act on. Message text
// is deliberately generic — upstream errors can echo request details, and this
// string is shown to the athlete.
function toClaudeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new ClaudeError("The AI coach is misconfigured on this server.", 503);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError("The AI coach is misconfigured on this server.", 503);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ClaudeError("The coach is busy right now — try again shortly.", 429);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ClaudeError("That request couldn't be processed.", 400);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ClaudeError("Couldn't reach the coach. Check your connection.", 503);
  }
  if (err instanceof Anthropic.APIError) {
    return new ClaudeError("The coach is unavailable right now.", 502);
  }
  return new ClaudeError("Something went wrong generating that answer.", 500);
}
