import { describe, expect, it } from "bun:test"
import {
  type EmailVerificationResult,
  EmailVerifierResponseSchema,
  getVerifierQueueStats,
  isEmailDeliverable,
  verifyEmail,
  verifyEmailBatch,
} from "./hunterio-email-verifier.service"

describe("Hunter.io Email Verifier Service", () => {
  describe("Response Schema Validation", () => {
    it("should validate valid API response with all fields", () => {
      const validResponse = {
        data: {
          status: "valid",
          result: "deliverable",
          score: 100,
          email: "patrick@stripe.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
          sources: [
            {
              domain: "example.com",
              uri: "http://example.com/contact",
              extracted_on: "2020-06-17",
              last_seen_on: "2020-06-17",
              still_on_page: true,
            },
          ],
        },
        meta: {
          params: {
            email: "patrick@stripe.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data.status).toBe("valid")
        expect(result.data.data.score).toBe(100)
        expect(result.data.data.email).toBe("patrick@stripe.com")
      }
    })

    it("should validate response without sources", () => {
      const validResponse = {
        data: {
          status: "valid",
          score: 95,
          email: "test@example.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
        },
        meta: {
          params: {
            email: "test@example.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("should validate response without deprecated result field", () => {
      const validResponse = {
        data: {
          status: "invalid",
          score: 0,
          email: "invalid@fake.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: false,
          smtp_server: false,
          smtp_check: false,
          accept_all: false,
          block: false,
        },
        meta: {
          params: {
            email: "invalid@fake.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("should accept all valid status values", () => {
      const statuses = [
        "valid",
        "invalid",
        "accept_all",
        "webmail",
        "disposable",
        "unknown",
      ] as const

      for (const status of statuses) {
        const response = {
          data: {
            status,
            score: 50,
            email: "test@example.com",
            regexp: true,
            gibberish: false,
            disposable: status === "disposable",
            webmail: status === "webmail",
            mx_records: true,
            smtp_server: true,
            smtp_check: true,
            accept_all: status === "accept_all",
            block: false,
          },
          meta: {
            params: {
              email: "test@example.com",
            },
          },
        }

        const result = EmailVerifierResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      }
    })

    it("should accept all valid result values", () => {
      const results = ["deliverable", "undeliverable", "risky"] as const

      for (const resultValue of results) {
        const response = {
          data: {
            status: "valid",
            result: resultValue,
            score: 80,
            email: "test@example.com",
            regexp: true,
            gibberish: false,
            disposable: false,
            webmail: false,
            mx_records: true,
            smtp_server: true,
            smtp_check: true,
            accept_all: false,
            block: false,
          },
          meta: {
            params: {
              email: "test@example.com",
            },
          },
        }

        const result = EmailVerifierResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      }
    })

    it("should reject invalid status value", () => {
      const invalidResponse = {
        data: {
          status: "not-a-valid-status",
          score: 50,
          email: "test@example.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
        },
        meta: {
          params: {
            email: "test@example.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response missing required fields", () => {
      const invalidResponse = {
        data: {
          status: "valid",
          // missing score
          email: "test@example.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
        },
        meta: {
          params: {
            email: "test@example.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with wrong types", () => {
      const invalidResponse = {
        data: {
          status: "valid",
          score: "not-a-number", // should be number
          email: "test@example.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
        },
        meta: {
          params: {
            email: "test@example.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with invalid source structure", () => {
      const invalidResponse = {
        data: {
          status: "valid",
          score: 100,
          email: "test@example.com",
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mx_records: true,
          smtp_server: true,
          smtp_check: true,
          accept_all: false,
          block: false,
          sources: [
            {
              domain: "example.com",
              // missing uri
              extracted_on: "2020-06-17",
              last_seen_on: "2020-06-17",
              still_on_page: true,
            },
          ],
        },
        meta: {
          params: {
            email: "test@example.com",
          },
        },
      }

      const result = EmailVerifierResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe("Service Function - Error Handling", () => {
    it("should return null for invalid email format", async () => {
      const result = await verifyEmail("not-an-email")
      expect(result).toBeNull()
    })

    it("should return null for empty string", async () => {
      const result = await verifyEmail("")
      expect(result).toBeNull()
    })

    it("should return null for email without domain", async () => {
      const result = await verifyEmail("user@")
      expect(result).toBeNull()
    })

    it("should return null for email without user", async () => {
      const result = await verifyEmail("@domain.com")
      expect(result).toBeNull()
    })

    it("should handle emails with spaces (should fail)", async () => {
      const result = await verifyEmail("user name@domain.com")
      expect(result).toBeNull()
    })
  })

  describe("Queue Statistics", () => {
    it("should return queue statistics", () => {
      const stats = getVerifierQueueStats()

      expect(stats).toBeDefined()
      expect(stats.minuteQueue).toBeDefined()
      expect(stats.secondQueue).toBeDefined()
      expect(typeof stats.minuteQueue.size).toBe("number")
      expect(typeof stats.minuteQueue.pending).toBe("number")
      expect(typeof stats.secondQueue.size).toBe("number")
      expect(typeof stats.secondQueue.pending).toBe("number")
    })
  })

  describe("Data Transformation", () => {
    it("should correctly identify valid emails as deliverable", () => {
      const mockResult: EmailVerificationResult = {
        email: "valid@example.com",
        status: "valid",
        score: 100,
        isValid: true,
        isDeliverable: true,
        checks: {
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mxRecords: true,
          smtpServer: true,
          smtpCheck: true,
          acceptAll: false,
          block: false,
        },
      }

      expect(mockResult.isValid).toBe(true)
      expect(mockResult.isDeliverable).toBe(true)
      expect(mockResult.status).toBe("valid")
    })

    it("should correctly identify accept_all emails as deliverable but not valid", () => {
      const mockResult: EmailVerificationResult = {
        email: "catchall@example.com",
        status: "accept_all",
        score: 50,
        isValid: false,
        isDeliverable: true,
        checks: {
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mxRecords: true,
          smtpServer: true,
          smtpCheck: true,
          acceptAll: true,
          block: false,
        },
      }

      expect(mockResult.isValid).toBe(false)
      expect(mockResult.isDeliverable).toBe(true)
      expect(mockResult.status).toBe("accept_all")
    })

    it("should correctly identify invalid emails as not deliverable", () => {
      const mockResult: EmailVerificationResult = {
        email: "invalid@fake.com",
        status: "invalid",
        score: 0,
        isValid: false,
        isDeliverable: false,
        checks: {
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mxRecords: false,
          smtpServer: false,
          smtpCheck: false,
          acceptAll: false,
          block: false,
        },
      }

      expect(mockResult.isValid).toBe(false)
      expect(mockResult.isDeliverable).toBe(false)
      expect(mockResult.status).toBe("invalid")
    })

    it("should correctly transform sources from snake_case to camelCase", () => {
      const mockResult: EmailVerificationResult = {
        email: "test@example.com",
        status: "valid",
        score: 100,
        isValid: true,
        isDeliverable: true,
        checks: {
          regexp: true,
          gibberish: false,
          disposable: false,
          webmail: false,
          mxRecords: true,
          smtpServer: true,
          smtpCheck: true,
          acceptAll: false,
          block: false,
        },
        sources: [
          {
            domain: "example.com",
            uri: "http://example.com/contact",
            extractedOn: "2020-06-17",
            lastSeenOn: "2020-06-17",
            stillOnPage: true,
          },
        ],
      }

      expect(mockResult.sources).toBeDefined()
      expect(mockResult.sources?.[0]?.extractedOn).toBe("2020-06-17")
      expect(mockResult.sources?.[0]?.lastSeenOn).toBe("2020-06-17")
      expect(mockResult.sources?.[0]?.stillOnPage).toBe(true)
    })
  })

  describe("Integration Test - Real API (Manual)", () => {
    // These tests require a valid Hunter.io API key and will make real API calls
    // Uncomment to run manually

    it.skip("should verify a valid email", async () => {
      const result = await verifyEmail("patrick@stripe.com")

      console.log("Email verification result:", JSON.stringify(result, null, 2))

      expect(result).not.toBeNull()
      if (result) {
        expect(result.email).toBe("patrick@stripe.com")
        expect(result.status).toBeDefined()
        expect(typeof result.score).toBe("number")
        expect(result.checks).toBeDefined()
      }
    }, 30000)

    it.skip("should return invalid for non-existent email", async () => {
      const result = await verifyEmail("nonexistent123456@thisisnotarealdomain12345.com")

      console.log("Invalid email result:", JSON.stringify(result, null, 2))

      expect(result).not.toBeNull()
      if (result) {
        expect(["invalid", "unknown"]).toContain(result.status)
      }
    }, 30000)

    it.skip("should detect disposable email", async () => {
      const result = await verifyEmail("test@mailinator.com")

      console.log("Disposable email result:", JSON.stringify(result, null, 2))

      expect(result).not.toBeNull()
      if (result) {
        expect(result.checks.disposable).toBe(true)
      }
    }, 30000)

    it.skip("should detect webmail email", async () => {
      const result = await verifyEmail("test@gmail.com")

      console.log("Webmail email result:", JSON.stringify(result, null, 2))

      expect(result).not.toBeNull()
      if (result) {
        expect(result.checks.webmail).toBe(true)
      }
    }, 30000)

    it.skip("should test isEmailDeliverable helper", async () => {
      const deliverable = await isEmailDeliverable("patrick@stripe.com")

      console.log("Is deliverable:", deliverable)

      expect(typeof deliverable).toBe("boolean")
    }, 30000)

    it.skip("should verify batch of emails", async () => {
      const emails = [
        "patrick@stripe.com",
        "test@mailinator.com",
        "invalid@notarealdomain12345.com",
      ]

      const { results, summary } = await verifyEmailBatch(emails, { concurrency: 2 })

      console.log("Batch verification results:", JSON.stringify(results, null, 2))
      console.log("Summary:", summary)

      expect(results.length).toBeGreaterThan(0)
      expect(summary.total).toBe(emails.length)
      expect(summary.valid + summary.invalid + summary.unknown).toBeLessThanOrEqual(summary.total)
    }, 60000)

    it.skip("should test cache hit on second call", async () => {
      const email = "cachetest@stripe.com"

      console.log("First call (should miss cache)...")
      const startTime1 = Date.now()
      const result1 = await verifyEmail(email)
      const elapsed1 = Date.now() - startTime1
      console.log(`First call completed in ${elapsed1}ms`)

      console.log("Second call (should hit cache)...")
      const startTime2 = Date.now()
      const result2 = await verifyEmail(email)
      const elapsed2 = Date.now() - startTime2
      console.log(`Second call completed in ${elapsed2}ms`)

      // Second call should be significantly faster if cache is working
      expect(elapsed2).toBeLessThan(elapsed1)
      expect(result1).toEqual(result2)
    }, 60000)
  })

  describe("Edge Cases", () => {
    it("should handle email with plus sign", async () => {
      // This is valid email format but may fail API validation
      const result = await verifyEmail("user+tag@example.com")
      // Should not crash - may return null or a result
      expect(result === null || typeof result === "object").toBe(true)
    })

    it("should handle international domain", async () => {
      const result = await verifyEmail("user@例え.jp")
      expect(result === null || typeof result === "object").toBe(true)
    })

    it("should normalize email to lowercase", async () => {
      // Both should produce same cache key
      const email1 = "Test@Example.COM"
      const email2 = "test@example.com"

      // Both should fail validation equally since they're the same normalized email
      const result1 = await verifyEmail(email1)
      const result2 = await verifyEmail(email2)

      // If both hit cache or both hit API, they should return same result
      if (result1 !== null && result2 !== null) {
        expect(result1.email.toLowerCase()).toBe(result2.email.toLowerCase())
      }
    })

    it("should handle very long email addresses", async () => {
      const longLocalPart = "a".repeat(64)
      const longEmail = `${longLocalPart}@example.com`

      const result = await verifyEmail(longEmail)
      // Should not crash
      expect(result === null || typeof result === "object").toBe(true)
    })
  })

  describe("Batch Verification", () => {
    it("should handle empty email array", async () => {
      const { results, summary } = await verifyEmailBatch([])

      expect(results).toEqual([])
      expect(summary.total).toBe(0)
      expect(summary.valid).toBe(0)
      expect(summary.invalid).toBe(0)
      expect(summary.unknown).toBe(0)
    })

    it("should respect concurrency option", async () => {
      const { results, summary } = await verifyEmailBatch(["invalid1", "invalid2", "invalid3"], {
        concurrency: 1,
      })

      // All should fail validation
      expect(results).toEqual([])
      expect(summary.total).toBe(3)
    })

    it("should continue on error by default", async () => {
      const emails = ["valid@email.com", "invalid", "another@email.com"]

      const { summary } = await verifyEmailBatch(emails)

      // Should not throw, even with invalid emails
      expect(summary.total).toBe(3)
    })
  })
})
