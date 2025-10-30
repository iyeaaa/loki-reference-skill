import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { leads } from "../db/schema/leads"
import type { ColumnFilter, FilterValidationResult } from "../types/lead-filters.types"
import {
  FILTERABLE_LEAD_FIELDS,
  LEAD_FIELD_TYPES,
  OPERATOR_FIELD_TYPE_MAP,
} from "../types/lead-filters.types"

/**
 * Employee count range definitions
 * Must match the ranges defined in getFilterOptions service function
 */
const EMPLOYEE_COUNT_RANGES: Record<string, { min: number; max: number | null }> = {
  "1-10": { min: 1, max: 10 },
  "11-50": { min: 11, max: 50 },
  "51-200": { min: 51, max: 200 },
  "201-500": { min: 201, max: 500 },
  "501-1000": { min: 501, max: 1000 },
  "1000+": { min: 1000, max: null },
}

/**
 * Parse employee count value from database string
 * Handles values like "15", "25 employees", "11-50", etc.
 * Returns the first number found in the string
 */
function _parseEmployeeCountValue(value: string | null): number | null {
  if (!value) return null
  const match = value.match(/\d+/)
  if (!match) return null
  return parseInt(match[0], 10)
}

/**
 * Build SQL condition for employee count range matching
 *
 * CURRENT APPROACH: Runtime SQL parsing (works but not optimal for large datasets)
 *
 * TODO: Optimize for production when dataset grows beyond 10K leads
 * BETTER ALTERNATIVES TO CONSIDER:
 * 1. Database normalization: Add computed columns (employee_count_min, employee_count_max)
 *    with indexes for fast range queries (~10x faster)
 *    See: /EMPLOYEE_COUNT_OPTIMIZATION.md for migration guide
 * 2. Data migration: Standardize all values to consistent format during import
 * 3. Materialized view: Pre-compute parsed ranges for faster queries
 *
 * This function handles employeeCount stored as strings in various formats:
 * - Ranges: "10-20", "50-100", "100-500명"
 * - Open ranges: "10000+", "500명 이상"
 *
 * Uses range overlap logic: rangeA overlaps rangeB if (A.min <= B.max AND A.max >= B.min)
 *
 * @performance Current: ~50ms/1K rows, Optimized: ~5ms/1K rows with normalized columns
 */
function buildEmployeeCountRangeCondition(ranges: string[]): SQL | undefined {
  if (ranges.length === 0) return undefined

  const rangeConditions: SQL[] = []

  for (const rangeKey of ranges) {
    const range = EMPLOYEE_COUNT_RANGES[rangeKey]
    if (!range) continue

    if (range.max === null) {
      // Open-ended filter (e.g., "1000+")
      // Match if stored value's minimum >= filter.min
      rangeConditions.push(
        sql`(
          ${leads.employeeCount} IS NOT NULL
          AND ${leads.employeeCount} ~ '[0-9]+'
          AND CAST(SUBSTRING(${leads.employeeCount} FROM '[0-9]+') AS INTEGER) >= ${range.min}
        )`,
      )
    } else {
      // Closed range filter (e.g., "11-50")
      // Use single regex to extract min/max, then check overlap
      // Pattern: Extract first number as min, second number (if exists) as max, else max=min
      rangeConditions.push(
        sql`(
          ${leads.employeeCount} IS NOT NULL
          AND ${leads.employeeCount} ~ '[0-9]+'
          AND (
            CASE
              -- Has range pattern "X-Y": check range overlap
              WHEN ${leads.employeeCount} ~ '[0-9]+-[0-9]+' THEN
                CAST(SUBSTRING(${leads.employeeCount} FROM '^([0-9]+)') AS INTEGER) <= ${range.max}
                AND CAST(SUBSTRING(${leads.employeeCount} FROM '-([0-9]+)') AS INTEGER) >= ${range.min}
              -- Single number: check if within range
              ELSE
                CAST(SUBSTRING(${leads.employeeCount} FROM '[0-9]+') AS INTEGER) BETWEEN ${range.min} AND ${range.max}
            END
          )
        )`,
      )
    }
  }

  if (rangeConditions.length === 0) return undefined
  if (rangeConditions.length === 1) return rangeConditions[0]

  return or(...rangeConditions)
}

/**
 * Validates a single filter
 */
