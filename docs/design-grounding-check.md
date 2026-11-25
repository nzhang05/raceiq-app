# Grounding check

## Problem

RaceIQ's central claim is that Claude narrates numbers the engine computed and never invents them. Until now that claim lived only in the prompt text ("Only cite numbers present in the DATA block"), which nothing checked. A reviewer had no way to verify it, and a prompt or model change could quietly break it.

## Decision

Check it at the number level, in the test suite, through the real server code.

`src/utils/grounding.js` extracts every number from an answer and checks each one against the numbers in the data the model was given. The comparison is by value: "32.7", "+32.7%" and the French "32,7 %" are one number. Clocks are compared as clocks, so "6:09/km" never licenses a bare "9" or "6". Re-rounding counts as a failure ("33%" when the data says "32.7%"), because the narrative prompt forbids it.

`src/__tests__/grounding.test.js` runs answers through `handleCoach` / `handleNarrative`, with only the Anthropic SDK mocked. It captures the exact request the handler built and checks the answer against that request's data. This covers:

- **every demo recording** (4 debriefs and 4 coach questions, in English and French), in each coach context the recording claims to be valid for. It also confirms the routed intent and source races still match the recording;
- **fixture races** that the sample athlete doesn't cover: a hand-entered result with no splits, a hot ride with fueling logged by section, a hilly ultra on grade-adjusted pace;
- **planted failures**: the same answers with invented, mis-copied and re-rounded numbers, which must fail on exactly those numbers. Without these, a checker that accepts everything would also pass.

`npm run eval:grounding` runs the same check against the live model (about 30 calls) for when the question is "does the model behave", not "does the pipeline".

## What it does not prove

It checks numbers, not attribution. A real number cited for the wrong thing (the 12 km/h wind presented as "12% more fluid") passes, and a test pins that limit so nobody reads more into a green run than it proves. Attribution is covered by the prompt's evidence rules and by review.

## What building it found

All of these were in the data blocks Claude receives:

- `Carbohydrate target …: 60–90g/hr. undefined`: the rationale was read from a field that no longer exists.
- `nullg/hr carbs · nullmg/hr sodium`, for any race entered without fueling.
- `You answer questions about there's race performance` and `Address there by first name`, whenever there is no profile name (always, in the demo).
- Intent routing wrapped every keyword in `\b…\b`, so stems never matched: "my injury" and "tendonitis" skipped the deterministic medical referral, and "am I improving?" asked from a debrief got single-race data instead of the trend. Separately, the French "which races fit me best?" routed to trend while the English routed to fit.

Each now has a test.

## Options considered

- **A runtime guard** that rejects or flags ungrounded answers before they reach the athlete. Cheap to add now that the checker exists, but it changes product behaviour (what happens to a flagged answer?). Left as a follow-up decision.
- **An LLM judge.** It could catch attribution errors, but it is non-deterministic and costs a call per check. That's a poor fit for CI.
