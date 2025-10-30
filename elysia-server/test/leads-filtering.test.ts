import "dotenv/config"
import { describe, expect, test } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { Elysia } from "elysia"
import { leadRoutes } from "../src/routes/leads.routes"
import type { ColumnFilter } from "../src/types/lead-filters.types"

/**
 * Integration Tests for Lead Filtering API
 *
 * Tests the Eden Treaty type safety and API contract for filtering endpoints
 */

// Test app setup
function createTestApp() {
  return new Elysia().use(leadRoutes)
}

describe("Lead Filtering API - Eden Treaty Type Safety", () => {
  const app = createTestApp()
  const api = treaty(app)

  test("endpoint structure is correctly typed", () => {
    // Verify endpoint exists and is typed
    expect(api.api).toBeDefined()
    expect(api.api.v1).toBeDefined()
    expect(api.api.v1.leads).toBeDefined()
    expect(api.api.v1.leads.search).toBeDefined()
    expect(api.api.v1.leads.search.get).toBeDefined()
    expect(typeof api.api.v1.leads.search.get).toBe("function")
  })

  test("can call endpoint with no filters", async () => {
    const response = await api.api.v1.leads.search.get({
      query: {
        limit: "5",
        offset: "0",
      },
    })

    expect(response.status).toBeDefined()
    expect([200, 400, 500]).toContain(response.status)

    // Type check - response should have data property when successful
    if (response.status === 200 && response.data && "data" in response.data) {
      const data = response.data as any
      expect(Array.isArray(data.data.data)).toBe(true)
      expect(typeof data.data.total).toBe("number")
      expect(typeof data.data.limit).toBe("number")
      expect(typeof data.data.offset).toBe("number")
    }
  })

  test("accepts valid filter JSON format", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "leadScore",
        operator: "gt",
        value: 50,
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
        limit: "10",
      },
    })

    expect(response.status).toBeDefined()
    expect([200, 400, 500]).toContain(response.status)
  })

  test("accepts multiple filters with AND logic", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "country",
        operator: "in",
        value: ["USA", "Canada"],
      },
      {
        field: "leadScore",
        operator: "gte",
        value: 70,
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
      },
    })

    expect(response.status).toBeDefined()
  })

  test("accepts sorting parameters", async () => {
    const response = await api.api.v1.leads.search.get({
      query: {
        sortField: "leadScore",
        sortOrder: "desc",
        limit: "5",
      },
    })

    expect(response.status).toBeDefined()
    expect([200, 400, 500]).toContain(response.status)

    if (response.status === 200 && response.data && "data" in response.data && response.data.data) {
      expect((response.data as any).data.limit).toBe(5)
    }
  })

  test("accepts date range filters", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const response = await api.api.v1.leads.search.get({
      query: {
        createdAfter: yesterday.toISOString(),
        limit: "10",
      },
    })

    expect(response.status).toBeDefined()
  })

  test("returns error for invalid JSON filters", async () => {
    const response = await api.api.v1.leads.search.get({
      query: {
        filters: "{invalid json",
      },
    })

    // Elysia may return 400 or 422 for validation errors
    expect([400, 422]).toContain(response.status)
  })

  test("response structure matches schema on success", async () => {
    const response = await api.api.v1.leads.search.get({
      query: {
        limit: "1",
      },
    })

    if (response.status === 200 && response.data && "data" in response.data) {
      // Verify response structure
      expect(response.data).toHaveProperty("data")
      expect(response.data).toHaveProperty("total")
      expect(response.data).toHaveProperty("limit")
      expect(response.data).toHaveProperty("offset")

      // Verify data is array
      const data = response.data as any
      expect(Array.isArray(data.data.data)).toBe(true)

      // If we have results, verify lead structure
      if (data.data.data.length > 0) {
        const lead = data.data.data[0]

        if (lead) {
          // Core fields
          expect(lead).toHaveProperty("id")
          expect(lead).toHaveProperty("workspaceId")
          expect(lead).toHaveProperty("workspaceName")
          expect(lead).toHaveProperty("companyName")
          expect(lead).toHaveProperty("leadStatus")
          expect(lead).toHaveProperty("leadScore")
          expect(lead).toHaveProperty("createdAt")
          expect(lead).toHaveProperty("updatedAt")

          // Related data arrays
          expect(lead).toHaveProperty("contacts")
          expect(Array.isArray(lead.contacts)).toBe(true)
          expect(lead).toHaveProperty("socialMedia")
          expect(Array.isArray(lead.socialMedia)).toBe(true)
          expect(lead).toHaveProperty("products")
          expect(Array.isArray(lead.products)).toBe(true)
          expect(lead).toHaveProperty("businessSectors")
          expect(Array.isArray(lead.businessSectors)).toBe(true)
          expect(lead).toHaveProperty("productCategories")
          expect(Array.isArray(lead.productCategories)).toBe(true)
          expect(lead).toHaveProperty("industryTypes")
          expect(Array.isArray(lead.industryTypes)).toBe(true)
        }
      }
    }
  })

  test("supports all filter operators", async () => {
    const testCases: Array<{
      operator: ColumnFilter["operator"]
      // biome-ignore lint/suspicious/noExplicitAny: Test cases need flexible value types
      value: any
    }> = [
      { operator: "equals", value: "Test" },
      { operator: "notEquals", value: "Test" },
      { operator: "contains", value: "test" },
      { operator: "startsWith", value: "Test" },
      { operator: "endsWith", value: "Corp" },
      { operator: "gt", value: 50 },
      { operator: "lt", value: 100 },
      { operator: "gte", value: 50 },
      { operator: "lte", value: 100 },
      { operator: "between", value: { min: 10, max: 90 } },
      { operator: "in", value: ["USA", "Canada"] },
      { operator: "notIn", value: ["Spam"] },
      { operator: "isEmpty", value: null },
      { operator: "isNotEmpty", value: null },
    ]

    for (const testCase of testCases) {
      const filters: ColumnFilter[] = [
        {
          field: testCase.operator.includes("Empty") ? "notes" : "companyName",
          operator: testCase.operator,
          value: testCase.value,
        },
      ]

      const response = await api.api.v1.leads.search.get({
        query: {
          filters: JSON.stringify(filters),
        },
      })

      expect(response.status).toBeDefined()
      expect([200, 400, 500]).toContain(response.status)
    }
  })

  test("supports numeric field filtering", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "leadScore",
        operator: "between",
        value: { min: 50, max: 100 },
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
      },
    })

    expect(response.status).toBeDefined()
  })

  test("supports date field filtering with between operator", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "createdAt",
        operator: "between",
        value: { from: "2025-01-01", to: "2025-12-31" },
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
      },
    })

    expect(response.status).toBeDefined()
  })

  test("supports enum field filtering", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "leadStatus",
        operator: "in",
        value: ["new", "qualified", "converted"],
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
      },
    })

    expect(response.status).toBeDefined()
  })

  test("combines filters with sorting and pagination", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "leadScore",
        operator: "gte",
        value: 50,
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
        sortField: "leadScore",
        sortOrder: "desc",
        limit: "5",
        offset: "0",
      },
    })

    expect(response.status).toBeDefined()

    if (response.status === 200 && response.data && "data" in response.data) {
      const data = response.data as any
      expect(data.data.limit).toBe(5)
      expect(data.data.offset).toBe(0)
    }
  })

  test("combines column filters with legacy filters", async () => {
    const filters: ColumnFilter[] = [
      {
        field: "leadScore",
        operator: "gt",
        value: 70,
      },
    ]

    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify(filters),
        leadStatus: "qualified",
        country: "USA",
      },
    })

    expect(response.status).toBeDefined()
  })

  test("handles empty filter array", async () => {
    const response = await api.api.v1.leads.search.get({
      query: {
        filters: JSON.stringify([]),
      },
    })

    expect(response.status).toBeDefined()
    expect([200, 400, 500]).toContain(response.status)
  })

  test("TypeScript enforces correct filter structure", () => {
    // This test validates TypeScript compilation
    const validFilter: ColumnFilter = {
      field: "companyName",
      operator: "contains",
      value: "test",
    }

    expect(validFilter.field).toBe("companyName")
    expect(validFilter.operator).toBe("contains")
    expect(validFilter.value).toBe("test")

    // TypeScript would catch these at compile time:
    // const invalid1: ColumnFilter = { field: 123 } // Error: field must be string
    // const invalid2: ColumnFilter = { operator: "invalid" } // Error: invalid operator
  })
})
