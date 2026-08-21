/*
  Tiny request/response helpers that work under both runtimes we deploy to:
  Vercel's Node functions (which pre-parse req.body and add res.json) and the
  plain `http` req/res the Vite dev middleware hands us. Neither helper assumes
  the Vercel sugar exists.
*/

const MAX_BODY_BYTES = 2 * 1024 * 1024; // race sets with splits are small; cap anyway

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

// Vercel parses JSON bodies for us; under `vite dev` we read the stream.
export async function readJsonBody(req) {
  if (req.body != null && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}
