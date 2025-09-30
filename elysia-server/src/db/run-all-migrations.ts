import { readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
})

async function runAllMigrations() {
  const client = await pool.connect()

  try {
    console.log('🔄 Running all manual migrations...')

    // 1. Add workflow_data to sequences
    console.log('  ├─ Adding workflow_data column to sequences...')
    await client.query(`
      ALTER TABLE sequences ADD COLUMN IF NOT EXISTS workflow_data TEXT;
      COMMENT ON COLUMN sequences.workflow_data IS 'JSON data for React Flow workflow (nodes and edges)';
    `)
    console.log('  ├─ ✅ workflow_data column added')

    // 2. Create workflow_generated_emails table
    console.log('  ├─ Creating workflow_generated_emails table...')
    const workflowEmailsSql = readFileSync(
      join(__dirname, 'manual-migrations', '001_create_workflow_emails.sql'),
      'utf-8'
    )
    await client.query(workflowEmailsSql)
    console.log('  └─ ✅ workflow_generated_emails table created')

    console.log('✅ All migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runAllMigrations()
