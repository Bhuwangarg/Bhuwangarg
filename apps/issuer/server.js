// Aegis Authorization Server + custodial wallet.
//
// In a consumer product this is "the Aegis app": it holds the human's keys in a
// secure enclave, lets them grant/revoke mandates to their agents, runs the
// authorization decision merchants call into, and keeps the audit ledger.
//
// Run:  npm run issuer        (defaults to http://localhost:4000)
//
// API:
//   POST /v1/principals                  -> create a human account (wallet)
//   POST /v1/mandates                     -> issue a mandate to an agent
//   POST /v1/mandates/:id/revoke          -> revoke instantly
//   GET  /v1/mandates/:id                 -> fetch a mandate
//   GET  /v1/mandates/:id/ledger          -> audit trail
//   POST /v1/authorize                    -> merchant authorization decision
//   GET  /                                -> live dashboard

import { createServer } from "node:http";
import { createIdentity } from "../../src/protocol/keys.js";
import { issueMandate } from "../../src/protocol/mandate.js";
import { AuthorizationStore } from "../../src/protocol/revocation.js";
import { authorize } from "../../src/protocol/authorize.js";
import { money } from "../../src/protocol/constraints.js";
import { json, html, readJson, route } from "../../src/protocol/http-util.js";
import { renderDashboard } from "./dashboard.js";

const PORT = process.env.PORT || 4000;

const authority = createIdentity(); // signs receipts
const store = new AuthorizationStore();
const principals = new Map(); // did -> { identity, name }

function getPrincipal(did) {
  return principals.get(did);
}

const server = createServer(async (req, res) => {
  const { method, path } = route(req);
  if (method === "OPTIONS") return json(res, 204, {});

  try {
    if (method === "GET" && path === "/") {
      return html(res, 200, renderDashboard({ store, principals, authority }));
    }

    if (method === "GET" && path === "/v1/authority") {
      return json(res, 200, { did: authority.did });
    }

    // Create a custodial human account.
    if (method === "POST" && path === "/v1/principals") {
      const { name } = await readJson(req);
      const identity = createIdentity();
      principals.set(identity.did, { identity, name: name || "Account holder" });
      return json(res, 201, { did: identity.did, name: name || "Account holder" });
    }

    // Issue a mandate from a principal to an agent.
    if (method === "POST" && path === "/v1/mandates") {
      const { principal_did, agent_did, agent_name, scope, ttl_seconds } = await readJson(req);
      const p = getPrincipal(principal_did);
      if (!p) return json(res, 404, { error: "unknown principal" });
      const mandate = issueMandate({
        principal: { did: p.identity.did, name: p.name, privateKey: p.identity.privateKey },
        agentDid: agent_did,
        agentName: agent_name,
        scope,
        ttlSeconds: ttl_seconds ?? 7 * 24 * 3600,
      });
      store.register(mandate);
      return json(res, 201, mandate);
    }

    const mandateMatch = path.match(/^\/v1\/mandates\/([^/]+)(\/revoke|\/ledger)?$/);
    if (mandateMatch) {
      const id = mandateMatch[1];
      const sub = mandateMatch[2];
      const mandate = store.get(id);
      if (!mandate) return json(res, 404, { error: "unknown mandate" });

      if (method === "POST" && sub === "/revoke") {
        store.revoke(id);
        return json(res, 200, { id, revoked: true });
      }
      if (method === "GET" && sub === "/ledger") {
        const ledger = store.ledger(id);
        return json(res, 200, {
          mandate_id: id,
          revoked: store.isRevoked(id),
          spent: ledger.spent,
          spent_display: money(ledger.spent, mandate.scope.currency),
          actions: ledger.actions,
        });
      }
      if (method === "GET" && !sub) return json(res, 200, mandate);
    }

    // The authorization decision a merchant calls.
    if (method === "POST" && path === "/v1/authorize") {
      const { mandate, actionRequest } = await readJson(req);
      const result = authorize({ store, authority, mandate, actionRequest });
      return json(res, result.ok ? 200 : 402, result);
    }

    return json(res, 404, { error: "not found", path });
  } catch (err) {
    return json(res, 400, { error: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Aegis authorization server  →  http://localhost:${PORT}`);
  console.log(`  authority DID: ${authority.did}\n`);
});
