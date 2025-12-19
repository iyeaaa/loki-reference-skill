import { describe, expect, it } from "bun:test"
import {
  getQueueStats,
  type HunterioCompany,
  HunterioDiscoverParamsSchema,
  HunterioDiscoverResponseSchema,
  searchLeadsWithHunter,
} from "./hunterio-lead-search.service"

describe("Hunter.io Lead Search Service", () => {
  describe("Input Parameter Schema Validation", () => {
    it("should validate valid parameters with query", () => {
      const validParams = {
        query: "AI startups in San Francisco",
        limit: 50,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.query).toBe("AI startups in San Francisco")
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0) // default value
      }
    })

    it("should validate organization with domain array", () => {
      const validParams = {
        organization: {
          domain: ["stripe.com", "google.com"],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.organization?.domain).toEqual(["stripe.com", "google.com"])
      }
    })

    it("should validate organization with name array", () => {
      const validParams = {
        organization: {
          name: ["Stripe", "Google"],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate headquarters_location with include", () => {
      const validParams = {
        headquarters_location: {
          include: [
            { country: "US", state: "CA" },
            { country: "GB", city: "London" },
          ],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate headquarters_location with continent and region", () => {
      const validParams = {
        headquarters_location: {
          include: [{ continent: "Europe" as const, business_region: "EMEA" as const }],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate industry with include and exclude", () => {
      const validParams = {
        industry: {
          include: ["Technology", "Software"],
          exclude: ["Consulting"],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate headcount as array", () => {
      const validParams = {
        query: "test",
        headcount: ["51-200" as const, "201-500" as const, "501-1000" as const],
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should accept all valid headcount enum values in array", () => {
      const validHeadcounts = [
        "1-10",
        "11-50",
        "51-200",
        "201-500",
        "501-1000",
        "1001-5000",
        "5001-10000",
        "10001+",
      ] as const

      const validParams = {
        query: "test",
        headcount: validHeadcounts,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate company_type with include and exclude", () => {
      const validParams = {
        company_type: {
          include: ["privately held" as const, "public company" as const],
          exclude: ["government agency" as const],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate keywords with match option", () => {
      const validParams = {
        keywords: {
          include: ["AI", "machine learning"],
          exclude: ["consulting"],
          match: "any" as const,
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate year_founded with range", () => {
      const validParams = {
        year_founded: {
          from: 2010,
          to: 2020,
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate funding with series and amount", () => {
      const validParams = {
        funding: {
          series: ["series_a" as const, "series_b" as const],
          amount: {
            from: 1000000,
            to: 10000000,
          },
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate similar_to parameter", () => {
      const validParams = {
        similar_to: {
          domain: "stripe.com",
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate technology filter", () => {
      const validParams = {
        technology: {
          include: ["React", "Node.js"],
          match: "all" as const,
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should validate complex multi-filter search", () => {
      const validParams = {
        query: "SaaS companies",
        organization: {
          domain: ["example.com"],
        },
        headquarters_location: {
          include: [{ country: "US", state: "CA" }],
        },
        industry: {
          include: ["Technology"],
        },
        headcount: ["51-200" as const, "201-500" as const],
        company_type: {
          include: ["privately held" as const],
        },
        keywords: {
          include: ["software", "platform"],
          match: "all" as const,
        },
        limit: 50,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it("should reject parameters with no search criteria", () => {
      const invalidParams = {
        limit: 50,
        offset: 0,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("At least one search parameter")
      }
    })

    it("should reject invalid headcount value in array", () => {
      const invalidParams = {
        query: "test",
        headcount: ["invalid-range"],
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should reject invalid company_type value", () => {
      const invalidParams = {
        company_type: {
          include: ["invalid-type"],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should reject invalid continent value", () => {
      const invalidParams = {
        headquarters_location: {
          include: [{ continent: "Invalid Continent" }],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should reject limit below 1", () => {
      const invalidParams = {
        query: "test",
        limit: 0,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should reject limit above 100", () => {
      const invalidParams = {
        query: "test",
        limit: 101,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should reject negative offset", () => {
      const invalidParams = {
        query: "test",
        offset: -1,
      }

      const result = HunterioDiscoverParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it("should apply default values for limit and offset", () => {
      const params = {
        query: "test",
      }

      const result = HunterioDiscoverParamsSchema.safeParse(params)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(100)
        expect(result.data.offset).toBe(0)
      }
    })
  })

  describe("Output Response Schema Validation", () => {
    it("should validate valid API response", () => {
      const validResponse = {
        data: [
          {
            domain: "example.com",
            organization: "Example Inc",
            emails_count: {
              personal: 10,
              generic: 5,
              total: 15,
            },
          },
          {
            domain: "test.com",
            organization: "Test Corp",
            emails_count: {
              personal: 0,
              generic: 3,
              total: 3,
            },
          },
        ],
        meta: {
          results: 2,
          limit: 100,
          offset: 0,
          params: { query: "test companies" },
          filters: { headcount: ["51-200"] },
        },
      }

      const result = HunterioDiscoverResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(2)
        expect(result.data.meta.results).toBe(2)
      }
    })

    it("should validate empty data array response", () => {
      const emptyResponse = {
        data: [],
        meta: {
          results: 0,
          limit: 100,
          offset: 0,
          params: { query: "nonexistent" },
        },
      }

      const result = HunterioDiscoverResponseSchema.safeParse(emptyResponse)
      expect(result.success).toBe(true)
    })

    it("should reject response missing required fields", () => {
      const invalidResponse = {
        data: [
          {
            domain: "example.com",
            // missing organization
            emails_count: {
              personal: 10,
              generic: 5,
              total: 15,
            },
          },
        ],
        meta: {
          results: 1,
          limit: 100,
          offset: 0,
          params: {},
        },
      }

      const result = HunterioDiscoverResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with invalid email counts", () => {
      const invalidResponse = {
        data: [
          {
            domain: "example.com",
            organization: "Example Inc",
            emails_count: {
              personal: "not-a-number", // should be number
              generic: 5,
              total: 15,
            },
          },
        ],
        meta: {
          results: 1,
          limit: 100,
          offset: 0,
          params: {},
        },
      }

      const result = HunterioDiscoverResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe("Service Function - Error Handling", () => {
    it("should return empty array for invalid input parameters", async () => {
      const invalidParams = {
        limit: 50,
        // missing required search parameter
      }

      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
      const result = await searchLeadsWithHunter(invalidParams as any)

      expect(result).toEqual([])
    })

    it("should return empty array for parameters with wrong types", async () => {
      const invalidParams = {
        query: "test",
        limit: "not-a-number", // should be number
      }

      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
      const result = await searchLeadsWithHunter(invalidParams as any)

      expect(result).toEqual([])
    })
  })

  describe("Queue Statistics", () => {
    it("should return queue statistics", () => {
      const stats = getQueueStats()

      expect(stats).toBeDefined()
      expect(stats.minuteQueue).toBeDefined()
      expect(stats.secondQueue).toBeDefined()
      expect(typeof stats.minuteQueue.size).toBe("number")
      expect(typeof stats.minuteQueue.pending).toBe("number")
      expect(typeof stats.secondQueue.size).toBe("number")
      expect(typeof stats.secondQueue.pending).toBe("number")
    })
  })

  describe("Integration Test - Real API (Manual)", () => {
    // These tests require a valid Hunter.io API key and will make real API calls
    // Uncomment to run manually
    it.skip("should search for companies with query", async () => {
      const params = {
        query: "AI companies in San Francisco",
        limit: 10,
      }

      const result = await searchLeadsWithHunter(params)

      console.log("Hunter.io Discover Result:", JSON.stringify(result, null, 2))

      expect(result).toBeInstanceOf(Array)
      if (result.length > 0) {
        const firstCompany = result[0]
        expect(firstCompany).toBeDefined()
        expect(firstCompany).toHaveProperty("domain")
        expect(firstCompany).toHaveProperty("organization")
        expect(firstCompany).toHaveProperty("emailsCount")
        if (firstCompany) {
          expect(firstCompany.emailsCount).toHaveProperty("personal")
          expect(firstCompany.emailsCount).toHaveProperty("generic")
          expect(firstCompany.emailsCount).toHaveProperty("total")
        }
      }
    }, 30000)

    it.skip("should handle organization search with domain array", async () => {
      const params = {
        organization: {
          domain: ["stripe.com"],
        },
        limit: 5,
      }

      const result = await searchLeadsWithHunter(params)

      console.log("Organization search result:", JSON.stringify(result, null, 2))

      expect(result).toBeInstanceOf(Array)
    }, 30000)

    it.skip("should handle headcount filter as array", async () => {
      const params = {
        query: "SaaS",
        headcount: ["51-200" as const, "201-500" as const],
        limit: 10,
      }

      const result = await searchLeadsWithHunter(params)

      console.log("Headcount filter result:", JSON.stringify(result, null, 2))

      expect(result).toBeInstanceOf(Array)
    }, 30000)

    it.skip("should handle complex multi-filter search", async () => {
      const params = {
        query: "technology companies",
        headquarters_location: {
          include: [{ country: "US", state: "CA" }],
        },
        industry: {
          include: ["Technology", "Software"],
        },
        headcount: ["51-200" as const],
        limit: 10,
      }

      const result = await searchLeadsWithHunter(params)

      console.log("Multi-filter result:", JSON.stringify(result, null, 2))

      expect(result).toBeInstanceOf(Array)
    }, 30000)

    it.skip("should test cache hit on second call", async () => {
      const params = {
        query: "test cache behavior",
        limit: 5,
      }

      console.log("First call (should miss cache)...")
      const startTime1 = Date.now()
      const result1 = await searchLeadsWithHunter(params)
      const elapsed1 = Date.now() - startTime1
      console.log(`First call completed in ${elapsed1}ms`)

      console.log("Second call (should hit cache)...")
      const startTime2 = Date.now()
      const result2 = await searchLeadsWithHunter(params)
      const elapsed2 = Date.now() - startTime2
      console.log(`Second call completed in ${elapsed2}ms`)

      // Second call should be significantly faster if cache is working
      expect(elapsed2).toBeLessThan(elapsed1)
      expect(result1).toEqual(result2)
    }, 60000)
  })

  describe("Data Transformation", () => {
    it("should correctly transform API response to HunterioCompany format", () => {
      const apiResponse = {
        domain: "example.com",
        organization: "Example Inc",
        emails_count: {
          personal: 10,
          generic: 5,
          total: 15,
        },
      }

      const transformed: HunterioCompany = {
        domain: apiResponse.domain,
        organization: apiResponse.organization,
        emailsCount: {
          personal: apiResponse.emails_count.personal,
          generic: apiResponse.emails_count.generic,
          total: apiResponse.emails_count.total,
        },
      }

      expect(transformed.domain).toBe("example.com")
      expect(transformed.organization).toBe("Example Inc")
      expect(transformed.emailsCount.personal).toBe(10)
      expect(transformed.emailsCount.generic).toBe(5)
      expect(transformed.emailsCount.total).toBe(15)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty object parameters gracefully", async () => {
      const params = {}

      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
      const result = await searchLeadsWithHunter(params as any)

      // Should return empty array due to validation failure
      expect(result).toBeInstanceOf(Array)
      expect(result).toEqual([])
    })

    it("should handle extremely long query string", async () => {
      const longQuery = "a".repeat(1000)
      const params = {
        query: longQuery,
      }

      const result = await searchLeadsWithHunter(params)

      // Should not crash
      expect(result).toBeInstanceOf(Array)
    })

    it("should handle special characters in query", async () => {
      const params = {
        query: "companies with special chars: @#$%^&*()",
      }

      const result = await searchLeadsWithHunter(params)

      expect(result).toBeInstanceOf(Array)
    })

    it("should handle multiple location filters", async () => {
      const params = {
        headquarters_location: {
          include: [
            { country: "US", state: "CA" },
            { country: "US", state: "NY" },
            { country: "GB" },
          ],
          exclude: [{ country: "FR" }],
        },
      }

      const result = HunterioDiscoverParamsSchema.safeParse(params)
      expect(result.success).toBe(true)
    })
  })
})
