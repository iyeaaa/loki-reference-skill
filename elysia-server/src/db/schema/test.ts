import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Test table for migration verification
 * Purpose: Verify automatic migrations work on deployment
 */
export const testTable = pgTable("test_migrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  testName: varchar("test_name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TestTable = typeof testTable.$inferSelect;
export type NewTestTable = typeof testTable.$inferInsert;
