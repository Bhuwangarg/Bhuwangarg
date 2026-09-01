// Euro Gems — WhatsApp Cloud API adapter.
//
// Turns the engine's abstract outbound messages into WhatsApp Graph API
// payloads and sends them. Split out so the engine stays transport-free and so
// the same logic could target zappie's own send layer instead.

const GRAPH_VERSION = process.env.GRAPH_VERSION || "v21.0";

// WhatsApp hard limits we must respect.
const BTN_TITLE_MAX = 20; // reply button title
const ROW_TITLE_MAX = 24; // list row title
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Build the Graph API `messages` body for one outbound + recipient.
export function toPayload(to, out) {
  if (out.kind === "text") {
    return { messaging_product: "whatsapp", to, type: "text", text: { body: out.text } };
  }
  if (out.kind === "buttons") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: out.text },
        action: {
          buttons: out.buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: clip(b.title, BTN_TITLE_MAX) },
          })),
        },
      },
    };
  }
  if (out.kind === "list") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: out.header ? { type: "text", text: clip(out.header, 60) } : undefined,
        body: { text: out.text },
        action: {
          button: clip(out.button, BTN_TITLE_MAX),
          sections: [{ rows: out.rows.slice(0, 10).map((r) => ({ id: r.id, title: clip(r.title, ROW_TITLE_MAX) })) }],
        },
      },
    };
  }
  throw new Error(`unknown outbound kind: ${out.kind}`);
}

// Send one outbound via the Graph API. Requires WHATSAPP_TOKEN + PHONE_NUMBER_ID.
export async function send(to, out) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_TOKEN and PHONE_NUMBER_ID must be set");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(toPayload(to, out)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp send failed ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// Parse an inbound WhatsApp webhook body into { from, input } or null.
export function parseInbound(body) {
  try {
    const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;
    const from = msg.from;
    if (msg.type === "text") return { from, input: { type: "text", text: msg.text.body } };
    if (msg.type === "interactive") {
      const i = msg.interactive;
      const id = i.button_reply?.id || i.list_reply?.id;
      if (id) return { from, input: { type: "reply", id } };
    }
    // Any other message type: treat its text-ish content as a plain message.
    return { from, input: { type: "text", text: "" } };
  } catch {
    return null;
  }
}
