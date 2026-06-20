# 🚌 Bus Challan Checker

An automatic e-challan (traffic fine) checker for a personal bus fleet. It
fetches challans for each bus, aggregates the **totals per month**, and serves
everything over a clean **REST API** you can plug straight into your own app
or dashboard. A small built-in dashboard is included so you can see it working.

> Built with **zero external dependencies** — just Node.js (v18+). No database,
> no build step. Data is kept in a single JSON file (`data/store.json`).

---

## What it does

- Track a list of buses by registration number.
- Automatically pull challans for every bus on a schedule (default: every 12h).
- Aggregate totals **per bus** and **per month** (count, amount, pending vs paid).
- Expose a JSON API your app/dashboard consumes.
- Ships with a demo dashboard at `/`.

---

## Quick start

```bash
cp .env.example .env        # configure (optional for a quick demo)
npm run seed                # add 3 sample buses + demo challans
npm start                   # http://localhost:3000
```

Open <http://localhost:3000> for the dashboard, or call the API directly.

By default it uses the **mock** provider, which generates realistic demo data
so everything works offline. To pull real challans, switch the provider (below).

---

## Connecting it to your app

Every endpoint returns JSON. Protect the API by setting `API_KEY` in `.env`;
then send it as the `x-api-key` header (or `?apiKey=` query param).

### Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET`  | `/health` | Liveness check (no auth) |
| `GET`  | `/api/buses` | List tracked buses |
| `POST` | `/api/buses` | Add a bus `{ "number": "RJ14PA1234", "name": "Bus 1" }` |
| `DELETE` | `/api/buses/:number` | Stop tracking a bus |
| `POST` | `/api/refresh` | Refresh challans for **all** buses now |
| `POST` | `/api/refresh/:number` | Refresh one bus now |
| `GET`  | `/api/challans?bus=&month=&status=` | Raw challan list with filters |
| `GET`  | `/api/reports/summary` | Fleet summary + this month's totals |
| `GET`  | `/api/reports/fleet` | Per-bus totals (one row per bus) |
| `GET`  | `/api/reports/monthly?months=6&bus=` | Monthly totals (fleet or one bus) |
| `GET`  | `/api/reports/bus/:number` | Full report for one bus |

### Example: monthly total for your dashboard

```bash
curl -H "x-api-key: YOUR_KEY" \
  "http://localhost:3000/api/reports/monthly?months=6"
```

```json
{
  "months": [
    { "month": "2026-06", "count": 5, "amount": 4000, "pending": 3, "pendingAmount": 2000, "paid": 2 }
  ]
}
```

### Example: pull it from your app (JS)

```js
const res = await fetch("http://localhost:3000/api/reports/summary", {
  headers: { "x-api-key": process.env.CHALLAN_API_KEY },
});
const data = await res.json();
// data.thisMonth.count, data.thisMonth.amount, data.allTime.pendingAmount ...
```

---

## Using real challan data

The official Parivahan portal (`echallan.parivahan.gov.in`) is captcha-protected
and has **no open API**, so real fleets use a licensed reseller (Surepass,
APIClub, RapidAPI vendors, etc.). They all take a vehicle number and return a
list of challans — only field names and auth headers differ. Point the adapter
at your provider in `.env`:

```env
CHALLAN_PROVIDER=http
CHALLAN_API_URL=https://api.your-provider.com/challan
CHALLAN_API_KEY=your-key
CHALLAN_API_MODE=body          # body (POST) or query (GET)
CHALLAN_API_VEHICLE_FIELD=vehicle_number
CHALLAN_API_AUTH=x-api-key     # bearer | x-api-key | token
```

The adapter (`src/providers/http.js`) auto-detects common response shapes and
field names. If your provider is unusual, tweak `normalizeChallan()` there.

---

## Automation

Refreshing is automatic — `src/scheduler.js` runs on startup and then every
`REFRESH_INTERVAL_HOURS`. For production, run it under a process manager
(`pm2`, `systemd`) or a container so it stays up and keeps the data fresh.

---

## Project layout

```
src/
  index.js                # entry: starts server + scheduler
  server.js               # zero-dep HTTP router, auth, static serving
  scheduler.js            # automatic periodic refresh
  config.js               # env config (+ tiny .env loader)
  store.js                # JSON-file datastore
  providers/
    mock.js               # offline demo data
    http.js               # real third-party API adapter
  services/
    challanService.js     # fetch + save
    reportService.js      # monthly / per-bus aggregation
public/index.html         # demo dashboard
scripts/seed.js           # sample data
test/api.test.js          # smoke tests
```

Run tests with `npm test`.

---

— Maintained by Bhuwan Garg · reach me at Bhuwan.garg1@gmail.com
