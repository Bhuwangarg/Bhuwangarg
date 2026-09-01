import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, freshState } from "../src/engine.js";
import { toPayload } from "../src/whatsapp.js";

const reply = (s, id) => handle(s, { type: "reply", id });
const text = (s, t) => handle(s, { type: "text", text: t });

test("greeting keyword starts the flow with a bilingual language prompt", () => {
  const r = text(freshState(), "ciao");
  assert.equal(r.outbounds[0].kind, "buttons");
  assert.match(r.outbounds[0].text, /Welcome to Euro Gems/);
  assert.match(r.outbounds[0].text, /Benvenuto in Euro Gems/);
});

test("English path saves stone + showroom and hands off", () => {
  let r = text(freshState(), "hi");
  r = reply(r.state, "lang_en");
  assert.equal(r.outbounds[0].kind, "list"); // main menu
  r = reply(r.state, "m_collections");
  r = reply(r.state, "c_precious");
  r = reply(r.state, "p_emerald");
  assert.equal(r.state.attrs.last_stone, "Emerald");
  assert.equal(r.outbounds[0].node, "showroom");
  r = reply(r.state, "sh_milan");
  assert.equal(r.state.attrs.showroom, "Milan");
  assert.equal(r.state.handoff, true);
  assert.match(r.outbounds[0].text, /Our agent will connect/);
});

test("Italian language choice renders Italian copy", () => {
  let r = text(freshState(), "start");
  r = reply(r.state, "lang_it");
  assert.match(r.outbounds[0].text, /Come possiamo aiutarti/);
});

test("returning customer gets Welcome back with saved stone", () => {
  const s = freshState();
  s.attrs.last_stone = "Ruby";
  let r = text(s, "hello");
  r = reply(r.state, "lang_en");
  assert.equal(r.outbounds[0].node, "welcome_back");
  assert.match(r.outbounds[0].text, /Last time you chose Ruby/);
});

test("Welcome back → Yes goes straight to showroom keeping the stone", () => {
  const s = freshState();
  s.attrs.last_stone = "Sapphire";
  let r = text(s, "hi");
  r = reply(r.state, "lang_en");
  r = reply(r.state, "wb_yes");
  assert.equal(r.outbounds[0].node, "showroom");
  assert.equal(r.state.attrs.last_stone, "Sapphire");
});

test("diamond subtype saves a descriptive stone name", () => {
  let r = text(freshState(), "hi");
  r = reply(r.state, "lang_en");
  r = reply(r.state, "m_collections");
  r = reply(r.state, "c_diamond");
  r = reply(r.state, "d_drops");
  assert.equal(r.state.attrs.last_stone, "Drops & Briolette Diamond");
});

test("after handoff the bot stays silent until re-triggered", () => {
  let r = text(freshState(), "hi");
  r = reply(r.state, "lang_en");
  r = reply(r.state, "m_team"); // straight to handoff
  assert.equal(r.state.handoff, true);
  const quiet = handle(r.state, { type: "text", text: "are you there?" });
  assert.equal(quiet.outbounds.length, 0);
  const restart = handle(r.state, { type: "text", text: "menu" });
  assert.ok(restart.outbounds.length > 0);
});

test("list payloads respect WhatsApp's 10-row limit and 24-char titles", () => {
  let r = text(freshState(), "hi");
  r = reply(r.state, "lang_en");
  r = reply(r.state, "m_collections");
  r = reply(r.state, "c_diamond");
  const payload = toPayload("15551230000", r.outbounds[0]);
  const rows = payload.interactive.action.sections[0].rows;
  assert.equal(rows.length, 8);
  assert.ok(rows.every((row) => row.title.length <= 24));
});
