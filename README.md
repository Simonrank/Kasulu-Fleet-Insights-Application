# Kasulu Fleet Reporting

Production-ready MVP for multipurpose fleet reporting — integrates with **Wialon** telematics and serves KPI dashboards, fuel theft analysis, driver incidents, and scheduled reports.

## Quick Start (Neon Postgres)

```bash
# 1. Install dependencies
npm install

# 2. Create a Neon project at https://console.neon.tech
#    Copy pooled + direct connection strings into .env (see docs/NEON.md)

cp .env.example .env
# Edit .env — set DATABASE_URL and DATABASE_URL_UNPOOLED from Neon

# 3. Push schema
npm run db:push

# 4. Configure data sources in .env (see .env.example)
#    - WIALON_TOKEN for live telemetry
#    - GOOGLE_SHEETS_SPREADSHEET_ID + service account credentials

# 5. Pull live data (clears demo dependency)
npm run db:clear   # optional — remove old seeded rows first
npm run sync       # Wialon + Google Sheets → Postgres

# 6. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Database setup guide:** [docs/NEON.md](docs/NEON.md)

### Optional: local Postgres via Docker

If you prefer a local database instead of Neon:

```bash
docker compose up -d
# Set DATABASE_URL=postgresql://kasulu:kasulu_dev@localhost:5432/kasulu_fleet
```

## Wialon Configuration

Add to `.env`:

```env
WIALON_API_URL=https://hst-api.wialon.com/wialon/ajax.html
WIALON_TOKEN=your_token_here
DATA_SOURCE=both
NEXT_PUBLIC_DUAL_SOURCE=true

# Report IDs from Wialon UI (resource, template, unit group)
WIALON_REPORT_RESOURCE_ID=
WIALON_REPORT_TEMPLATE_ID=
WIALON_REPORT_GROUP_ID=
WIALON_REPORT_TABLE_LABEL=
WIALON_REPORT_MAX_DAYS=7
```

Live dashboard pulls Wialon for the **same date range** as Google Sheets (one report per calendar day in the range). Toggle sources in the UI or call:

`GET /api/dashboard?from=&to=&source=wialon`  
`GET /api/wialon/live?from=&to=`

Trigger manual sync:

```bash
npm run sync          # Wialon + Google Sheets
npm run sync:wialon   # Wialon only
npm run sync:sheets   # Google Sheets only
# or POST /api/sync
```

## Google Sheets

1. Share your spreadsheet with `kasulu-fuel@kasulu.iam.gserviceaccount.com` (Viewer).
2. Set `GOOGLE_SHEETS_SPREADSHEET_ID` in `.env` (from the sheet URL).
3. Place service account JSON at `credentials/google-service-account.json` (or set `GOOGLE_APPLICATION_CREDENTIALS`).

Expected tabs (rename via env if different):

| Tab | Columns (header row) |
|-----|----------------------|
| **Units** | wialon_id, name, plate, driver, vehicle_type, category, status |
| **Fuel Events** | date, unit, event_type, volume, duration, location, description |
| **Driver Incidents** | date, unit, driver, incident_type, severity, value, threshold, location |
| **Daily Metrics** | date, unit, distance_km, engine_hours, fuel_consumed, fuel_filled |


## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── kpis/route.ts
│   │   ├── fuel-thefts/route.ts
│   │   ├── driver-incidents/route.ts
│   │   ├── reports/route.ts
│   │   ├── units/route.ts
│   │   └── sync/wialon/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── dashboard.tsx
│   │   ├── kpi-grid.tsx
│   │   ├── fuel-thefts-tab.tsx
│   │   ├── driver-incidents-tab.tsx
│   │   └── reports-tab.tsx
│   ├── ui/
│   └── providers.tsx
├── hooks/
│   └── use-fleet-data.ts
├── lib/
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── seed.ts
│   ├── wialon/
│   │   ├── client.ts
│   │   ├── normalize.ts
│   │   └── sync.ts
│   ├── services/
│   │   └── analytics.ts
│   └── types/
└── scripts/
    └── sync-wialon.ts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpis?from=&to=` | Landing KPIs |
| GET | `/api/fuel-thefts?from=&to=&type=` | Theft analysis |
| GET | `/api/driver-incidents?from=&to=` | Driver incidents |
| GET | `/api/reports?period=` | Scheduled reports |
| GET | `/api/units` | Fleet units |
| POST | `/api/sync/wialon` | Sync from Wialon |

## UI Architecture

- **Landing page** — 8 KPI cards + date range filter
- **Fuel Thefts tab** — type filter, top violators, best performers, event log
- **Driver Incidents tab** — incident table with severity
- **Reports tab** — daily/weekly/monthly/yearly with variance highlights

## Next Steps

1. Provide Wialon token + report template IDs for live data
2. Add auth (NextAuth) before external deployment
3. Add WhatsApp/email alert dispatch
4. PDF report export
