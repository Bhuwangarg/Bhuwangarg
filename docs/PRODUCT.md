# Aegis — Product Thesis

## The one-sentence version

When AI agents start acting on the open web, every website needs a way to know an
agent is *really* authorized by a human and *really* inside the limits that human
set — and humans need a single place to grant, watch, and revoke that authority.
**Aegis is that layer.**

## The problem, told as a story

Maya's assistant agent offers to reorder her groceries. To let it, she has two
choices today:

1. **Give it her password and card.** Now a probabilistic language model has her
   full credentials and unbounded spending power. One prompt-injection on a
   malicious product page and it buys $4,000 of gift cards. She has no scoping, no
   real-time cap, and revocation means changing her password everywhere.
2. **Do it herself.** The whole promise of agents evaporates.

This is not a payments problem. It's a **delegation** problem: *how do you grant a
narrow, revocable slice of your authority to a non-human actor, and how does the
far side verify it?* Payments are simply where the pain (and the money) shows up
first.

## Why now

- **The agents are here.** Tool-using, web-browsing agents went mainstream in
  2025–26. They can already fill carts and forms.
- **The money is moving.** Visa Trusted Agent Protocol, Mastercard Agent Pay /
  Verifiable Intent, Stripe Shared Payment Tokens all shipped by mid-2026.
  McKinsey projects $1T+ in US agent-driven transactions by 2030.
- **The standards are a mess.** Five vendor "agent identity" frameworks launched
  in one week at RSAC 2026; competing IETF drafts; a fresh NIST initiative. Every
  one reinvents the same signed-scoped-mandate primitive inside its own silo.

The primitive is settled. **Ownership of the neutral, human-controlled layer is
not.** That's the opening.

## What Aegis is (and isn't)

**Is:** an open protocol + the consumer app and developer SDKs around it. A human
holds keys (phone secure enclave / passkey), issues scoped mandates to agents,
and watches a live control panel. Websites verify a mandate offline and get an
authorization decision online. Think **"OAuth + Stripe, redesigned for the human
granting authority to a machine."**

**Isn't:** a card network, a model provider, or a closed marketplace. Aegis
doesn't move money itself — it *authorizes* and rides existing rails (cards,
bank transfers, crypto) via adapters. Neutrality is the product.

## Why it wins (the Jobs cut)

Don't sell "agent IAM." Sell the feeling: **calm.** The product is the moment
Maya taps "Allow groceries, $150/week" and *stops worrying* — because she can see
every action and kill it instantly. The technology (Ed25519, DIDs, verifiable
credentials) should be invisible. The visible thing is a dead-simple permission
slip and an off switch that actually works.

Three design commitments:

1. **The human is always the principal.** Every action traces to a person who
   said yes. No exceptions, no anonymous agents.
2. **Least authority by default.** A mandate grants the *minimum* — one category,
   one cap, one site, one week. Broad grants are a deliberate, visible choice.
3. **Revocation is sacred and instant.** The off switch is the most important
   button in the product and must never be more than one tap away.

## Business model

- **Free** for individuals to issue and revoke mandates (drives the network).
- **Per-authorization fee** to merchants/platforms for the authorization +
  signed-receipt + dispute-protection service (the Stripe-like rail).
- **Enterprise** seat/governance pricing for companies issuing mandates to their
  own internal agents (policy, SSO, audit export, SIEM hooks).

## Moat

Two-sided network effect: every human who issues mandates makes Aegis worth
verifying for merchants; every merchant who verifies makes Aegis worth holding
for humans and agents. Plus the **audit ledger** — the system of record for
"what did my agents do" — is sticky and compounding.

## The 90-second pitch

> Agents are going to spend your money and act in your name on the web. You will
> not give them your passwords — you'll give them a *mandate*: this agent, this
> much, this place, until this date, revocable now. Aegis is the open layer that
> issues those mandates, lets any website verify them with no shared secret, and
> gives you one screen to watch and kill anything. We're the trust layer for the
> agentic web. Give your agent a key, not your keys.

## Sources

The market context above is drawn from public reporting as of mid-2026:

- [Mastercard launches Agent Pay for Machines](https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html)
- [Mastercard Verifiable Intent: Trust in Agent Commerce](https://www.digitalapplied.com/blog/mastercard-verifiable-intent-trust-agentic-commerce)
- [Visa — enabling AI agents to buy securely (Intelligent Commerce)](https://www.visa.com/en-us/solutions/intelligent-commerce)
- [Visa teams with Stripe on agent payments (PYMNTS)](https://www.pymnts.com/visa/2026/visa-scales-agentic-commerce-through-stripe-protocol-collaboration/)
- [Stripe — payment methods for agentic commerce](https://stripe.com/blog/supporting-additional-payment-methods-for-agentic-commerce)
- [Ping Identity defines runtime identity standard for autonomous AI](https://press.pingidentity.com/2026-03-24-Ping-Identity-Defines-the-Runtime-Identity-Standard-for-Autonomous-AI)
- [NIST AI Agent Standards Initiative (WorkOS explainer)](https://workos.com/blog/nist-ai-agent-standards-initiative-explained)
- [IETF draft — AI Agent Authentication and Authorization](https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/)
- [Agent authentication & delegated access (Zylos research)](https://zylos.ai/research/2026-04-11-agent-authentication-delegated-access-oauth-scoped-tokens)
- [Agent identity verification — how agents authenticate purchases (Eco)](https://eco.com/support/en/articles/15192005-agent-identity-verification-how-ai-agents-authenticate-purchases-in-2026)
