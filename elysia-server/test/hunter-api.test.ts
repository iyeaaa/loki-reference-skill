import { describe, expect, it } from "bun:test"
import { config } from "../src/config"
import { enrichLead, findEmailsWithHunter } from "../src/services/lead-enrichment.service"

const HUNTER_API_KEY = config.hunter.apiKey

describe("Hunter.io API Integration", () => {
  it("should find emails for a known domain", async () => {
    // Test with a well-known company domain
    const result = await findEmailsWithHunter("stripe.com", HUNTER_API_KEY)

    console.log("Hunter API Result for stripe.com:", JSON.stringify(result, null, 2))

    // Verify the response structure
    expect(result).toBeDefined()
    expect(result.emails).toBeInstanceOf(Array)

    // Stripe should have some generic emails
    if (result.emails.length > 0) {
      expect(result.emails[0]).toHaveProperty("value")
      expect(result.emails[0]).toHaveProperty("type")
      expect(result.emails[0]).toHaveProperty("confidence")
    }
  })

  it("should handle domain without generic emails gracefully", async () => {
    // Test with a small/unknown domain
    const result = await findEmailsWithHunter("unknowndomain12345678.com", HUNTER_API_KEY)

    console.log("Hunter API Result for unknown domain:", JSON.stringify(result, null, 2))

    // Should return empty array, not error
    expect(result).toBeDefined()
    expect(result.emails).toBeInstanceOf(Array)
  })

  it("should integrate with enrichLead function", async () => {
    // Test the full enrichLead function with Hunter enabled
    const result = await enrichLead("https://intercom.com", "Intercom", {
      hunterApiKey: HUNTER_API_KEY,
      skipHunter: false,
      skipJina: true, // Skip Jina to isolate Hunter test
    })

    console.log("enrichLead Result:", JSON.stringify(result, null, 2))

    expect(result).toBeDefined()
    expect(result.domain).toBe("intercom.com")
    expect(result.emails).toBeInstanceOf(Array)
  })
})
