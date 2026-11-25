import { describe, it, expect } from "vitest";
import { demoConfig, createDemoBudget, clientKey, demoBodyProblem, DEMO_LIMITS } from "./demo.js";

describe("demoConfig", () => {
  it("is off unless VITE_DEMO_MODE is exactly 'true'", () => {
    expect(demoConfig({}).enabled).toBe(false);
    expect(demoConfig({ VITE_DEMO_MODE: "1" }).enabled).toBe(false);
    expect(demoConfig({ VITE_DEMO_MODE: "true" }).enabled).toBe(true);
  });

  it("allows live calls only when both budgets are positive", () => {
    const on = { VITE_DEMO_MODE: "true" };
    expect(demoConfig(on).live).toBe(false);
    expect(demoConfig({ ...on, DEMO_AI_PER_CLIENT_PER_DAY: "5" }).live).toBe(false);
    expect(demoConfig({ ...on, DEMO_AI_PER_CLIENT_PER_DAY: "5", DEMO_AI_GLOBAL_PER_DAY: "-1" }).live).toBe(false);
    expect(demoConfig({ ...on, DEMO_AI_PER_CLIENT_PER_DAY: "5", DEMO_AI_GLOBAL_PER_DAY: "100" }).live).toBe(true);
    expect(demoConfig({ DEMO_AI_PER_CLIENT_PER_DAY: "5", DEMO_AI_GLOBAL_PER_DAY: "100" }).live).toBe(false);
  });
});

describe("demo budget", () => {
  const t0 = Date.parse("2026-11-25T12:00:00Z");

  it("caps each visitor per rolling 24h", () => {
    const check = createDemoBudget();
    const cfg = { perClient: 2, global: 100 };
    expect(check("a", cfg, t0).ok).toBe(true);
    expect(check("a", cfg, t0 + 1).ok).toBe(true);
    const third = check("a", cfg, t0 + 2);
    expect(third).toMatchObject({ ok: false, reason: "client" });
    expect(third.retryAfter).toBe(24 * 3600);
    expect(check("b", cfg, t0 + 3).ok).toBe(true); // other visitors unaffected
    expect(check("a", cfg, t0 + 24 * 3600 * 1000 + 1).ok).toBe(true);
  });

  it("caps the whole deployment per UTC day and resets at midnight", () => {
    const check = createDemoBudget();
    const cfg = { perClient: 10, global: 2 };
    check("a", cfg, t0);
    check("b", cfg, t0);
    const full = check("c", cfg, t0);
    expect(full).toMatchObject({ ok: false, reason: "global", retryAfter: 12 * 3600 });
    expect(check("c", cfg, Date.parse("2026-11-26T00:00:01Z")).ok).toBe(true);
  });

  it("refuses everything when a budget is zero", () => {
    expect(createDemoBudget()("a", { perClient: 0, global: 10 }, t0).ok).toBe(false);
    expect(createDemoBudget()("a", { perClient: 10, global: 0 }, t0).ok).toBe(false);
  });
});

describe("clientKey", () => {
  it("hashes the address and prefers x-real-ip", () => {
    const k = clientKey({ headers: { "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" } });
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(k).not.toContain("203");
    expect(k).toBe(clientKey({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }));
  });
});

describe("demoBodyProblem", () => {
  it("accepts a normal request and rejects oversized ones", () => {
    expect(demoBodyProblem({ task: "coach", question: "Why?", races: [] })).toBeNull();
    expect(demoBodyProblem({ question: "x".repeat(DEMO_LIMITS.maxQuestionChars + 1) })).toBe("errors.questionTooLong");
    expect(demoBodyProblem({ races: Array(DEMO_LIMITS.maxRaces + 1).fill({}) })).toBe("errors.malformedBody");
    expect(demoBodyProblem({ blob: "x".repeat(DEMO_LIMITS.maxBodyChars) })).toBe("errors.malformedBody");
  });
});
