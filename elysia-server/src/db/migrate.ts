import { readFileSync } from "node:fs"
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import logger from "../utils/logger"
import * as schema from "./schema"

export async function migrateDatabase() {
  const pool = new Pool({
    connectionString:
      Bun.env.DATABASE_URL ||
      `postgres://${Bun.env.DB_USER || "postgres"}:${Bun.env.DB_PASSWORD || "postgres"}@${Bun.env.DB_HOST || "localhost"}:${Bun.env.DB_PORT || "5432"}/${Bun.env.DB_NAME || "postgres"}`,
  })

  const db = drizzle(pool, { schema })

  try {
    logger.info("Starting database migration")

    // 1. Run Drizzle auto-generated migrations
    logger.info("Running Drizzle migrations from ./drizzle folder")
    await migrate(db, { migrationsFolder: "./drizzle" })
    logger.info("Drizzle migrations completed")

    // 2. Run manual migrations (if migrations folder exists)
    logger.info("Running manual migrations")
    try {
      // Add workflow_data column to sequences
      const workflowDataSql = readFileSync(
        join(process.cwd(), "migrations", "add_workflow_data_to_sequences.sql"),
        "utf-8",
      )
      await db.execute(sql.raw(workflowDataSql))
      logger.info("workflow_data column migration completed")

      // Create workflow_generated_emails table
      const workflowEmailsSql = readFileSync(
        join(process.cwd(), "migrations", "create_workflow_generated_emails.sql"),
        "utf-8",
      )
      await db.execute(sql.raw(workflowEmailsSql))
      logger.info("workflow_generated_emails table migration completed")
    } catch {
      // If manual migrations fail (e.g., already applied or files not found), continue
      logger.warn("Manual migrations skipped (already applied or not found)")
    }

    logger.info("All migrations completed successfully")

    // 3. Check if database is empty and run seed if needed
    logger.info("Checking if database needs seed data")
    try {
      const departmentCount = await db.select({ count: sql`count(*)` }).from(schema.departments)
      const userCount = await db.select({ count: sql`count(*)` }).from(schema.users)

      const isDatabaseEmpty =
        Number(departmentCount[0]?.count) === 0 && Number(userCount[0]?.count) === 0

      if (isDatabaseEmpty) {
        logger.info("Database is empty, running seed data")
        const { seed } = await import("./seed")
        await seed()
        logger.info("Seed data completed successfully")
      } else {
        logger.info(
          {
            departments: departmentCount[0]?.count,
            users: userCount[0]?.count,
          },
          "Database already has data, skipping seed",
        )
      }
    } catch (seedError) {
      logger.warn({ err: seedError }, "Seed check/execution failed")
      // Don't throw error, just log it - seeding is optional
    }
  } catch (error) {
    logger.error({ err: error }, "Database migration failed")
    throw error
  } finally {
    await pool.end()
  }
}
