import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
})

async function runMigration() {
  const client = await pool.connect()

  try {
    console.log('🔄 Running manual migration: workflow_generated_emails')

    const sqlPath = join(__dirname, 'manual-migrations', '001_create_workflow_emails.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    await client.query(sql)

    console.log('✅ Migration completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
