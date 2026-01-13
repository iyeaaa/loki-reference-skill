/**
 * Column visibility management for Leads table
 */

export type ColumnDefinition = {
  id: string
  label: string
  isDefault: boolean
  canHide: boolean // If false, column cannot be hidden
}

// All available columns
export const AVAILABLE_COLUMNS: ColumnDefinition[] = [
  { id: "select", label: "선택", isDefault: true, canHide: false },
  { id: "companyName", label: "회사명", isDefault: true, canHide: false },
  { id: "websiteUrl", label: "웹사이트", isDefault: true, canHide: false },
  { id: "leadStatus", label: "상태", isDefault: true, canHide: false },
  { id: "contactName", label: "담당자명", isDefault: true, canHide: true },
  { id: "email", label: "이메일", isDefault: true, canHide: true },
  { id: "createdAt", label: "생성일", isDefault: false, canHide: true },
  { id: "leadScore", label: "리드 점수", isDefault: false, canHide: true },
  { id: "country", label: "국가", isDefault: false, canHide: true },
  { id: "city", label: "도시", isDefault: false, canHide: true },
  { id: "businessType", label: "비즈니스 타입", isDefault: false, canHide: true },
  { id: "description", label: "설명", isDefault: false, canHide: true },
  { id: "employeeCount", label: "직원수", isDefault: false, canHide: true },
  { id: "leadSource", label: "리드 소스", isDefault: false, canHide: true },
  { id: "foundedYear", label: "설립연도", isDefault: false, canHide: true },
  { id: "createdBy", label: "생성자", isDefault: false, canHide: true },
  { id: "updatedAt", label: "수정일", isDefault: false, canHide: true },
  { id: "columnActions", label: "액션", isDefault: true, canHide: false },
]

const STORAGE_KEY = "leadsTableVisibleColumns"
const ORDER_STORAGE_KEY = "leadsTableColumnOrder"

/**
 * Get default visible column IDs
 */
export function getDefaultVisibleColumns(): string[] {
  return AVAILABLE_COLUMNS.filter((col) => col.isDefault).map((col) => col.id)
}

/**
 * Get default column order
 */
export function getDefaultColumnOrder(): string[] {
  return AVAILABLE_COLUMNS.map((col) => col.id)
}

/**
 * Get visible columns from localStorage or defaults
 */
export function getVisibleColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as string[]
      // Ensure all non-hidable columns are included
      const nonHidable = AVAILABLE_COLUMNS.filter((col) => !col.canHide).map((col) => col.id)
      const combined = [...new Set([...nonHidable, ...parsed])]
      return combined
    }
  } catch (error) {
    console.error("Failed to load visible columns from localStorage:", error)
  }
  return getDefaultVisibleColumns()
}

/**
 * Save visible columns to localStorage
 */
export function saveVisibleColumns(columnIds: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnIds))
  } catch (error) {
    console.error("Failed to save visible columns to localStorage:", error)
  }
}

/**
 * Add a column to visible columns (adds before columnActions)
 */
export function addColumn(columnId: string): {
  visibleColumns: string[]
  columnOrder: string[]
} {
  const currentVisible = getVisibleColumns()
  const currentOrder = getColumnOrder()

  if (!currentVisible.includes(columnId)) {
    // Add to visible columns
    const updatedVisible = [...currentVisible, columnId]
    saveVisibleColumns(updatedVisible)

    // Add to order - remove columnActions first, add new column, then saveColumnOrder will put columnActions at the end
    const withoutActions = currentOrder.filter((id) => id !== "columnActions" && id !== columnId)
    const newOrder = [...withoutActions, columnId, "columnActions"]

    // saveColumnOrder will ensure columnActions is at the end and save
    saveColumnOrder(newOrder)

    // Return the actual saved order (with columnActions at the end)
    return { visibleColumns: updatedVisible, columnOrder: getColumnOrder() }
  }

  return { visibleColumns: currentVisible, columnOrder: currentOrder }
}

/**
 * Remove a column from visible columns
 */
export function removeColumn(columnId: string): string[] {
  const column = AVAILABLE_COLUMNS.find((col) => col.id === columnId)
  // Don't remove if column cannot be hidden
  if (column && !column.canHide) {
    return getVisibleColumns()
  }

  const current = getVisibleColumns()
  const updated = current.filter((id) => id !== columnId)
  saveVisibleColumns(updated)
  return updated
}

/**
 * Get available columns that are not currently visible
 */
export function getAvailableToAdd(visibleColumns: string[]): ColumnDefinition[] {
  return AVAILABLE_COLUMNS.filter(
    (col) => !visibleColumns.includes(col.id) && col.id !== "select" && col.id !== "columnActions",
  )
}

/**
 * Get column order from localStorage or defaults
 * Always ensures columnActions is at the end
 */
export function getColumnOrder(): string[] {
  try {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as string[]

      // Get all column IDs that should exist
      const allColumnIds = AVAILABLE_COLUMNS.map((col) => col.id)
      const missing = allColumnIds.filter((id) => !parsed.includes(id))

      // Remove columnActions from parsed to ensure it's at the end
      const withoutActions = parsed.filter((id) => id !== "columnActions")

      // Add missing columns (excluding columnActions which we'll add at the end)
      const missingWithoutActions = missing.filter((id) => id !== "columnActions")

      // Combine: existing order + missing columns + columnActions at the end
      return [...withoutActions, ...missingWithoutActions, "columnActions"]
    }
  } catch (error) {
    console.error("Failed to load column order from localStorage:", error)
  }
  return getDefaultColumnOrder()
}

/**
 * Save column order to localStorage
 * Always ensures columnActions is at the end
 */
export function saveColumnOrder(columnIds: string[]): void {
  try {
    // Ensure columnActions is always at the end
    const withoutActions = columnIds.filter((id) => id !== "columnActions")
    const finalOrder = [...withoutActions, "columnActions"]

    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(finalOrder))
  } catch (error) {
    console.error("Failed to save column order to localStorage:", error)
  }
}

/**
 * Reorder columns - move a column from one index to another
 * saveColumnOrder will ensure columnActions stays at the end
 */
export function reorderColumns(
  columnOrder: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const result = [...columnOrder]
  const [removed] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, removed)

  // saveColumnOrder will ensure columnActions is at the end
  saveColumnOrder(result)

  // Return the corrected order (with columnActions at the end)
  return getColumnOrder()
}

/**
 * Reset column visibility and order to defaults
 * Useful for debugging or fixing corrupted localStorage
 */
export function resetColumnSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ORDER_STORAGE_KEY)
  } catch (error) {
    console.error("Failed to reset column settings:", error)
  }
}
