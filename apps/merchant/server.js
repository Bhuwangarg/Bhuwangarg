// Demo merchant — any website that wants to safely transact with AI agents.
//
// The merchant does two things:
//   1. Locally verifies the agent's credentials (free, offline crypto) so it
//      can reject junk before talking to anyone.
//   2. Calls the Aegis authorization server for the binding decision (budget,
//      velocity, revocation) — exactly like a card terminal calls the network.
// It trusts no agent and stores no human secret. It just checks a signature
// and gets an approval.
//
// Run:  PORT=4100 AEGIS_URL=http://localhost:4000 npm run merchant

import { createServer } from "node:http";
import { verifyCredentials } from "../../src/protocol/mandate.js";
import { money } from "../../src/protocol/constraints.js";
import { json, readJson, route } from "../../src/protocol/http-util.js";

const PORT = process.env.PORT || 4100;
const AEGIS_URL = process.env.AEGIS_URL || "http://localhost:4000";
const DOMAIN = process.env.DOMAIN || "shop.example.com";

const server = createServer(async (req, res) => {
  const { method, path } = route(req);
  if (method === "OPTIONS") return json(res, 204, {});

  if (method === "POST" && path === "/checkout") {
    let presentation;
    try {
      presentation = await readJson(req);
    } catch {
      return json(res, 400, { error: "bad json" });
    }
    const { mandate, actionRequest } = presentation;

    // (1) Offline cryptographic gate — no network, no trust required.
    const crypto = verifyCredentials({ mandate, actionRequest });
    if (!crypto.ok) {
      return json(res, 401, { accepted: false, stage: "verify", reason: crypto.reason });
    }

    // (2) Ask the authority for the financial/lifecycle decision.
    let decision;
    try {
      const r = await fetch(`${AEGIS_URL}/v1/authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mandate, actionRequest }),
      });
      decision = await r.json();
    } catch (err) {
      return json(res, 502, { accepted: false, stage: "authorize", reason: "authority_unreachable" });
    }

    if (!decision.ok) {
      return json(res, 402, { accepted: false, stage: "authorize", reason: decision.reason, detail: decision.detail });
    }

    // Fulfilled. The signed receipt is the merchant's proof the agent was
    // authorized — its protection in any later dispute.
    return json(res, 200, {
      accepted: true,
      order_id: "ord_" + Math.random().toString(36).slice(2, 10),
      charged: money(actionRequest.action.amount || 0, actionRequest.action.currency),
      remaining_budget:
        decision.remaining_budget == null ? null : money(decision.remaining_budget, actionRequest.action.currency),
      receipt: decision.receipt,
    });
  }

  return json(res, 404, { error: "not found", hint: "POST /checkout with {mandate, actionRequest}" });
});

server.listen(PORT, () => {
  console.log(`\n  Merchant "${DOMAIN}"  →  http://localhost:${PORT}  (authority: ${AEGIS_URL})\n`);
});
