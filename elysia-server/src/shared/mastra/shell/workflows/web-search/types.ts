import { z } from "zod"

/**
 * Company information schema
 */
export const CompanyInfoSchema = z.object({
  name: z.string().describe("Company name"),
  website: z.string().optional().nullable().describe("Company website URL"),
  email: z.string().optional().nullable().describe("Company email address"),
  foundedYear: z.number().optional().nullable().describe("Year company was founded"),
  location: z.string().optional().nullable().describe("Company location"),
  source: z.string().describe("Source URL where company was found"),
  sourceType: z.enum(["snippet", "directory", "individual"]).describe("Type of extraction source"),
  extractedAt: z.string().datetime().describe("Extraction timestamp"),
})

export type CompanyInfo = z.infer<typeof CompanyInfoSchema>

/**
 * Search query with location and language
 */
export const SearchQuerySchema = z.object({
  query: z.string().describe("The search query string optimized for Google"),
  location: z
    .string()
    .optional()
    .describe('Geographic location for search (e.g., "San Francisco, California, United States")'),
  language: z
    .string()
    .optional()
    .describe('Language code for search results (e.g., "en" for English)'),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

/**
 * Google search result
 */
export const GoogleSearchResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  link: z.string(),
  displayedLink: z.string(),
  snippet: z.string().optional(),
  sitelinks: z.array(z.object({ title: z.string(), link: z.string() })).optional(),
  date: z.string().optional(),
})

export type GoogleSearchResult = z.infer<typeof GoogleSearchResultSchema>

/**
 * API Statistics
 */
export const APIStatsSchema = z.object({
  serpCalls: z.number(),
  serpTotalResults: z.number(),
  jinaReaderCalls: z.number(),
  jinaReaderSuccesses: z.number(),
  jinaReaderFailures: z.number(),
  openaiCalls: z.number(),
  openaiTokensEstimate: z.number(),
  startTime: z.string(),
  endTime: z.string().optional(),
  totalDurationMs: z.number().optional(),
})

export type APIStats = z.infer<typeof APIStatsSchema>

/**
 * Search iteration result
 */
export const SearchIterationSchema = z.object({
  query: z.string(),
  companiesFound: z.number(),
  bestSource: z.string().optional(),
  timestamp: z.string().datetime(),
})

export type SearchIteration = z.infer<typeof SearchIterationSchema>
