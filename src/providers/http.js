// Real provider: calls a third-party e-challan API and normalizes the
// response into our internal challan shape.
//
// The official Parivahan portal (echallan.parivahan.gov.in) is captcha-
// protected and has no open API, so production fleets use a licensed
// reseller such as Surepass, APIClub, or a RapidAPI vendor. Those all accept
// a vehicle number and return a list of challans — only the field names and
// auth header differ, which is why this adapter is configurable via .env.
import { config } from '../config.js';

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const { auth, apiKey } = config.http;
  if (!apiKey) return headers;
  if (auth === 'bearer') headers.Authorization = `Bearer ${apiKey}`;
  else if (auth === 'token') headers.token = apiKey;
  else headers['x-api-key'] = apiKey;
  return headers;
}

// Map a provider's raw challan object onto our normalized shape. Handles the
// most common field names across vendors; unknown shapes fall back to sane
// defaults so a single odd record never crashes a refresh.
function normalizeChallan(raw, vehicleNumber, index) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw && raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
    }
    return undefined;
  };
  const date = pick('challan_date', 'date', 'challanDate', 'offense_date');
  const isoDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return {
    id:
      pick('id', 'challan_no', 'challanNo', 'challan_number') ||
      `${vehicleNumber}-${isoDate}-${index}`,
    challanNo: pick('challan_no', 'challanNo', 'challan_number', 'id') || '',
    date: isoDate,
    amount: Number(pick('amount', 'fine_amount', 'challan_amount', 'penalty')) || 0,
    offence: pick('offence', 'offense', 'violation', 'accused_name_offence', 'reason') || 'Unknown',
    status: String(pick('status', 'challan_status', 'state') || 'Pending'),
    location: pick('location', 'area', 'place', 'address') || '',
    source: 'http',
  };
}

// Different vendors nest the array differently. Find the first array of objects.
function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['challans', 'data', 'result', 'results', 'records', 'response']) {
    const v = payload[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const nested = extractList(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

export async function fetchChallans(vehicleNumber) {
  const { url, mode, vehicleField } = config.http;
  if (!url) throw new Error('CHALLAN_API_URL is not configured');

  let response;
  if (mode === 'query') {
    const u = new URL(url);
    u.searchParams.set(vehicleField, vehicleNumber);
    response = await fetch(u, { method: 'GET', headers: buildHeaders() });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ [vehicleField]: vehicleNumber }),
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Provider responded ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  const list = extractList(payload);
  return list.map((raw, i) => normalizeChallan(raw, vehicleNumber, i));
}
