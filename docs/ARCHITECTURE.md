# Kasulu Fleet Reporting — System Architecture

## Overview

Multipurpose fleet reporting platform for the Kasulu Agricultural Project. Ingests telematics data from **Wialon**, stores normalized aggregates in **PostgreSQL**, and serves a real-time dashboard with KPIs, fuel theft analysis, driver incidents, and scheduled reports.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS (Browser / Mobile)                       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────────────┐
│                    Next.js 15 App (Vercel / Node)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │
│  │  Dashboard   │  │  API Routes  │  │  Cron / Manual Sync Script   │   │
│  │  (React RSC  │  │  /api/kpis   │  │  src/scripts/sync-wialon.ts  │   │
│  │  + Client)   │  │  /api/fuel-* │  │  /api/sync/wialon (POST)     │   │
│  └──────────────┘  └──────┬───────┘  └──────────────┬───────────────┘   │
└───────────────────────────┼─────────────────────────┼─────────────────────┘
                            │                         │
              ┌─────────────▼─────────────┐   ┌───────▼────────┐
              │   PostgreSQL (Drizzle)    │   │  Wialon Remote │
              │   units, daily_metrics,   │   │  API (token    │
              │   fuel_events, incidents  │   │  auth)         │
              └───────────────────────────┘   └────────────────┘
```

## Design Principles (MVP → Scale)

| Principle | MVP | Scale path |
|-----------|-----|------------|
| Data source | Wialon sync every 15 min | Webhook + queue (Redis/BullMQ) |
| Storage | PostgreSQL aggregates | TimescaleDB for telemetry |
| Auth | None (internal network) | NextAuth + RBAC |
| Reports | On-demand API + UI | PDF generation + email/WhatsApp |
| Deploy | Docker Compose local / Vercel | K8s + managed Postgres |

## Data Flow

1. **Sync job** authenticates with `WIALON_TOKEN`, fetches units + report data.
2. **Normalizer** maps Wialon rows → `units`, `daily_unit_metrics`, `fuel_events`, `driver_incidents`.
3. **API layer** aggregates by date range for dashboard KPIs.
4. **UI** fetches via TanStack Query with date-range filters.

## KPI Definitions

| KPI | Formula / Source |
|-----|------------------|
| Consumption km/L | `total_distance_km / total_fuel_liters` |
| Consumption L/hr | `total_fuel_liters / total_engine_hours` |
| Distance covered | Sum of `distance_km` across fleet |
| Engine hours | Sum of `engine_hours` |
| Utilization % | `productive_hours / (engine_hours × available_units) × 100` |
| Updating units | Units with `last_message_at` within threshold (default 30 min) |
| Non-updating units | Total units − updating units |
| Direct thefts | `fuel_events` where `theft_type = 'direct'` |
| Return pipe thefts | `fuel_events` where `theft_type = 'return_pipe'` |

## Theft Classification

Wialon fuel drain events are classified by sensor name / description keywords:
- **direct** — tank drain, siphon, direct theft
- **return_pipe** — return line, bypass, pipe theft

Configurable in `src/lib/wialon/normalize.ts`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kpis?from=&to=` | Landing page KPIs |
| GET | `/api/fuel-thefts?from=&to=&type=` | Theft list + top violators + best performers |
| GET | `/api/driver-incidents?from=&to=` | Speed, harsh brake, etc. |
| GET | `/api/reports?period=` | Aggregated report data |
| POST | `/api/sync/wialon` | Trigger Wialon sync (cron/manual) |
| GET | `/api/units` | Fleet unit list + online status |

## Security (Production)

- Store `WIALON_TOKEN` and `CRON_SECRET` in env only.
- Protect `/api/sync/wialon` with `Authorization: Bearer ${CRON_SECRET}`.
- Add auth middleware before external deployment.

## File Structure

See project root — `src/` layout documented in README.
