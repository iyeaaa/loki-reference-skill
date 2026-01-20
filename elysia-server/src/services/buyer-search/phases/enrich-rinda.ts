/**
 * Rinda Person Search for Email Enrichment
 * Used as primary enrichment source before Hunter.io fallback
 */

import logger from "../../../utils/logger"
import { rindaSearchService } from "../../rinda-search.service"
import type { EmailInfo, UniqueCompany } from "../types"

export interface RindaPersonResult {
  email: string | null
  contactName: string | null
  title: string | null
  linkedinUrl: string | null
}

/**
 * Rinda person result type (extracted from API schema)
 */
interface RindaPersonApiResult {
  id: string
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  jobTitle?: string | null
  workEmail?: string | null
  personalEmail?: string | null
  linkedinUrl?: string | null
  score: number
}

/**
 * Search Rinda for people at a specific company
 * Returns the best contact found (decision-maker with email preferred)
 */
export async function searchRindaPeopleForCompany(
  company: UniqueCompany,
): Promise<RindaPersonResult | null> {
  try {
    // Build search filters
    const filters: Parameters<typeof rindaSearchService.searchPeople>[0] = {
      limit: "5",
    }

    // Prefer domain-based search for accuracy
    if (company.domain) {
      filters.domain = company.domain
    } else if (company.companyName) {
      filters.company = company.companyName
    } else {
      return null // Cannot search without company identifier
    }

    const result = await rindaSearchService.searchPeople(filters)

    if (!result?.results || result.results.length === 0) {
      return null
    }

    // Type narrow the results (API returns union type)
    const typedResults = result.results as RindaPersonApiResult[]

    // Find best contact: prefer decision-makers with email
    const decisionMakerTitles = [
      "buyer",
      "purchasing",
      "procurement",
      "sourcing",
      "import",
      "director",
      "manager",
      "head",
      "ceo",
      "coo",
      "founder",
      "owner",
      "president",
      "vp",
      "chief",
      "lead",
      "md",
    ]

    // Sort by: has email > is decision-maker > score
    const sortedPeople = typedResults.sort((a, b) => {
      const aHasEmail = Boolean(a.workEmail || a.personalEmail)
      const bHasEmail = Boolean(b.workEmail || b.personalEmail)
      if (aHasEmail !== bHasEmail) return bHasEmail ? 1 : -1

      const aIsDecisionMaker = decisionMakerTitles.some((t) =>
        a.jobTitle?.toLowerCase().includes(t),
      )
      const bIsDecisionMaker = decisionMakerTitles.some((t) =>
        b.jobTitle?.toLowerCase().includes(t),
      )
      if (aIsDecisionMaker !== bIsDecisionMaker) return bIsDecisionMaker ? 1 : -1

      return (b.score || 0) - (a.score || 0)
    })

    const bestPerson = sortedPeople[0]
    if (!bestPerson) return null

    return {
      email: bestPerson.workEmail || bestPerson.personalEmail || null,
      contactName:
        bestPerson.fullName ||
        [bestPerson.firstName, bestPerson.lastName].filter(Boolean).join(" ") ||
        null,
      title: bestPerson.jobTitle || null,
      linkedinUrl: bestPerson.linkedinUrl || null,
    }
  } catch (error) {
    logger.error({ error, company: company.companyName }, "[Rinda] Person search failed")
    return null
  }
}

/**
 * Convert Rinda person result to EmailInfo format
 */
export function rindaPersonToEmailInfo(person: RindaPersonResult | null): EmailInfo | null {
  if (!person?.email) return null

  return {
    email: person.email,
    source: "rinda",
    verified: true, // Assume Rinda data is verified
    confidence: 85,
    contactName: person.contactName || undefined,
    title: person.title || undefined,
  }
}
