import { sql } from 'drizzle-orm'
import { db } from './drizzle'

export async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...')

    // Create posts table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `)

    // Create address book groups table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS address_book_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `)

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS address_book_groups_name_idx ON address_book_groups (name)`,
    )

    // Create address book contacts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS address_book_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES address_book_groups(id) ON DELETE CASCADE,
        company VARCHAR(160) NOT NULL,
        email VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `)

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS address_book_contacts_group_id_idx ON address_book_contacts (group_id)`,
    )
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS address_book_contacts_email_idx ON address_book_contacts (email)`,
    )

    console.log('✅ Database migration completed successfully')
  } catch (error) {
    console.error('❌ Database migration failed:', error)
    throw error
  }
}
