# Aegis — Use Cases

Payments are the wedge because that's where the fear and the money are. But a
mandate is just *scoped, revocable authority*, so the same primitive covers far
more than checkout. The `action.kind` field is the extension point.

## Tier 1 — Payments & commerce (the wedge)

- **Grocery / household reordering.** "Buy groceries, ≤ $50/trip, $200/week, only
  at my two stores." (The demo.)
- **Travel booking.** "Book flights/hotels for the Tokyo trip, ≤ $1,800 total,
  refundable fares only, before Friday."
- **Subscription management.** "Renew my existing subscriptions up to $30/mo
  each; never start a new one." Agents reorder/renew; new commitments need a
  fresh grant.
- **B2B procurement.** "Reorder consumables from approved vendors, ≤ $5k/PO,
  $50k/quarter," with every PO carrying a signed receipt for the finance system.
- **Micropayments / pay-per-use.** Sub-cent payments for API calls, data, or
  compute as agents transact with other agents — exactly the high-velocity,
  programmatic flow the card networks are now chasing.

## Tier 2 — Acting on your accounts (beyond money)

- **Form filling & applications.** "Submit this rebate / visa form using my
  saved profile; show me before final submit on anything legal."
- **Customer-service actions.** "Cancel this order, request this refund, update
  my address" — scoped to specific accounts, with receipts.
- **Scheduling & comms.** "Book appointments in this calendar window; never
  accept anything that costs money without a payment mandate."
- **Account hygiene.** "Rotate passwords / close dormant accounts on this list" —
  a read+act mandate scoped to named domains.

## Tier 3 — Data & access delegation

- **Consented data access.** "This research agent may read my last 3 months of
  transactions, read-only, for 24 hours" — a mandate as a portable, revocable,
  auditable access grant (a cleaner OAuth for agents).
- **Cross-agent delegation.** A planning agent delegates the "book the hotel"
  sub-task to a specialist agent — with the chain still anchored to you
  (roadmap: recursive delegation).

## Tier 4 — Enterprise & machine-to-machine

- **Internal agent governance.** A company issues mandates to its own agents:
  "this support agent may issue refunds ≤ $100, 50/day," enforced centrally with
  audit export to the SIEM.
- **Agent-to-agent marketplaces.** Service agents accept mandates as proof a
  buyer agent is funded and authorized before doing work.

## The throughline

Every one of these is the same shape: **a human (or org) grants a named
non-human actor the minimum authority to do a specific thing, for a limited time,
verifiable by the far side, watchable and revocable by the grantor, and logged
forever.** Build that primitive well once, and payments is just the first app on
top of it.
