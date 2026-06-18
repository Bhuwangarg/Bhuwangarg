// Aegis protocol — the Mandate (the heart of the system).
//
// A Mandate is a signed, scoped, time-bound, holder-bound credential. In plain
// terms it says: "I, this human, authorize THIS agent to perform THESE actions,
// within THESE limits, until THIS time." It is the agentic-web equivalent of a
// W3C Verifiable Credential, kept deliberately small and dependency-free.
//
// Two objects move through the system:
//   - Mandate:       issued + signed by the human principal. Long(ish)-lived.
//   - ActionRequest: signed by the AGENT for one concrete action. Proves the
//                    agent holds the key the mandate was granted to (proof of
//                    possession) and binds the grant to a real-world request.

import {
  signPayload,
  verifyPayload,
  newNonce,
  newId,
} from "./keys.js";

export const PROTOCOL_VERSION = "aegis/1";

// ── Issuing (human principal side) ──────────────────────────────────────────

// scope shape:
// {
//   actions: ["purchase", "subscribe", "book", "read_data", ...],
//   merchant_categories: ["grocery", "retail", ...] | "*",
//   allowed_domains: ["shop.example.com"] | "*",
//   currency: "USD",
//   max_per_transaction: <int cents>,
//   max_total: <int cents>,            // cumulative ceiling across the mandate
//   velocity: { max_transactions: <int>, window_seconds: <int> } | null
// }
export function issueMandate({ principal, agentDid, agentName, scope, ttlSeconds, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const body = {
    v: PROTOCOL_VERSION,
    type: "mandate",
    id: newId("mnd"),
    principal: { id: principal.did, name: principal.name },
    agent: { id: agentDid, name: agentName },
    scope,
    issued_at: issuedAt,
    expires_at: issuedAt + ttlSeconds,
    nonce: newNonce(),
  };
  const proof = signPayload(body, principal.privateKey);
  return { ...body, proof };
}

// ── Presenting one action (AI agent side) ───────────────────────────────────

// action shape:
// { kind, domain, merchant_category, currency, amount (cents), description, line_items? }
export function signAction({ agent, mandate, action, now = Date.now() }) {
  const body = {
    v: PROTOCOL_VERSION,
    type: "action",
    mandate_id: mandate.id,
    agent_id: agent.did,
    action,
    issued_at: Math.floor(now / 1000),
    nonce: newNonce(),
  };
  const proof = signPayload(body, agent.privateKey);
  return { ...body, proof };
}

// ── Verifying (merchant / verifier side, cryptographic layer only) ───────────
//
// This proves WHO without deciding WHETHER. It answers:
//   1. Did the named human really sign this mandate?
//   2. Did the agent the mandate names really sign this action?
//   3. Are both inside their validity window?
// Financial limits, revocation, and velocity are policy — see constraints.js
// and the authorization server — because they require shared, mutable state.
export function verifyCredentials({ mandate, actionRequest, now = Date.now() }) {
  const nowSec = Math.floor(now / 1000);

  if (!mandate || mandate.v !== PROTOCOL_VERSION || mandate.type !== "mandate") {
    return fail("malformed_mandate");
  }
  if (!actionRequest || actionRequest.v !== PROTOCOL_VERSION || actionRequest.type !== "action") {
    return fail("malformed_action");
  }

  // 1. Principal's signature over the mandate.
  const { proof: mandateProof, ...mandateBody } = mandate;
  if (!verifyPayload(mandateBody, mandateProof, mandate.principal.id)) {
    return fail("bad_mandate_signature");
  }

  // 2. Agent's signature over the action (proof of possession).
  const { proof: actionProof, ...actionBody } = actionRequest;
  if (!verifyPayload(actionBody, actionProof, actionRequest.agent_id)) {
    return fail("bad_action_signature");
  }

  // 3. Binding: the action must come from the exact agent the mandate names,
  //    and reference that mandate. This is what stops a stolen mandate from
  //    being replayed by a different key.
  if (actionRequest.agent_id !== mandate.agent.id) {
    return fail("agent_mismatch");
  }
  if (actionRequest.mandate_id !== mandate.id) {
    return fail("mandate_mismatch");
  }

  // 4. Validity window.
  if (nowSec < mandate.issued_at) return fail("mandate_not_yet_valid");
  if (nowSec >= mandate.expires_at) return fail("mandate_expired");

  return { ok: true, principal: mandate.principal, agent: mandate.agent };
}

function fail(reason) {
  return { ok: false, reason };
}
