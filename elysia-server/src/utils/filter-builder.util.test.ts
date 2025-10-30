import { describe, expect, test } from "bun:test"
import type { ColumnFilter } from "../types/lead-filters.types"
import {
  buildDateRangeFilter,
  buildFilterCondition,
  buildFiltersQuery,
  parseFiltersFromQuery,
  validateFilter,
  validateFilters,
} from "./filter-builder.util"

describe("validateFilter", () => {
  test("accepts valid string field with contains operator", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "contains",
      value: "test",
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test("accepts valid number field with gt operator", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "gt",
      value: 50,
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })

  test("accepts valid enum field with in operator", () => {
    const filter: ColumnFilter = {
      field: "leadStatus",
      operator: "in",
      value: ["new", "qualified"],
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })

  test("rejects non-filterable field", () => {
    const filter: ColumnFilter = {
      field: "invalidField",
      operator: "equals",
      value: "test",
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Field "invalidField" is not filterable')
  })

  test("rejects invalid operator for field type", () => {
    const filter: ColumnFilter = {
      field: "companyName", // string type
      operator: "gt", // number/date operator
      value: "test",
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Operator "gt" is not valid')
  })

  test("validates between operator with min/max", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "between",
      value: { min: 10, max: 90 },
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })

  test("validates between operator with from/to for dates", () => {
    const filter: ColumnFilter = {
      field: "createdAt",
      operator: "between",
      value: { from: "2025-01-01", to: "2025-12-31" },
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })

  test("rejects between operator without proper value", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "between",
      value: "invalid",
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain("requires an object")
  })

  test("rejects between operator with incomplete range", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "between",
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid value format
      value: { min: 10 } as any,
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(false)
  })

  test("validates in operator with array value", () => {
    const filter: ColumnFilter = {
      field: "country",
      operator: "in",
      value: ["USA", "Canada"],
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })

  test("rejects in operator without array value", () => {
    const filter: ColumnFilter = {
      field: "country",
      operator: "in",
      value: "USA",
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain("requires an array value")
  })

  test("accepts isEmpty operator and sets value to null", () => {
    const filter: ColumnFilter = {
      field: "notes",
      operator: "isEmpty",
      value: "any value", // Should be ignored
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
    expect(filter.value).toBe(null)
  })

  test("accepts isNotEmpty operator", () => {
    const filter: ColumnFilter = {
      field: "notes",
      operator: "isNotEmpty",
      value: null,
    }
    const result = validateFilter(filter)
    expect(result.isValid).toBe(true)
  })
})

describe("validateFilters", () => {
  test("validates array of valid filters", () => {
    const filters: ColumnFilter[] = [
      { field: "companyName", operator: "contains", value: "test" },
      { field: "leadScore", operator: "gt", value: 50 },
      { field: "country", operator: "in", value: ["USA", "Canada"] },
    ]
    const result = validateFilters(filters)
    expect(result.isValid).toBe(true)
  })

  test("returns error for first invalid filter", () => {
    const filters: ColumnFilter[] = [
      { field: "companyName", operator: "contains", value: "test" },
      { field: "invalidField", operator: "equals", value: "test" }, // Invalid
      { field: "leadScore", operator: "gt", value: 50 },
    ]
    const result = validateFilters(filters)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain("invalidField")
  })

  test("accepts empty filter array", () => {
    const filters: ColumnFilter[] = []
    const result = validateFilters(filters)
    expect(result.isValid).toBe(true)
  })
})

describe("buildFilterCondition", () => {
  test("builds equals condition", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "equals",
      value: "Test Company",
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds notEquals condition", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "notEquals",
      value: "Test Company",
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds contains condition with ilike", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "contains",
      value: "test",
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds startsWith condition", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "startsWith",
      value: "Test",
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds endsWith condition", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "endsWith",
      value: "Inc",
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds gt (greater than) condition", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "gt",
      value: 50,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds lt (less than) condition", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "lt",
      value: 100,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds gte (greater than or equal) condition", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "gte",
      value: 50,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds lte (less than or equal) condition", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "lte",
      value: 100,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds between condition for numbers", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "between",
      value: { min: 10, max: 90 },
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds between condition for dates", () => {
    const filter: ColumnFilter = {
      field: "createdAt",
      operator: "between",
      value: { from: "2025-01-01", to: "2025-12-31" },
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("throws error for invalid between value", () => {
    const filter: ColumnFilter = {
      field: "leadScore",
      operator: "between",
      value: "invalid",
    }
    expect(() => buildFilterCondition(filter)).toThrow('Invalid value for "between" operator')
  })

  test("builds in condition", () => {
    const filter: ColumnFilter = {
      field: "country",
      operator: "in",
      value: ["USA", "Canada", "UK"],
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds notIn condition", () => {
    const filter: ColumnFilter = {
      field: "country",
      operator: "notIn",
      value: ["Spam Country"],
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds isEmpty condition", () => {
    const filter: ColumnFilter = {
      field: "notes",
      operator: "isEmpty",
      value: null,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("builds isNotEmpty condition", () => {
    const filter: ColumnFilter = {
      field: "notes",
      operator: "isNotEmpty",
      value: null,
    }
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("throws error for unknown operator", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid operator
      operator: "invalidOperator" as any,
      value: "test",
    }
    expect(() => buildFilterCondition(filter)).toThrow("Unknown operator")
  })

  test("throws error for invalid field", () => {
    const filter: ColumnFilter = {
      field: "nonExistentField",
      operator: "equals",
      value: "test",
    }
    expect(() => buildFilterCondition(filter)).toThrow('Field "nonExistentField" not found')
  })
})

describe("buildFiltersQuery", () => {
  test("returns undefined for empty filter array", () => {
    const filters: ColumnFilter[] = []
    const result = buildFiltersQuery(filters)
    expect(result).toBeUndefined()
  })

  test("returns single condition for one filter", () => {
    const filters: ColumnFilter[] = [{ field: "companyName", operator: "contains", value: "test" }]
    const result = buildFiltersQuery(filters)
    expect(result).toBeDefined()
  })

  test("combines multiple filters with AND", () => {
    const filters: ColumnFilter[] = [
      { field: "companyName", operator: "contains", value: "test" },
      { field: "leadScore", operator: "gt", value: 50 },
      { field: "country", operator: "equals", value: "USA" },
    ]
    const result = buildFiltersQuery(filters)
    expect(result).toBeDefined()
  })

  test("handles mix of different operators", () => {
    const filters: ColumnFilter[] = [
      { field: "companyName", operator: "startsWith", value: "A" },
      { field: "leadScore", operator: "between", value: { min: 10, max: 90 } },
      { field: "leadStatus", operator: "in", value: ["new", "qualified"] },
      { field: "notes", operator: "isNotEmpty", value: null },
    ]
    const result = buildFiltersQuery(filters)
    expect(result).toBeDefined()
  })
})

describe("parseFiltersFromQuery", () => {
  test("parses valid JSON filter array", () => {
    const json = '[{"field":"companyName","operator":"contains","value":"test"}]'
    const result = parseFiltersFromQuery(json)
    expect(result).toHaveLength(1)
    expect(result[0]?.field).toBe("companyName")
    expect(result[0]?.operator).toBe("contains")
    expect(result[0]?.value).toBe("test")
  })

  test("parses multiple filters", () => {
    const json =
      '[{"field":"companyName","operator":"contains","value":"test"},{"field":"leadScore","operator":"gt","value":50}]'
    const result = parseFiltersFromQuery(json)
    expect(result).toHaveLength(2)
  })

  test("returns empty array for undefined input", () => {
    const result = parseFiltersFromQuery(undefined)
    expect(result).toEqual([])
  })

  test("returns empty array for empty string", () => {
    const result = parseFiltersFromQuery("")
    expect(result).toEqual([])
  })

  test("throws error for invalid JSON", () => {
    const invalidJson = '{"field":"test"'
    expect(() => parseFiltersFromQuery(invalidJson)).toThrow("Invalid filters JSON")
  })

  test("throws error for non-array JSON", () => {
    const nonArrayJson = '{"field":"companyName","operator":"contains","value":"test"}'
    expect(() => parseFiltersFromQuery(nonArrayJson)).toThrow("Filters must be an array")
  })

  test("parses complex filter values", () => {
    const json = '[{"field":"leadStatus","operator":"in","value":["new","qualified","converted"]}]'
    const result = parseFiltersFromQuery(json)
    expect(result[0]?.value).toEqual(["new", "qualified", "converted"])
  })

  test("parses between filter with object value", () => {
    const json = '[{"field":"leadScore","operator":"between","value":{"min":10,"max":90}}]'
    const result = parseFiltersFromQuery(json)
    expect(result[0]?.value).toEqual({ min: 10, max: 90 })
  })
})

describe("buildDateRangeFilter", () => {
  test("builds filter with both after and before dates", () => {
    const result = buildDateRangeFilter("createdAt", "2025-01-01", "2025-12-31")
    expect(result).toBeDefined()
  })

  test("builds filter with only after date", () => {
    const result = buildDateRangeFilter("createdAt", "2025-01-01", undefined)
    expect(result).toBeDefined()
  })

  test("builds filter with only before date", () => {
    const result = buildDateRangeFilter("createdAt", undefined, "2025-12-31")
    expect(result).toBeDefined()
  })

  test("returns undefined when no dates provided", () => {
    const result = buildDateRangeFilter("createdAt", undefined, undefined)
    expect(result).toBeUndefined()
  })

  test("works with updatedAt field", () => {
    const result = buildDateRangeFilter("updatedAt", "2025-01-01", "2025-12-31")
    expect(result).toBeDefined()
  })

  test("handles ISO date strings", () => {
    const result = buildDateRangeFilter("createdAt", "2025-01-01T00:00:00Z", "2025-12-31T23:59:59Z")
    expect(result).toBeDefined()
  })
})

describe("Integration tests", () => {
  test("validate and build filter chain", () => {
    const filter: ColumnFilter = {
      field: "companyName",
      operator: "contains",
      value: "google",
    }

    // Validate
    const validation = validateFilter(filter)
    expect(validation.isValid).toBe(true)

    // Build condition
    const condition = buildFilterCondition(filter)
    expect(condition).toBeDefined()
  })

  test("parse, validate, and build complete filter flow", () => {
    const json =
      '[{"field":"companyName","operator":"contains","value":"test"},{"field":"leadScore","operator":"gte","value":70}]'

    // Parse
    const filters = parseFiltersFromQuery(json)
    expect(filters).toHaveLength(2)

    // Validate
    const validation = validateFilters(filters)
    expect(validation.isValid).toBe(true)

    // Build query
    const query = buildFiltersQuery(filters)
    expect(query).toBeDefined()
  })

  test("complex real-world scenario", () => {
    const filters: ColumnFilter[] = [
      { field: "country", operator: "in", value: ["USA", "Canada", "UK"] },
      { field: "leadScore", operator: "between", value: { min: 50, max: 100 } },
      { field: "companyName", operator: "contains", value: "tech" },
      { field: "leadStatus", operator: "notIn", value: ["lost", "unsubscribed"] },
      { field: "notes", operator: "isNotEmpty", value: null },
    ]

    // Validate all filters
    const validation = validateFilters(filters)
    expect(validation.isValid).toBe(true)

    // Build combined query
    const query = buildFiltersQuery(filters)
    expect(query).toBeDefined()
  })
})
