# Euro Gems — bilingual WhatsApp bot

A greeting-triggered, **English/Italian** WhatsApp auto-reply bot for Euro Gems
(gemstone & diamond jeweller). It guides a customer from a greeting to a warm
**live-agent handoff**, remembers the stone they chose last time, and saves
three attributes (`preferred_language`, `last_stone`, `showroom`).

Runs **standalone on the WhatsApp Cloud API** (zero runtime dependencies) or
ports straight into **zappie** — the flow lives as plain data in `src/flow.js`.

## Try it with no setup

```bash
npm run sim     # plays 3 full conversations through the real engine
npm test        # 8 tests: bilingual, welcome-back, handoff, payload limits
```

## Run it for real

```bash
export WHATSAPP_TOKEN=... PHONE_NUMBER_ID=... VERIFY_TOKEN=euro-gems-2026
npm start
```

Then point Meta's webhook at `https://<host>/webhook`. Full steps in
[`GO-LIVE.md`](GO-LIVE.md).

## The flow

```
greeting keyword ─▶ Language (EN/IT)
                      │
          last_stone? ┤ yes ─▶ Welcome back ─ Yes ─▶ Showroom
                      │                       └ Explore ─▶ Main menu
                      └ no ─▶ Main menu
Main menu ─▶ Collections ─▶ { Precious | Diamond | Semi-precious | Others }
                                   └▶ pick a stone (saves last_stone)
                                          └▶ Showroom (Milan/Valenza, saves showroom)
                                                 └▶ "Our agent will connect…" + transfer
```

Every message exists in English and Italian; after the language step the bot
replies only in the chosen language. English & Italian only — no other languages.

## Files

| File | What it is |
|---|---|
| `src/flow.js` | The conversation as data — all EN/IT copy, options, routing, attribute writes. **Port this into zappie.** |
| `src/engine.js` | Pure state machine: (state, message) → replies + attribute updates + handoff. No I/O. |
| `src/whatsapp.js` | Builds WhatsApp Graph API payloads (buttons/lists, respecting the 3-button / 10-row / title-length limits) and sends them. |
| `src/server.js` | Webhook server: Meta verification, inbound → engine → replies, `/inbox` for handed-off chats. |
| `src/sim.js` | Offline simulator — proves the flow with no tokens. |
| `test/flow.test.js` | Automated tests. |
| `GO-LIVE.md` | Credentials + deploy + webhook + smoke-test runbook. |

## Design notes

- `last_stone` is stored as an attribute **value** (e.g. `Ruby`), not a tag, so
  it can be printed back into the Welcome-back message via `{{last_stone}}`.
- Custom order / Book a visit / Talk to team route to the showroom + handoff as a
  sensible default (they weren't detailed in the original spec) — adjust in
  `src/flow.js`.
- Contact state is in-memory; persist it to a DB for production so returning
  customers are remembered across restarts.