export function validateFilter(filter: ColumnFilter): FilterValidationResult {
  // Check if field is filterable
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic field validation requires any type
  if (!FILTERABLE_LEAD_FIELDS.includes(filter.field as any)) {
    return {
      isValid: false,
      error: `Field "${filter.field}" is not filterable`,
    }
  }

  // Check if operator is valid for field type
  const fieldType = LEAD_FIELD_TYPES[filter.field]
  if (!fieldType) {
    return {
      isValid: false,
      error: `Field "${filter.field}" has no type mapping`,
    }
  }

  const validOperators = OPERATOR_FIELD_TYPE_MAP[fieldType] || []

  if (!validOperators.includes(filter.operator)) {
    return {
      isValid: false,
      error: `Operator "${filter.operator}" is not valid for field "${filter.field}" (type: ${fieldType})`,
    }
  }

  // Validate value based on operator
  if (filter.operator === "between") {
    if (typeof filter.value !== "object" || filter.value === null) {
      return {
        isValid: false,
        error: `Operator "between" requires an object with min/max or from/to properties`,
      }
    }

    const hasMinMax = "min" in filter.value && "max" in filter.value
    const hasFromTo = "from" in filter.value && "to" in filter.value

    if (!hasMinMax && !hasFromTo) {
      return {
        isValid: false,
        error: `Operator "between" requires {min, max} for numbers or {from, to} for dates`,
      }
    }
  }

  if (["in", "notIn"].includes(filter.operator)) {
    if (!Array.isArray(filter.value)) {
      return {
        isValid: false,
        error: `Operator "${filter.operator}" requires an array value`,
      }
    }
  }

  if (["isEmpty", "isNotEmpty"].includes(filter.operator)) {
    // These operators don't need a value
    filter.value = null
  }

  return { isValid: true }
}

/**
 * Validates an array of filters
 */
export function validateFilters(filters: ColumnFilter[]): FilterValidationResult {
  for (const filter of filters) {
    const result = validateFilter(filter)
    if (!result.isValid) {
      return result
    }
  }

  return { isValid: true }
}

/**
 * Builds a Drizzle where condition from a single filter
 */
export function buildFilterCondition(filter: ColumnFilter): SQL | undefined {
  const { field, operator, value } = filter

  // Special handling for employeeCount field with "in" and "notIn" operators
  // This field stores string values but needs to be filtered by numeric ranges
  if (field === "employeeCount" && (operator === "in" || operator === "notIn")) {
    if (!Array.isArray(value)) {
      throw new Error(`Operator "${operator}" requires an array value`)
    }

    const rangeCondition = buildEmployeeCountRangeCondition(value as string[])

    if (!rangeCondition) return undefined

    // For "notIn", negate the condition
    if (operator === "notIn") {
      return not(rangeCondition)
    }

    return rangeCondition
  }

  // Get the column from the leads schema
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic column access from schema requires any type
  const column = (leads as any)[field]

  if (!column) {
    throw new Error(`Field "${field}" not found in leads schema`)
  }

  switch (operator) {
    case "equals":
      return eq(column, value)

    case "notEquals":
      return ne(column, value)

    case "contains":
      return ilike(column, `%${value as string}%`)

    case "startsWith":
      return ilike(column, `${value as string}%`)

    case "endsWith":
      return ilike(column, `%${value as string}`)

    case "gt":
      return gt(column, value)

    case "lt":
      return lt(column, value)

    case "gte":
      return gte(column, value)

    case "lte":
      return lte(column, value)

    case "between": {
      if (typeof value === "object" && value !== null) {
        if ("min" in value && "max" in value) {
          // Number range
          return and(gte(column, value.min), lte(column, value.max))
        } else if ("from" in value && "to" in value) {
          // Date range
          return and(gte(column, new Date(value.from)), lte(column, new Date(value.to)))
        }
      }
      throw new Error('Invalid value for "between" operator')
    }

    case "in":
      // biome-ignore lint/suspicious/noExplicitAny: Array value type must be coerced for inArray operator
      return inArray(column, value as any[])

    case "notIn":
      // biome-ignore lint/suspicious/noExplicitAny: Array value type must be coerced for notInArray operator
      return notInArray(column, value as any[])

    case "isEmpty":
      return or(eq(column, null), eq(column, ""))

    case "isNotEmpty":
      return and(not(eq(column, null)), not(eq(column, "")))

    default:
      throw new Error(`Unknown operator: ${operator}`)
  }
}

/**
 * Builds Drizzle where conditions from an array of filters
 * All filters are combined with AND logic
 */
export function buildFiltersQuery(filters: ColumnFilter[]): SQL | undefined {
  if (filters.length === 0) {
    return undefined
  }

  const conditions = filters
    .map((filter) => buildFilterCondition(filter))
    .filter((c): c is SQL => c !== undefined)

  if (conditions.length === 0) {
    return undefined
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return and(...conditions)
}

/**
 * Parses filters from JSON string
 */
export function parseFiltersFromQuery(filtersJson?: string): ColumnFilter[] {
  if (!filtersJson) {
    return []
  }

  try {
    const parsed = JSON.parse(filtersJson)

    if (!Array.isArray(parsed)) {
      throw new Error("Filters must be an array")
    }

    return parsed as ColumnFilter[]
  } catch (error) {
    throw new Error(
      `Invalid filters JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Builds date range filters for createdAt/updatedAt
 */
export function buildDateRangeFilter(
  field: "createdAt" | "updatedAt",
  after?: string,
  before?: string,
): SQL | undefined {
  const column = leads[field]
  const conditions: SQL[] = []

  if (after) {
    conditions.push(gte(column, new Date(after)))
  }

  if (before) {
    conditions.push(lte(column, new Date(before)))
  }

  if (conditions.length === 0) {
    return undefined
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return and(...conditions)
}
