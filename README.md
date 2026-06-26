# RaceIQ — local prototype

A race intelligence prototype: race resume, race debrief, manual entry, GPX/TCX
import, and grade-adjusted pace for trail/cycling.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later (check with `node -v`)

## Setup

```bash
npm install
```

## Run it

```bash
npm run dev
```

Then open the URL it prints — usually **http://localhost:5173**.

The dev server has hot reload: edit `src/RaceIQ.jsx` and save, and the browser
updates without a manual refresh.

## Build for production (a static bundle you can host anywhere)

```bash
npm run build
```

This outputs a `dist/` folder. Preview it locally with:

```bash
npm run preview
```

## What changed moving from the Claude.ai artifact to here

- **Storage**: the artifact version used Claude.ai's `window.storage` API.
  That doesn't exist outside Claude.ai, so this version uses the browser's
  standard `localStorage` instead — same effect (your added races persist
  across reloads on this machine), but it's now a normal web API rather
  than something specific to the artifact sandbox.
- **Weather lookups**: now that this runs as a normal page (not inside the
  Claude.ai artifact iframe, which only allows network calls to a fixed
  domain allowlist), the real fetch to Open-Meteo's historical weather and
  geocoding APIs should succeed directly — no API key needed. If you ever
  see the amber "SIMULATED" weather banner here, it means the fetch
  genuinely failed (e.g. no internet connection), not a sandbox block.

## Project structure

```
index.html          — page shell, mounts the app
src/main.jsx         — React entry point
src/RaceIQ.jsx        — the whole app (single file, by design for now)
```

## Known limitations to keep in mind while testing

- GPX/TCX pace is only as good as the GPS trace — tight switchbacks or
  heavy tree cover can make individual splits noisy.
- The RaceIQ Score and percentile formulas are placeholder models, not the
  real scoring system from the PRD — easy to swap once that's defined.
- There's no backend: all data lives in this browser's localStorage. Clearing
  browser data or switching browsers/devices will lose your entered races.
