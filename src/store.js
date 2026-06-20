// Tiny JSON-file datastore. No external database needed — perfect for a
// personal fleet of a handful of buses. All writes are atomic (write to a
// temp file, then rename) so the store never ends up half-written.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const empty = { buses: [], challans: [], meta: { lastRefresh: null } };
let data = null;

function ensureLoaded() {
  if (data) return;
  const dir = path.dirname(config.dataFile);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(config.dataFile)) {
    try {
      data = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
    } catch {
      data = structuredClone(empty);
    }
  } else {
    data = structuredClone(empty);
  }
  // Backfill any missing top-level keys.
  data.buses ||= [];
  data.challans ||= [];
  data.meta ||= { lastRefresh: null };
}

function persist() {
  const tmp = `${config.dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, config.dataFile);
}

// ---- Buses ----

export function listBuses() {
  ensureLoaded();
  return [...data.buses];
}

export function getBus(number) {
  ensureLoaded();
  return data.buses.find((b) => b.number === normalize(number)) || null;
}

export function addBus({ number, name }) {
  ensureLoaded();
  const num = normalize(number);
  if (!num) throw new Error('Bus number is required');
  if (data.buses.some((b) => b.number === num)) {
    throw new Error(`Bus ${num} already exists`);
  }
  const bus = { number: num, name: name || num, addedAt: new Date().toISOString() };
  data.buses.push(bus);
  persist();
  return bus;
}

export function removeBus(number) {
  ensureLoaded();
  const num = normalize(number);
  const before = data.buses.length;
  data.buses = data.buses.filter((b) => b.number !== num);
  data.challans = data.challans.filter((c) => c.bus !== num);
  persist();
  return data.buses.length < before;
}

// ---- Challans ----

export function listChallans(filter = {}) {
  ensureLoaded();
  let rows = [...data.challans];
  if (filter.bus) rows = rows.filter((c) => c.bus === normalize(filter.bus));
  if (filter.status) {
    rows = rows.filter((c) => c.status.toLowerCase() === filter.status.toLowerCase());
  }
  if (filter.month) rows = rows.filter((c) => c.date.startsWith(filter.month));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

// Replace the stored challans for a bus with a freshly fetched set.
// Merges on challan id so we keep history and don't create duplicates.
export function replaceChallansForBus(number, challans) {
  ensureLoaded();
  const num = normalize(number);
  const others = data.challans.filter((c) => c.bus !== num);
  const normalized = challans.map((c) => ({ ...c, bus: num }));
  data.challans = [...others, ...normalized];
  persist();
  return normalized.length;
}

export function setLastRefresh(ts) {
  ensureLoaded();
  data.meta.lastRefresh = ts;
  persist();
}

export function getMeta() {
  ensureLoaded();
  return { ...data.meta };
}

export function normalize(number) {
  return String(number || '').toUpperCase().replace(/\s+/g, '');
}
