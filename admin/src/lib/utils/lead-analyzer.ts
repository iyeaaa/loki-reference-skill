import type { CompanyScale, GroupNameTemplate } from "@/lib/api/types/customer-group"
import type { Lead } from "@/lib/api/types/lead"
import { determineCompanyScale, formatDateForGroupName } from "./group-name-generator"

/**
 * Analyzes an array of leads to extract common values for group name generation.
 * Uses the most frequent (mode) values for categorical fields.
 *
 * @param leads - Array of leads to analyze
 * @returns GroupNameTemplate with extracted values
 *
 * @example
 * ```typescript
 * const leads = [
 *   { country: 'Korea', businessType: 'B2B', employeeCount: '100', businessSectors: [{ name: 'SaaS' }] },
 *   { country: 'Korea', businessType: 'B2B', employeeCount: '50', businessSectors: [{ name: 'SaaS' }] }
 * ]
 * const template = analyzeLeadsForGroupName(leads)
 * // Returns: { country: 'Korea', scale: 'Medium', businessType: 'B2B', businessSector: 'SaaS', uploadDate: '2025-10-28' }
 * ```
 */
export const analyzeLeadsForGroupName = (leads: Lead[]): GroupNameTemplate => {
  if (!leads || leads.length === 0) {
    return {
      country: "Unknown",
      scale: "Unknown",
      businessType: "Unknown",
      businessSector: "Unknown",
      uploadDate: formatDateForGroupName(new Date()),
    }
  }

  return {
    country: getMostCommonCountry(leads),
    scale: getAverageCompanyScale(leads),
    businessType: getMostCommonBusinessType(leads),
    businessSector: getMostCommonBusinessSector(leads),
    uploadDate: formatDateForGroupName(new Date()),
  }
}

/**
 * Finds the most common country from an array of leads.
 */
const getMostCommonCountry = (leads: Lead[]): string => {
  const countries = leads.map((lead) => lead.country?.trim()).filter((c): c is string => Boolean(c))

  if (countries.length === 0) {
    return "Unknown"
  }

  return findMode(countries)
}

/**
 * Finds the most common business type from an array of leads.
 */
const getMostCommonBusinessType = (leads: Lead[]): string => {
  const businessTypes = leads
    .map((lead) => lead.businessType?.trim())
    .filter((bt): bt is string => Boolean(bt))

  if (businessTypes.length === 0) {
    return "Unknown"
  }

  return findMode(businessTypes)
}

/**
 * Finds the most common business sector from an array of leads.
 */
const getMostCommonBusinessSector = (leads: Lead[]): string => {
  const sectors: string[] = []

  for (const lead of leads) {
    if (lead.businessSectors && lead.businessSectors.length > 0) {
      // Take the first sector from each lead's sectors array
      const firstSector = lead.businessSectors[0]?.sectorName?.trim()
      if (firstSector) {
        sectors.push(firstSector)
      }
    }
  }

  if (sectors.length === 0) {
    return "Unknown"
  }

  return findMode(sectors)
}

/**
 * Calculates the average company scale based on employee counts.
 */
const getAverageCompanyScale = (leads: Lead[]): CompanyScale => {
  const employeeCounts = leads
    .map((lead) => {
      if (!lead.employeeCount) return null
      // Parse employee count string to number
      const count = Number.parseInt(lead.employeeCount, 10)
      return Number.isNaN(count) ? null : count
    })
    .filter((count): count is number => count !== null)

  if (employeeCounts.length === 0) {
    return "Unknown"
  }

  // Calculate average employee count
  const average = employeeCounts.reduce((sum, count) => sum + count, 0) / employeeCounts.length

  return determineCompanyScale(Math.round(average))
}

/**
 * Finds the most frequent value (mode) in an array.
 */
const findMode = (values: string[]): string => {
  const frequency = new Map<string, number>()

  for (const value of values) {
    frequency.set(value, (frequency.get(value) || 0) + 1)
  }

  let maxCount = 0
  let mode = values[0]

  for (const [value, count] of frequency.entries()) {
    if (count > maxCount) {
      maxCount = count
      mode = value
    }
  }

  return mode
}
