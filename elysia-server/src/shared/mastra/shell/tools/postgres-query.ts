import { createTool } from "@mastra/core/tools"
import { Client } from "pg"
import { z } from "zod"
import { config } from "../../../../config"

/**
 * PostgreSQL Read-Only Query Tool
 * Executes SQL queries within a rolled-back transaction to ensure no data modification
 * Shell layer - handles database I/O
 */

/**
 * Parses PostgreSQL connection URL and returns connection config
 */
function parseConnectionUrl(url: string) {
  const parsedUrl = new URL(url)
  return {
    host: parsedUrl.hostname,
    port: Number.parseInt(parsedUrl.port, 10) || 5432,
    user: parsedUrl.username,
    password: parsedUrl.password,
    database: parsedUrl.pathname.slice(1), // Remove leading slash
    ssl: {
      rejectUnauthorized: false, // AWS RDS requires SSL
    },
  }
}

/**
 * Executes a SQL query within a rolled-back transaction
 * Ensures read-only behavior regardless of query type
 */
async function executeReadOnlyQuery(query: string): Promise<{
  rows: unknown[]
  rowCount: number
  fields: Array<{ name: string; dataTypeID: number }>
  executionTime: number
}> {
  const connectionConfig = parseConnectionUrl(config.mastra.rindaLeadPgUrl)
  const client = new Client(connectionConfig)
  const startTime = Date.now()

  try {
    await client.connect()

    // Begin transaction
    await client.query("BEGIN")

    // Set transaction to read-only mode
    await client.query("SET TRANSACTION READ ONLY")

    // Execute the user's query
    const result = await client.query(query)

    // Always rollback to ensure no changes are committed
    await client.query("ROLLBACK")

    const executionTime = Date.now() - startTime

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((field) => ({
        name: field.name,
        dataTypeID: field.dataTypeID,
      })),
      executionTime,
    }
  } catch (error) {
    // Ensure rollback even on error
    try {
      await client.query("ROLLBACK")
    } catch {
      // Ignore rollback errors
    }

    throw error
  } finally {
    await client.end()
  }
}

/**
 * Mastra tool for executing read-only PostgreSQL queries
 */
export const postgresQueryTool = createTool({
  id: "postgres-read-only-query",
  description: `Executes SQL queries against a PostgreSQL database in read-only mode.
  All queries are executed within a rolled-back transaction, ensuring no data modifications can occur.
  Useful for safely querying and analyzing database data without risk of changes.

  Examples:
  - SELECT * FROM users LIMIT 10
  - SELECT COUNT(*) FROM orders WHERE status = 'pending'
  - SELECT name, email FROM customers WHERE created_at > '2024-01-01'
  `,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "SQL query to execute. Can be any valid PostgreSQL query (SELECT, INSERT, UPDATE, DELETE, etc.). All operations will be rolled back.",
      ),
  }),
  execute: async ({ context }) => {
    try {
      const result = await executeReadOnlyQuery(context.query)

      return {
        success: true,
        data: {
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields,
          executionTime: result.executionTime,
        },
        message: `Query executed successfully. Retrieved ${result.rowCount} rows in ${result.executionTime}ms`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        success: false,
        error: errorMessage,
        message: `Query execution failed: ${errorMessage}`,
      }
    }
  },
})
