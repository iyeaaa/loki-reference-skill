/**
 * Filter operators for column-specific filtering
 * Mirrors backend: elysia-server/src/types/lead-filters.types.ts
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

/**
 * Filter value types
 */
export type FilterValue =
  | string
  | string[]
  | number
  | { min: number; max: number }
  | { from: string; to: string } // for date ranges
  | null

/**
 * Column filter definition
 */
export interface ColumnFilter {
  field: string
  operator: FilterOperator
  value: FilterValue
}

/**
 * Column filter configuration
 */
export interface ColumnFilterConfig {
  type: "text" | "number" | "date" | "enum" | "select"
  operators: FilterOperator[]
  loadOptions?: (context?: {
    workspaceId?: string
    customerGroupId?: string
    signal?: AbortSignal
  }) => Promise<Array<{ value: string; label: string }>>
}

/**
 * Filter preset - saved collection of filters
 */
export interface FilterPreset {
  id: string
  name: string
  filters: ColumnFilter[]
  createdAt: string
}

/**
 * Searchable field configuration
 */
export interface SearchableField {
  field: string
  type: "string" | "number" | "date" | "enum"
  options?: string[]
}

/**
 * All searchable lead fields
 */
export const SEARCHABLE_LEAD_FIELDS: SearchableField[] = [
  {
    field: "companyName",
    type: "string",
  },
  {
    field: "contactName",
    type: "string",
  },
  {
    field: "websiteUrl",
    type: "string",
  },
  {
    field: "country",
    type: "string",
  },
  {
    field: "city",
    type: "string",
  },
  {
    field: "state",
    type: "string",
  },
  {
    field: "businessType",
    type: "string",
  },
  {
    field: "leadStatus",
    type: "enum",
    options: ["new", "contacted", "qualified", "unqualified", "converted", "lost", "unsubscribed"],
  },
  {
    field: "leadSource",
    type: "string",
  },
  {
    field: "leadScore",
    type: "number",
  },
  {
    field: "foundedYear",
    type: "number",
  },
  {
    field: "employeeCount",
    type: "string",
  },
  {
    field: "address",
    type: "string",
  },
  {
    field: "description",
    type: "string",
  },
  {
    field: "notes",
    type: "string",
  },
  {
    field: "createdBy",
    type: "string",
  },
  {
    field: "createdAt",
    type: "date",
  },
  {
    field: "updatedAt",
    type: "date",
  },
  {
    field: "lastContactedAt",
    type: "date",
  },
]

export function keyOfField(field: string): string {
  return `search.fieldSelector.field.${field}`
}

/**
 * Get field configuration by field name
 */
export function getFieldConfig(field: string): SearchableField | undefined {
  return SEARCHABLE_LEAD_FIELDS.find((f) => f.field === field)
}

/**
 * Operator labels for display
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "Equals",
  notEquals: "Not Equals",
  contains: "Contains",
  startsWith: "Starts With",
  endsWith: "Ends With",
  gt: "Greater Than",
  lt: "Less Than",
  gte: "Greater Than or Equal",
  lte: "Less Than or Equal",
  between: "Between",
  in: "In",
  notIn: "Not In",
  isEmpty: "Is Empty",
  isNotEmpty: "Is Not Empty",
}
