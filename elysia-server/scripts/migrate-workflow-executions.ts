import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const connectionString =
  Bun.env.DATABASE_URL ||
  `postgres://${Bun.env.DB_USER || 'postgres'}:${Bun.env.DB_PASSWORD || 'postgres'}@${Bun.env.DB_HOST || 'localhost'}:${Bun.env.DB_PORT || '5432'}/${Bun.env.DB_NAME || 'postgres'}`

console.log('Connecting to database...')
console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':****@'))

const pool = new Pool({
  connectionString,
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    const sqlPath = path.join(__dirname, '../migrations/create_workflow_executions.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    
    console.log('Running migration...')
    await client.query(sql)
    
    console.log('✓ Migration completed successfully')
  } catch (error) {
    console.error('✗ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()

