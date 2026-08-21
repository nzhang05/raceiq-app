import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/*
  Vercel runs api/*.js as serverless functions in production, but `vite dev`
  knows nothing about them. This plugin mounts the same handler as dev
  middleware so `npm run dev` behaves like the deployed app — one handler, no
  second implementation to drift.

  It also copies the non-VITE_ env vars (ANTHROPIC_API_KEY, SUPABASE_*) from
  .env.local into process.env for the handler. Vite deliberately withholds
  unprefixed vars from the client bundle; this only puts them on the dev
  server's own process, never in anything served to the browser.
*/
function apiDevServer(env) {
  return {
    name: "raceiq-api-dev",
    apply: "serve",
    configureServer(server) {
      const serverKeys = [
        "ANTHROPIC_API_KEY",
        "SUPABASE_URL", "SUPABASE_ANON_KEY",
        // The handler falls back to these when the unprefixed pair is unset —
        // they're public anyway, so there's no second copy to keep in sync.
        "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY",
      ];
      for (const key of serverKeys) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }

      // Env is read once, at startup — so say plainly at boot when the key is
      // missing. Without this the only symptom is a 503 from /api/claude after
      // you've already clicked into the app, which doesn't point at .env.local.
      if (!process.env.ANTHROPIC_API_KEY) {
        server.config.logger.warn(
          "\n  ⚠  ANTHROPIC_API_KEY not found — AI features will return 503.\n" +
          "     Add it to .env.local (no VITE_ prefix), then restart this server.\n"
        );
      }

      // Mounted on the whole /api namespace, and it never calls next(): if a
      // request fell through, Vite's static/transform layer would happily serve
      // the *source* of api/claude.js and api/_lib/auth.js to the browser.
      server.middlewares.use("/api", async (req, res) => {
        const json = (status, payload) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(payload));
        };

        // req.url is relative to the mount point.
        const route = (req.url || "").split("?")[0].replace(/\/$/, "");
        if (route !== "/claude") return json(404, { error: "Not found." });
        if (req.method !== "POST") {
          res.setHeader("allow", "POST");
          return json(405, { error: "Method not allowed." });
        }

        try {
          // Loaded per-request so edits to api/ take effect without a restart.
          const mod = await server.ssrLoadModule("/api/claude.js");
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[api/claude] ${err?.stack || err}`);
          if (!res.writableEnded) json(500, { error: "Dev server error — see terminal." });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // "" prefix loads every var, including the unprefixed server-only ones.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiDevServer(env)],
    server: { port: 5173 },
  };
});
