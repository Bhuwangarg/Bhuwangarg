// InstantPay Vehicle Challan provider.
// https://developers.instantpay.in/reference/identity-verification-vehicle-challan
//
// Simpler than a token flow: authentication is via static headers
// (X-Ipay-Client-Id / X-Ipay-Client-Secret). One POST per vehicle returns the
// challan data, which we normalize into our internal shape.
import { config } from '../config.js';

const ip = config.instantPay;

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

// Find the first array of challan-like objects anywhere in the payload, since
// vendors nest it under different keys (challans / challanDetails / data...).
function extractList(node, depth = 0) {
  if (depth > 5 || node == null) return [];
  if (Array.isArray(node)) {
    return node.every((x) => x && typeof x === 'object') ? node : [];
  }
  if (typeof node !== 'object') return [];
  for (const key of ['challans', 'challanDetails', 'challanList', 'records', 'data', 'result']) {
    if (key in node) {
      const found = extractList(node[key], depth + 1);
      if (found.length) return found;
    }
  }
  for (const v of Object.values(node)) {
    const found = extractList(v, depth + 1);
    if (found.length) return found;
  }
  return [];
}

function normalize(raw, vehicleNumber, index) {
  const date = toIsoDate(
    pick(raw, 'challanDate', 'challan_date', 'date', 'offenseDate', 'challanDateTime')
  );
  const statusRaw = String(
    pick(raw, 'challanStatus', 'status', 'paymentStatus', 'challan_status') || 'Pending'
  );
  return {
    id: pick(raw, 'challanNo', 'challanNumber', 'challan_no', 'id') || `${vehicleNumber}-${date}-${index}`,
    challanNo: pick(raw, 'challanNo', 'challanNumber', 'challan_no') || '',
    date,
    amount: Number(pick(raw, 'amount', 'fineAmount', 'challanAmount', 'penalty', 'fine')) || 0,
    offence: pick(raw, 'offence', 'offense', 'violation', 'offenceDetails', 'reason') || 'Unknown',
    status: statusRaw,
    location: pick(raw, 'location', 'area', 'place', 'address', 'state') || '',
    source: 'instantpay',
  };
}

export async function fetchChallans(vehicleNumber) {
  if (!ip.clientId || !ip.clientSecret) {
    throw new Error('INSTANTPAY_CLIENT_ID / INSTANTPAY_CLIENT_SECRET are not configured');
  }

  const res = await fetch(ip.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ipay-Auth-Code': ip.authCode,
      'X-Ipay-Client-Id': ip.clientId,
      'X-Ipay-Client-Secret': ip.clientSecret,
      'X-Ipay-Endpoint-Ip': ip.endpointIp,
    },
    body: JSON.stringify({
      vehicleRegistrationNumber: vehicleNumber,
      latitude: ip.latitude,
      longitude: ip.longitude,
      externalRef: `challan-${Date.now()}`,
      consent: ip.consent,
    }),
  });

  const payload = await res.json().catch(() => ({}));

  // InstantPay wraps everything in an envelope; "SPS" = success. Anything else
  // carries a human-readable message in `status`.
  const code = String(pick(payload, 'statuscode', 'statusCode') || '');
  if (!res.ok || (code && code !== 'SPS')) {
    const msg = pick(payload, 'status', 'message') || `HTTP ${res.status}`;
    throw new Error(`InstantPay error: ${msg}`);
  }

  const list = extractList(payload.data || payload);
  return list.map((raw, i) => normalize(raw, vehicleNumber, i));
}
