import { createTool } from "@mastra/core/tools"
import { Client } from "pg"
import { z } from "zod"
import { mastraConfig } from "../config"

/**
 * Database Company Search Tool
 * Performs full-text search across all columns in company_normalized table
 * Shell layer - handles database I/O
 */

/**
 * Schema for company_normalized table rows
 * Includes all columns from the table plus the calculated rank field
 */
export const CompanyNormalizedSchema = z.object({
  id: z.string().nullable(),
  domain: z.string().nullable(),
  name: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  industry: z.string().nullable(),
  team_size: z.string().nullable(),
  revenue_range: z.string().nullable(),
  total_funding: z.string().nullable(),
  location: z.string().nullable(),
  facebook_page: z.string().nullable(),
  source_table: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  rank: z.number(), // BM25-like relevance score from ts_rank
})

export type CompanyNormalized = z.infer<typeof CompanyNormalizedSchema>

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
 * Executes a full-text search query within a rolled-back transaction
 * Ensures read-only behavior
 */
async function searchCompany(searchTerm: string): Promise<{
  rows: CompanyNormalized[]
  rowCount: number
  executionTime: number
}> {
  const connectionConfig = parseConnectionUrl(mastraConfig.rindaLeadPgUrl)
  const client = new Client(connectionConfig)
  const startTime = Date.now()

  try {
    await client.connect()

    // Begin transaction
    await client.query("BEGIN")

    // Set transaction to read-only mode
    await client.query("SET TRANSACTION READ ONLY")

    // Build full-text search query using PostgreSQL's ts_vector
    // This is much faster than ILIKE and uses BM25-like ranking
    const query = `
      SELECT *,
        ts_rank(
          to_tsvector('english',
            COALESCE(name, '') || ' ' ||
            COALESCE(domain, '') || ' ' ||
            COALESCE(industry, '') || ' ' ||
            COALESCE(location, '') || ' ' ||
            COALESCE(team_size, '') || ' ' ||
            COALESCE(revenue_range, '') || ' ' ||
            COALESCE(total_funding, '') || ' ' ||
            COALESCE(phone, '') || ' ' ||
            COALESCE(email, '') || ' ' ||
            COALESCE(website, '') || ' ' ||
            COALESCE(facebook_page, '')
          ),
          plainto_tsquery('english', $1)
        ) AS rank
      FROM normalized_normalized.company_normalized
      WHERE
        to_tsvector('english',
          COALESCE(name, '') || ' ' ||
          COALESCE(domain, '') || ' ' ||
          COALESCE(industry, '') || ' ' ||
          COALESCE(location, '') || ' ' ||
          COALESCE(team_size, '') || ' ' ||
          COALESCE(revenue_range, '') || ' ' ||
          COALESCE(total_funding, '') || ' ' ||
          COALESCE(phone, '') || ' ' ||
          COALESCE(email, '') || ' ' ||
          COALESCE(website, '') || ' ' ||
          COALESCE(facebook_page, '')
        ) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 400
    `

    // Execute the search query
    const result = await client.query(query, [searchTerm])

    // Always rollback to ensure no changes are committed
    await client.query("ROLLBACK")

    const executionTime = Date.now() - startTime

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
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
 * Mastra tool for searching companies in database
 */
export const dbSearchCompanyTool = createTool({
  id: "db-search-company",
  description: `Searches for companies in the company_normalized database table using full-text search.
  Searches across all columns including: name, domain, website, email, phone, industry,
  team_size, revenue_range, total_funding, location, facebook_page, and source_table.
  Returns up to 400 matching results.

  Examples:
  - Search for "Samsung" to find Samsung companies
  - Search for "Seoul" to find companies in Seoul
  - Search for "Software" to find software industry companies
  - Search for "tech" to find technology companies
  `,
  inputSchema: z.object({
    searchTerm: z
      .string()
      .min(1)
      .describe(
        "Search term to find companies. Will search across all text columns in the company table.",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z
      .object({
        rows: z.array(CompanyNormalizedSchema),
        rowCount: z.number(),
        executionTime: z.number(),
      })
      .optional(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const result = await searchCompany(context.searchTerm)

      return {
        success: true,
        data: {
          rows: result.rows,
          rowCount: result.rowCount,
          executionTime: result.executionTime,
        },
        message: `Found ${result.rowCount} companies matching "${context.searchTerm}" in ${result.executionTime}ms`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        success: false,
        error: errorMessage,
        message: `Company search failed: ${errorMessage}`,
      }
    }
  },
})
