import { NextResponse } from "next/server";

// Turn GPS coordinates (from the browser's geolocation) into a readable
// address, so "Use my location" can show a real place name in the From field.
// Runs server-side to set the User-Agent that Nominatim requires.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "BusFareCalculator/1.0 (self-hosted trip fare estimator)";

// Build a short "locality, city" label from Nominatim's address parts, so the
// From field reads like "Bais Godam, Jaipur" instead of a full postal string.
function conciseLabel(
  address: Record<string, string> | undefined,
): string | null {
  if (!address) return null;
  const primary =
    address.neighbourhood ??
    address.suburb ??
    address.road ??
    address.village ??
    address.town ??
    address.city ??
    address.county;
  const secondary =
    address.city ?? address.town ?? address.state_district ?? address.state;
  const parts = [primary, secondary].filter(
    (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i,
  );
  return parts.length ? parts.join(", ") : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not look up that location." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };

    const label = conciseLabel(data.address) ?? data.display_name ?? null;
    if (!label) {
      return NextResponse.json(
        { error: "No address found for your location." },
        { status: 404 },
      );
    }

    return NextResponse.json({ label });
  } catch {
    return NextResponse.json(
      { error: "Location lookup is unavailable right now." },
      { status: 503 },
    );
  }
}
