import { test } from "node:test";
import assert from "node:assert/strict";

import { createIdentity, publicKeyFromDid, canonicalize } from "../src/protocol/keys.js";
import { issueMandate, signAction, verifyCredentials } from "../src/protocol/mandate.js";
import { AuthorizationStore } from "../src/protocol/revocation.js";
import { authorize } from "../src/protocol/authorize.js";

function setup() {
  const principal = { ...createIdentity(), name: "Human" };
  const agent = { ...createIdentity(), name: "Agent" };
  const authority = createIdentity();
  const store = new AuthorizationStore();
  const mandate = issueMandate({
    principal,
    agentDid: agent.did,
    agentName: agent.name,
    scope: {
      actions: ["purchase"],
      merchant_categories: ["grocery"],
      allowed_domains: ["shop.example.com"],
      currency: "USD",
      max_per_transaction: 5000,
      max_total: 10000,
      velocity: { max_transactions: 3, window_seconds: 3600 },
    },
    ttlSeconds: 3600,
  });
  store.register(mandate);
  const buy = (amount, over = {}) => ({
    kind: "purchase", domain: "shop.example.com", merchant_category: "grocery",
    currency: "USD", amount, description: "x", ...over,
  });
  return { principal, agent, authority, store, mandate, buy };
}

test("DID is self-certifying — key recovers from identifier", () => {
  const id = createIdentity();
  assert.ok(publicKeyFromDid(id.did));
});

test("canonicalize is stable regardless of key order", () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
});

test("valid action is approved and budget decremented", () => {
  const { agent, authority, store, mandate, buy } = setup();
  const actionRequest = signAction({ agent, mandate, action: buy(3000) });
  const r = authorize({ store, authority, mandate, actionRequest });
  assert.equal(r.ok, true);
  assert.equal(r.remaining_budget, 7000);
  assert.ok(r.receipt.proof);
});

test("over per-transaction cap is declined", () => {
  const { agent, authority, store, mandate, buy } = setup();
  const r = authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(6000) }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "policy_violation");
});

test("wrong merchant category is declined", () => {
  const { agent, authority, store, mandate, buy } = setup();
  const action = buy(1000, { merchant_category: "electronics" });
  const r = authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "policy_violation");
});

test("cumulative budget is enforced across actions", () => {
  const { agent, authority, store, mandate, buy } = setup();
  authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(4000) }) });
  authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(4000) }) });
  const r = authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(4000) }) });
  assert.equal(r.ok, false); // 12000 > 10000 cap
});

test("revoked mandate is declined", () => {
  const { agent, authority, store, mandate, buy } = setup();
  store.revoke(mandate.id);
  const r = authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(1000) }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "mandate_revoked");
});

test("impostor agent cannot replay a stolen mandate", () => {
  const { authority, store, mandate, buy } = setup();
  const impostor = createIdentity();
  const actionRequest = signAction({ agent: impostor, mandate, action: buy(1000) });
  const r = authorize({ store, authority, mandate, actionRequest });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "agent_mismatch");
});

test("tampering with a signed mandate is detected", () => {
  const { agent, mandate, buy } = setup();
  const tampered = structuredClone(mandate);
  tampered.scope.max_total = 999999999; // try to raise the budget
  const actionRequest = signAction({ agent, mandate: tampered, action: buy(1000) });
  const r = verifyCredentials({ mandate: tampered, actionRequest });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "bad_mandate_signature");
});

test("expired mandate is rejected", () => {
  const { agent, mandate, buy } = setup();
  const future = Date.now() + 3601 * 1000;
  const actionRequest = signAction({ agent, mandate, action: buy(1000), now: future });
  const r = verifyCredentials({ mandate, actionRequest, now: future });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "mandate_expired");
});

test("velocity limit is enforced", () => {
  const { agent, authority, store, mandate, buy } = setup();
  for (let i = 0; i < 3; i++)
    authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(100) }) });
  const r = authorize({ store, authority, mandate, actionRequest: signAction({ agent, mandate, action: buy(100) }) });
  assert.equal(r.ok, false); // 4th within window
});
