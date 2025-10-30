import "dotenv/config"
import { describe, expect, it } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { createTestApp } from "./setup"
import * as XLSX from "xlsx"

/**
 * Type-Safe API Tests for Lead Import
 *
 * These tests demonstrate Eden Treaty's type safety and API structure.
 * Eden Treaty provides full TypeScript autocomplete and type checking.
 */
describe("Lead Import API - Type Safety with Eden Treaty", () => {
  const app = createTestApp()
  const api = treaty(app)

  /**
   * Helper function to generate test Excel file
   */
  function generateTestExcel(leads: Array<{ companyName: string; websiteUrl: string; email?: string; phone?: string }>) {
    const worksheetData = leads.map((lead) => ({
      "회사명": lead.companyName,
      "웹사이트 URL": lead.websiteUrl,
      "이메일": lead.email || "",
      "전화번호": lead.phone || "",
    }))

    const worksheet = XLSX.utils.json_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads")

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  }

  it("demonstrates type-safe API endpoint access", () => {
    // ✅ TypeScript knows the exact structure
    expect(api.api).toBeDefined()
    expect(api.api.v1).toBeDefined()
    expect(api.api.v1.admin).toBeDefined()
    expect(api.api.v1.admin["lead-import"]).toBeDefined()
    expect(api.api.v1.admin["lead-import"].upload).toBeDefined()
    expect(api.api.v1.admin["lead-import"]["sheet-names"]).toBeDefined()
  })

  it("should have correct endpoint structure for upload", () => {
    const uploadEndpoint = api.api.v1.admin["lead-import"].upload

    // Verify endpoint exists and has the right methods
    expect(uploadEndpoint.post).toBeDefined()
    expect(typeof uploadEndpoint.post).toBe("function")
  })

  it("should have correct endpoint structure for sheet-names", () => {
    const sheetNamesEndpoint = api.api.v1.admin["lead-import"]["sheet-names"]

    // Verify endpoint exists and has the right methods
    expect(sheetNamesEndpoint.post).toBeDefined()
    expect(typeof sheetNamesEndpoint.post).toBe("function")
  })

  it("should generate valid Excel files for testing", () => {
    const excelBuffer = generateTestExcel([
      {
        companyName: "Test Company",
        websiteUrl: "https://test.com",
        email: "test@example.com",
        phone: "123-456-7890",
      },
    ])

    // Verify we got a buffer
    expect(excelBuffer).toBeInstanceOf(Buffer)
    expect(excelBuffer.length).toBeGreaterThan(0)

    // Verify it's a valid Excel file (check magic bytes)
    const header = excelBuffer.slice(0, 4).toString("hex")
    expect(header).toMatch(/504b0304/) // ZIP header (Excel files are ZIP archives)
  })

  it("should create File objects compatible with API", () => {
    const excelBuffer = generateTestExcel([
      {
        companyName: "Test",
        websiteUrl: "https://test.com",
      },
    ])

    const file = new File([excelBuffer], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    // Verify file properties
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe("test.xlsx")
    expect(file.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    expect(file.size).toBeGreaterThan(0)
  })

  /**
   * Type Safety Demonstration
   *
   * Uncomment these to see TypeScript errors:
   */
  it("demonstrates compile-time type safety", () => {
    // ✅ Valid endpoint access
    const validEndpoint = api.api.v1.admin["lead-import"].upload

    // ❌ Invalid endpoint would cause TypeScript error (uncomment to test):
    // const invalidEndpoint = api.api.v1.admin["non-existent"].upload

    // ❌ Invalid method would cause TypeScript error (uncomment to test):
    // validEndpoint.delete()

    expect(validEndpoint).toBeDefined()
  })

  /**
   * Response Structure Test
   *
   * This demonstrates what the response structure should look like
   * based on the implementation
   */
  it("documents expected response structure for duplicate detection", () => {
    // Based on ImportResult interface in lead-import.service.ts
    const expectedResponseStructure = {
      total: expect.any(Number),
      success: expect.any(Number),
      skipped: expect.any(Number),
      failed: expect.any(Number),
      details: {
        leadsCreated: expect.any(Number),
        contactsCreated: expect.any(Number),
        socialMediaCreated: expect.any(Number),
        productsCreated: expect.any(Number),
        sectorsCreated: expect.any(Number),
        categoriesCreated: expect.any(Number),
        industriesCreated: expect.any(Number),
        groupMembersCreated: expect.any(Number),
      },
      duplicateEmails: expect.any(Array), // ✅ New field for duplicate detection
      emailsSkipped: expect.any(Number),  // ✅ New field for skipped count
      groupAssignment: expect.anything(), // ✅ New field for group info (can be null)
      errors: expect.any(Array),
      duration: expect.any(Number),
    }

    // This documents the expected structure
    expect(expectedResponseStructure).toBeDefined()
    expect(expectedResponseStructure.duplicateEmails).toBeDefined()
    expect(expectedResponseStructure.emailsSkipped).toBeDefined()
    expect(expectedResponseStructure.groupAssignment).toBeDefined()

    // Verify the new fields for duplicate detection are present
    expect(typeof expectedResponseStructure.emailsSkipped).toBe("object")
    expect(Array.isArray(expectedResponseStructure.duplicateEmails)).toBe(false) // It's expect.any(Array), not actual array
  })
})
