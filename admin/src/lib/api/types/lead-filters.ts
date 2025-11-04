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
  label: string
  type: "string" | "number" | "date" | "enum"
  options?: { value: string; label: string }[]
  placeholder?: string
}

/**
 * All searchable lead fields
 */
export const SEARCHABLE_LEAD_FIELDS: SearchableField[] = [
  {
    field: "companyName",
    label: "회사명",
    type: "string",
    placeholder: "회사명을 입력하세요...",
  },
  {
    field: "contactName",
    label: "담당자명",
    type: "string",
    placeholder: "담당자명을 입력하세요...",
  },
  {
    field: "websiteUrl",
    label: "웹사이트",
    type: "string",
    placeholder: "웹사이트 URL을 입력하세요...",
  },
  {
    field: "country",
    label: "국가",
    type: "string",
    placeholder: "국가를 입력하세요...",
  },
  {
    field: "city",
    label: "도시",
    type: "string",
    placeholder: "도시를 입력하세요...",
  },
  {
    field: "state",
    label: "주/도",
    type: "string",
    placeholder: "주/도를 입력하세요...",
  },
  {
    field: "businessType",
    label: "비즈니스 타입",
    type: "string",
    placeholder: "비즈니스 타입을 입력하세요...",
  },
  {
    field: "leadStatus",
    label: "상태",
    type: "enum",
    options: [
      { value: "new", label: "신규" },
      { value: "contacted", label: "연락됨" },
      { value: "qualified", label: "적격" },
      { value: "unqualified", label: "부적격" },
      { value: "converted", label: "전환됨" },
      { value: "lost", label: "실패" },
      { value: "unsubscribed", label: "구독취소" },
    ],
  },
  {
    field: "leadSource",
    label: "리드 소스",
    type: "string",
    placeholder: "리드 소스를 입력하세요...",
  },
  {
    field: "leadScore",
    label: "리드 점수",
    type: "number",
    placeholder: "리드 점수를 입력하세요...",
  },
  {
    field: "foundedYear",
    label: "설립연도",
    type: "number",
    placeholder: "설립연도를 입력하세요...",
  },
  {
    field: "employeeCount",
    label: "직원수",
    type: "string",
    placeholder: "직원수를 입력하세요...",
  },
  {
    field: "address",
    label: "주소",
    type: "string",
    placeholder: "주소를 입력하세요...",
  },
  {
    field: "description",
    label: "설명",
    type: "string",
    placeholder: "설명을 입력하세요...",
  },
  {
    field: "notes",
    label: "메모",
    type: "string",
    placeholder: "메모를 입력하세요...",
  },
  {
    field: "createdBy",
    label: "생성자",
    type: "string",
    placeholder: "생성자를 입력하세요...",
  },
  {
    field: "createdAt",
    label: "생성일",
    type: "date",
    placeholder: "날짜를 선택하세요...",
  },
  {
    field: "updatedAt",
    label: "수정일",
    type: "date",
    placeholder: "날짜를 선택하세요...",
  },
  {
    field: "lastContactedAt",
    label: "마지막 연락일",
    type: "date",
    placeholder: "날짜를 선택하세요...",
  },
]

/**
 * Get field configuration by field name
 */
export function getFieldConfig(field: string): SearchableField | undefined {
  return SEARCHABLE_LEAD_FIELDS.find((f) => f.field === field)
}

/**
 * Get field label by field name
 */
export function getFieldLabel(field: string): string {
  return getFieldConfig(field)?.label || field
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
