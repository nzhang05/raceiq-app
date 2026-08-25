// End-to-end tests for GPX waypoint → aid-station parsing.
//
// gpx.js depends on DOMParser, which Node doesn't have, so the parser runs in a
// real browser against a vite dev server and the assertions run back here.
//
//   node scripts/test-waypoints.mjs

import { spawn } from "node:child_process";
import { chromium } from "playwright";

const FIXTURES = "/src/__fixtures__/gpx";
const SPORT = "Trail Running";

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail != null ? ` — got ${JSON.stringify(detail)}` : ""}`);
  }
}

async function startServer() {
  const proc = spawn("npx", ["vite", "--port", "5199", "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("vite did not start in 30s")), 30000);
    proc.stdout.on("data", (b) => {
      const m = String(b).match(/(http:\/\/localhost:\d+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`vite exited with ${code}`)); });
  });
  return { proc, url };
}

// Parse one fixture inside the page and hand the plain result back to Node.
async function parseFixture(page, filename, sport = SPORT) {
  return page.evaluate(
    async ([dir, name, sportName]) => {
      const text = await (await fetch(`${dir}/${name}`)).text();
      const file = new File([text], name, { type: "application/gpx+xml" });
      const { parseRouteFile } = await import("/src/utils/gpx.js");
      try {
        const parsed = await parseRouteFile(file, sportName);
        return {
          ok: true,
          name: parsed.name,
          distanceKm: parsed.distanceKm,
          elevationM: parsed.elevationM,
          waypoints: parsed.waypoints,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    [FIXTURES, filename, sport]
  );
}

const { proc, url } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);

try {
  // 1 — Waypoints before the track, no <metadata><name>.
  {
    const r = await parseFixture(page, "utmb-style.gpx");
    console.log("utmb-style.gpx");
    check("course name comes from <trk>, not the first waypoint", r.name === "UTMB 2026", r.name);
    const stations = r.waypoints.filter((w) => w.isStation);
    check("3 aid stations found, parking excluded", stations.length === 3, r.waypoints.map((w) => [w.name, w.isStation]));
    check("full ravito gets food despite 'eau' in its description", stations[0]?.food === true, stations[0]);
    check("'Point d'eau' is water-only", stations[1]?.water === true && stations[1]?.food === false, stations[1]);
    check("a station named for a col is still a station", stations[2]?.name.includes("Forclaz") && stations[2]?.food === true, stations[2]);
    check("parking is off-course and unresolved", r.waypoints.find((w) => w.name === "Parking navettes")?.km === null, r.waypoints.at(-1));
  }

  // 2 — Out-and-back, organiser states the distance.
  {
    const r = await parseFixture(page, "out-and-back.gpx");
    console.log("out-and-back.gpx");
    const w = r.waypoints[0];
    check("explicit km hint wins over geometry", w.confidence === "explicit", w);
    check("resolved to the stated outbound distance", Math.abs(w.km - 1.7) < 0.35, w.km);
    check("not flagged ambiguous", w.ambiguous === false, w);
  }

  // 3 — Same geometry, no hint to disambiguate.
  {
    const r = await parseFixture(page, "out-and-back-nodesc.gpx");
    console.log("out-and-back-nodesc.gpx");
    const w = r.waypoints[0];
    check("still resolves to a kilometre", typeof w.km === "number", w);
    check("takes the earlier of the two passes", w.km < r.distanceKm / 2, { km: w.km, total: r.distanceKm });
  }

  // 4 — Waypoint well off the course line.
  {
    const r = await parseFixture(page, "off-course.gpx");
    console.log("off-course.gpx");
    const w = r.waypoints[0];
    check("km is null beyond the snap tolerance", w.km === null, w);
    check("reports how far off-course it was", w.distanceFromCourseM > 150, w.distanceFromCourseM);
  }

  // 5 — <rte>/<rtept> instead of <trk>.
  {
    const r = await parseFixture(page, "route-only.gpx");
    console.log("route-only.gpx");
    check("route-only file parses", r.ok === true, r.error);
    check("distance computed from route points", r.distanceKm > 10, r.distanceKm);
    check("waypoint still resolves against the route", r.waypoints?.[0]?.km > 0, r.waypoints?.[0]);
  }

  // 6 — Accented French naming.
  {
    const r = await parseFixture(page, "french.gpx");
    console.log("french.gpx");
    const byName = (frag) => r.waypoints.find((w) => w.name.includes(frag));
    check("accents normalised — 'Ravitaillement Complet' is a full station", byName("Complet")?.food === true, byName("Complet"));
    check("'Point d'Eau' stays water-only despite 'ravito' in its description", byName("Eau")?.food === false, byName("Eau"));
    check("'Sommet du Col' is not a station", byName("Sommet")?.isStation === false, byName("Sommet"));
  }

  // 7 — Elevation gain against fixtures with a known true profile (1000 m).
  {
    console.log("elevation gain (true 1000 m)");
    const clean = await parseFixture(page, "elevation-clean.gpx");
    check("clean DEM-style profile within 2%", Math.abs(clean.elevationM - 1000) < 20, clean.elevationM);

    const noisy = await parseFixture(page, "elevation-noisy.gpx");
    // The naive positive-delta sum reports ~9,500 m on this file.
    check("densely-sampled ±2m file within 10%", Math.abs(noisy.elevationM - 1000) < 100, noisy.elevationM);
    check("noisy result is not inflated by sampling rate", noisy.elevationM < 1.5 * clean.elevationM, {
      clean: clean.elevationM, noisy: noisy.elevationM,
    });
  }

  // 8 — Projection accuracy against a known track point.
  {
    console.log("projection accuracy");
    const r = await page.evaluate(async ([dir]) => {
      const text = await (await fetch(`${dir}/utmb-style.gpx`)).text();
      const { resolveWaypoints } = await import("/src/utils/waypoints.js");
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const pts = Array.from(doc.getElementsByTagName("trkpt")).map((p) => ({
        lat: parseFloat(p.getAttribute("lat")),
        lon: parseFloat(p.getAttribute("lon")),
      }));
      // Rebuild cumKm the same way gpx.js does, then drop a waypoint exactly on
      // a known point and see whether we recover its distance.
      const { haversineMeters } = await import("/src/utils/geo.js");
      let cum = 0;
      const points = pts.map((p, i) => {
        if (i > 0) cum += haversineMeters(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
        return { ...p, cumKm: cum / 1000 };
      });
      const target = points[137];
      const [resolved] = resolveWaypoints([{ lat: target.lat, lon: target.lon, name: "Ravito" }], points);
      return { expected: target.cumKm, got: resolved.km };
    }, [FIXTURES]);
    check("resolved km lands within 10 m of the true distance", Math.abs(r.got - r.expected) < 0.01, r);
  }
} finally {
  await browser.close();
  proc.kill();
}

console.log(failures === 0 ? "\nAll waypoint tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
