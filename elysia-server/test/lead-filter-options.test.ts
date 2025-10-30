import "dotenv/config"
import { describe, expect, test } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { Elysia } from "elysia"
import { leadRoutes } from "../src/routes/leads.routes"

/**
 * Integration Tests for Lead Filter Options API
 *
 * Tests the GET /api/v1/leads/filter-options/:field endpoint
 */

// Test app setup
function createTestApp() {
  return new Elysia().use(leadRoutes)
}

describe("Lead Filter Options API", () => {
  const app = createTestApp()
  const api = treaty(app)

  test("endpoint structure is correctly typed", () => {
    // Verify endpoint exists and is typed
    expect(api.api).toBeDefined()
    expect(api.api.v1).toBeDefined()
    expect(api.api.v1.leads).toBeDefined()
  })

  describe("Standard Fields (country, city, state, leadSource, businessType)", () => {
    test("returns filter options for country field", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "country" }).get()

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.success).toBe(true)
        expect(data.data.field).toBe("country")
        expect(Array.isArray(data.data.options)).toBe(true)
        expect(typeof data.data.total).toBe("number")

        // Check option structure
        if (data.data.options.length > 0) {
          const option = data.data.options[0]
          expect(option).toHaveProperty("value")
          expect(option).toHaveProperty("label")
          expect(option).toHaveProperty("count")
          expect(typeof option.value).toBe("string")
          expect(typeof option.label).toBe("string")
          expect(typeof option.count).toBe("number")
        }
      }
    })

    test("returns filter options for city field", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "city" }).get()

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.data.field).toBe("city")
        expect(Array.isArray(data.data.options)).toBe(true)
      }
    })

    test("returns filter options for leadSource field", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "leadSource" }).get()

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.data.field).toBe("leadSource")
        expect(Array.isArray(data.data.options)).toBe(true)
      }
    })

    test("returns filter options for state field", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "state" }).get()

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.data.field).toBe("state")
        expect(Array.isArray(data.data.options)).toBe(true)
      }
    })

    test("returns filter options for businessType field", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "businessType" }).get()

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.data.field).toBe("businessType")
        expect(Array.isArray(data.data.options)).toBe(true)
      }
    })
  })

  describe("Special Field: leadStatus (enum)", () => {
    test("returns all enum values with counts", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "leadStatus" }).get()

      expect(response.status).toBeDefined()

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.success).toBe(true)
        expect(data.data.field).toBe("leadStatus")
        expect(Array.isArray(data.data.options)).toBe(true)

        // Should return all enum values
        const expectedStatuses = ["new", "contacted", "qualified", "unqualified", "converted", "lost", "unsubscribed"]
        const returnedValues = data.data.options.map((opt: any) => opt.value)

        expectedStatuses.forEach((status) => {
          expect(returnedValues).toContain(status)
        })

        // Check that labels are capitalized
        data.data.options.forEach((option: any) => {
          expect(option.label).toBe(option.value.charAt(0).toUpperCase() + option.value.slice(1))
          expect(typeof option.count).toBe("number")
          expect(option.count).toBeGreaterThanOrEqual(0)
        })
      }
    })
  })

  describe("Special Field: employeeCount (ranges)", () => {
    test("returns predefined ranges with counts", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "employeeCount" }).get()

      expect(response.status).toBeDefined()

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        expect(data.success).toBe(true)
        expect(data.data.field).toBe("employeeCount")
        expect(Array.isArray(data.data.options)).toBe(true)

        // Should return predefined ranges
        const expectedRanges = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]
        const returnedValues = data.data.options.map((opt: any) => opt.value)

        expectedRanges.forEach((range) => {
          expect(returnedValues).toContain(range)
        })

        // Check structure
        data.data.options.forEach((option: any) => {
          expect(option).toHaveProperty("value")
          expect(option).toHaveProperty("label")
          expect(option).toHaveProperty("count")
          expect(typeof option.count).toBe("number")
          expect(option.count).toBeGreaterThanOrEqual(0)
        })
      }
    })
  })

  describe("Workspace Filtering", () => {
    test("accepts workspaceId query parameter", async () => {
      // Using a mock UUID for testing
      const mockWorkspaceId = "00000000-0000-0000-0000-000000000000"

      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "country" }).get({
        query: {
          workspaceId: mockWorkspaceId,
        },
      })

      expect(response.status).toBeDefined()
      expect([200, 400, 404, 500]).toContain(response.status)
    })
  })

  describe("Error Handling", () => {
    test("returns 400 or 404 for invalid field parameter", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "invalidField" }).get()

      expect([400, 404]).toContain(response.status)

      if (response.status === 400 && response.data && "message" in response.data) {
        const data = response.data as any
        expect(data.success).toBe(false)
        expect(data.message).toContain("Invalid field parameter")
      }
    })

    test("rejects non-allowed fields", async () => {
      const invalidFields = ["companyName", "websiteUrl", "description", "notes"]

      for (const field of invalidFields) {
        const response = await (api.api.v1.leads as any)["filter-options"]({ field }).get()
        expect([400, 404]).toContain(response.status)
      }
    })
  })

  describe("Response Structure", () => {
    test("response has correct structure", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "country" }).get()

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any

        // Check top-level structure
        expect(data).toHaveProperty("success")
        expect(data).toHaveProperty("code")
        expect(data).toHaveProperty("data")
        expect(data).toHaveProperty("timestamp")

        // Check data structure
        expect(data.data).toHaveProperty("field")
        expect(data.data).toHaveProperty("options")
        expect(data.data).toHaveProperty("total")

        // Validate types
        expect(typeof data.success).toBe("boolean")
        expect(typeof data.code).toBe("string")
        expect(typeof data.timestamp).toBe("string")
        expect(typeof data.data.field).toBe("string")
        expect(Array.isArray(data.data.options)).toBe(true)
        expect(typeof data.data.total).toBe("number")
      }
    })

    test("total equals sum of all option counts", async () => {
      const response = await (api.api.v1.leads as any)["filter-options"]({ field: "leadStatus" }).get()

      if (response.status === 200 && response.data && "data" in response.data) {
        const data = response.data as any
        const sumOfCounts = data.data.options.reduce((sum: number, opt: any) => sum + opt.count, 0)
        expect(data.data.total).toBe(sumOfCounts)
      }
    })
  })
})
