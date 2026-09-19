import { defineConfig } from "drizzle-kit";

/** New canonical migrations are isolated from the defective historical journal. */
export default defineConfig({
  out: "./drizzle/forward",
  schema: "./db/schema/canonical.ts",
  dialect: "sqlite",
});
