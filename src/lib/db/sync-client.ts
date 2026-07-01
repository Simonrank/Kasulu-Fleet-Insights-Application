import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type SyncDb = PostgresJsDatabase<typeof schema>;

let syncDatabase: SyncDb | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

/** Pooled Postgres client for long-running sync jobs (avoids Neon HTTP per-query limits). */
export function getSyncDb(): SyncDb {
  if (syncDatabase) return syncDatabase;

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  sqlClient = postgres(connectionString, {
    max: 1,
    idle_timeout: 60,
    connect_timeout: 30,
  });
  syncDatabase = drizzle(sqlClient, { schema });
  return syncDatabase;
}

export async function closeSyncDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    syncDatabase = null;
  }
}
