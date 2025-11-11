import type { CompanyInfo } from "./types"

/**
 * Deduplicate companies based on website URL or company name
 * Core utility - pure function
 */
export const deduplicateCompanies = (companies: CompanyInfo[]): CompanyInfo[] => {
  const seen = new Map<string, CompanyInfo>()

  for (const company of companies) {
    // Use website as primary key, fallback to name
    const key = company.website ? normalizeUrl(company.website) : normalizeName(company.name)

    // Keep the first occurrence (or the one with more data)
    const existing = seen.get(key)
    if (existing) {
      // Replace if new company has more complete data
      if (isMoreComplete(company, existing)) {
        seen.set(key, company)
      }
    } else {
      seen.set(key, company)
    }
  }

  return Array.from(seen.values())
}

/**
 * Normalize URL for comparison
 */
const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    // Remove www, trailing slash, protocol
    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}

/**
 * Normalize company name for comparison
 */
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[,.\-_]/g, "") // Remove punctuation
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "") // Remove company suffixes
}

/**
 * Check if company A is more complete than company B
 */
const isMoreComplete = (a: CompanyInfo, b: CompanyInfo): boolean => {
  let scoreA = 0
  let scoreB = 0

  if (a.website) scoreA++
  if (a.location) scoreA++
  if (b.website) scoreB++
  if (b.location) scoreB++

  return scoreA > scoreB
}

/**
 * Validate that a company has minimum required data
 */
export const isValidCompany = (company: CompanyInfo): boolean => {
  // Must have a name
  if (!company.name || company.name.trim().length < 2) {
    return false
  }

  // Must have either website or location
  if (!(company.website || company.location)) {
    return false
  }

  // Filter out obvious garbage
  const namePattern = /^[a-zA-Z0-9\s\-.,&'()]+$/
  if (!namePattern.test(company.name)) {
    return false
  }

  return true
}

/**
 * Clean and validate companies
 */
export const cleanCompanies = (companies: CompanyInfo[]): CompanyInfo[] =>
  companies.filter(isValidCompany).map((company) => ({
    ...company,
    name: company.name.trim(),
    website: company.website?.trim(),
    location: company.location?.trim(),
  }))

/**
 * Format company for display/logging
 */
export const formatCompany = (company: CompanyInfo): string => {
  const parts = [company.name]
  if (company.website) parts.push(`(${company.website})`)
  if (company.location) parts.push(`[${company.location}]`)
  return parts.join(" ")
}
