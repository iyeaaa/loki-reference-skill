import type { CompanyScale, GroupNameTemplate } from "@/lib/api/types/customer-group"
import type { LeadCSVData } from "@/lib/csv-utils"
import { determineCompanyScale, formatDateForGroupName } from "./group-name-generator"

/**
 * Analyzes CSV lead data to extract common values for group name generation.
 * This is a simplified version that works with CSV data before leads are created in the database.
 *
 * @param csvLeads - Array of CSV lead data to analyze
 * @returns GroupNameTemplate with extracted values
 */
export const analyzeCSVLeadsForGroupName = (csvLeads: LeadCSVData[]): GroupNameTemplate => {
  if (!csvLeads || csvLeads.length === 0) {
    return {
      country: "Unknown",
      scale: "Unknown",
      businessType: "Unknown",
      businessSector: "Unknown",
      uploadDate: formatDateForGroupName(new Date()),
    }
  }

  return {
    country: getMostCommonCountry(csvLeads),
    scale: getAverageCompanyScale(csvLeads),
    businessType: getMostCommonBusinessType(csvLeads),
    businessSector: "Unknown", // CSV data doesn't have business sectors
    uploadDate: formatDateForGroupName(new Date()),
  }
}

/**
 * Finds the most common country from CSV leads.
 */
const getMostCommonCountry = (csvLeads: LeadCSVData[]): string => {
  const countries = csvLeads
    .map((lead) => lead.country?.trim())
    .filter((c): c is string => Boolean(c))

  if (countries.length === 0) {
    return "Unknown"
  }

  return findMode(countries)
}

/**
 * Finds the most common business type from CSV leads.
 */
const getMostCommonBusinessType = (csvLeads: LeadCSVData[]): string => {
  const businessTypes = csvLeads
    .map((lead) => lead.businessType?.trim())
    .filter((bt): bt is string => Boolean(bt))

  if (businessTypes.length === 0) {
    return "Unknown"
  }

  return findMode(businessTypes)
}

/**
 * Calculates the average company scale based on employee counts from CSV data.
 */
const getAverageCompanyScale = (csvLeads: LeadCSVData[]): CompanyScale => {
  const employeeCounts = csvLeads
    .map((lead) => {
      if (!lead.employeeCount) return null
      const count = Number.parseInt(lead.employeeCount, 10)
      return Number.isNaN(count) ? null : count
    })
    .filter((count): count is number => count !== null)

  if (employeeCounts.length === 0) {
    return "Unknown"
  }

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
