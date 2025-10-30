/**
 * Excel File Fixtures for Testing
 *
 * Helper functions to generate test Excel files with lead data
 */

import * as XLSX from "xlsx"

export interface LeadFixture {
  companyName: string
  websiteUrl: string
  email?: string
  phone?: string
}

/**
 * Generate a test Excel file with lead data
 *
 * @param leads - Array of lead data to include in the Excel file
 * @returns Buffer containing the Excel file
 */
export function generateTestExcel(leads: LeadFixture[]): Buffer {
  const worksheetData = leads.map((lead) => ({
    company_name: lead.companyName,
    website_url: lead.websiteUrl,
    email: lead.email || "",
    phone_number: lead.phone || "",
  }))

  const worksheet = XLSX.utils.json_to_sheet(worksheetData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads")

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

/**
 * Common test lead fixtures
 */
export const testLeadFixtures = {
  /**
   * Single lead with all fields
   */
  complete: (): LeadFixture => ({
    companyName: "Test Company",
    websiteUrl: "https://test.com",
    email: "test@example.com",
    phone: "123-456-7890",
  }),

  /**
   * Lead with duplicate email
   */
  withDuplicateEmail: (email: string): LeadFixture => ({
    companyName: "Company With Duplicate",
    websiteUrl: "https://duplicate.com",
    email,
    phone: "123-456-7890",
  }),

  /**
   * Minimal lead (only required fields)
   */
  minimal: (companyName: string, websiteUrl: string): LeadFixture => ({
    companyName,
    websiteUrl,
  }),

  /**
   * Generate multiple leads with the same email (for CSV duplicate testing)
   */
  withCsvDuplicates: (email: string, count: number): LeadFixture[] => {
    return Array.from({ length: count }, (_, i) => ({
      companyName: `Company ${i + 1}`,
      websiteUrl: `https://company-${i + 1}.com`,
      email,
      phone: `123-456-${7890 + i}`,
    }))
  },
}
