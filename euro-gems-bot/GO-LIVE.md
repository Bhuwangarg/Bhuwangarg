# Euro Gems bot — go-live runbook

The code is done and tested. These are the steps that need **your** WhatsApp/Meta
credentials — they can only run where the bot (or zappie) is hosted, not from a
sandbox. Follow top to bottom.

## 0. What you need in hand
- Euro Gems' **Meta Business** account (already verified ✅)
- A **WhatsApp Business phone number** on the **Cloud API** (not the consumer app)
- Admin access to the Meta App → WhatsApp product

## 1. Get the WhatsApp Cloud API credentials
In Meta → your App → **WhatsApp → API Setup**:
- Copy the **Phone number ID** → `PHONE_NUMBER_ID`
- Generate a **permanent access token** (System User token with `whatsapp_business_messaging`) → `WHATSAPP_TOKEN`
- Choose any secret string for `VERIFY_TOKEN` (e.g. `euro-gems-2026`)

## 2. Deploy the bot
Any Node ≥18 host (Render, Railway, Fly, a VPS). Set these env vars:

```
WHATSAPP_TOKEN=<permanent token>
PHONE_NUMBER_ID=<phone number id>
VERIFY_TOKEN=euro-gems-2026
GRAPH_VERSION=v21.0        # optional
PORT=8080                  # or whatever the host provides
```

Then:

```bash
npm start        # starts the webhook server
```

You now have a public URL like `https://euro-gems-bot.onrender.com`.

> **Already running zappie?** You don't need this server — port `src/flow.js`
> into your zappie flow builder (it's plain data), and let zappie's own webhook
> send the payloads that `src/whatsapp.js` builds. This server is the drop-in
> option if you'd rather run the flow standalone to cut even zappie's overhead.

## 3. Point Meta's webhook at it
In Meta → App → **WhatsApp → Configuration → Webhook**:
- **Callback URL:** `https://<your-host>/webhook`
- **Verify token:** the same `VERIFY_TOKEN`
- Click **Verify and save** (Meta calls `GET /webhook`; the server answers the challenge)
- **Subscribe** to the **messages** field

## 4. Smoke test with a real phone
- Save Euro Gems' number, send **“hi”** → you should get the language buttons
- Walk English: Collections → Diamond → Rose cut → Valenza → thank-you
- Send **“ciao”** again → **Welcome back!** with your saved stone (returning branch)
- Check `GET /inbox` → the handed-off conversation is listed for the agents

## 5. Wire up the human handoff
The bot flips a conversation to “agent” at the thank-you step and logs it
(`[handoff] …`) and exposes it at `GET /inbox`. Decide how Euro Gems' Milan &
Valenza staff pick these up:
- If running in **zappie**: use zappie's live-agent inbox / assignment.
- If standalone: point `/inbox` at a simple dashboard, or forward the handoff
  event to email/Slack/your CRM (one function in `src/server.js`).

## 6. Go live
- Move the number to a **verified/production** state in Meta (raise messaging
  limits as needed).
- Brief the client's staff on picking up transfers.
- Done — every greeting is answered instantly in the customer's language, and a
  human takes over the moment a stone + showroom are chosen.

## Notes
- **State is in-memory** in `src/server.js`. For production, persist `contacts`
  (and therefore `last_stone`) to a database so returning-customer memory
  survives restarts. The engine treats state as a plain object, so this is a
  small change to the store.
- Outside the 24-hour service window you must use an **approved template** to
  re-open a chat; inside it (the customer greeted you) everything here is free-form.
