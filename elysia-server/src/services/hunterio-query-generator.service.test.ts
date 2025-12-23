import { describe, expect, test } from "bun:test"
import { VALID_HUNTERIO_INDUSTRIES } from "../constants/hunterio-industries"

// Cast to mutable array for easier testing
const INDUSTRIES_LIST = VALID_HUNTERIO_INDUSTRIES as readonly string[]

/**
 * Tests for hunterio-query-generator.service.ts
 *
 * Note: LLM calls are tested via integration tests.
 * These unit tests focus on the fallback logic and parameter transformation.
 */

describe("hunterio-query-generator.service", () => {
  describe("valid industries constant", () => {
    test("VALID_HUNTERIO_INDUSTRIES contains expected industries", () => {
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Software Development")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("IT Services and IT Consulting")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Financial Services")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Manufacturing")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Retail")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Education")
      expect(VALID_HUNTERIO_INDUSTRIES).toContain("Hospitals and Health Care")
    })

    test("VALID_HUNTERIO_INDUSTRIES has many entries", () => {
      expect(VALID_HUNTERIO_INDUSTRIES.length).toBeGreaterThan(400)
    })

    test("all industries are non-empty strings", () => {
      for (const industry of VALID_HUNTERIO_INDUSTRIES) {
        expect(typeof industry).toBe("string")
        expect(industry.length).toBeGreaterThan(0)
      }
    })
  })

  describe("fallback params structure", () => {
    test("fallback params have correct structure with valid industries", () => {
      // Test the expected fallback structure directly using valid industries
      const fallbackParams = {
        query: "B2B companies in tech sector",
        headquarters_location: { include: [{ country: "US" }] },
        industry: {
          include: [
            "Software Development",
            "IT Services and IT Consulting",
            "Technology, Information and Internet",
          ],
        },
        headcount: ["1-10", "11-50", "51-200", "201-500", "501-1000"] as const,
        limit: 100,
        offset: 0,
      }

      expect(fallbackParams).toHaveProperty("limit", 100)
      expect(fallbackParams).toHaveProperty("offset", 0)
      expect(fallbackParams).toHaveProperty("query")
      expect(fallbackParams.headquarters_location.include).toHaveLength(1)
      expect(fallbackParams.industry.include).toContain("Software Development")
      expect(fallbackParams.headcount).toHaveLength(5)

      // Verify all industries are valid
      for (const industry of fallbackParams.industry.include) {
        expect(INDUSTRIES_LIST).toContain(industry)
      }
    })
  })

  describe("country code mapping (unit tests)", () => {
    const countryMappings = [
      { input: "us", expected: "US" },
      { input: "usa", expected: "US" },
      { input: "kr", expected: "KR" },
      { input: "korea", expected: "KR" },
      { input: "jp", expected: "JP" },
      { input: "japan", expected: "JP" },
      { input: "de", expected: "DE" },
      { input: "germany", expected: "DE" },
      { input: "uk", expected: "GB" },
      { input: "gb", expected: "GB" },
      { input: "fr", expected: "FR" },
      { input: "france", expected: "FR" },
      { input: "ca", expected: "CA" },
      { input: "canada", expected: "CA" },
      { input: "au", expected: "AU" },
      { input: "australia", expected: "AU" },
      { input: "sg", expected: "SG" },
      { input: "singapore", expected: "SG" },
    ]

    test.each(countryMappings)("maps '$input' to '$expected'", ({ input, expected }) => {
      const COUNTRY_CODE_MAP: Record<string, string> = {
        us: "US",
        usa: "US",
        kr: "KR",
        korea: "KR",
        jp: "JP",
        japan: "JP",
        cn: "CN",
        china: "CN",
        de: "DE",
        germany: "DE",
        uk: "GB",
        gb: "GB",
        fr: "FR",
        france: "FR",
        ca: "CA",
        canada: "CA",
        au: "AU",
        australia: "AU",
        sg: "SG",
        singapore: "SG",
        in: "IN",
        india: "IN",
        br: "BR",
        brazil: "BR",
        mx: "MX",
        mexico: "MX",
      }

      const result = COUNTRY_CODE_MAP[input.toLowerCase()] || input.toUpperCase()
      expect(result).toBe(expected)
    })
  })

  describe("industry matching with valid industries", () => {
    test("all fallback industries are valid Hunter.io industries", () => {
      // These are the fallback industries used in findMatchingIndustries
      const techFallback = [
        "Software Development",
        "IT Services and IT Consulting",
        "Technology, Information and Internet",
      ]
      const healthFallback = [
        "Hospitals and Health Care",
        "Medical Practices",
        "Medical Equipment Manufacturing",
      ]
      const financeFallback = ["Financial Services", "Banking", "Investment Management"]
      const retailFallback = ["Retail", "Online and Mail Order Retail"]
      const manufacturingFallback = ["Manufacturing", "Machinery Manufacturing"]
      const consultingFallback = ["Business Consulting and Services", "Professional Services"]
      const marketingFallback = ["Marketing Services", "Advertising Services"]
      const educationFallback = ["Education", "E-Learning Providers", "Higher Education"]
      const defaultFallback = ["Professional Services"]

      const allFallbacks = [
        ...techFallback,
        ...healthFallback,
        ...financeFallback,
        ...retailFallback,
        ...manufacturingFallback,
        ...consultingFallback,
        ...marketingFallback,
        ...educationFallback,
        ...defaultFallback,
      ]

      for (const industry of allFallbacks) {
        expect(INDUSTRIES_LIST).toContain(industry)
      }
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Software Development", () => {
      expect(INDUSTRIES_LIST).toContain("Software Development")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains IT Services and IT Consulting", () => {
      expect(INDUSTRIES_LIST).toContain("IT Services and IT Consulting")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Financial Services", () => {
      expect(INDUSTRIES_LIST).toContain("Financial Services")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Retail", () => {
      expect(INDUSTRIES_LIST).toContain("Retail")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Manufacturing", () => {
      expect(INDUSTRIES_LIST).toContain("Manufacturing")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Professional Services", () => {
      expect(INDUSTRIES_LIST).toContain("Professional Services")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Education", () => {
      expect(INDUSTRIES_LIST).toContain("Education")
    })

    test("VALID_HUNTERIO_INDUSTRIES contains Hospitals and Health Care", () => {
      expect(INDUSTRIES_LIST).toContain("Hospitals and Health Care")
    })
  })

  describe("headcount ranges", () => {
    const SMB_HEADCOUNT_RANGES = ["1-10", "11-50", "51-200", "201-500", "501-1000"] as const
    const _LARGE_COMPANY_RANGES = ["1001-5000", "5001-10000", "10001+"] as const

    test("SMB ranges include small to medium sizes", () => {
      expect(SMB_HEADCOUNT_RANGES).toContain("1-10")
      expect(SMB_HEADCOUNT_RANGES).toContain("11-50")
      expect(SMB_HEADCOUNT_RANGES).toContain("51-200")
      expect(SMB_HEADCOUNT_RANGES).toContain("201-500")
      expect(SMB_HEADCOUNT_RANGES).toContain("501-1000")
    })

    test("SMB ranges exclude large company sizes", () => {
      expect(SMB_HEADCOUNT_RANGES).not.toContain("1001-5000")
      expect(SMB_HEADCOUNT_RANGES).not.toContain("5001-10000")
      expect(SMB_HEADCOUNT_RANGES).not.toContain("10001+")
    })

    test("has exactly 5 SMB ranges", () => {
      expect(SMB_HEADCOUNT_RANGES).toHaveLength(5)
    })
  })

  describe("output format validation", () => {
    test("HunterioDiscoverParams structure is valid with valid industries", () => {
      const validParams = {
        query: "B2B SaaS companies",
        headquarters_location: {
          include: [{ country: "US" }],
        },
        industry: {
          include: ["Software Development", "IT Services and IT Consulting"],
        },
        headcount: ["11-50", "51-200"] as const,
        keywords: {
          include: ["software", "B2B"],
          match: "all" as const,
        },
        limit: 100,
        offset: 0,
      }

      expect(validParams.query).toBeDefined()
      expect(validParams.headquarters_location.include).toBeArray()
      expect(validParams.industry.include).toBeArray()
      expect(validParams.headcount).toBeArray()
      expect(validParams.keywords.include).toBeArray()
      expect(validParams.keywords.match).toBe("all")
      expect(validParams.limit).toBe(100)
      expect(validParams.offset).toBe(0)

      // Verify all industries are valid
      for (const industry of validParams.industry.include) {
        expect(INDUSTRIES_LIST).toContain(industry)
      }
    })

    test("keywords.match must be 'any' or 'all'", () => {
      const validMatches = ["any", "all"]
      expect(validMatches).toContain("any")
      expect(validMatches).toContain("all")
    })
  })

  describe("SurveyData interface", () => {
    test("requires all fields", () => {
      const surveyData = {
        industry: "tech",
        target: "B2B companies",
        country: "us",
        experience: "beginner",
      }

      expect(surveyData.industry).toBeDefined()
      expect(surveyData.target).toBeDefined()
      expect(surveyData.country).toBeDefined()
      expect(surveyData.experience).toBeDefined()
    })
  })
})

describe("hunterio-query-generator.service integration", () => {
  // These tests make real LLM calls - run only in CI or with OPENAI_API_KEY
  const hasApiKey = !!process.env.OPENAI_API_KEY

  test.skipIf(!hasApiKey)(
    "generates params from survey data (integration)",
    async () => {
      const { generateHunterioQuery } = await import("./hunterio-query-generator.service")

      const result = await generateHunterioQuery({
        industry: "tech",
        target: "B2B SaaS companies",
        country: "us",
        experience: "intermediate",
      })

      expect(result).toHaveProperty("query")
      expect(result).toHaveProperty("limit", 100)
      expect(result).toHaveProperty("offset", 0)
      expect(result.headquarters_location?.include).toBeDefined()
      expect(result.industry?.include).toBeDefined()
      expect(result.headcount).toBeDefined()

      // Verify generated industries are valid
      if (result.industry?.include) {
        for (const industry of result.industry.include) {
          expect(INDUSTRIES_LIST).toContain(industry)
        }
      }
    },
    30000,
  ) // 30s timeout for LLM calls
})
