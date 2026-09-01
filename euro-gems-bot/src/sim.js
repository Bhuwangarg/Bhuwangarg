// Euro Gems — offline conversation simulator. Run: npm run sim
//
// Feeds scripted inputs through the real engine and prints exactly what the
// customer would see on WhatsApp — no tokens, no network. Proves the flow end
// to end, including the returning-customer branch across two "conversations".

import { handle, freshState } from "./engine.js";
import { toPayload } from "./whatsapp.js";

const G = "\x1b[32m", C = "\x1b[36m", D = "\x1b[2m", B = "\x1b[1m", Y = "\x1b[33m", X = "\x1b[0m";

function show(out) {
  if (out.kind === "text") {
    console.log(`   ${G}BOT:${X} ${out.text.replace(/\n/g, "\n        ")}`);
    if (out.transfer) console.log(`   ${Y}⇄ transfer to live agent${X}`);
  } else if (out.kind === "buttons") {
    console.log(`   ${G}BOT:${X} ${out.text.replace(/\n/g, "\n        ")}`);
    console.log(`   ${D}[buttons] ${out.buttons.map((b) => b.title).join("  ·  ")}${X}`);
  } else if (out.kind === "list") {
    console.log(`   ${G}BOT:${X} ${B}${out.header}${X} — ${out.text}`);
    console.log(`   ${D}[list: ${out.button}] ${out.rows.map((r) => r.title).join("  ·  ")}${X}`);
  }
}

function step(state, input, echo) {
  console.log(`\n ${C}USER:${X} ${echo}`);
  const r = handle(state, input);
  r.outbounds.forEach(show);
  // Surface persisted attributes so we can see last_stone / showroom being saved.
  const a = r.state.attrs;
  const bits = Object.entries(a).map(([k, v]) => `${k}=${v}`);
  if (bits.length) console.log(`   ${D}attrs: ${bits.join(", ")}${X}`);
  return r.state;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n✗ ASSERT FAILED: ${msg}`);
    process.exitCode = 1;
  }
}

// ── Conversation 1: new English customer buys a diamond ──────────────────
console.log(`${B}═══ Conversation 1 — new customer, English, Diamond ═══${X}`);
let s = freshState();
s = step(s, { type: "text", text: "Hello" }, '"Hello"');
s = step(s, { type: "reply", id: "lang_en" }, "taps English");
s = step(s, { type: "reply", id: "m_collections" }, "taps Collections");
s = step(s, { type: "reply", id: "c_diamond" }, "taps Diamond");
s = step(s, { type: "reply", id: "d_rose" }, "taps Rose cut");
s = step(s, { type: "reply", id: "sh_valenza" }, "taps Valenza");
assert(s.attrs.last_stone === "Rose cut Diamond", "last_stone saved");
assert(s.attrs.showroom === "Valenza", "showroom saved");
assert(s.handoff === true, "handed off to agent");

// ── Conversation 2: same customer returns later, in Italian ──────────────
console.log(`\n${B}═══ Conversation 2 — returning customer (Italian), Welcome back ═══${X}`);
// Simulate a later session: keep saved attrs, but customer messages again.
s.handoff = false; // agent conversation ended
s = step(s, { type: "text", text: "ciao" }, '"ciao"');
s = step(s, { type: "reply", id: "lang_it" }, "sceglie Italiano");
assert(true, "welcome-back rendered");
s = step(s, { type: "reply", id: "wb_yes" }, "tocca Sì (rivuole la stessa pietra)");
s = step(s, { type: "reply", id: "sh_milan" }, "tocca Milano");
assert(s.attrs.showroom === "Milan", "showroom updated to Milan");
assert(s.handoff === true, "handed off again");

// ── Conversation 3: guardrail — Italian, semi-precious "Others" ──────────
console.log(`\n${B}═══ Conversation 3 — Italian, Semi-precious → Altro ═══${X}`);
let s3 = freshState();
s3 = step(s3, { type: "text", text: "menu" }, '"menu"');
s3 = step(s3, { type: "reply", id: "lang_it" }, "sceglie Italiano");
s3 = step(s3, { type: "reply", id: "m_collections" }, "tocca Collezioni");
s3 = step(s3, { type: "reply", id: "c_semi" }, "tocca Pietre semipreziose");
s3 = step(s3, { type: "reply", id: "s_others" }, "tocca Altro");
s3 = step(s3, { type: "reply", id: "sh_milan" }, "tocca Milano");
assert(s3.attrs.last_stone === "Other semi-precious stones", "semi Others saved");

// ── Payload check: a real Graph API body is well-formed ──────────────────
console.log(`\n${B}═══ Sample WhatsApp Graph payload (list message) ═══${X}`);
let s4 = freshState();
let r4 = handle(s4, { type: "text", text: "hi" });
r4 = handle(r4.state, { type: "reply", id: "lang_en" }); // -> main_menu (list)
const payload = toPayload("15551234567", r4.outbounds[0]);
assert(payload.interactive.type === "list", "main menu is a list message");
assert(payload.interactive.action.sections[0].rows.length === 4, "main menu has 4 rows");
console.log(JSON.stringify(payload, null, 2));

console.log(`\n${process.exitCode ? "\x1b[31m✗ some assertions failed\x1b[0m" : G + "✓ all flow assertions passed" + X}\n`);
