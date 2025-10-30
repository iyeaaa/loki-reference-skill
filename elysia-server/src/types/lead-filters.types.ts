/**
 * Filter operators for column-specific filtering
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
 * Filter validation result
 */
export interface FilterValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Supported filterable fields on Lead model
 */
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

/**
 * Operator compatibility with field types
 */
export const OPERATOR_FIELD_TYPE_MAP: Record<string, FilterOperator[]> = {
  string: [
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
}

/**
 * Field type mapping for validation
 */
export const LEAD_FIELD_TYPES: Record<string, "string" | "number" | "date" | "enum"> = {
  companyName: "string",
  foundCompanyName: "string",
  contactName: "string",
  websiteUrl: "string",
  businessType: "string",
  description: "string",
  country: "string",
  city: "string",
  state: "string",
  address: "string",
  foundedYear: "number",
  employeeCount: "string",
  leadStatus: "enum",
  leadScore: "number",
  leadSource: "string",
  notes: "string",
  createdAt: "date",
  updatedAt: "date",
}

/**
 * Represents a single filter option with value, label, and count
 */
export interface FilterOption {
  value: string
  label: string
  count: number
}

/**
 * Response data for the filter options endpoint
 */
export interface GetFilterOptionsResponse {
  field: FilterableLeadField
  options: FilterOption[]
  total: number
}
