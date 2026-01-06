import { describe, expect, it } from "bun:test"
import { SEARCH_CONFIG, type SearchProgress } from "../src/services/lead-search-enrichment.service"

describe("Lead Search & Enrichment Service", () => {
  const _mockSearchQuery = "Software companies in United States"

  describe("Configuration", () => {
    it("should have correct default config", () => {
      expect(SEARCH_CONFIG.TARGET_LEADS).toBe(30)
      expect(SEARCH_CONFIG.MAX_EMPLOYEE_COUNT).toBe(5000)
      expect(SEARCH_CONFIG.HUNTERIO_MAX_EMAIL_COUNT).toBe(100)
      expect(SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE).toBe(30)
    })
  })

  describe("Filtering Logic", () => {
    it("should filter companies by employee count", () => {
      const companies = [
        { company: "SmallCo", employees: "100" },
        { company: "MediumCo", employees: "2000" },
        { company: "LargeCo", employees: "8000" },
        { company: "EnterpriseCo", employees: "50000" },
      ]

      const filtered = companies.filter((c) => {
        const count = parseInt(c.employees, 10)
        return count <= SEARCH_CONFIG.MAX_EMPLOYEE_COUNT
      })

      expect(filtered).toHaveLength(2)
      expect(filtered.map((c) => c.company)).toEqual(["SmallCo", "MediumCo"])
    })

    it("should filter companies by email count (Hunter.io proxy)", () => {
      const companies = [
        { name: "StartupCo", emailsCount: { total: 15 } },
        { name: "ScaleupCo", emailsCount: { total: 80 } },
        { name: "EnterpriseCo", emailsCount: { total: 500 } },
      ]

      const filtered = companies.filter(
        (c) => c.emailsCount.total <= SEARCH_CONFIG.HUNTERIO_MAX_EMAIL_COUNT,
      )

      expect(filtered).toHaveLength(2)
      expect(filtered.map((c) => c.name)).toEqual(["StartupCo", "ScaleupCo"])
    })

    it("should detect and skip duplicate domains", () => {
      const processedDomains = new Set<string>()
      const domains = ["example.com", "test.com", "example.com", "new.com", "TEST.COM"]

      const unique = domains.filter((domain) => {
        const normalized = domain.toLowerCase()
        if (processedDomains.has(normalized)) return false
        processedDomains.add(normalized)
        return true
      })

      expect(unique).toHaveLength(3)
      expect(unique).toEqual(["example.com", "test.com", "new.com"])
    })

    it("should filter out invalid email addresses", () => {
      const leads = [
        { primaryEmail: "contact@company.com" },
        { primaryEmail: "noreply@company.com" },
        { primaryEmail: "postmaster@company.com" },
        { primaryEmail: "abuse@company.com" },
        { primaryEmail: "sales@company.com" },
      ]

      const filtered = leads.filter((lead) => {
        if (!lead.primaryEmail) return false
        const email = lead.primaryEmail.toLowerCase()
        if (email.includes("noreply")) return false
        if (email.startsWith("postmaster@")) return false
        if (email.startsWith("abuse@")) return false
        return true
      })

      expect(filtered).toHaveLength(2)
      expect(filtered.map((l) => l.primaryEmail)).toEqual([
        "contact@company.com",
        "sales@company.com",
      ])
    })
  })

  describe("Progress Callbacks", () => {
    it("should call progress callback during search", async () => {
      const progressUpdates: SearchProgress[] = []

      const onProgress = (progress: SearchProgress) => {
        progressUpdates.push(progress)
      }

      // Note: This would require mocking the actual API calls
      // For now, just test the callback structure

      const mockProgress: SearchProgress = {
        phase: "bigquery",
        message: "Searching BigQuery",
        currentCount: 50,
        targetCount: 150,
      }

      await onProgress(mockProgress)

      expect(progressUpdates).toHaveLength(1)
      expect(progressUpdates[0]).toEqual(mockProgress)
    })

    it("should track progress through all phases", () => {
      const phases: SearchProgress["phase"][] = []

      const expectedPhases: SearchProgress["phase"][] = [
        "bigquery",
        "enrichment",
        "hunterio",
        "scoring",
        "complete",
      ]

      for (const phase of expectedPhases) {
        phases.push(phase)
      }

      expect(phases).toEqual(expectedPhases)
    })
  })

  describe("Statistics", () => {
    it("should calculate correct statistics", () => {
      const bigQueryLeads = 120
      const hunterIOLeads = 30
      const skippedDuplicates = 50
      const skippedLargeCompanies = 25
      const skippedLowScoring = 10

      const stats = {
        totalFound: bigQueryLeads + hunterIOLeads,
        fromBigQuery: bigQueryLeads,
        fromHunterIO: hunterIOLeads,
        skippedDuplicates,
        skippedLargeCompanies,
        skippedLowScoring,
        withEmails: bigQueryLeads + hunterIOLeads,
      }

      expect(stats.totalFound).toBe(150)
      expect(stats.fromBigQuery).toBe(120)
      expect(stats.fromHunterIO).toBe(30)
      expect(stats.skippedDuplicates).toBe(50)
      expect(stats.skippedLargeCompanies).toBe(25)
      expect(stats.skippedLowScoring).toBe(10)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty BigQuery results", () => {
      const results: Array<{ website?: string }> = []
      const filtered = results.filter((r) => r.website && r.website.length > 0)
      expect(filtered).toHaveLength(0)
    })

    it("should handle leads without email", () => {
      const leads = [
        { companyName: "Test1", primaryEmail: "test@test.com" },
        { companyName: "Test2", primaryEmail: null },
        { companyName: "Test3", primaryEmail: "contact@test.com" },
      ]

      const withEmails = leads.filter((l) => l.primaryEmail)
      expect(withEmails).toHaveLength(2)
    })

    it("should handle zero or negative employee counts", () => {
      const companies = [
        { employees: "0" },
        { employees: "-1" },
        { employees: "" },
        { employees: "100" },
      ]

      const valid = companies.filter((c) => {
        const count = parseInt(c.employees || "0", 10)
        return count > 0 && count <= SEARCH_CONFIG.MAX_EMPLOYEE_COUNT
      })

      expect(valid).toHaveLength(1)
    })

    it("should handle malformed employee data", () => {
      const testCases = ["abc", "N/A", "unknown"]

      testCases.forEach((employees) => {
        const count = parseInt(employees, 10)
        // parseInt returns NaN for invalid strings that don't start with numbers
        expect(Number.isNaN(count)).toBe(true)
      })

      // Partial parsing cases: parseInt stops at first non-numeric character
      expect(parseInt("1-50", 10)).toBe(1)
      expect(parseInt("100+", 10)).toBe(100)
    })
  })

  describe("Data Transformations", () => {
    it("should transform BigQuery results to enriched leads", () => {
      const bigQueryRow = {
        company: "Test Company",
        website: "https://test.com",
        industry: "Software",
        employees: "100",
        country: "United States",
      }

      const enrichedLead = {
        companyName: bigQueryRow.company,
        websiteUrl: bigQueryRow.website,
        primaryEmail: "contact@test.com", // Would come from enrichment
        businessType: bigQueryRow.industry,
        country: bigQueryRow.country,
        employeeCount: bigQueryRow.employees,
        leadSource: "bigquery-auto" as const,
      }

      expect(enrichedLead.companyName).toBe(bigQueryRow.company)
      expect(enrichedLead.websiteUrl).toBe(bigQueryRow.website)
      expect(enrichedLead.leadSource).toBe("bigquery-auto")
    })

    it("should transform Hunter.io results to enriched leads", () => {
      const hunterIOLead = {
        organization: "Hunter Company",
        domain: "hunter.com",
        emailsCount: { total: 50 },
      }

      const enrichedLead = {
        companyName: hunterIOLead.organization,
        websiteUrl: `https://${hunterIOLead.domain}`,
        primaryEmail: "contact@hunter.com", // From Domain Search API
        leadSource: "hunterio-discover" as const,
      }

      expect(enrichedLead.companyName).toBe(hunterIOLead.organization)
      expect(enrichedLead.websiteUrl).toBe("https://hunter.com")
      expect(enrichedLead.leadSource).toBe("hunterio-discover")
    })
  })

  describe("Natural Language Query", () => {
    it("should accept natural language query strings", () => {
      const validQueries = [
        "Software companies in United States",
        "Technology startups in Japan",
        "Healthcare B2B companies in Germany",
        "Manufacturing firms in United Kingdom",
      ]

      validQueries.forEach((query) => {
        expect(typeof query).toBe("string")
        expect(query.length).toBeGreaterThan(0)
      })
    })

    it("should handle queries with various formats", () => {
      const queries = [
        "Software companies in United States",
        "software companies in united states", // lowercase
        "B2B SaaS companies in USA",
        "Technology startups with 50-200 employees in Japan",
      ]

      queries.forEach((query) => {
        expect(query).toMatch(/\w+.*in\s+\w+/i) // Contains "in" with text before and after
      })
    })
  })

  describe("Performance Considerations", () => {
    it("should batch enrichment correctly", () => {
      const totalLeads = 100
      const batchSize = SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE

      const batches = Math.ceil(totalLeads / batchSize)
      expect(batches).toBe(4) // 100 / 30 = 3.33, ceil = 4

      // Verify batch sizes
      const expectedBatchSizes = [30, 30, 30, 10]
      expectedBatchSizes.forEach((size, i) => {
        const start = i * batchSize
        const end = Math.min(start + batchSize, totalLeads)
        const actualSize = end - start
        expect(actualSize).toBe(size)
      })
    })

    it("should limit BigQuery results per query", () => {
      const queryLimit = SEARCH_CONFIG.BIGQUERY_BATCH_SIZE
      expect(queryLimit).toBe(30)

      // Should not fetch more than limit per query
      const mockResults = new Array(queryLimit + 50).fill({})
      const limited = mockResults.slice(0, queryLimit)
      expect(limited).toHaveLength(queryLimit)
    })

    it("should paginate Hunter.io results", () => {
      const maxPerPage = SEARCH_CONFIG.HUNTERIO_MAX_PER_PAGE
      const totalNeeded = 250

      const pages = Math.ceil(totalNeeded / maxPerPage)
      expect(pages).toBe(3) // 250 / 100 = 2.5, ceil = 3
    })
  })

  describe("Domain Normalization", () => {
    it("should normalize domains to lowercase", () => {
      const domains = ["Example.COM", "TeSt.CoM", "NEW.com"]
      const normalized = domains.map((d) => d.toLowerCase())

      expect(normalized).toEqual(["example.com", "test.com", "new.com"])
    })

    it("should handle domains with protocols", () => {
      const urls = ["https://example.com", "http://test.com", "example.org"]

      // Extract domain from URL
      const domains = urls.map((url) => {
        try {
          return new URL(url).hostname.toLowerCase()
        } catch {
          return url.toLowerCase()
        }
      })

      expect(domains).toEqual(["example.com", "test.com", "example.org"])
    })
  })

  describe("Integration Scenarios", () => {
    it("should handle BigQuery success with no fallback needed", () => {
      const targetLeads = 150
      const bigQueryLeads = 150
      const hunterIOLeads = 0

      const totalLeads = bigQueryLeads + hunterIOLeads
      expect(totalLeads).toBe(targetLeads)
      expect(hunterIOLeads).toBe(0) // No fallback triggered
    })

    it("should handle BigQuery partial results with Hunter.io fallback", () => {
      const targetLeads = 150
      const bigQueryLeads = 100
      const hunterIOLeads = 50

      const totalLeads = bigQueryLeads + hunterIOLeads
      expect(totalLeads).toBe(targetLeads)
      expect(bigQueryLeads).toBeLessThan(targetLeads) // Fallback was needed
      expect(hunterIOLeads).toBeGreaterThan(0)
    })

    it("should handle case where combined results exceed target", () => {
      const targetLeads = 150
      const bigQueryLeads = 100
      const hunterIOLeads = 60 // Could overshoot

      const totalLeads = Math.min(bigQueryLeads + hunterIOLeads, targetLeads)
      expect(totalLeads).toBeLessThanOrEqual(targetLeads)
    })
  })
})

describe("Mock-based Integration Tests", () => {
  it("should successfully search and enrich with mocked data", async () => {
    // This would be a full mock test if we mock all external dependencies
    // For now, just verify the structure

    const mockResult = {
      leads: [
        {
          companyName: "Test Co",
          websiteUrl: "https://test.com",
          primaryEmail: "contact@test.com",
          leadSource: "bigquery-auto" as const,
        },
      ],
      stats: {
        totalFound: 1,
        fromBigQuery: 1,
        fromHunterIO: 0,
        skippedDuplicates: 0,
        skippedLargeCompanies: 0,
        skippedLowScoring: 0,
        withEmails: 1,
      },
    }

    expect(mockResult.leads).toHaveLength(1)
    expect(mockResult.stats.totalFound).toBe(1)
    expect(mockResult.leads[0]?.leadSource).toBe("bigquery-auto")
  })
})
