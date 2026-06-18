// One-command live demo: boots the Aegis authorization server + a merchant as
// child processes, then drives a real agent against them over HTTP, then tears
// everything down. Proves the full network flow, not just the in-memory path.
//
// Run:  npm run live

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { AegisAgent } from "../apps/agent/sdk.js";

const AEGIS = "http://localhost:4000";
const MERCHANT = "http://localhost:4100";

function boot(name, file, env) {
  const child = spawn("node", [file], { env: { ...process.env, ...env }, stdio: "inherit" });
  child.on("exit", (code) => code && console.error(`${name} exited ${code}`));
  return child;
}

async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const issuer = boot("issuer", "apps/issuer/server.js", { PORT: "4000" });
const merchant = boot("merchant", "apps/merchant/server.js", {
  PORT: "4100",
  AEGIS_URL: AEGIS,
  DOMAIN: "shop.example.com",
});

try {
  await waitFor(`${AEGIS}/v1/authority`);
  await waitFor(`${MERCHANT}/`);
  await sleep(150);

  const agent = new AegisAgent({ name: "Live Shopping Agent" });
  const principal = await post(`${AEGIS}/v1/principals`, { name: "Maya (live)" });
  const mandate = await post(`${AEGIS}/v1/mandates`, {
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
      max_total: 8000,
      velocity: { max_transactions: 5, window_seconds: 3600 },
    },
  });
  agent.receiveMandate(mandate);

  const buy = (amount, description, over = {}) =>
    agent.act(
      mandate.id,
      { kind: "purchase", domain: "shop.example.com", merchant_category: "grocery", currency: "USD", amount, description, ...over },
      `${MERCHANT}/checkout`,
    );

  console.log("\n=== LIVE HTTP FLOW ===");
  console.log("approved buy:", await buy(3200, "groceries"));
  console.log("over-cap buy:", await buy(9000, "too big"));

  console.log("\nrevoking mandate via Aegis API...");
  await post(`${AEGIS}/v1/mandates/${mandate.id}/revoke`, {});
  console.log("post-revoke buy:", await buy(1000, "after revoke"));

  const ledger = await (await fetch(`${AEGIS}/v1/mandates/${mandate.id}/ledger`)).json();
  console.log("\nledger:", JSON.stringify(ledger, null, 2));
  console.log(`\nDashboard (while servers run): ${AEGIS}`);
} finally {
  await sleep(200);
  issuer.kill();
  merchant.kill();
}
