// Pure, dependency-free fare math. Kept separate from the UI so it is
// trivial to unit-test and review in isolation.

export interface FareInput {
  /** Road distance for the trip, in kilometres. */
  distanceKm: number;
  /** Operator's preferred rate charged per kilometre, in rupees. */
  ratePerKm: number;
  /** Toll tax + any extra charges for the trip, in rupees. */
  tollAmount?: number;
}

export interface FareBreakdown {
  distanceKm: number;
  ratePerKm: number;
  /** distanceKm * ratePerKm, rounded to the nearest rupee. */
  distanceCost: number;
  tollAmount: number;
  /** Grand total charged to the customer, rounded to the nearest rupee. */
  total: number;
}

/** Coerce arbitrary input into a non-negative finite number (0 otherwise). */
export function toNonNegativeNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Compute the total fare for a trip.
 *
 * total = round(distanceKm * ratePerKm) + round(tollAmount)
 *
 * Every input is sanitised to a non-negative number first, so bad or empty
 * fields degrade to 0 rather than producing NaN.
 */
export function computeFare(input: FareInput): FareBreakdown {
  const distanceKm = toNonNegativeNumber(input.distanceKm);
  const ratePerKm = toNonNegativeNumber(input.ratePerKm);
  const tollAmount = Math.round(toNonNegativeNumber(input.tollAmount));

  const distanceCost = Math.round(distanceKm * ratePerKm);
  const total = distanceCost + tollAmount;

  return { distanceKm, ratePerKm, distanceCost, tollAmount, total };
}

/** Format a whole-rupee amount for display, e.g. 12500 -> "₹12,500". */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Format a per-km rate, preserving up to 2 decimals, e.g. 12.5 -> "₹12.5".
 * Unlike {@link formatINR}, this does NOT round — a fractional rate like
 * ₹12.50/km must be shown exactly, or the quote breakdown contradicts itself.
 */
export function formatRate(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

/** Format a distance for display, e.g. 267.4 -> "267.4 km". */
export function formatKm(km: number): string {
  const safe = Number.isFinite(km) ? km : 0;
  return `${safe.toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })} km`;
}
