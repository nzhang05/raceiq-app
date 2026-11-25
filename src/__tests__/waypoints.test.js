// @vitest-environment jsdom
/*
  GPX waypoint → aid-station parsing, against real-world-shaped fixtures.

  These used to run in Playwright against a dev server because gpx.js needs
  DOMParser. jsdom provides one, so they now run in-process with the rest of
  the suite: no browser download, no port, no server to start.
*/
import { describe, it, expect } from "vitest";
import { parseRouteFile } from "../utils/gpx.js";
import { resolveWaypoints } from "../utils/waypoints.js";
import { haversineMeters } from "../utils/geo.js";
import { fixtureFile, fixtureText } from "./helpers.js";

const parse = (name, sport = "Trail Running") => parseRouteFile(fixtureFile(name), sport);

describe("utmb-style.gpx — waypoints before the track, no <metadata><name>", () => {
  it("takes the course name from <trk>, not the first waypoint", async () => {
    expect((await parse("utmb-style.gpx")).name).toBe("UTMB 2026");
  });

  it("finds three aid stations and excludes the parking", async () => {
    const r = await parse("utmb-style.gpx");
    const stations = r.waypoints.filter((w) => w.isStation);
    expect(stations).toHaveLength(3);
    expect(stations[0].food).toBe(true); // full ravito despite "eau" in its description
    expect(stations[1]).toMatchObject({ water: true, food: false }); // "Point d'eau"
    expect(stations[2].name).toContain("Forclaz"); // named for a col, still a station
    expect(stations[2].food).toBe(true);
  });

  it("leaves the off-course parking unresolved", async () => {
    const r = await parse("utmb-style.gpx");
    expect(r.waypoints.find((w) => w.name === "Parking navettes").km).toBeNull();
  });
});

describe("out-and-back courses", () => {
  it("prefers the organiser's stated km over geometry", async () => {
    const [w] = (await parse("out-and-back.gpx")).waypoints;
    expect(w.confidence).toBe("explicit");
    expect(Math.abs(w.km - 1.7)).toBeLessThan(0.35);
    expect(w.ambiguous).toBe(false);
  });

  it("takes the earlier pass when nothing disambiguates", async () => {
    const r = await parse("out-and-back-nodesc.gpx");
    const [w] = r.waypoints;
    expect(typeof w.km).toBe("number");
    expect(w.km).toBeLessThan(r.distanceKm / 2);
  });
});

describe("off-course.gpx", () => {
  it("returns km null beyond the snap tolerance and reports the distance", async () => {
    const [w] = (await parse("off-course.gpx")).waypoints;
    expect(w.km).toBeNull();
    expect(w.distanceFromCourseM).toBeGreaterThan(150);
  });
});

describe("route-only.gpx — <rte>/<rtept> instead of <trk>", () => {
  it("parses, measures distance from route points, and resolves waypoints", async () => {
    const r = await parse("route-only.gpx");
    expect(r.distanceKm).toBeGreaterThan(10);
    expect(r.waypoints[0].km).toBeGreaterThan(0);
  });
});

describe("french.gpx — accented French naming", () => {
  it("normalises accents and classifies by name before description", async () => {
    const r = await parse("french.gpx");
    const byName = (frag) => r.waypoints.find((w) => w.name.includes(frag));
    expect(byName("Complet").food).toBe(true);
    expect(byName("Eau").food).toBe(false); // despite "ravito" in its description
    expect(byName("Sommet").isStation).toBe(false);
  });
});

describe("elevation gain against a known 1000 m profile", () => {
  it("is within 2% on a clean DEM-style profile", async () => {
    expect(Math.abs((await parse("elevation-clean.gpx")).elevationM - 1000)).toBeLessThan(20);
  });

  it("is within 10% on a densely sampled ±2 m noisy file", async () => {
    // The naive positive-delta sum reports ~9,500 m on this file.
    const clean = await parse("elevation-clean.gpx");
    const noisy = await parse("elevation-noisy.gpx");
    expect(Math.abs(noisy.elevationM - 1000)).toBeLessThan(100);
    expect(noisy.elevationM).toBeLessThan(1.5 * clean.elevationM);
  });
});

describe("projection accuracy", () => {
  it("recovers a waypoint dropped exactly on a track point to within 10 m", () => {
    const doc = new DOMParser().parseFromString(fixtureText("utmb-style.gpx"), "application/xml");
    const pts = Array.from(doc.getElementsByTagName("trkpt")).map((p) => ({
      lat: parseFloat(p.getAttribute("lat")),
      lon: parseFloat(p.getAttribute("lon")),
    }));
    let cum = 0;
    const points = pts.map((p, i) => {
      if (i > 0) cum += haversineMeters(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
      return { ...p, cumKm: cum / 1000 };
    });
    const target = points[137];
    const [resolved] = resolveWaypoints([{ lat: target.lat, lon: target.lon, name: "Ravito" }], points);
    expect(Math.abs(resolved.km - target.cumKm)).toBeLessThan(0.01);
  });
});

describe("unreadable input", () => {
  it("rejects malformed XML with a catalog key, not a crash", async () => {
    const file = { name: "broken.gpx", text: async () => "<gpx><trk><trkseg><trkpt" };
    await expect(parseRouteFile(file, "Trail Running")).rejects.toMatchObject({ key: "errors.unreadableFile" });
  });

  it("rejects a file with fewer than two points", async () => {
    const file = { name: "one.gpx", text: async () => '<gpx><trk><trkseg><trkpt lat="45" lon="6"/></trkseg></trk></gpx>' };
    await expect(parseRouteFile(file, "Trail Running")).rejects.toMatchObject({ key: "errors.noTrackPoints" });
  });
});
