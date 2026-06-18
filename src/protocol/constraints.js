// Aegis protocol — policy enforcement.
//
// Given a cryptographically-valid {mandate, action} pair, decide whether the
// action is actually *allowed* by the scope the human granted. This is pure
// and stateless except for the running totals the caller passes in (cumulative
// spend + recent transaction timestamps), which live in the authorization
// server's ledger.

export function checkScope({ mandate, action, ledger, now = Date.now() }) {
  const s = mandate.scope;
  const nowSec = Math.floor(now / 1000);
  const reasons = [];

  // Action kind must be permitted.
  if (!Array.isArray(s.actions) || !s.actions.includes(action.kind)) {
    reasons.push(`action "${action.kind}" not in mandate scope`);
  }

  // Domain allow-list ("*" means any).
  if (s.allowed_domains !== "*" && !asArray(s.allowed_domains).includes(action.domain)) {
    reasons.push(`domain "${action.domain}" not allowed`);
  }

  // Merchant category allow-list ("*" means any).
  if (
    action.merchant_category !== undefined &&
    s.merchant_categories !== "*" &&
    !asArray(s.merchant_categories).includes(action.merchant_category)
  ) {
    reasons.push(`merchant category "${action.merchant_category}" not allowed`);
  }

  // Money checks only apply to actions that carry an amount.
  if (typeof action.amount === "number") {
    if (action.currency !== s.currency) {
      reasons.push(`currency "${action.currency}" != mandate currency "${s.currency}"`);
    }
    if (typeof s.max_per_transaction === "number" && action.amount > s.max_per_transaction) {
      reasons.push(
        `amount ${money(action.amount)} exceeds per-transaction cap ${money(s.max_per_transaction)}`,
      );
    }
    const spent = ledger?.spent ?? 0;
    if (typeof s.max_total === "number" && spent + action.amount > s.max_total) {
      reasons.push(
        `amount ${money(action.amount)} would exceed remaining budget ` +
          `${money(Math.max(0, s.max_total - spent))} (cap ${money(s.max_total)})`,
      );
    }
  }

  // Velocity: no more than N transactions per rolling window.
  if (s.velocity && ledger?.timestamps) {
    const windowStart = nowSec - s.velocity.window_seconds;
    const recent = ledger.timestamps.filter((t) => t >= windowStart).length;
    if (recent >= s.velocity.max_transactions) {
      reasons.push(
        `velocity limit reached: ${s.velocity.max_transactions} actions per ` +
          `${s.velocity.window_seconds}s`,
      );
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

function asArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

export function money(cents, currency = "USD") {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
