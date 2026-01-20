/**
 * Phase 2: Rinda Search - Company Search
 * Searches Rinda Search API for companies in parallel with other providers
 */

import logger from "../../../utils/logger"
import { rindaSearchService } from "../../rinda-search.service"
import { COUNTRY_NAMES } from "../constants"
import type { BuyerIntelligence, CompanySize, Country, RawCompany } from "../types"

/**
 * Rinda company result type (extracted from API schema)
 */
interface RindaCompanyResult {
  name: string
  domain: string
  description?: string | null
  industry?: string | null
  size?: string | null
  website?: string | null
  locationCountry?: string | null
}

/**
 * Map Rinda Search size to CompanySize type
 */
function mapRindaSizeToCompanySize(size: string | null | undefined): CompanySize | undefined {
  if (!size) return undefined

  const lower = size.toLowerCase()
  if (lower.includes("1-10") || lower.includes("startup")) return "startup"
  if (lower.includes("11-50") || lower.includes("10-50")) return "small"
  if (lower.includes("51-200") || lower.includes("50-250")) return "medium"
  if (lower.includes("201-500") || lower.includes("250-1000")) return "large"
  if (lower.includes("500+") || lower.includes("1000+") || lower.includes("10000+"))
    return "enterprise"

  return undefined
}

/**
 * Map Country type to Rinda Search country filter
 */
function mapCountryToRindaFilter(country: Country): string {
  const mapping: Record<Country, string> = {
    japan: "Japan",
    usa: "United States",
    china: "China",
    southeast_asia: "Singapore", // Use Singapore as representative
    europe: "Germany", // Use Germany as representative
    middle_east: "United Arab Emirates",
  }
  return mapping[country] || COUNTRY_NAMES[country]
}

/**
 * Search Rinda for companies matching buyer intelligence
 */
export async function searchWithRinda(
  intelligence: BuyerIntelligence,
  countries: Country[],
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(
    `[Rinda] Company search starting: ${countries.length} countries, ${intelligence.buyerPersonas.length} personas`,
  )

  const allResults: RawCompany[] = []
  const promises: Promise<void>[] = []

  // Search each country x persona combination in parallel
  for (const country of countries) {
    const countryFilter = mapCountryToRindaFilter(country)
    const countryName = COUNTRY_NAMES[country]

    for (const persona of intelligence.buyerPersonas) {
      const promise = (async () => {
        try {
          // Build search query from persona keywords
          // const searchQuery = [persona.type, ...persona.searchKeywords.en.slice(0, 2)].join(" ")

          logger.info(`[Rinda] ${countryName} - ${persona.typeKo} searching...`)

          const result = await rindaSearchService.searchCompanies({
            // q: searchQuery,
            country: countryFilter,
            industry: intelligence.industryFilters.keywords[0],
            limit: "10",
          })

          if (!result?.results || result.results.length === 0) {
            logger.warn(`[Rinda] No results for ${countryName} - ${persona.typeKo}`)
            return
          }

          // Type narrow the results (API returns union type)
          const typedResults = result.results as RindaCompanyResult[]

          // Map Rinda results to RawCompany
          const companies: RawCompany[] = typedResults.map((company) => ({
            companyName: company.name,
            website: company.website || undefined,
            domain: company.domain,
            industry: company.industry || undefined,
            country: company.locationCountry || countryName,
            description: company.description || undefined,
            size: mapRindaSizeToCompanySize(company.size),
            contacts: [],
            source: "rinda" as const,
          }))

          allResults.push(...companies)
          logger.info(`[Rinda] ${countryName} - ${persona.typeKo}: found ${companies.length}`)
        } catch (error) {
          logger.error(
            { error, country: countryName, persona: persona.typeKo },
            "[Rinda] Search failed",
          )
          // Continue on error - other searches may succeed
        }
      })()

      promises.push(promise)
    }
  }

  await Promise.all(promises)

  const duration = Date.now() - startTime
  logger.info(
    `[Rinda] Company search complete (${duration}ms): ${allResults.length} total (with duplicates)`,
  )

  return allResults
}
