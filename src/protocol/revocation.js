// Aegis protocol — revocation + the spend ledger.
//
// Cryptography proves authenticity but cannot express "I changed my mind" or
// "track how much has been spent." Those need shared, mutable state held by an
// authorization server (the issuer / "Aegis"). This is the in-memory reference
// implementation; a production build would back it with a database and expose
// the same surface.

export class AuthorizationStore {
  constructor() {
    this.mandates = new Map(); // id -> mandate
    this.revoked = new Set(); // revoked mandate ids
    this.ledgers = new Map(); // id -> { spent, timestamps: [], actions: [] }
  }

  register(mandate) {
    this.mandates.set(mandate.id, mandate);
    if (!this.ledgers.has(mandate.id)) {
      this.ledgers.set(mandate.id, { spent: 0, timestamps: [], actions: [] });
    }
    return mandate;
  }

  get(id) {
    return this.mandates.get(id);
  }

  ledger(id) {
    return this.ledgers.get(id) ?? { spent: 0, timestamps: [], actions: [] };
  }

  revoke(id) {
    this.revoked.add(id);
  }

  isRevoked(id) {
    return this.revoked.has(id);
  }

  // Atomically record an approved action against a mandate's running totals.
  // Called only after every cryptographic + policy check has passed.
  record({ mandateId, action, now = Date.now() }) {
    const ledger = this.ledger(mandateId);
    ledger.timestamps.push(Math.floor(now / 1000));
    if (typeof action.amount === "number") ledger.spent += action.amount;
    ledger.actions.push({ at: Math.floor(now / 1000), action });
    this.ledgers.set(mandateId, ledger);
    return ledger;
  }
}
