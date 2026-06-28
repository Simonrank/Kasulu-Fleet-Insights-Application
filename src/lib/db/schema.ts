import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const unitStatusEnum = pgEnum("unit_status", [
  "active",
  "inactive",
  "maintenance",
]);

export const theftTypeEnum = pgEnum("theft_type", ["direct", "return_pipe"]);

export const incidentTypeEnum = pgEnum("incident_type", [
  "speed_violation",
  "harsh_braking",
  "harsh_acceleration",
  "geo_fence_breach",
  "unauthorized_movement",
  "idle_exceedance",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "success",
  "failed",
]);

/** Fleet vehicles synced from Wialon */
export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wialonId: integer("wialon_id").notNull(),
    name: text("name").notNull(),
    plateNumber: text("plate_number"),
    vehicleType: text("vehicle_type"),
    vehicleCategory: text("vehicle_category"),
    driverName: text("driver_name"),
    status: unitStatusEnum("status").default("active").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastLat: doublePrecision("last_lat"),
    lastLon: doublePrecision("last_lon"),
    isOnline: boolean("is_online").default(false).notNull(),
    sheetComment: text("sheet_comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("units_wialon_id_idx").on(t.wialonId),
    uniqueIndex("units_name_idx").on(t.name),
    index("units_is_online_idx").on(t.isOnline),
  ]
);

/** Daily aggregated metrics per unit — powers KPIs and reports */
export const dailyUnitMetrics = pgTable(
  "daily_unit_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    distanceKm: doublePrecision("distance_km").default(0).notNull(),
    engineHours: doublePrecision("engine_hours").default(0).notNull(),
    productiveHours: doublePrecision("productive_hours").default(0).notNull(),
    idleHours: doublePrecision("idle_hours").default(0).notNull(),
    fuelConsumedLiters: doublePrecision("fuel_consumed_liters")
      .default(0)
      .notNull(),
    fuelFilledLiters: doublePrecision("fuel_filled_liters")
      .default(0)
      .notNull(),
    kmPerLiter: doublePrecision("km_per_liter").default(0).notNull(),
    litersPerHour: doublePrecision("liters_per_hour").default(0).notNull(),
    initialFuelLevel: doublePrecision("initial_fuel_level").default(0).notNull(),
    finalFuelLevel: doublePrecision("final_fuel_level").default(0).notNull(),
    avgSpeedKmh: doublePrecision("avg_speed_kmh").default(0).notNull(),
    maxSpeedKmh: doublePrecision("max_speed_kmh").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("daily_metrics_unit_date_idx").on(t.unitId, t.date),
    index("daily_metrics_date_idx").on(t.date),
  ]
);

/** Fuel theft and refill events */
export const fuelEvents = pgTable(
  "fuel_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    wialonEventId: text("wialon_event_id"),
    eventType: text("event_type").notNull(), // 'theft' | 'filling'
    theftType: theftTypeEnum("theft_type"),
    volumeLiters: doublePrecision("volume_liters").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    locationLat: doublePrecision("location_lat"),
    locationLon: doublePrecision("location_lon"),
    locationName: text("location_name"),
    description: text("description"),
    durationMinutes: doublePrecision("duration_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("fuel_events_unit_idx").on(t.unitId),
    index("fuel_events_occurred_idx").on(t.occurredAt),
    index("fuel_events_theft_type_idx").on(t.theftType),
    uniqueIndex("fuel_events_wialon_idx").on(t.wialonEventId),
  ]
);

/** Driver behaviour incidents */
export const driverIncidents = pgTable(
  "driver_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    wialonEventId: text("wialon_event_id"),
    incidentType: incidentTypeEnum("incident_type").notNull(),
    severity: text("severity").default("medium").notNull(),
    value: doublePrecision("value"),
    threshold: doublePrecision("threshold"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    locationLat: doublePrecision("location_lat"),
    locationLon: doublePrecision("location_lon"),
    locationName: text("location_name"),
    driverName: text("driver_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("incidents_unit_idx").on(t.unitId),
    index("incidents_occurred_idx").on(t.occurredAt),
    index("incidents_type_idx").on(t.incidentType),
    uniqueIndex("incidents_wialon_event_idx").on(t.wialonEventId),
  ]
);

/** Sync audit log */
export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: syncStatusEnum("status").notNull(),
  unitsSynced: integer("units_synced").default(0),
  eventsSynced: integer("events_synced").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type Unit = typeof units.$inferSelect;
export type DailyUnitMetric = typeof dailyUnitMetrics.$inferSelect;
export type FuelEvent = typeof fuelEvents.$inferSelect;
export type DriverIncident = typeof driverIncidents.$inferSelect;
