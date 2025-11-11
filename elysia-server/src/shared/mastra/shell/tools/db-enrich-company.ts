import { createTool } from "@mastra/core/tools"
import { Client } from "pg"
import { z } from "zod"
import { config } from "../../../../config"

/**
 * Database Company Enrichment Tool
 * Retrieves company and associated employees by domain/website
 * Shell layer - handles database I/O
 */

/**
 * Schema for company_normalized table rows
 */
export const EnrichedCompanySchema = z.object({
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
})

export type EnrichedCompany = z.infer<typeof EnrichedCompanySchema>

/**
 * Schema for person_normalized table rows
 */
export const PersonNormalizedSchema = z.object({
  id: z.string().nullable(),
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  full_name: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  facebook_profile: z.string().nullable(),
  job_title: z.string().nullable(),
  email_status: z.string().nullable(),
  company_domain: z.string().nullable(),
  company_name: z.string().nullable(),
  company_location: z.string().nullable(),
  source_table: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

export type PersonNormalized = z.infer<typeof PersonNormalizedSchema>

/**
 * Schema for enriched company with employees
 */
export const CompanyEnrichmentResultSchema = z.object({
  company: EnrichedCompanySchema.nullable(),
  employees: z.array(PersonNormalizedSchema),
})

export type CompanyEnrichmentResult = z.infer<typeof CompanyEnrichmentResultSchema>

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
 * Normalizes domain/website input by extracting clean domain
 * Handles URLs, www prefix, and extracts just the domain
 */
function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase()

  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, "")

  // Remove www. prefix if present
  domain = domain.replace(/^www\./, "")

  // Remove path and query params if present
  const parts = domain.split("/")
  domain = parts[0] ?? ""
  const queryParts = domain.split("?")
  domain = queryParts[0] ?? ""

  return domain
}

/**
 * Executes enrichment query within a rolled-back transaction
 * Ensures read-only behavior
 */
async function enrichCompany(domainOrWebsite: string): Promise<{
  result: CompanyEnrichmentResult
  executionTime: number
}> {
  const connectionConfig = parseConnectionUrl(config.mastra.rindaLeadPgUrl)
  const client = new Client(connectionConfig)
  const startTime = Date.now()

  const normalizedDomain = normalizeDomain(domainOrWebsite)

  try {
    await client.connect()

    // Begin transaction
    await client.query("BEGIN")

    // Set transaction to read-only mode
    await client.query("SET TRANSACTION READ ONLY")

    // Query company by domain (matching both domain and website columns)
    const companyQuery = `
      SELECT *
      FROM normalized_normalized.company_normalized
      WHERE
        COALESCE(domain, '') LIKE $1
        OR COALESCE(website, '') LIKE $1
      LIMIT 1
    `

    const companyResult = await client.query(companyQuery, [`%${normalizedDomain}%`])
    const company = companyResult.rows[0] || null

    let employees: PersonNormalized[] = []

    // If company found, fetch associated employees by matching domain
    if (company?.domain) {
      const employeesQuery = `
        SELECT *
        FROM normalized_normalized.person_normalized
        WHERE COALESCE(company_domain, '') LIKE $1
        ORDER BY created_at DESC
      `

      const employeesResult = await client.query(employeesQuery, [`%${normalizedDomain}%`])
      employees = employeesResult.rows
    }

    // Always rollback to ensure no changes are committed
    await client.query("ROLLBACK")

    const executionTime = Date.now() - startTime

    return {
      result: {
        company,
        employees,
      },
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
 * Mastra tool for enriching company data with employees
 */
export const dbEnrichCompanyTool = createTool({
  id: "db-enrich-company",
  description: `Retrieves company information and associated employees from the database by domain or website.
  Searches the company_normalized table for a matching domain/website and returns the company
  along with all employees (from person_normalized) associated with that company.

  Accepts flexible input formats:
  - Plain domain: "example.com"
  - With www: "www.example.com"
  - Full URL: "https://example.com"
  - With path: "https://example.com/about"

  Returns company details and list of employees with their information.

  Examples:
  - Input: "samsung.com" → Returns Samsung company + all Samsung employees
  - Input: "https://www.google.com" → Returns Google company + all Google employees
  - Input: "microsoft.com/en-us" → Returns Microsoft company + all Microsoft employees
  `,
  inputSchema: z.object({
    domain: z
      .string()
      .min(1)
      .describe(
        "Company domain or website URL. Can be a plain domain (example.com), with www (www.example.com), or full URL (https://example.com)",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z
      .object({
        company: EnrichedCompanySchema.nullable(),
        employees: z.array(PersonNormalizedSchema),
        employeeCount: z.number(),
        executionTime: z.number(),
      })
      .optional(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { result, executionTime } = await enrichCompany(context.domain)

      if (!result.company) {
        return {
          success: true,
          data: {
            company: null,
            employees: [],
            employeeCount: 0,
            executionTime,
          },
          message: `No company found with domain "${context.domain}"`,
        }
      }

      return {
        success: true,
        data: {
          company: result.company,
          employees: result.employees,
          employeeCount: result.employees.length,
          executionTime,
        },
        message: `Found company "${result.company.name}" with ${result.employees.length} employees in ${executionTime}ms`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        success: false,
        error: errorMessage,
        message: `Company enrichment failed: ${errorMessage}`,
      }
    }
  },
})
