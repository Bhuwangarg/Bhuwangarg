// Masters India e-Challan provider.
// https://docs.mastersindia.co/masters-india-apis/proof-of-delivery-pod-api/vehicle-e-challan
//
// Two-step flow:
//   1. POST /token-auth/ with { username, password } -> JWT access token (24h)
//   2. POST /ECHALLAN/ with Authorization: JWT <token> + Subid/Productid/Mode
//      headers and body { vehiclenumber }.
//
// The response splits records into Disposed_data and Pending_data arrays; we
// flatten and normalize both into our internal challan shape.
import { config } from '../config.js';

const mi = config.mastersIndia;

// Cache the JWT so we don't log in on every single vehicle lookup.
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt) return tokenCache.token;
  if (!mi.username || !mi.password) {
    throw new Error('MI_USERNAME / MI_PASSWORD are not configured');
  }

  const res = await fetch(mi.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: mi.username, password: mi.password }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const token = data.access_token || data.token || data.access || (data.data && data.data.access_token);
  if (!token) throw new Error('Auth response did not contain an access token');

  // Token is valid 24h; refresh a little early to be safe.
  tokenCache = { token, expiresAt: now + 23 * 60 * 60 * 1000 };
  return token;
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value).slice(0, 10)
    : d.toISOString().slice(0, 10);
}

function offenceText(raw) {
  const details = pick(raw, 'offence_details', 'offenceDetails');
  if (Array.isArray(details)) {
    return (
      details
        .map((o) => pick(o, 'description', 'offence', 'act') || '')
        .filter(Boolean)
        .join(', ') || 'Unknown'
    );
  }
  return pick(raw, 'offence', 'offense', 'violation', 'reason') || 'Unknown';
}

function normalize(raw, vehicleNumber, statusHint, index) {
  const date = toIsoDate(pick(raw, 'challan_date_time', 'challan_date', 'date'));
  return {
    id: pick(raw, 'challan_no', 'challan_number', 'id') || `${vehicleNumber}-${date}-${index}`,
    challanNo: pick(raw, 'challan_no', 'challan_number') || '',
    date,
    amount: Number(pick(raw, 'fine_imposed', 'fine_amount', 'amount', 'challan_amount')) || 0,
    offence: offenceText(raw),
    status: String(pick(raw, 'challan_status', 'status') || statusHint),
    location: pick(raw, 'location', 'area', 'place', 'address') || '',
    source: 'mastersindia',
  };
}

export async function fetchChallans(vehicleNumber) {
  const token = await getToken();
  const res = await fetch(mi.challanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${token}`,
      Subid: mi.subid,
      Productid: mi.productId,
      Mode: mi.mode,
    },
    body: JSON.stringify({ vehiclenumber: vehicleNumber }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`eChallan request failed (${res.status}): ${t.slice(0, 200)}`);
  }

  const payload = await res.json();
  // The actual records can be nested under data/result depending on plan.
  const root = payload.data || payload.result || payload;
  const pending = root.Pending_data || root.pending_data || [];
  const disposed = root.Disposed_data || root.disposed_data || [];

  // "305" inside a 200 means no records found — return an empty list cleanly.
  const code = String(pick(payload, 'code', 'status_code') || '');
  if (code === '305' && pending.length === 0 && disposed.length === 0) return [];

  return [
    ...pending.map((r, i) => normalize(r, vehicleNumber, 'Pending', i)),
    ...disposed.map((r, i) => normalize(r, vehicleNumber, 'Disposed', i)),
  ];
}
