// Builds the reports your dashboard consumes: monthly totals, per-bus
// breakdowns, and an overall fleet summary.
import * as store from '../store.js';

const monthKey = (dateStr) => dateStr.slice(0, 7); // "2026-06"

function emptyTotals() {
  return { count: 0, amount: 0, pending: 0, pendingAmount: 0, paid: 0 };
}

function accumulate(totals, c) {
  totals.count += 1;
  totals.amount += c.amount;
  if (c.status.toLowerCase() === 'paid') totals.paid += 1;
  else {
    totals.pending += 1;
    totals.pendingAmount += c.amount;
  }
  return totals;
}

// Last N month keys ending with the current month, oldest first.
function recentMonthKeys(n) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// Monthly totals for the whole fleet (or one bus if `bus` is given).
export function monthlyReport({ bus, months = 6 } = {}) {
  const challans = store.listChallans(bus ? { bus } : {});
  const buckets = new Map();
  for (const c of challans) {
    const key = monthKey(c.date);
    if (!buckets.has(key)) buckets.set(key, emptyTotals());
    accumulate(buckets.get(key), c);
  }
  const wanted = recentMonthKeys(months);
  return wanted.map((month) => ({
    month,
    ...(buckets.get(month) || emptyTotals()),
  }));
}

// Full report for one bus: totals + monthly breakdown + raw challans.
export function busReport(number) {
  const bus = store.getBus(number);
  if (!bus) return null;
  const challans = store.listChallans({ bus: number });
  const totals = challans.reduce(accumulate, emptyTotals());
  return {
    bus,
    totals,
    monthly: monthlyReport({ bus: number, months: 6 }),
    challans,
  };
}

// Per-bus totals across the fleet — one row per bus.
export function fleetByBus() {
  const buses = store.listBuses();
  return buses.map((bus) => {
    const challans = store.listChallans({ bus: bus.number });
    const totals = challans.reduce(accumulate, emptyTotals());
    return { number: bus.number, name: bus.name, ...totals };
  });
}

// Top-level summary card for the dashboard.
export function summary() {
  const buses = store.listBuses();
  const all = store.listChallans();
  const totals = all.reduce(accumulate, emptyTotals());
  const thisMonth = monthKey(new Date().toISOString().slice(0, 10));
  const monthChallans = all.filter((c) => c.date.startsWith(thisMonth));
  const monthTotals = monthChallans.reduce(accumulate, emptyTotals());
  return {
    buses: buses.length,
    lastRefresh: store.getMeta().lastRefresh,
    allTime: totals,
    thisMonth: { month: thisMonth, ...monthTotals },
  };
}
