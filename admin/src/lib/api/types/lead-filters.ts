/**
 * Lead Filtering Types
 *
 * Type definitions for the advanced filtering system matching backend types
 */

export type FilterOperator =
  | "equals" // Exact match
  | "notEquals" // Not equal
  | "contains" // Substring match (case-insensitive)
  | "startsWith" // Starts with
  | "endsWith" // Ends with
  | "gt" // Greater than (numbers/dates)
  | "lt" // Less than (numbers/dates)
  | "gte" // Greater than or equal
  | "lte" // Less than or equal
  | "between" // Range (numbers/dates)
  | "in" // One of multiple values
  | "notIn" // Not one of multiple values
  | "isEmpty" // Null or empty string
  | "isNotEmpty" // Not null and not empty

export type FilterValue =
  | string
  | string[]
  | number
  | { min: number; max: number }
  | { from: string; to: string }
  | null

export interface ColumnFilter {
  field: string
  operator: FilterOperator
  value: FilterValue
}

export interface FilterPreset {
  id: string
  name: string
  filters: ColumnFilter[]
  createdAt: string
  isShared?: boolean
}

export type ColumnFilterType = "text" | "select" | "number" | "date" | "enum"

export interface ColumnFilterConfig {
  type: ColumnFilterType
  operators?: FilterOperator[]
  options?: Array<{ value: string; label: string }>
  loadOptions?: (context?: {
    customerGroupId?: string
    workspaceId?: string
    signal?: AbortSignal
  }) => Promise<Array<{ value: string; label: string; count?: number }>>
}

// Filterable lead fields (must match backend FILTERABLE_LEAD_FIELDS)
export const FILTERABLE_LEAD_FIELDS = [
  "companyName",
  "foundCompanyName",
  "contactName",
  "websiteUrl",
  "businessType",
  "description",
  "country",
  "city",
  "state",
  "address",
  "foundedYear",
  "employeeCount",
  "leadStatus",
  "leadScore",
  "leadSource",
  "notes",
  "createdAt",
  "updatedAt",
] as const

export type FilterableLeadField = (typeof FILTERABLE_LEAD_FIELDS)[number]

// Field type mapping for validation
export const LEAD_FIELD_TYPES: Record<string, ColumnFilterType> = {
  companyName: "text",
  foundCompanyName: "text",
  contactName: "text",
  websiteUrl: "text",
  businessType: "text",
  description: "text",
  country: "select",
  city: "select",
  state: "text",
  address: "text",
  foundedYear: "number",
  employeeCount: "select",
  leadStatus: "enum",
  leadScore: "number",
  leadSource: "select",
  notes: "text",
  createdAt: "date",
  updatedAt: "date",
}

// Operator-field type compatibility map
export const OPERATOR_FIELD_TYPE_MAP: Record<ColumnFilterType, FilterOperator[]> = {
  text: [
    "equals",
    "notEquals",
    "contains",
    "startsWith",
    "endsWith",
    "in",
    "notIn",
    "isEmpty",
    "isNotEmpty",
  ],
  number: ["equals", "notEquals", "gt", "lt", "gte", "lte", "between", "isEmpty", "isNotEmpty"],
  date: ["equals", "notEquals", "gt", "lt", "gte", "lte", "between"],
  enum: ["equals", "notEquals", "in", "notIn"],
  select: ["in", "notIn", "isEmpty", "isNotEmpty"],
}

// Filter display labels
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "Equals",
  notEquals: "Does not equal",
  contains: "Contains",
  startsWith: "Starts with",
  endsWith: "Ends with",
  gt: "Greater than",
  lt: "Less than",
  gte: "Greater than or equal to",
  lte: "Less than or equal to",
  between: "Between",
  in: "Is one of",
  notIn: "Is not one of",
  isEmpty: "Is empty",
  isNotEmpty: "Is not empty",
}

// Helper to get valid operators for a field
export function getOperatorsForField(field: string): FilterOperator[] {
  const fieldType = LEAD_FIELD_TYPES[field]
  if (!fieldType) return []
  return OPERATOR_FIELD_TYPE_MAP[fieldType] || []
}

// Helper to validate filter
export function isValidFilter(filter: ColumnFilter): boolean {
  if (!FILTERABLE_LEAD_FIELDS.includes(filter.field as FilterableLeadField)) {
    return false
  }

  const validOperators = getOperatorsForField(filter.field)
  if (!validOperators.includes(filter.operator)) {
    return false
  }

  // Validate value based on operator
  if (filter.operator === "between") {
    if (typeof filter.value !== "object" || filter.value === null) {
      return false
    }
    const hasMinMax = "min" in filter.value && "max" in filter.value
    const hasFromTo = "from" in filter.value && "to" in filter.value
    return hasMinMax || hasFromTo
  }

  if (["in", "notIn"].includes(filter.operator)) {
    return Array.isArray(filter.value)
  }

  if (["isEmpty", "isNotEmpty"].includes(filter.operator)) {
    return true // Value doesn't matter for these operators
  }

  return filter.value !== undefined && filter.value !== null
}
