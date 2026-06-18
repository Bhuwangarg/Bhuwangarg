# Aegis

### The trust layer for the agentic web. **Give your agent a key, not your keys.**

---

AI agents are about to start *doing things* on the web for us — buying groceries,
booking travel, paying bills, renewing subscriptions, filing forms. There is
exactly one thing standing between that future and chaos:

> **How does a website know an AI agent is really allowed to act for you — and
> how do *you* stay in control of what it can do?**

Today the answer is terrifying: you hand the agent your password and your credit
card and *hope*. That's like giving a contractor the keys to your house, your
car, and your bank account because they offered to pick up milk.

Aegis is the other way. You give your agent a **mandate** — a signed, scoped,
time-bound, instantly-revocable permission slip:

> *"This specific agent may **buy groceries**, up to **$50 a trip** and **$150 a
> week**, only at **zinc-grocer.com**, for the **next 7 days**."*

Every website can verify that mandate in milliseconds, with no shared secret, no
password, and no single vendor to trust. Every action is signed, capped, and
written to an audit trail you can inspect — or revoke from your phone in one tap.

This repo is a **working, zero-dependency reference implementation** of that idea:
the protocol, an authorization server with a live control panel, an agent SDK, a
merchant integration, and an end-to-end demo.

---

## See it in 10 seconds

```bash
npm run demo      # narrated end-to-end story, no setup
npm test          # 11 protocol tests
npm run live      # boots real HTTP servers + drives an agent through them
```

`npm run demo` prints the whole story: an agent gets approved for groceries,
then gets refused when it overspends, shops off-list, replays a stolen mandate,
or acts after revocation — each refusal explained.

To watch the **live control panel**, run the servers and open
<http://localhost:4000>:

```bash
npm run issuer    # terminal 1 — Aegis authorization server + dashboard
npm run merchant  # terminal 2 — a demo storefront
npm run agent     # terminal 3 — an agent makes a real purchase
```

---

## Why this, why now

The agentic-commerce land grab is already on. By mid-2026 Visa shipped the
**Trusted Agent Protocol**, Mastercard shipped **Agent Pay / Verifiable Intent**,
Stripe shipped **Shared Payment Tokens**, and Ping, Okta, Microsoft and a dozen
others each shipped an incompatible "agent identity" framework. NIST opened an
**AI Agent Standards Initiative**; the IETF has competing drafts. McKinsey
projects agents will drive **$1T+ in US transactions by 2030**.

They all converge on the *same primitive* — a signed, scoped, holder-bound
**mandate** that ties an agent's action to a human's approval — and they're each
rebuilding it inside a walled garden tied to their network or cloud.

**The gap Aegis fills:** an open, network-agnostic trust layer the *human*
controls, that any website can verify and any agent can carry — not locked to one
card network or one cloud. Payments are the wedge. The platform is **delegated
authority for everything an agent does online.** See
[`docs/PRODUCT.md`](docs/PRODUCT.md) for the full thesis and
[`docs/USE_CASES.md`](docs/USE_CASES.md) for where it goes after payments.

---

## How it works

Three actors, mirroring how card networks already work (so the world doesn't have
to learn a new mental model):

```
   HUMAN (principal)            AI AGENT                  WEBSITE (merchant)
   holds a keypair              holds its own keypair     trusts no one
        │                            │                          │
        │ 1. issues a MANDATE        │                          │
        │   (signed: who can do      │                          │
        │    what, how much,         │                          │
        │    where, until when)      │                          │
        ├───────────────────────────►│                          │
        │                            │ 2. signs an ACTION        │
        │                            │   (this purchase, now)    │
        │                            ├─────────────────────────►│
        │                            │                          │ 3. verifies both
        │                            │                          │    signatures offline
        │                            │                          │
        │                            │         ┌────────────────┤ 4. asks Aegis to
        │              AEGIS AUTHORIZATION SERVER               │    AUTHORIZE
        │              • revocation  • budget  • velocity       │
        │              • signs a tamper-evident RECEIPT ────────┤ 5. approved + receipt
```

Three independent layers, each doing one job:

| Layer | Question | Where | Needs network? |
|---|---|---|---|
| **Cryptography** | *Is this really who they claim?* | `verifyCredentials` | No — offline |
| **Lifecycle** | *Has the human pulled the mandate?* | revocation registry | Yes |
| **Policy** | *Is it inside the granted limits + budget?* | `checkScope` | Yes (shared ledger) |

Identity is **self-certifying**: a DID *is* the public key
(`did:aegis:<base64url-key>`), so any verifier extracts the key from the
identifier and checks a signature with **zero trusted third parties** — no CA to
bootstrap. The agent never sees a password. A stolen mandate is useless without
the agent's private key (proof of possession). Tampering with a single byte
breaks the signature. Revocation is instant. Every approval produces a signed
receipt — the audit trail and the merchant's protection in a dispute.

---

## Repository layout

```
src/protocol/      the protocol — keys, mandate, constraints, revocation, authorize
apps/issuer/       Aegis authorization server + live control-panel dashboard
apps/agent/        agent SDK (the few lines an agent developer writes) + runnable agent
apps/merchant/     a demo website that safely transacts with agents
demo/run.js        narrated end-to-end story (no servers)
demo/live.js       boots real servers and drives an agent over HTTP
test/              11 tests covering crypto, policy, revocation, replay, tampering
docs/              product thesis, protocol spec, use-case catalog
```

Built with **Node ≥ 18 and zero dependencies** — only the standard library
(`node:crypto` Ed25519, `node:http`). Clone and run; nothing to install.

---

## Status & roadmap

This is a reference implementation that demonstrates the full trust model end to
end. The honest next steps toward production:

- **Keys & UX:** move principal keys to a phone secure-enclave / passkey; the
  server here is custodial only to keep the demo one-command.
- **Recursive delegation:** let an agent sub-delegate to a sub-agent while the
  chain stays cryptographically anchored to the original human (the unsolved
  multi-hop problem the current standards punt on).
- **Interop:** adapters that present an Aegis mandate as a Visa TAP / Mastercard
  Verifiable Intent / Stripe SPT credential, so it rides existing rails.
- **Revocation at scale:** signed status lists / short-lived proofs instead of a
  live registry call.

See [`docs/PROTOCOL.md`](docs/PROTOCOL.md) for the wire format and threat model.

MIT licensed.
