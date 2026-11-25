// @vitest-environment jsdom
/*
  Characterization tests for the race-plan form.

  Written before RacePlanForm.jsx was split up, to pin what it does: they drive
  the real form (real GPX parsing, real plan engine) and snapshot the plan it
  hands to onPlanGenerated. The refactor had to leave every one of these, and
  the snapshot, untouched.

  Stubbed: the Leaflet map (needs a real layout engine), auth (signed out, so
  the AI estimate isn't attempted) and the network (fetch rejects, which sends
  the weather lookup down its documented "simulated" path).
*/
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "../i18n/index.js";
import i18n from "../i18n/index.js";
import { SEED_RACES } from "../constants.js";

vi.mock("../components/CourseMap.jsx", () => ({
  default: ({ stations }) => <div data-testid="course-map">{stations.length} stations on map</div>,
}));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ user: null, profile: null }) }));

const { default: RacePlanForm } = await import("../components/RacePlanForm.jsx");

const GPX_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../__fixtures__/gpx/");
const gpxFile = (name) => new File([readFileSync(GPX_DIR + name, "utf8")], name, { type: "application/gpx+xml" });

beforeAll(async () => {
  // jsdom's Blob has no text(); the parser reads files with it.
  if (!File.prototype.text) {
    File.prototype.text = function text() {
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsText(this);
      });
    };
  }
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-01T09:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const races = [...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date));

function setup() {
  const onPlanGenerated = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  const utils = render(<RacePlanForm allRaces={races} onPlanGenerated={onPlanGenerated} onCancel={onCancel} />);
  const fileInput = utils.container.querySelector('input[type="file"]');
  return { user, onPlanGenerated, onCancel, fileInput, ...utils };
}

const byLabel = (name) => screen.getByRole("textbox", { name }) ;
const numberField = (name) => screen.getByRole("spinbutton", { name });

async function loadCourse(user, fileInput, name = "utmb-style.gpx", sport = "Trail Running") {
  await user.selectOptions(screen.getByRole("combobox", { name: "Sport" }), sport);
  await user.upload(fileInput, gpxFile(name));
  await screen.findByText(/^Loaded/);
}

// Station rows are the inputs with the "km" placeholder.
const stationKms = (container) =>
  [...container.querySelectorAll('input[placeholder="km"]')].map((i) => i.value);

// Ids carry Date.now() and a module counter; neither is behaviour.
function normalizePlan(plan) {
  return JSON.parse(JSON.stringify(plan, (k, v) => (k === "id" && typeof v === "string" ? "<id>" : v)));
}

