import { describe, expect, test } from "bun:test"
import { validateWebReaderSummaryParams } from "./validate"

describe("validateWebReaderSummaryParams", () => {
  test("should validate correct parameters", () => {
    const params = {
      url: "https://example.com/article",
      query: "What is this about?",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe("https://example.com/article")
      expect(result.data.query).toBe("What is this about?")
    }
  })

  test("should reject invalid URL format", () => {
    const params = {
      url: "not-a-valid-url",
      query: "What is this?",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toBeDefined()
      expect(result.error.issues[0]?.path).toContain("url")
    }
  })

  test("should reject missing URL", () => {
    const params = {
      query: "What is this?",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toBeDefined()
      expect(result.error.issues[0]?.path).toContain("url")
    }
  })

  test("should reject missing query", () => {
    const params = {
      url: "https://example.com",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toBeDefined()
      expect(result.error.issues[0]?.path).toContain("query")
    }
  })

  test("should reject empty query string", () => {
    const params = {
      url: "https://example.com",
      query: "",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toBeDefined()
      expect(result.error.issues[0]?.path).toContain("query")
    }
  })

  test("should accept URLs with different protocols", () => {
    const httpsParams = {
      url: "https://example.com/page",
      query: "Test query",
    }
    const httpParams = {
      url: "http://example.com/page",
      query: "Test query",
    }

    const httpsResult = validateWebReaderSummaryParams(httpsParams)
    const httpResult = validateWebReaderSummaryParams(httpParams)

    expect(httpsResult.success).toBe(true)
    expect(httpResult.success).toBe(true)
  })

  test("should accept URLs with query parameters", () => {
    const params = {
      url: "https://example.com/page?foo=bar&baz=qux",
      query: "What is this?",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
  })

  test("should accept URLs with fragments", () => {
    const params = {
      url: "https://example.com/page#section",
      query: "What is this?",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
  })

  test("should reject non-object input", () => {
    const result = validateWebReaderSummaryParams("not an object")

    expect(result.success).toBe(false)
  })

  test("should reject null input", () => {
    const result = validateWebReaderSummaryParams(null)

    expect(result.success).toBe(false)
  })

  test("should reject undefined input", () => {
    const result = validateWebReaderSummaryParams(undefined)

    expect(result.success).toBe(false)
  })

  test("should handle extra properties gracefully", () => {
    const params = {
      url: "https://example.com",
      query: "What is this?",
      extraProperty: "should be ignored",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
    if (result.success) {
      // Zod strips extra properties by default
      expect("extraProperty" in result.data).toBe(false)
    }
  })

  test("should accept long query strings", () => {
    const params = {
      url: "https://example.com",
      query: "a".repeat(1000),
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
  })

  test("should accept special characters in query", () => {
    const params = {
      url: "https://example.com",
      query: "What's the main topic? Include examples & citations.",
    }

    const result = validateWebReaderSummaryParams(params)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.query).toContain("&")
      expect(result.data.query).toContain("'")
    }
  })
})
