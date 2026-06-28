# UI Architecture

## Layout Hierarchy

```
RootLayout (Server)
└── Providers (TanStack Query)
    └── HomePage (Server)
        ├── Header — branding, project context
        └── Dashboard (Client)
            ├── Date range controls + Sync button
            ├── KpiGrid — 8 KPI cards
            └── Tabs
                ├── Fuel Thefts
                ├── Driver Incidents
                └── Reports
```

## Component Map

| Component | Type | Responsibility |
|-----------|------|----------------|
| `dashboard.tsx` | Client | Orchestrates date range, sync, tabs |
| `kpi-grid.tsx` | Client | Renders 8 landing KPIs |
| `fuel-thefts-tab.tsx` | Client | Filter, violators chart, performers, event log |
| `driver-incidents-tab.tsx` | Client | Incident table with severity badges |
| `reports-tab.tsx` | Client | Period selector, variance, unit breakdown |

## Data Fetching

- **TanStack Query** hooks in `src/hooks/use-fleet-data.ts`
- Each tab fetches independently with shared `from`/`to` params
- Stale time: 60 seconds
- Sync button POSTs to `/api/sync/wialon` then invalidates KPI query

## KPI Cards (Landing)

1. Consumption Rate — km/L + L/hr subtitle
2. Distance Covered — fleet total km
3. Engine Hours — total runtime
4. Utilization — productive vs engine hours %
5. Updating Units — online count / total
6. Non-Updating Units — offline count
7. Direct Thefts — count + liters
8. Return Pipe Thefts — count + liters

## Tab: Fuel Thefts

- **Filter**: All / Direct / Return pipe (Select dropdown)
- **Top Violators**: Bar chart + ranked list (theft count, volume, rate)
- **Best Performers**: Lowest theft rate per engine hour
- **Event Log**: Full table with date, unit, type, volume, location

## Tab: Driver Incidents

- Summary badges by incident type
- Table: date, unit, driver, type, value/threshold, severity, location

## Tab: Reports

- Period toggle: Daily / Weekly / Monthly / Yearly
- Fleet summary card
- KPI variance vs targets (color-coded badges)
- Per-unit breakdown table

## Styling

- Tailwind CSS v4 with custom OKLCH theme (agricultural green primary)
- shadcn-inspired primitives: Card, Button, Tabs, Badge, Select
- Recharts for bar charts
- Responsive grid: 1 col mobile → 2 col tablet → 4 col desktop for KPIs

## Future UI Additions

- Live map (GIS tab)
- WhatsApp alert config panel
- PDF export button on Reports tab
- Dark mode toggle
