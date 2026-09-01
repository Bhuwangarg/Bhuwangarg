// Euro Gems — conversation engine.
//
// Pure logic: given a contact's stored state and one incoming message, it
// produces the outbound messages to send, the attribute updates to persist, and
// whether to hand off to a live agent. It performs NO network I/O, so it is
// fully unit-testable and identical whether driven by the live webhook
// (src/server.js) or the offline simulator (src/sim.js).

import { NODES, TRIGGER_KEYWORDS, ENTRY_NODE } from "./flow.js";

export function freshState() {
  return { node: null, lang: "en", attrs: {}, handoff: false };
}

function isTrigger(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return TRIGGER_KEYWORDS.includes(t);
}

function fill(template, attrs) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => attrs[k] ?? "");
}

// Render a node into an abstract outbound message (transport-agnostic).
function render(nodeId, state) {
  const node = NODES[nodeId];
  const lang = node.bilingual ? null : state.lang;
  const line = (obj) => (lang ? obj[lang] : `${obj.en}\n${obj.it}`);
  const text = fill(node.type === "list" ? line(node.text) : line(node.text), state.attrs);

  if (node.type === "buttons") {
    return {
      kind: "buttons",
      node: nodeId,
      text,
      buttons: node.options.map((o) => ({ id: o.id, title: node.bilingual ? o.label.en : o.label[state.lang] })),
    };
  }
  if (node.type === "list") {
    return {
      kind: "list",
      node: nodeId,
      header: line(node.header),
      text,
      button: line(node.listButton),
      rows: node.options.map((o) => ({ id: o.id, title: o.label[state.lang] })),
    };
  }
  // handoff
  return { kind: "text", node: nodeId, text, transfer: true };
}

// Walk logical branch nodes until we reach a node that emits a message.
function advance(nodeId, state) {
  const outbounds = [];
  let events = [];
  let current = nodeId;

  while (current) {
    const node = NODES[current];
    if (node.type === "branch") {
      current = node.branch(state.attrs);
      continue;
    }
    state.node = current;
    const out = render(current, state);
    outbounds.push(out);
    if (out.transfer) {
      state.handoff = true;
      events.push({ type: "transfer_to_agent", showroom: state.attrs.showroom ?? null, stone: state.attrs.last_stone ?? null });
    }
    break; // stop after the first message-emitting node
  }
  return { outbounds, events };
}

// Main entry. `input` is { type: "text", text } or { type: "reply", id }.
// Returns { outbounds, state, events }.
export function handle(state, input) {
  state = state || freshState();

  // A trigger keyword (re)starts the flow from the top, even mid-handoff.
  if (input.type === "text" && isTrigger(input.text)) {
    state.node = ENTRY_NODE;
    return { ...advance(ENTRY_NODE, state), state };
  }

  // If a human agent has taken over, the bot stays quiet unless re-triggered.
  if (state.handoff) return { outbounds: [], events: [], state };

  // Expecting a button/list reply for the current node.
  if (input.type === "reply" && state.node && NODES[state.node]?.options) {
    const option = NODES[state.node].options.find((o) => o.id === input.id);
    if (option) {
      if (option.set) {
        Object.assign(state.attrs, option.set);
        if (option.set.preferred_language) {
          state.lang = option.set.preferred_language === "Italian" ? "it" : "en";
        }
      }
      return { ...advance(option.next, state), state };
    }
  }

  // Anything else before the flow has started: greet.
  if (!state.node) {
    state.node = ENTRY_NODE;
    return { ...advance(ENTRY_NODE, state), state };
  }

  // Fallback: unrecognized input mid-flow — re-send the current prompt.
  return { outbounds: [render(state.node, state)], events: [], state };
}
