import { integer, text } from "drizzle-orm/sqlite-core";

/** Canonical timestamps are UTC epoch milliseconds. Legacy tables retain seconds. */
export const auditColumns = () => ({
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  createdByMembershipId: text("created_by_membership_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  updatedByMembershipId: text("updated_by_membership_id"),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  version: integer("version").notNull().default(1),
});

export const tenantColumns = () => ({
  tenantId: text("tenant_id").notNull(),
  ...auditColumns(),
});
