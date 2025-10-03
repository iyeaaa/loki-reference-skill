import { readFileSync } from "node:fs"
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import * as schema from "./schema"

export async function migrateDatabase() {
  const pool = new Pool({
    connectionString:
      Bun.env.DATABASE_URL ||
      `postgres://${Bun.env.DB_USER || "postgres"}:${Bun.env.DB_PASSWORD || "postgres"}@${Bun.env.DB_HOST || "localhost"}:${Bun.env.DB_PORT || "5432"}/${Bun.env.DB_NAME || "postgres"}`,
  })

  const db = drizzle(pool, { schema })

  try {
    console.log("🔄 Starting database migration...")

    // 1. Run Drizzle auto-generated migrations
    console.log("  ├─ Running Drizzle migrations from ./drizzle folder...")
    await migrate(db, { migrationsFolder: "./drizzle" })
    console.log("  ├─ ✅ Drizzle migrations completed")

    // 2. Run manual migrations (if migrations folder exists)
    console.log("  ├─ Running manual migrations...")
    try {
      // Add workflow_data column to sequences
      const workflowDataSql = readFileSync(
        join(process.cwd(), "migrations", "add_workflow_data_to_sequences.sql"),
        "utf-8",
      )
      await db.execute(sql.raw(workflowDataSql))
      console.log("  ├─ ✅ workflow_data column migration completed")

      // Create workflow_generated_emails table
      const workflowEmailsSql = readFileSync(
        join(process.cwd(), "migrations", "create_workflow_generated_emails.sql"),
        "utf-8",
      )
      await db.execute(sql.raw(workflowEmailsSql))
      console.log("  ├─ ✅ workflow_generated_emails table migration completed")
    } catch {
      // If manual migrations fail (e.g., already applied or files not found), continue
      console.log("  ├─ ⚠️  Manual migrations skipped (already applied or not found)")
    }

    console.log("  └─ ✅ All migrations completed successfully")

    // 3. Check if database is empty and run seed if needed
    console.log("\n🔍 Checking if database needs seed data...")
    try {
      const departmentCount = await db.select({ count: sql`count(*)` }).from(schema.departments)
      const userCount = await db.select({ count: sql`count(*)` }).from(schema.users)

      const isDatabaseEmpty =
        Number(departmentCount[0]?.count) === 0 && Number(userCount[0]?.count) === 0

      if (isDatabaseEmpty) {
        console.log("  ├─ Database is empty, running seed data...")
        const { seed } = await import("./seed")
        await seed()
        console.log("  └─ ✅ Seed data completed successfully")
      } else {
        console.log(
          `  └─ ⏭️  Database already has data (${departmentCount[0]?.count} departments, ${userCount[0]?.count} users), skipping seed`,
        )
      }
    } catch (seedError) {
      console.error("  └─ ⚠️  Seed check/execution failed:", seedError)
      // Don't throw error, just log it - seeding is optional
    }
  } catch (error) {
    console.error("❌ Database migration failed:", error)
    throw error
  } finally {
    await pool.end()
  }
}
