# Mahalaxmi Travels — Fleet Document Tracker

A bus-wise document & expiry tracker. Every bus in the **NEW BUS DOCUMENT**
Google Drive folder is listed with its key statutory documents
(Insurance, Fitness, Permit, Road Tax, PUC, RC). Expiry dates were seeded by
OCR-reading the latest scan of each document, and the app flags what is
**Expired**, **Expiring soon**, **Valid**, or **Missing** as of today.

## What it does
- **Attention list** — every document across the fleet, sorted so overdue and
  soon-to-expire items float to the top.
- **By bus** — one card per bus showing the status of each document.
- **Search / filter** by bus number, document type, and status.
- **Add / update document** — record a new expiry date, add a note, or attach a
  scan. New buses can be added by typing a new registration number.
- **View** — opens the source scan in Google Drive (or an uploaded file).

## Data
- `data/fleet.json` — the seed (buses + OCR-extracted expiry dates). Regenerate
  with the extraction pipeline, or edit in-app.
- Items flagged **⚠ verify** were low-confidence OCR — check the source scan.

## Storage
Out of the box the app is **local-first**: edits save in the browser, and you can
Export / Import a master JSON file to share.

### Turn on shared team sync (Supabase)
1. Create a free project at supabase.com.
2. In the SQL editor run:
   ```sql
   create table if not exists fleet_state (
     id text primary key,
     data jsonb,
     updated_at timestamptz default now()
   );
   alter table fleet_state enable row level security;
   create policy "team access" on fleet_state
     for all using (true) with check (true);
   ```
3. Copy your project **URL** and **anon public key** (Settings → API).
4. Either paste them in the app's **⚙ Settings → Connect shared team database**,
   or set them in `config.js` (`supabaseUrl`, `supabaseAnonKey`) and redeploy so
   every device is synced automatically.

The anon key is a public key protected by row-level security — it is designed to
ship in the client. For stricter access, tighten the RLS policy or add Supabase
Auth.