describe("RacePlanForm", () => {
  it("starts empty: build disabled, no course, road-running references preselected", () => {
    setup();
    expect(screen.getByRole("button", { name: /build my plan/i }).disabled).toBe(true);
    expect(screen.getByText("No file selected")).toBeTruthy();
    expect(screen.getByText(/2 of 2 selected/)).toBeTruthy(); // Brandywine + Lakefront
  });

  it("switching sport reselects that sport's reference races", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sport" }), "Trail Running");
    expect(screen.getByText(/1 of 1 selected/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /deselect all/i }));
    expect(screen.getByText(/0 of 1 selected/)).toBeTruthy();
  });

  it("loading a course parses it, seeds aid stations from waypoints and estimates a target", async () => {
    const { user, fileInput, container } = setup();
    await loadCourse(user, fileInput);

    expect(screen.getByText(/Loaded/).textContent).toMatchSnapshot("import message");
    expect(stationKms(container)).toHaveLength(3);
    expect(screen.getByTestId("course-map").textContent).toBe("3 stations on map");
    // Deterministic estimate (signed out), copied into the target field.
    const target = byLabel(/Your Target/);
    expect(target.value).toMatch(/^\d+:\d{2}(:\d{2})?$/);
    expect(screen.getByText(target.value)).toBeTruthy();
  });

  it("refuses to build without a target time", async () => {
    const { user, fileInput, onPlanGenerated } = setup();
    await loadCourse(user, fileInput);
    await user.clear(byLabel(/Your Target/));
    await user.click(screen.getByRole("button", { name: /build my plan/i }));
    expect(onPlanGenerated).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("form.errorNoTarget", { ns: "plan" }))).toBeTruthy();
  });

  it("weather lookup falls back to simulated conditions when the network is unavailable", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /Location/ }), "Chamonix");
    await user.click(screen.getByRole("button", { name: /^look up$/i }));
    await screen.findByText(/SIMULATED/);
    expect(numberField(/Temp/).value).not.toBe("");
  });

  it("asks before replacing hand-edited stations with the file's, and respects the answer", async () => {
    const { user, fileInput, container } = setup();
    await loadCourse(user, fileInput);
    await user.click(screen.getAllByRole("button", { name: "Remove station" })[0]);
    expect(stationKms(container)).toHaveLength(2);

    const importBtn = screen.getByRole("button", { name: /import 3/i });
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(importBtn);
    expect(stationKms(container)).toHaveLength(2);

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(importBtn);
    expect(stationKms(container)).toHaveLength(3);
  });

  it("auto-spaces stations every 8 km for a run", async () => {
    const { user, fileInput, container } = setup();
    await loadCourse(user, fileInput);
    await user.click(screen.getByRole("button", { name: /^auto-space$/i }));
    const kms = stationKms(container).map(Number);
    expect(kms.length).toBeGreaterThan(0);
    kms.forEach((km, i) => expect(km).toBeCloseTo(8 * (i + 1), 5));
  });

  it("offers non-station waypoints for promotion and adds a promoted one in km order", async () => {
    const { user, fileInput, container } = setup();
    await loadCourse(user, fileInput, "french.gpx");
    const before = stationKms(container).length;
    await user.click(screen.getByRole("button", { name: /other waypoint/i }));
    const sommet = screen.getByText(/Sommet/).closest("label");
    await user.click(within(sommet).getByRole("checkbox"));
    const kms = stationKms(container).map(Number);
    expect(kms).toHaveLength(before + 1);
    expect([...kms].sort((a, b) => a - b)).toEqual(kms);
  });

  it("builds the plan from everything on the form", async () => {
    const { user, fileInput, container, onPlanGenerated } = setup();
    await loadCourse(user, fileInput);

    // Course details
    const date = container.querySelector('input[type="date"]');
    await user.clear(date);
    await user.type(date, "2026-08-28");
    await user.type(byLabel(/Start Time/), "06:00");

    // Conditions, target, fueling overrides
    await user.type(numberField(/Temp/), "21");
    await user.type(numberField(/Humidity/), "55");
    await user.clear(byLabel(/Your Target/));
    await user.type(byLabel(/Your Target/), "7:30:00");
    await user.type(numberField(/Carbs/), "70");
    await user.type(numberField(/Caffeine/), "150");

    // Aid stations: rename one, refill flags, ultra details, carry capacity
    const names = container.querySelectorAll('input[placeholder^="Aid"]');
    await user.clear(names[1]);
    await user.type(names[1], "Col de Voza");
    const firstRow = names[0].closest("div").parentElement;
    await user.click(within(firstRow).getAllByRole("button", { name: /^yes$/i })[1]); // food off at the first station
    if (!screen.queryByRole("button", { name: /hide ultra/i })) {
      await user.click(screen.getByRole("button", { name: /Show ultra options/ }));
    }
    await user.click(screen.getAllByRole("button", { name: /^more$/i })[2]);
    const stop = container.querySelectorAll('input[type="number"][min="0"]')[0];
    await user.type(stop, "12");
    await user.type(numberField(/Carry Capacity/), "1000");

    await user.click(screen.getByRole("button", { name: /build my plan/i }));
    await waitFor(() => expect(onPlanGenerated).toHaveBeenCalledTimes(1));

    const plan = onPlanGenerated.mock.calls[0][0];
    expect(plan.raceDate).toBe("2026-08-28");
    expect(plan.targetClock).toBe("7:30:00");
    expect(plan.startTimeOfDay).toBe("06:00");
    expect(plan.stations.map((s) => s.name)).toContain("Col de Voza");
    expect(plan.nutrition.sources.carbs).toBe("manual");
    expect(normalizePlan(plan)).toMatchSnapshot("plan");
  });

  it("cancel calls back without building", async () => {
    const { user, onCancel, onPlanGenerated } = setup();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlanGenerated).not.toHaveBeenCalled();
  });
});
