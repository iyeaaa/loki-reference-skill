import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import {
  getDomainSearchQueueStats,
  HunterioDomainSearchParamsSchema,
  HunterioDomainSearchResponseSchema,
  searchDomainWithHunter,
} from "./hunterio-domain-search.service"

// Mock the config
mock.module("../config", () => ({
  config: {
    hunter: {
      apiKey: "test-api-key",
    },
    cache: {
      leadDiscovery: {
        ttl: 86400,
        prefix: "test",
      },
    },
  },
}))

// Mock the redis cache
mock.module("./redis-cache.service", () => ({
  RedisCache: {
    fromConfig: () => ({
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve()),
    }),
  },
  hashString: (str: string) => `hash_${str.slice(0, 10)}`,
}))

// Mock logger
mock.module("../utils/logger", () => ({
  default: {
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
  },
}))

describe("HunterioDomainSearchParamsSchema", () => {
  it("should validate params with domain", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      domain: "stripe.com",
    })
    expect(result.success).toBe(true)
  })

  it("should validate params with company", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      company: "Stripe",
    })
    expect(result.success).toBe(true)
  })

  it("should reject params without domain or company", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      seniority: "senior",
    })
    expect(result.success).toBe(false)
  })

  it("should validate params with all optional fields", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      domain: "stripe.com",
      seniority: "senior",
      department: "sales",
      required_field: "full_name",
      verification_status: "valid",
      job_titles: "CEO,CTO",
    })
    expect(result.success).toBe(true)
  })

  it("should reject invalid seniority value", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      domain: "stripe.com",
      seniority: "invalid",
    })
    expect(result.success).toBe(false)
  })

  it("should reject invalid department value", () => {
    const result = HunterioDomainSearchParamsSchema.safeParse({
      domain: "stripe.com",
      department: "invalid",
    })
    expect(result.success).toBe(false)
  })
})

describe("HunterioDomainSearchResponseSchema", () => {
  const validResponse = {
    data: {
      domain: "stripe.com",
      disposable: false,
      webmail: false,
      accept_all: false,
      pattern: "{first}",
      organization: "Stripe",
      emails: [
        {
          value: "info@stripe.com",
          type: "generic",
          confidence: 95,
          sources: [
            {
              domain: "stripe.com",
              uri: "https://stripe.com/contact",
              extracted_on: "2024-01-01",
              last_seen_on: "2024-12-01",
              still_on_page: true,
            },
          ],
          first_name: null,
          last_name: null,
          position: null,
          seniority: null,
          department: null,
        },
      ],
    },
    meta: {
      results: 1,
      limit: 1,
      offset: 0,
      params: {
        domain: "stripe.com",
        type: "generic",
      },
    },
  }

  it("should validate a valid response", () => {
    const result = HunterioDomainSearchResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it("should reject response without domain", () => {
    const invalidResponse = {
      ...validResponse,
      data: {
        ...validResponse.data,
        domain: undefined,
      },
    }
    const result = HunterioDomainSearchResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })

  it("should validate response with optional fields", () => {
    const responseWithOptionals = {
      ...validResponse,
      data: {
        ...validResponse.data,
        description: "Payment processing",
        industry: "Financial Services",
        twitter: "stripe",
        linkedin: "company/stripe",
        technologies: ["React", "Node.js"],
        country: "US",
        state: "CA",
        city: "San Francisco",
      },
    }
    const result = HunterioDomainSearchResponseSchema.safeParse(responseWithOptionals)
    expect(result.success).toBe(true)
  })

  it("should validate email with verification object", () => {
    const responseWithVerification = {
      ...validResponse,
      data: {
        ...validResponse.data,
        emails: [
          {
            ...validResponse.data.emails[0],
            verification: {
              date: "2024-12-01",
              status: "valid",
            },
          },
        ],
      },
    }
    const result = HunterioDomainSearchResponseSchema.safeParse(responseWithVerification)
    expect(result.success).toBe(true)
  })
})

describe("getDomainSearchQueueStats", () => {
  it("should return queue statistics", () => {
    const stats = getDomainSearchQueueStats()
    expect(stats).toHaveProperty("minuteQueue")
    expect(stats).toHaveProperty("secondQueue")
    expect(stats.minuteQueue).toHaveProperty("size")
    expect(stats.minuteQueue).toHaveProperty("pending")
    expect(stats.secondQueue).toHaveProperty("size")
    expect(stats.secondQueue).toHaveProperty("pending")
  })
})

describe("searchDomainWithHunter", () => {
  beforeEach(() => {
    // Reset mocks before each test
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              domain: "stripe.com",
              disposable: false,
              webmail: false,
              accept_all: false,
              pattern: "{first}",
              organization: "Stripe",
              emails: [
                {
                  value: "info@stripe.com",
                  type: "generic",
                  confidence: 95,
                  sources: [
                    {
                      domain: "stripe.com",
                      uri: "https://stripe.com/contact",
                      extracted_on: "2024-01-01",
                      last_seen_on: "2024-12-01",
                      still_on_page: true,
                    },
                  ],
                  first_name: null,
                  last_name: null,
                  position: null,
                  seniority: null,
                  department: null,
                },
              ],
            },
            meta: {
              results: 1,
              limit: 1,
              offset: 0,
              params: { domain: "stripe.com", type: "generic" },
            },
          }),
      }),
    ) as unknown as typeof fetch
  })

  it("should return empty result for invalid params", async () => {
    const result = await searchDomainWithHunter({} as { domain?: string; company?: string })
    expect(result.genericEmail).toBeNull()
    expect(result.organization).toBeNull()
  })

  it("should call API with correct parameters", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")

    await searchDomainWithHunter({ domain: "stripe.com" })

    expect(fetchSpy).toHaveBeenCalled()
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(callUrl).toContain("api.hunter.io")
    expect(callUrl).toContain("domain=stripe.com")
    expect(callUrl).toContain("type=generic")
    expect(callUrl).toContain("limit=1")
  })

  it("should return generic email from response", async () => {
    const result = await searchDomainWithHunter({ domain: "stripe.com" })
    expect(result.domain).toBe("stripe.com")
    expect(result.organization).toBe("Stripe")
    expect(result.genericEmail).toBe("info@stripe.com")
    expect(result.pattern).toBe("{first}")
  })

  it("should return null genericEmail when no generic emails found", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              domain: "example.com",
              disposable: false,
              webmail: false,
              accept_all: false,
              pattern: null,
              organization: "Example Inc",
              emails: [],
            },
            meta: {
              results: 0,
              limit: 1,
              offset: 0,
              params: { domain: "example.com", type: "generic" },
            },
          }),
      }),
    ) as unknown as typeof fetch

    const result = await searchDomainWithHunter({ domain: "example.com" })
    expect(result.genericEmail).toBeNull()
    expect(result.organization).toBe("Example Inc")
  })

  it("should handle API errors gracefully", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      }),
    ) as unknown as typeof fetch

    const result = await searchDomainWithHunter({ domain: "stripe.com" })
    expect(result.genericEmail).toBeNull()
    expect(result.organization).toBeNull()
  })

  it("should handle API errors with AbortError (no retries)", async () => {
    // 4xx errors (except 429) should not retry and return empty result
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      }),
    ) as unknown as typeof fetch

    const result = await searchDomainWithHunter({ domain: "nonexistent.com" })
    expect(result.genericEmail).toBeNull()
    expect(result.organization).toBeNull()
  })
})
