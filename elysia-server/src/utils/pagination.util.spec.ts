import { describe, expect, it } from "bun:test"
import {
  calculateOffset,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  validatePageNumber,
  validatePageSize,
} from "./pagination.util"

describe("pagination.util", () => {
  describe("validatePageSize", () => {
    it("should return default page size when input is undefined", () => {
      expect(validatePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE)
    })

    it("should return default page size when input is empty string", () => {
      expect(validatePageSize("")).toBe(DEFAULT_PAGE_SIZE)
    })

    it("should parse valid string numbers", () => {
      expect(validatePageSize("50")).toBe(50)
      expect(validatePageSize("100")).toBe(100)
      expect(validatePageSize("1000")).toBe(1000)
    })

    it("should accept valid numeric inputs", () => {
      expect(validatePageSize(10)).toBe(10)
      expect(validatePageSize(100)).toBe(100)
      expect(validatePageSize(5000)).toBe(5000)
    })

    it("should cap values at MAX_PAGE_SIZE", () => {
      expect(validatePageSize(20000)).toBe(MAX_PAGE_SIZE)
      expect(validatePageSize("50000")).toBe(MAX_PAGE_SIZE)
      expect(validatePageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE)
    })

    it("should enforce minimum page size", () => {
      expect(validatePageSize(0)).toBe(MIN_PAGE_SIZE)
      expect(validatePageSize(-10)).toBe(MIN_PAGE_SIZE)
      expect(validatePageSize("-5")).toBe(MIN_PAGE_SIZE)
    })

    it("should throw error for invalid string inputs", () => {
      expect(() => validatePageSize("abc")).toThrow()
      expect(() => validatePageSize("not-a-number")).toThrow()
      expect(() => validatePageSize("12.5")).toThrow()
    })

    it("should throw error for NaN", () => {
      expect(() => validatePageSize(NaN)).toThrow()
    })

    it("should throw error for Infinity", () => {
      expect(() => validatePageSize(Infinity)).toThrow()
      expect(() => validatePageSize(-Infinity)).toThrow()
    })
  })

  describe("calculateOffset", () => {
    it("should calculate correct offset for first page", () => {
      expect(calculateOffset(1, 10)).toBe(0)
      expect(calculateOffset(1, 100)).toBe(0)
      expect(calculateOffset(1, 50)).toBe(0)
    })

    it("should calculate correct offset for subsequent pages", () => {
      expect(calculateOffset(2, 10)).toBe(10)
      expect(calculateOffset(3, 10)).toBe(20)
      expect(calculateOffset(5, 10)).toBe(40)
    })

    it("should handle different page sizes correctly", () => {
      expect(calculateOffset(2, 100)).toBe(100)
      expect(calculateOffset(3, 50)).toBe(100)
      expect(calculateOffset(10, 25)).toBe(225)
    })

    it("should handle page 0 as page 1", () => {
      expect(calculateOffset(0, 10)).toBe(0)
      expect(calculateOffset(-1, 10)).toBe(0)
    })

    it("should handle large page numbers", () => {
      expect(calculateOffset(100, 100)).toBe(9900)
      expect(calculateOffset(1000, 10)).toBe(9990)
    })
  })

  describe("validatePageNumber", () => {
    it("should return 1 when input is undefined", () => {
      expect(validatePageNumber(undefined)).toBe(1)
    })

    it("should return 1 when input is empty string", () => {
      expect(validatePageNumber("")).toBe(1)
    })

    it("should parse valid string numbers", () => {
      expect(validatePageNumber("1")).toBe(1)
      expect(validatePageNumber("5")).toBe(5)
      expect(validatePageNumber("100")).toBe(100)
    })

    it("should accept valid numeric inputs", () => {
      expect(validatePageNumber(1)).toBe(1)
      expect(validatePageNumber(10)).toBe(10)
      expect(validatePageNumber(50)).toBe(50)
    })

    it("should enforce minimum page number of 1", () => {
      expect(validatePageNumber(0)).toBe(1)
      expect(validatePageNumber(-5)).toBe(1)
      expect(validatePageNumber("-10")).toBe(1)
    })

    it("should throw error for invalid string inputs", () => {
      expect(() => validatePageNumber("abc")).toThrow()
      expect(() => validatePageNumber("not-a-number")).toThrow()
    })

    it("should throw error for NaN", () => {
      expect(() => validatePageNumber(NaN)).toThrow()
    })

    it("should throw error for Infinity", () => {
      expect(() => validatePageNumber(Infinity)).toThrow()
      expect(() => validatePageNumber(-Infinity)).toThrow()
    })

    it("should throw error for decimal numbers", () => {
      expect(() => validatePageNumber("5.5")).toThrow()
      expect(() => validatePageNumber(10.2)).toThrow()
    })
  })
})
