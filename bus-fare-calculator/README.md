# Bus Fare Calculator

A tiny web app for a bus operator to turn a route into a customer quote in
seconds. Enter where the trip starts and ends, your rate per kilometre, and any
toll/extra charges — it shows the total to charge.

> **Formula:** `total = round(distance_km × rate_per_km) + round(toll)`

## Features

- **Auto distance** — type two place names and it fills the road distance from
  OpenStreetMap + OSRM (no API key). The number stays **editable**, so you
  always have the final say.
- **Manual override** — no internet lookup needed; just type the kilometres.
- **Toll & extras** — a separate field for toll tax, parking, permits, etc.
- **Live quote card** — total updates as you type, formatted in ₹ (Indian
  numbering).
- **Copy quote / Print** — hand the customer a clean quote.
- **Responsive + light/dark** — works on phone and desktop.

## Tech stack (gstack)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · deployed on
Vercel.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
```

## How it fits together

| Path                            | Role                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `src/lib/fare.ts`               | Pure fare math + ₹/km formatting (framework-free, testable)  |
| `src/app/page.tsx`              | The calculator UI (client component)                        |
| `src/app/api/distance/route.ts` | Server route: geocode place names → road distance           |

The distance lookup runs server-side so it can set the User-Agent that
Nominatim requires and avoid browser CORS issues. If the lookup ever fails, the
UI simply asks you to type the distance — the calculator keeps working.
