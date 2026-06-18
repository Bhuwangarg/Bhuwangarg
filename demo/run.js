// Aegis end-to-end demo (no servers — pure protocol). Run: npm run demo
//
// Story: Maya installs a shopping agent. She does NOT give it her card or
// password. She gives it a *mandate*: "you may buy groceries, up to $50 a
// trip, $150 a week, only at zinc-grocer.com." Then we watch the agent try
// things — and watch Aegis approve what's allowed and refuse everything else.

import { createIdentity } from "../src/protocol/keys.js";
import { issueMandate, signAction } from "../src/protocol/mandate.js";
import { AuthorizationStore } from "../src/protocol/revocation.js";
import { authorize } from "../src/protocol/authorize.js";
import { money } from "../src/protocol/constraints.js";

const D = "\x1b[2m", G = "\x1b[32m", R = "\x1b[31m", B = "\x1b[1m", C = "\x1b[36m", X = "\x1b[0m";
const line = () => console.log(D + "─".repeat(64) + X);

// Actors. Each is just a keypair; private keys never leave their owner.
const maya = { ...createIdentity(), name: "Maya" };
const agent = { ...createIdentity(), name: "Maya's Shopping Agent" };
const authority = createIdentity(); // the Aegis authorization server
const store = new AuthorizationStore();

console.log(`\n${B}AEGIS — give your agent a key, not your keys${X}`);
line();
console.log(`${D}human  ${X}${maya.name.padEnd(22)} ${D}${maya.did}${X}`);
console.log(`${D}agent  ${X}${agent.name.padEnd(22)} ${D}${agent.did}${X}`);
console.log(`${D}aegis  ${X}${"authorization server".padEnd(22)} ${D}${authority.did}${X}`);
line();

// 1) Maya grants a scoped mandate.
const mandate = issueMandate({
  principal: maya,
  agentDid: agent.did,
  agentName: agent.name,
  scope: {
    actions: ["purchase"],
    merchant_categories: ["grocery"],
    allowed_domains: ["zinc-grocer.com"],
    currency: "USD",
    max_per_transaction: 5000, // $50.00
    max_total: 15000, // $150.00 / week
    velocity: { max_transactions: 5, window_seconds: 7 * 24 * 3600 },
  },
  ttlSeconds: 7 * 24 * 3600,
});
store.register(mandate);
console.log(`${B}Maya grants a mandate:${X} buy ${C}groceries${X} at ${C}zinc-grocer.com${X}, ` +
  `≤ ${money(5000)}/trip, ${money(15000)}/week.\n`);

// Helper that plays one attempt and prints the verdict.
function attempt(label, action, { from = agent } = {}) {
  const actionRequest = signAction({ agent: from, mandate, action });
  const result = authorize({ store, authority, mandate, actionRequest });
  if (result.ok) {
    console.log(`${G}✓ APPROVED${X}  ${label}`);
    console.log(`${D}            ${money(action.amount, action.currency)} · ` +
      `remaining ${money(result.remaining_budget)} · receipt ${result.receipt.id}${X}`);
  } else {
    const detail = result.detail ? ` — ${result.detail.join("; ")}` : "";
    console.log(`${R}✗ DECLINED${X}  ${label}`);
    console.log(`${D}            ${result.reason}${detail}${X}`);
  }
  return result;
}

const grocery = (amount, description) => ({
  kind: "purchase", domain: "zinc-grocer.com", merchant_category: "grocery",
  currency: "USD", amount, description,
});

console.log(`${B}The agent goes to work:${X}`);
attempt("weekly groceries", grocery(4200, "milk, eggs, veg"));
attempt("a second small run", grocery(2500, "snacks"));

console.log();
console.log(`${B}Now the guardrails earn their keep:${X}`);
attempt("a $90 stock-up (over per-trip cap)", grocery(9000, "bulk order"));
attempt("a TV at an electronics store", {
  kind: "purchase", domain: "mega-electronics.com", merchant_category: "electronics",
  currency: "USD", amount: 4000, description: "65-inch TV",
});
attempt("groceries that blow the weekly budget", grocery(9000, "party platters"));

console.log();
console.log(`${B}A stolen mandate, replayed by an impostor agent:${X}`);
const impostor = { ...createIdentity(), name: "Impostor" };
attempt("impostor reuses Maya's mandate", grocery(1000, "test"), { from: impostor });

console.log();
console.log(`${B}Maya revokes the mandate from her phone:${X}`);
store.revoke(mandate.id);
attempt("agent tries again after revocation", grocery(1000, "milk"));

line();
const ledger = store.ledger(mandate.id);
console.log(`${B}Audit trail${X} (${ledger.actions.length} approved, ${money(ledger.spent)} spent):`);
ledger.actions.forEach((a) =>
  console.log(`${D}  • ${new Date(a.at * 1000).toLocaleTimeString()}  ` +
    `${money(a.action.amount)}  ${a.action.description}${X}`));
line();
console.log(`Every action was cryptographically tied to ${B}Maya → her agent → one request${X}.`);
console.log(`No password shared. Limits enforced. Revocation instant. Receipts signed.\n`);
