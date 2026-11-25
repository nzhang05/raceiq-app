/*
  The AI coach: chat chrome, the canned out-of-scope replies, and the API error
  messages.

  `fallback.*` is served by api/_lib/prompts.js when Claude is skipped entirely
  (medical or training-plan questions). Those two are refusals with a safety
  purpose — translate the meaning, never soften the referral to a professional.

  `systemDirective` is appended to every Claude system prompt so the model
  answers in the athlete's language. The grounding DATA block stays English on
  purpose: it is structured data, and translating its field names only confuses
  the model.
*/
export default {
  eyebrow: "AI coach",
  title: "Ask RaceIQ",
  backToDebrief: "← Back to debrief",
  backToRaces: "← Back to races",
  clearHistory: "Clear history",
  clearConfirm: "Clear conversation history?",
  context: "Context: {{name}}",
  intro: "Ask anything about your race history, {{name}}. Every answer is drawn from your logged data.",
  defaultName: "there",
  tryAsking: "Try asking",
  suggested: {
    bonk: "Why did I bonk at my last race?",
    improving: "Am I improving across my race history?",
    fit: "Which types of races fit me best?",
    next: "What should I change before my next marathon?",
  },
  coachLabel: "RaceIQ coach",
  youLabel: "You",
  basedOn: "Based on:",
  analyzing: "Analyzing your data…",
  send: "Send",
  inputLabel: "Your question",
  inputHint: "Enter to send · Shift+Enter for new line",
  placeholder: {
    race: "Ask about {{name}}…",
    general: "Ask about your race history…",
    signedOut: "Sign in to ask the coach…",
  },
  demoNotice: {
    title: "Demo · sample athlete",
    body: "The suggested questions replay recorded answers about the sample athlete's races, and every number in them is checked against the race data by the test suite. Your own questions go to the live coach only when this demo has a live budget switched on.",
  },
  recorded: "Recorded answer",
  signInRequired: {
    title: "Sign in required",
    body: "The AI coach analyses your logged races on RaceIQ's servers. Sign in to use it — your race data is only ever sent for questions you ask.",
  },

  fallback: {
    medical: "That sounds like it could involve a medical or injury concern — outside what RaceIQ can help with. Please consult a sports medicine professional or physiotherapist who can evaluate you in person.",
    training: "RaceIQ focuses on race analysis and readiness — generating a training plan is outside its scope. A coach can use these race insights as input, but the planning decisions belong with them.",
  },

  systemDirective: "Reply in English. The DATA block is supplied in English regardless of the reply language — translate any values you quote from it, but never translate race names.",

  errors: {
    signedOut: "Sign in to use the AI coach.",
    unreachable: "Couldn't reach the coach. Check your connection.",
    requestFailed: "Request failed ({{status, number}}).",
    generic: "Something went wrong — please try again.",
    methodNotAllowed: "Method not allowed.",
    notConfigured: "The AI coach is not configured on this server.",
    rateLimited: "Too many requests — try again in {{seconds, number}}s.",
    malformedBody: "Malformed request body.",
    unknownTask: "Unknown task \"{{task}}\".",
    serverError: "Something went wrong generating that answer.",
    questionTooLong: "That question is too long — keep it under {{max, number}} characters.",
    demoLiveOff: "Live questions are switched off in this demo. Try one of the suggested questions: they replay recorded answers about the sample athlete.",
    demoBudgetSpent: "The demo's live budget is used up for now. The suggested questions still work: they replay recorded answers about the sample athlete.",
  },
};
