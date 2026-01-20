import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { BuyerIntelligence, Country } from "../types"

// Mock the rinda search service
const mockSearchCompanies = mock(() =>
  Promise.resolve({
    results: [
      {
        name: "Test Company",
        domain: "test.com",
        website: "https://test.com",
        industry: "Technology",
        locationCountry: "Japan",
        description: "A test company",
        size: "51-200",
        score: 0.9,
      },
    ],
  }),
)

mock.module("../../rinda-search.service", () => ({
  rindaSearchService: {
    searchCompanies: mockSearchCompanies,
  },
}))

// Import after mocking
const { searchWithRinda } = await import("../phases/search-rinda")

describe("searchWithRinda", () => {
  const mockIntelligence: BuyerIntelligence = {
    productSummary: "Industrial equipment manufacturer",
    buyerPersonas: [
      {
        type: "Distributor",
        typeKo: "유통사",
        description: "Equipment distributors",
        decisionMakers: ["Purchasing Manager"],
        targetCompanySize: ["medium", "large"],
        searchKeywords: {
          en: ["industrial distributor", "equipment wholesaler"],
          local: {},
        },
      },
    ],
    industryFilters: {
      keywords: ["industrial equipment"],
      excludeKeywords: [],
    },
    searchStrategy: {
      priorityPersonas: ["Distributor"],
      notes: "",
    },
  }

  const countries: Country[] = ["japan"]

  beforeEach(() => {
    mockSearchCompanies.mockClear()
  })

  it("should search Rinda and return RawCompany results", async () => {
    const results = await searchWithRinda(mockIntelligence, countries)

    expect(mockSearchCompanies).toHaveBeenCalled()
    expect(results.length).toBeGreaterThan(0)

    const firstResult = results[0]
    expect(firstResult).toBeDefined()
    expect(firstResult?.source).toBe("rinda")
    expect(firstResult?.companyName).toBe("Test Company")
  })

  it("should map size correctly", async () => {
    const results = await searchWithRinda(mockIntelligence, countries)

    const firstResult = results[0]
    expect(firstResult).toBeDefined()
    expect(firstResult?.size).toBe("medium") // 51-200 maps to medium
  })

  it("should handle API errors gracefully", async () => {
    mockSearchCompanies.mockImplementationOnce(() => Promise.reject(new Error("API Error")))

    const results = await searchWithRinda(mockIntelligence, countries)

    // Should return empty array, not throw
    expect(results).toEqual([])
  })
})
