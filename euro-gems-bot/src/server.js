// Euro Gems — WhatsApp webhook server (zero runtime dependencies).
//
// GET  /webhook  — Meta verification handshake
// POST /webhook  — inbound messages → engine → WhatsApp replies
// GET  /health   — liveness
// GET  /inbox    — conversations currently handed off to a human agent
//
// Env: VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID, GRAPH_VERSION (optional), PORT
//
// State is in-memory here (per contact). For production, back `contacts` with a
// database so attributes survive restarts — the engine already treats state as
// a plain object, so swapping the store is a small change.

import { createServer } from "node:http";
import { handle, freshState } from "./engine.js";
import { send, parseInbound } from "./whatsapp.js";

const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "euro-gems-verify";

const contacts = new Map(); // phone -> engine state
const handoffs = new Map(); // phone -> { at, showroom, stone }

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // Meta webhook verification.
  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end(challenge || "");
    }
    res.writeHead(403);
    return res.end("forbidden");
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, contacts: contacts.size, handoffs: handoffs.size }));
  }

  if (req.method === "GET" && url.pathname === "/inbox") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify([...handoffs.entries()].map(([phone, v]) => ({ phone, ...v })), null, 2));
  }

  // Inbound messages.
  if (req.method === "POST" && url.pathname === "/webhook") {
    // Always 200 fast so Meta doesn't retry; process after.
    res.writeHead(200);
    res.end("ok");
    let body;
    try {
      body = await readBody(req);
    } catch {
      return;
    }
    const parsed = parseInbound(body);
    if (!parsed) return;

    const state = contacts.get(parsed.from) || freshState();
    const result = handle(state, parsed.input);
    contacts.set(parsed.from, result.state);

    for (const ev of result.events) {
      if (ev.type === "transfer_to_agent") {
        handoffs.set(parsed.from, { at: new Date().toISOString(), showroom: ev.showroom, stone: ev.stone });
        console.log(`[handoff] ${parsed.from} → ${ev.showroom || "?"} · ${ev.stone || "?"}`);
      }
    }

    for (const out of result.outbounds) {
      try {
        await send(parsed.from, out);
      } catch (err) {
        console.error(`[send error] ${parsed.from}:`, err.message);
      }
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`Euro Gems WhatsApp bot listening on :${PORT}`);
  console.log(`  webhook verify token: ${VERIFY_TOKEN}`);
  console.log(`  graph creds set: ${Boolean(process.env.WHATSAPP_TOKEN && process.env.PHONE_NUMBER_ID)}`);
});
