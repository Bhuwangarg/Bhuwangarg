// The "fully automatic" part: refreshes every bus on startup and then on a
// fixed interval, so the dashboard always shows fresh data without anyone
// pressing a button.
import { config } from './config.js';
import { refreshAll } from './services/challanService.js';

let timer = null;

export function startScheduler() {
  const intervalMs = Math.max(1, config.refreshIntervalHours) * 60 * 60 * 1000;

  const tick = async () => {
    try {
      const result = await refreshAll();
      console.log(
        `[scheduler] refreshed ${result.buses} bus(es): ${result.succeeded} ok, ${result.failed} failed`
      );
    } catch (e) {
      console.error('[scheduler] refresh failed:', e.message);
    }
  };

  if (config.refreshOnStart) {
    tick();
  }
  timer = setInterval(tick, intervalMs);
  // Don't keep the event loop alive solely for the timer in test scenarios.
  if (timer.unref) timer.unref();
  console.log(`[scheduler] auto-refresh every ${config.refreshIntervalHours}h`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
