// Orchestrates fetching challans from the active provider and saving them.
import { getProvider } from '../providers/index.js';
import * as store from '../store.js';

// Refresh a single bus. Returns a small result summary.
export async function refreshBus(number) {
  const bus = store.getBus(number);
  if (!bus) throw new Error(`Bus ${number} not found`);
  const provider = getProvider();
  try {
    const challans = await provider.fetchChallans(bus.number);
    const saved = store.replaceChallansForBus(bus.number, challans);
    return { bus: bus.number, ok: true, count: saved };
  } catch (err) {
    return { bus: bus.number, ok: false, error: err.message };
  }
}

// Refresh every bus in the fleet. Runs sequentially to stay gentle on the
// upstream provider's rate limits.
export async function refreshAll() {
  const buses = store.listBuses();
  const results = [];
  for (const bus of buses) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await refreshBus(bus.number));
  }
  const ts = new Date().toISOString();
  store.setLastRefresh(ts);
  return {
    refreshedAt: ts,
    buses: buses.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
