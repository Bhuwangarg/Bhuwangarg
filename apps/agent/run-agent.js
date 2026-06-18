// Runnable agent that talks to a live merchant over HTTP. Assumes the issuer
// (npm run issuer) and merchant (npm run merchant) are already running.
//
// It creates an agent identity, asks the Aegis server to mint a principal +
// mandate for it, then attempts a purchase at the merchant.
//
// Run:  npm run agent

import { AegisAgent } from "./sdk.js";

const AEGIS_URL = process.env.AEGIS_URL || "http://localhost:4000";
const MERCHANT_URL = process.env.MERCHANT_URL || "http://localhost:4100/checkout";

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const agent = new AegisAgent({ name: "Demo Shopping Agent" });
console.log("agent DID:", agent.did);

const principal = await post(`${AEGIS_URL}/v1/principals`, { name: "Live Demo User" });
console.log("principal:", principal.did);

const mandate = await post(`${AEGIS_URL}/v1/mandates`, {
  principal_did: principal.did,
  agent_did: agent.did,
  agent_name: agent.name,
  ttl_seconds: 3600,
  scope: {
    actions: ["purchase"],
    merchant_categories: ["grocery"],
    allowed_domains: ["shop.example.com"],
    currency: "USD",
    max_per_transaction: 5000,
    max_total: 10000,
    velocity: { max_transactions: 5, window_seconds: 3600 },
  },
});
agent.receiveMandate(mandate);
console.log("mandate:", mandate.id);

const result = await agent.act(
  mandate.id,
  {
    kind: "purchase",
    domain: "shop.example.com",
    merchant_category: "grocery",
    currency: "USD",
    amount: 3200,
    description: "groceries via live HTTP flow",
  },
  MERCHANT_URL,
);

console.log("\nmerchant response:");
console.log(JSON.stringify(result, null, 2));
console.log(`\nView the control panel at ${AEGIS_URL}`);
