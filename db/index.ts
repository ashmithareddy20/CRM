import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getLocalD1Database } from "./d1-adapter";

export type Database = ReturnType<typeof createDb>;

/** Creates a request/test-local Drizzle client from an explicit D1 binding, falling back to local D1 SQLite. */
export function createDb(binding?: D1Database) {
  const d1 = binding || getLocalD1Database();
  return drizzle(d1, { schema });
}

/** Compatibility wrapper for code running inside the Worker global environment. */
export function getDb() {
  const databaseEnv = env as typeof env & { DB?: D1Database };
  return createDb(databaseEnv?.DB);
}
