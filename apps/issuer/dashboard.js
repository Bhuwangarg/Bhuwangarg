// Live dashboard for the Aegis authorization server. Renders current mandates,
// their budgets, velocity, and audit trail — the "control panel" a human uses
// to see and pull what their agents can do.

import { money } from "../../src/protocol/constraints.js";

export function renderDashboard({ store, principals, authority }) {
  const mandates = [...store.mandates.values()];
  const rows = mandates
    .map((m) => {
      const ledger = store.ledger(m.id);
      const revoked = store.isRevoked(m.id);
      const cap = m.scope.max_total;
      const pct = typeof cap === "number" && cap > 0 ? Math.min(100, (ledger.spent / cap) * 100) : 0;
      const actions = ledger.actions
        .map(
          (a) =>
            `<li><code>${esc(a.action.kind)}</code> ${esc(a.action.description || "")} ·
             <b>${esc(money(a.action.amount || 0, m.scope.currency))}</b>
             <span class="muted">@ ${esc(a.action.domain)}</span></li>`,
        )
        .join("");
      return `
      <div class="card ${revoked ? "revoked" : ""}">
        <div class="head">
          <div>
            <div class="agent">${esc(m.agent.name)}</div>
            <div class="muted mono">${esc(m.id)}</div>
          </div>
          <div class="status">${revoked ? "REVOKED" : "ACTIVE"}</div>
        </div>
        <div class="muted">granted by ${esc(m.principal.name)} · expires ${new Date(
          m.expires_at * 1000,
        ).toLocaleString()}</div>
        <div class="scope">
          can <b>${esc((m.scope.actions || []).join(", "))}</b> at
          <b>${esc(fmtList(m.scope.allowed_domains))}</b>
          (${esc(fmtList(m.scope.merchant_categories))})
        </div>
        <div class="budget">
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="muted">${esc(money(ledger.spent, m.scope.currency))} of
            ${esc(money(cap || 0, m.scope.currency))} used ·
            cap ${esc(money(m.scope.max_per_transaction || 0, m.scope.currency))}/txn</div>
        </div>
        <ul class="actions">${actions || '<li class="muted">no activity yet</li>'}</ul>
      </div>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>Aegis — agent control panel</title>
  <meta http-equiv="refresh" content="3">
  <style>
    body{font:15px/1.5 -apple-system,system-ui,sans-serif;background:#0b0d12;color:#e7eaf0;margin:0;padding:32px}
    h1{font-size:22px;margin:0 0 2px} .sub{color:#8b93a7;margin:0 0 24px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
    .card{background:#151926;border:1px solid #232838;border-radius:14px;padding:18px}
    .card.revoked{opacity:.55;border-color:#5b2330}
    .head{display:flex;justify-content:space-between;align-items:flex-start}
    .agent{font-weight:600;font-size:16px}
    .status{font-size:11px;letter-spacing:.08em;color:#3fb98a}
    .card.revoked .status{color:#e0667a}
    .muted{color:#8b93a7;font-size:13px} .mono{font-family:ui-monospace,monospace;font-size:11px}
    .scope{margin:10px 0;padding:10px;background:#0f1320;border-radius:8px;font-size:13px}
    .bar{height:6px;background:#0f1320;border-radius:4px;overflow:hidden;margin:4px 0}
    .fill{height:100%;background:linear-gradient(90deg,#3fb98a,#5bd1ff)}
    ul.actions{list-style:none;padding:0;margin:8px 0 0;font-size:13px}
    ul.actions li{padding:4px 0;border-top:1px solid #1c2233}
    code{background:#0f1320;padding:1px 5px;border-radius:4px;font-size:12px}
    .empty{color:#8b93a7;padding:40px;text-align:center}
  </style></head><body>
  <h1>Aegis · agent control panel</h1>
  <p class="sub">${mandates.length} mandate(s) · authority <span class="mono">${esc(
    authority.did,
  )}</span> · auto-refreshes</p>
  <div class="grid">${rows || '<div class="empty">No mandates yet. Run <code>npm run demo</code> or the live flow.</div>'}</div>
  </body></html>`;
}

function fmtList(v) {
  if (v === "*") return "any";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
