import { describe, it, expect } from "vitest";
import { fmtMinSec, fmtClock } from "../utils/clock.js";
import { minutesToClock } from "../utils/racePlan.js";
import { parseClockToMinutes } from "../utils/time.js";

describe("clock formatting", () => {
  it("formats minutes as m:ss and h:mm:ss", () => {
    expect(fmtMinSec(4.5)).toBe("4:30");
    expect(fmtClock(38.7)).toBe("38:42");
    expect(fmtClock(204.85)).toBe("3:24:51");
  });

  it("never prints 60 in a seconds or minutes field", () => {
    expect(fmtMinSec(4.9999)).toBe("5:00");
    expect(fmtClock(59.9999)).toBe("1:00:00");
    expect(fmtClock(119.995)).toBe("2:00:00");
    expect(minutesToClock(59.9999)).toBe("1:00:00");
  });

  it("round-trips with parseClockToMinutes", () => {
    for (const clock of ["0:38:42", "3:24:51", "5:48:12", "45:00"]) {
      expect(fmtClock(parseClockToMinutes(clock))).toBe(clock.replace(/^0:/, ""));
    }
  });
});
