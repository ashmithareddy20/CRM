import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

/** Creates a request/test-local Drizzle client from an explicit D1 binding. */
export function createDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

/** Compatibility wrapper for code running inside the Worker global environment. */
export function getDb() {
  const databaseEnv = env as typeof env & { DB?: D1Database };
  if (!databaseEnv.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable");
  }
  return createDb(databaseEnv.DB);
}
