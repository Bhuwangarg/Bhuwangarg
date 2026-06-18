# Aegis Protocol Specification (v1, reference)

A minimal, transport-agnostic protocol for delegating scoped authority from a
human to an AI agent, and for any third party to verify and authorize an agent's
action. Wire format is JSON; signatures are Ed25519 over canonical JSON.

## 1. Identities & DIDs

Every actor is an Ed25519 keypair. A DID encodes the raw 32-byte public key
inline:

```
did:aegis:<base64url(raw Ed25519 public key)>
```

Identity is **self-certifying**: a verifier recovers the public key directly from
the DID and checks signatures with no CA, registry, or trusted third party. (A
registry may be layered on for human-readable names and revocation status, but is
never required to verify a signature.)

## 2. Canonicalization

Signatures cover the **canonical JSON** of a payload with the `proof` field
removed: object keys sorted recursively, `undefined` dropped, no insignificant
whitespace. See `canonicalize()` in `src/protocol/keys.js`.

## 3. Objects

### 3.1 Mandate (signed by the principal)

```jsonc
{
  "v": "aegis/1",
  "type": "mandate",
  "id": "mnd_…",
  "principal": { "id": "did:aegis:…", "name": "Maya" },
  "agent":     { "id": "did:aegis:…", "name": "Maya's Shopping Agent" },
  "scope": {
    "actions": ["purchase"],
    "merchant_categories": ["grocery"],   // or "*"
    "allowed_domains": ["zinc-grocer.com"],// or "*"
    "currency": "USD",
    "max_per_transaction": 5000,           // integer minor units (cents)
    "max_total": 15000,                    // cumulative ceiling
    "velocity": { "max_transactions": 5, "window_seconds": 604800 }
  },
  "issued_at": 1718000000,
  "expires_at": 1718604800,
  "nonce": "…",
  "proof": "<base64url Ed25519 sig by principal over the body>"
}
```

### 3.2 ActionRequest (signed by the agent — proof of possession)

```jsonc
{
  "v": "aegis/1",
  "type": "action",
  "mandate_id": "mnd_…",
  "agent_id": "did:aegis:…",
  "action": {
    "kind": "purchase",
    "domain": "zinc-grocer.com",
    "merchant_category": "grocery",
    "currency": "USD",
    "amount": 4200,
    "description": "milk, eggs, veg",
    "line_items": []                       // optional
  },
  "issued_at": 1718000100,
  "nonce": "…",
  "proof": "<base64url Ed25519 sig by agent over the body>"
}
```

### 3.3 Receipt (signed by the authorization server)

Returned on approval; tamper-evident proof the action was authorized. Includes
`action_nonce`, `spent_total`, and the authority's signature.

## 4. Verification (offline, no network)

`verifyCredentials({ mandate, actionRequest })` returns `{ ok, reason }` and
enforces, in order:

1. Both objects well-formed and version `aegis/1`.
2. **Mandate signature** valid against the public key in `principal.id`.
3. **Action signature** valid against the public key in `agent_id` (proof of
   possession — a stolen mandate is useless without the agent's private key).
4. **Binding:** `actionRequest.agent_id === mandate.agent.id` and
   `actionRequest.mandate_id === mandate.id`.
5. **Validity window:** `issued_at ≤ now < expires_at`.

## 5. Authorization (online, stateful)

`authorize({ store, authority, mandate, actionRequest })` runs `verifyCredentials`
then, against the authority's ledger:

- **Revocation:** declines if the mandate id is revoked.
- **Registration:** declines if the mandate was never registered with this
  authority.
- **Policy** (`checkScope`): action kind ∈ scope; domain allowed; merchant
  category allowed; currency matches; `amount ≤ max_per_transaction`;
  `spent + amount ≤ max_total`; velocity within the rolling window.

On success it atomically records the spend/timestamp and returns a signed
receipt and remaining budget. Declines return a machine reason (e.g.
`policy_violation`, `mandate_revoked`, `agent_mismatch`) and human-readable
detail.

## 6. Threat model & properties

| Threat | Mitigation |
|---|---|
| Agent leaks/abuses a password | There is no password; only a scoped mandate. |
| Stolen mandate replayed by another agent | Proof of possession — action must be signed by the mandated agent's key (`agent_mismatch`). |
| Mandate tampering (raise the cap) | Any byte change breaks the principal's signature (`bad_mandate_signature`). |
| Compromised/runaway agent | Per-txn cap, cumulative budget, velocity limit, domain + category allow-lists, expiry. |
| Human changes their mind | Instant revocation at the authority. |
| Merchant fraud / dispute | Signed receipt binds principal → agent → exact action + amount. |
| No CA / bootstrap trust | Self-certifying DIDs; signatures verify offline. |

### Known limitations (reference build)

- **Custodial keys.** The demo authorization server holds principal keys to stay
  one-command; production must keep them client-side (secure enclave / passkey).
- **Replay window.** Action nonces are recorded per approval but a full
  nonce-cache + tight `issued_at` skew check is left to the deployment.
- **Single authority.** One ledger; federation / multiple authorities and signed
  status lists for revocation-at-scale are roadmap.
- **One-hop delegation.** Recursive sub-delegation (agent → sub-agent, still
  anchored to the human) is specified as future work — it's the gap current
  industry standards also leave open.
