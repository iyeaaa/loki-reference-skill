import type { ColumnFilter, FilterOperator } from "@/lib/api/types/lead-filters"
import { getFieldConfig } from "@/lib/api/types/lead-filters"

/**
 * Search token representation
 */
export interface SearchToken {
  id: string
  field: string
  fieldLabel: string
  operator: FilterOperator
  value: string
  displayValue: string
}

/**
 * Generate a unique ID for a token
 */
function generateTokenId(): string {
  return `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a search token from field and value
 */
export function createToken(field: string, value: string): SearchToken {
  const fieldConfig = getFieldConfig(field)
  const fieldLabel = fieldConfig?.label || field

  // Determine operator based on field type
  let operator: FilterOperator = "contains"
  let displayValue = value

  if (fieldConfig?.type === "enum") {
    operator = "equals"
    // Find label for enum value
    const option = fieldConfig.options?.find((opt) => opt.value === value)
    displayValue = option?.label || value
  } else if (fieldConfig?.type === "number") {
    operator = "equals"
  } else if (fieldConfig?.type === "date") {
    operator = "gte"
  }

  return {
    id: generateTokenId(),
    field,
    fieldLabel,
    operator,
    value,
    displayValue,
  }
}

/**
 * Convert a search token to a column filter
 */
export function tokenToFilter(token: SearchToken): ColumnFilter {
  const fieldConfig = getFieldConfig(token.field)

  let filterValue: ColumnFilter["value"] = token.value

  // Convert value based on field type and operator
  if (fieldConfig?.type === "number") {
    const numValue = Number.parseFloat(token.value)
    filterValue = Number.isNaN(numValue) ? 0 : numValue
  } else if (fieldConfig?.type === "date") {
    if (token.operator === "between") {
      // Parse date range from JSON string
      try {
        const parsed = JSON.parse(token.value)
        // Backend expects { from: string, to: string } for new Date() conversion
        filterValue = parsed
      } catch {
        filterValue = token.value
      }
    } else if (token.operator === "gte" || token.operator === "lte") {
      // Single date value - keep as string for new Date() conversion
      filterValue = token.value
    }
  }

  return {
    field: token.field,
    operator: token.operator,
    value: filterValue,
  }
}

/**
 * Convert an array of search tokens to column filters
 */
export function tokensToFilters(tokens: SearchToken[]): ColumnFilter[] {
  return tokens.map((token) => tokenToFilter(token))
}

/**
 * Convert column filters to JSON string for API
 */
export function filtersToQueryString(filters: ColumnFilter[]): string {
  return JSON.stringify(filters)
}

/**
 * Parse token input string
 * Returns null if input is not in the expected format
 */
export function parseTokenInput(input: string): { field: string; value: string } | null {
  // Expected format: "@fieldName: value" or "fieldName: value"
  const match = input.match(/^@?([a-zA-Z]+):\s*(.+)$/)
  if (!match) return null

  const [, field, value] = match
  if (!field || !value) return null

  return { field: field.trim(), value: value.trim() }
}

/**
 * Format token for display
 */
export function formatTokenDisplay(token: SearchToken): string {
  return `@${token.fieldLabel}: ${token.displayValue}`
}

/**
 * Check if a string looks like a token input
 */
export function isTokenInput(input: string): boolean {
  return /^@?[a-zA-Z]+:\s*.+$/.test(input)
}

/**
 * Extract field name from partial input (e.g., "@companyName:" or "companyName:")
 */
export function extractFieldFromInput(input: string): string | null {
  const match = input.match(/^@?([a-zA-Z]+):/)
  return match ? match[1] : null
}
