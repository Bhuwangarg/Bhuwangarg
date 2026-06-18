// Aegis Agent SDK — the few lines an AI agent developer writes.
//
// The agent never sees the human's password or card. It holds its own keypair
// and a mandate the human granted it. To act on a site, it signs the concrete
// action and presents {mandate, actionRequest}. That is the entire integration.

import { createIdentity } from "../../src/protocol/keys.js";
import { signAction } from "../../src/protocol/mandate.js";

export class AegisAgent {
  // identity: result of createIdentity(); name: human-readable agent name.
  constructor({ name, identity } = {}) {
    this.identity = identity ?? createIdentity();
    this.name = name ?? "agent";
    this.mandates = new Map(); // mandate.id -> mandate
  }

  get did() {
    return this.identity.did;
  }

  // The human hands the agent a mandate (out of band — e.g. scanned/approved
  // in the Aegis wallet). The agent stores it.
  receiveMandate(mandate) {
    this.mandates.set(mandate.id, mandate);
    return this;
  }

  // Build a signed action request for a given mandate. Pure crypto; no network.
  prepareAction(mandateId, action) {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) throw new Error(`agent holds no mandate ${mandateId}`);
    const actionRequest = signAction({ agent: this.identity, mandate, action });
    return { mandate, actionRequest };
  }

  // Present an action to a merchant endpoint that speaks Aegis. Returns the
  // merchant's JSON response (approved + receipt, or declined + reason).
  async act(mandateId, action, merchantUrl) {
    const presentation = this.prepareAction(mandateId, action);
    const res = await fetch(merchantUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(presentation),
    });
    return res.json();
  }
}
