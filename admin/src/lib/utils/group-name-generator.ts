import type { CompanyScale, GroupNameTemplate } from "@/lib/api/types/customer-group"

/**
 * Generates a formatted group name from a template.
 * Format: {Country}_{Scale}_{BusinessType}_{BusinessSector}_{UploadDate}
 *
 * @param template - The template data for generating the group name
 * @returns A formatted group name string with underscore separators
 *
 * @example
 * ```typescript
 * const template = {
 *   country: 'Korea',
 *   scale: 'Large',
 *   businessType: 'B2B',
 *   businessSector: 'SaaS',
 *   uploadDate: '2025-10-28'
 * }
 * const name = generateGroupName(template)
 * // Returns: "Korea_Large_B2B_SaaS_2025-10-28"
 * ```
 */
export const generateGroupName = (template: GroupNameTemplate): string => {
  const { country, scale, businessType, businessSector, uploadDate } = template

  // Sanitize each field to handle empty strings or provide placeholders
  const sanitizedCountry = country.trim() || "Unknown"
  const sanitizedScale = scale || "Unknown"
  const sanitizedBusinessType = businessType.trim() || "Unknown"
  const sanitizedBusinessSector = businessSector.trim() || "Unknown"
  const sanitizedDate = uploadDate.trim() || formatDateForGroupName(new Date())

  return `${sanitizedCountry}_${sanitizedScale}_${sanitizedBusinessType}_${sanitizedBusinessSector}_${sanitizedDate}`
}

/**
 * Formats a date string for use in group names.
 *
 * @param date - Date to format (ISO string or Date object)
 * @returns Formatted date string (YYYY-MM-DD)
 */
export const formatDateForGroupName = (date: string | Date): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    // Invalid date, return current date
    const now = new Date()
    return now.toISOString().split("T")[0]
  }

  return dateObj.toISOString().split("T")[0]
}

/**
 * Determines company scale category based on employee count.
 *
 * @param employeeCount - Number of employees
 * @returns Scale category (Small/Medium/Large/Unknown)
 *
 * Scale ranges:
 * - Small: 1-50 employees
 * - Medium: 51-250 employees
 * - Large: 251+ employees
 * - Unknown: null/undefined/0
 */
export const determineCompanyScale = (employeeCount: number | null | undefined): CompanyScale => {
  if (!employeeCount || employeeCount <= 0) {
    return "Unknown"
  }

  if (employeeCount <= 50) {
    return "Small"
  }

  if (employeeCount <= 250) {
    return "Medium"
  }

  return "Large"
}
