// Mock provider: generates realistic, deterministic challan data for a
// vehicle so the dashboard and reports work end-to-end without any internet
// connection or paid API. The same vehicle number always yields the same
// data, which keeps demos and tests stable.

const OFFENCES = [
  { offence: 'Over speeding', amount: 1000 },
  { offence: 'Without seat belt', amount: 500 },
  { offence: 'Signal jumping', amount: 1000 },
  { offence: 'Improper parking', amount: 500 },
  { offence: 'Overloading', amount: 2000 },
  { offence: 'Using mobile while driving', amount: 1000 },
  { offence: 'Driving without valid permit', amount: 1500 },
];

const STATUSES = ['Pending', 'Pending', 'Paid', 'Disposed'];
const PLACES = ['NH-48 Toll', 'City Center', 'Ring Road', 'Bus Stand Rd', 'Sector 9 Crossing'];

// Simple deterministic hash so output is stable per vehicle number.
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export async function fetchChallans(vehicleNumber) {
  const rng = makeRng(seedFrom(vehicleNumber));
  const out = [];
  const now = new Date();

  // Spread challans across the last 6 months.
  for (let monthsAgo = 0; monthsAgo < 6; monthsAgo++) {
    const count = Math.floor(rng() * 3); // 0..2 challans per month
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1 + Math.floor(rng() * 27));
      const off = OFFENCES[Math.floor(rng() * OFFENCES.length)];
      const status = STATUSES[Math.floor(rng() * STATUSES.length)];
      const date = d.toISOString().slice(0, 10);
      out.push({
        id: `MOCK-${vehicleNumber}-${date}-${i}`,
        challanNo: `CH${seedFrom(vehicleNumber + date + i) % 1_000_000_000}`,
        date,
        amount: off.amount,
        offence: off.offence,
        status,
        location: PLACES[Math.floor(rng() * PLACES.length)],
        source: 'mock',
      });
    }
  }
  return out;
}
