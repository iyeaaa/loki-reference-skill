import { describe, expect, test } from "bun:test"
import { prepareLLMPrompt, truncateContent } from "./prepare"

describe("prepareLLMPrompt", () => {
  test("should format prompt with all parameters", () => {
    const content = "This is test content about AI."
    const query = "What is this about?"
    const url = "https://example.com/article"

    const prompt = prepareLLMPrompt(content, query, url)

    expect(prompt).toContain("Source URL: https://example.com/article")
    expect(prompt).toContain("Content:")
    expect(prompt).toContain("This is test content about AI.")
    expect(prompt).toContain("User Query:")
    expect(prompt).toContain("What is this about?")
    expect(prompt).toContain("helpful assistant")
  })

  test("should include instructions about unavailable information", () => {
    const content = "Some content"
    const query = "Any query"
    const url = "https://example.com"

    const prompt = prepareLLMPrompt(content, query, url)

    expect(prompt).toContain("doesn't contain relevant information")
    expect(prompt).toContain("state that clearly")
  })

  test("should handle empty content", () => {
    const content = ""
    const query = "What is this?"
    const url = "https://example.com"

    const prompt = prepareLLMPrompt(content, query, url)

    expect(prompt).toContain("Content:")
    expect(prompt).toContain("What is this?")
    expect(typeof prompt).toBe("string")
  })

  test("should handle special characters in content", () => {
    const content = "Content with 'quotes' and \"double quotes\" and $pecial ch@rs"
    const query = "What's this?"
    const url = "https://example.com/special"

    const prompt = prepareLLMPrompt(content, query, url)

    expect(prompt).toContain("'quotes'")
    expect(prompt).toContain('"double quotes"')
    expect(prompt).toContain("$pecial ch@rs")
  })
})

describe("truncateContent", () => {
  test("should not truncate content below max length", () => {
    const content = "Short content"
    const result = truncateContent(content, 100)

    expect(result).toBe(content)
    expect(result).not.toContain("[Content truncated")
  })

  test("should truncate content above max length", () => {
    const content = "a".repeat(1000)
    const maxLength = 500

    const result = truncateContent(content, maxLength)

    expect(result.length).toBeGreaterThan(maxLength) // Includes truncation message
    expect(result).toContain("[Content truncated")
    expect(result).toContain("original length: 1000")
    expect(result.startsWith("a".repeat(maxLength))).toBe(true)
  })

  test("should use default max length of 50000", () => {
    const content = "a".repeat(60000)

    const result = truncateContent(content)

    expect(result).toContain("[Content truncated")
    expect(result).toContain("original length: 60000")
    expect(result.startsWith("a".repeat(50000))).toBe(true)
  })

  test("should handle content exactly at max length", () => {
    const content = "a".repeat(500)
    const result = truncateContent(content, 500)

    expect(result).toBe(content)
    expect(result).not.toContain("[Content truncated")
  })

  test("should handle empty content", () => {
    const content = ""
    const result = truncateContent(content, 100)

    expect(result).toBe("")
    expect(result).not.toContain("[Content truncated")
  })

  test("should include original length in truncation message", () => {
    const content = "x".repeat(10000)
    const result = truncateContent(content, 5000)

    expect(result).toContain("original length: 10000 characters")
  })

  test("should handle unicode characters correctly", () => {
    const content = "🚀".repeat(1000)
    const maxLength = 500

    const result = truncateContent(content, maxLength)

    expect(result).toContain("[Content truncated")
    // Unicode characters may affect length calculation
    expect(result.length).toBeLessThan(content.length)
  })
})
