import { NextResponse } from "next/server";

// Server-side road-distance lookup. Runs on the server (not the browser) so we
// can set the User-Agent that Nominatim requires and avoid CORS issues.
//
// Pipeline:
//   1. Geocode each place name -> lat/lon via OpenStreetMap Nominatim.
//   2. Ask OSRM for the driving route between the two points.
// No API keys are needed. The distance is always editable in the UI, so this
// is a convenience helper, not a hard dependency.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

// A descriptive UA is required by the Nominatim usage policy.
const USER_AGENT =
  "BusFareCalculator/1.0 (self-hosted trip fare estimator)";

// Reject absurdly long inputs so a hostile caller can't inflate outbound
// requests to the free OSM services.
const MAX_QUERY_LEN = 120;

// Small in-memory cache so repeat/abusive queries don't re-hit the free OSM
// services (which rate-limit and ban abusers). Best-effort: on serverless it
// is per-instance, but it still absorbs the common case of the same route
// being priced repeatedly.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_MAX = 500;
const cache = new Map<string, { value: unknown; expires: number }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < performance.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, { value, expires: performance.now() + CACHE_TTL_MS });
}

interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

async function geocode(place: string): Promise<GeoPoint | null> {
  const cacheKey = `geo:${place.toLowerCase()}`;
  const cached = cacheGet<GeoPoint | null>(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${NOMINATIM}?q=${encodeURIComponent(
    place,
  )}&format=json&limit=1&countrycodes=in`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Do not cache geocoding at the fetch layer; place text varies.
    cache: "no-store",
  });
  // A transient HTTP error (429/5xx) must NOT be cached as "not found".
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!Array.isArray(data) || data.length === 0) {
    cacheSet(cacheKey, null); // genuinely no such place — safe to remember
    return null;
  }

  const first = data[0];
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const point: GeoPoint = { lat, lon, label: first.display_name };
  cacheSet(cacheKey, point);
  return point;
}

async function roadDistanceKm(a: GeoPoint, b: GeoPoint): Promise<number | null> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const cacheKey = `route:${coords}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${OSRM}/${coords}?overview=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ distance: number }>;
  };
  if (data.code !== "Ok" || !data.routes?.length) return null;

  const meters = data.routes[0].distance;
  if (!Number.isFinite(meters)) return null;

  const km = Math.round((meters / 1000) * 10) / 10; // km, 1 decimal
  cacheSet(cacheKey, km);
  return km;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "Please provide both 'from' and 'to' locations." },
      { status: 400 },
    );
  }

  if (from.length > MAX_QUERY_LEN || to.length > MAX_QUERY_LEN) {
    return NextResponse.json(
      { error: "Location names are too long. Use shorter place names." },
      { status: 400 },
    );
  }

  try {
    // Sequential, not Promise.all: Nominatim's usage policy allows only ~1
    // request/second, so firing both at once risks a 429 that surfaces as a
    // misleading "location not found".
    const origin = await geocode(from);
    const destination = await geocode(to);

    if (!origin) {
      return NextResponse.json(
        { error: `Could not find the location "${from}".` },
        { status: 404 },
      );
    }
    if (!destination) {
      return NextResponse.json(
        { error: `Could not find the location "${to}".` },
        { status: 404 },
      );
    }

    const distanceKm = await roadDistanceKm(origin, destination);
    if (distanceKm === null) {
      return NextResponse.json(
        {
          error:
            "Found both places but couldn't calculate a road route. Enter the distance manually.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      distanceKm,
      from: origin.label,
      to: destination.label,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Distance service is unavailable right now. Enter the distance manually.",
      },
      { status: 503 },
    );
  }
}
