// Aegis protocol — the authorization decision.
//
// This is what an Aegis authorization server runs when a merchant asks
// "should I let this agent do this?". It composes the three layers:
//   1. crypto   (verifyCredentials)  — is this really who they claim?
//   2. lifecycle(revocation)         — has the human pulled the mandate?
//   3. policy   (checkScope)         — is it inside the granted limits + budget?
// On approval it records the spend and returns a signed, tamper-evident
// receipt — the audit trail the human can later inspect or dispute.

import { verifyCredentials } from "./mandate.js";
import { checkScope } from "./constraints.js";
import { signPayload, newId } from "./keys.js";
import { PROTOCOL_VERSION } from "./mandate.js";

export function authorize({ store, authority, mandate, actionRequest, now = Date.now() }) {
  const crypto = verifyCredentials({ mandate, actionRequest, now });
  if (!crypto.ok) return decline(crypto.reason);

  if (store.isRevoked(mandate.id)) return decline("mandate_revoked");

  const known = store.get(mandate.id);
  if (!known) return decline("mandate_not_registered");

  const policy = checkScope({
    mandate,
    action: actionRequest.action,
    ledger: store.ledger(mandate.id),
    now,
  });
  if (!policy.ok) return decline("policy_violation", policy.reasons);

  const ledger = store.record({ mandateId: mandate.id, action: actionRequest.action, now });
  const receipt = issueReceipt({ authority, mandate, actionRequest, ledger, now });
  return { ok: true, decision: "approved", receipt, remaining_budget: remaining(mandate, ledger) };
}

function issueReceipt({ authority, mandate, actionRequest, ledger, now }) {
  const body = {
    v: PROTOCOL_VERSION,
    type: "receipt",
    id: newId("rcpt"),
    authority: authority.did,
    mandate_id: mandate.id,
    principal: mandate.principal.id,
    agent: mandate.agent.id,
    action: actionRequest.action,
    action_nonce: actionRequest.nonce,
    spent_total: ledger.spent,
    issued_at: Math.floor(now / 1000),
  };
  return { ...body, proof: signPayload(body, authority.privateKey) };
}

function remaining(mandate, ledger) {
  if (typeof mandate.scope.max_total !== "number") return null;
  return Math.max(0, mandate.scope.max_total - ledger.spent);
}

function decline(reason, detail) {
  return { ok: false, decision: "declined", reason, detail };
}
