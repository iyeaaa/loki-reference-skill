import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================================================
// Types
// ============================================================================

export type Column<T> = {
  key: string
  header: string
  width?: string
  minWidth?: string
  sticky?: "left" | "right"
  render?: (item: T, index: number) => ReactNode
  sortable?: boolean
}

export type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type DataTableProps<T> = {
  data: T[]
  columns: Column<T>[]
  pagination?: PaginationInfo
  isLoading?: boolean
  selectable?: boolean
  selectedIds?: string[]
  getItemId?: (item: T) => string
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (ids: string[]) => void
  onPageChange?: (page: number) => void
  emptyMessage?: string
  loadingRows?: number
}

// ============================================================================
// DataTable Component
// ============================================================================

export function DataTable<T>({
  data,
  columns,
  pagination,
  isLoading = false,
  selectable = false,
  selectedIds = [],
  getItemId,
  onToggleSelect,
  onToggleSelectAll,
  onPageChange,
  emptyMessage = "데이터가 없습니다.",
  loadingRows = 5,
}: DataTableProps<T>) {
  const [pageInputValue, setPageInputValue] = useState(pagination?.page?.toString() || "1")

  const handlePageChange = useCallback(
    (page: number) => {
      onPageChange?.(page)
      setPageInputValue(page.toString())
    },
    [onPageChange],
  )

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && pagination) {
      const page = Number.parseInt(pageInputValue, 10)
      if (page >= 1 && page <= pagination.totalPages) {
        handlePageChange(page)
      } else {
        setPageInputValue(pagination.page.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    if (pagination) {
      const page = Number.parseInt(pageInputValue, 10)
      if (page >= 1 && page <= pagination.totalPages) {
        handlePageChange(page)
      } else {
        setPageInputValue(pagination.page.toString())
      }
    }
  }

  const getPageNumbers = () => {
    if (!pagination) {
      return []
    }
    const { page, totalPages } = pagination
    const maxVisiblePages = 5
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  const handleToggleAll = useCallback(() => {
    if (getItemId && onToggleSelectAll) {
      onToggleSelectAll(data.map((item) => getItemId(item)))
    }
  }, [data, getItemId, onToggleSelectAll])

  const allSelected = data.length > 0 && selectedIds.length === data.length

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {selectable && (
                  <th className="w-10 p-2">
                    <Skeleton className="h-4 w-4" />
                  </th>
                )}
                {columns.map((col) => (
                  <th className="p-2 text-left" key={col.key}>
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr className="border-t" key={rowIndex}>
                  {selectable && (
                    <td className="p-2">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td className="p-2" key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <div
          className="overflow-x-auto overflow-y-visible"
          style={{ scrollbarGutter: "stable", WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full" style={{ tableLayout: "auto" }}>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {selectable && (
                  <th
                    className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                    style={{ width: "1%", whiteSpace: "nowrap" }}
                  >
                    <Checkbox checked={allSelected} onCheckedChange={handleToggleAll} />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    className={`p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400 ${
                      col.sticky === "left"
                        ? "sticky left-0 z-10 bg-gray-50 dark:bg-gray-700"
                        : col.sticky === "right"
                          ? "sticky right-0 z-10 bg-gray-50 dark:bg-gray-700"
                          : ""
                    }`}
                    key={col.key}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                      whiteSpace: col.width === "1%" ? "nowrap" : undefined,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {data.length === 0 ? (
                <tr>
                  <td
                    className="p-8 text-center text-gray-500 dark:text-gray-400"
                    colSpan={columns.length + (selectable ? 1 : 0)}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((item, index) => {
                  const itemId = getItemId?.(item) || String(index)
                  const isSelected = selectedIds.includes(itemId)

                  return (
                    <tr
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                      key={itemId}
                    >
                      {selectable && (
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleSelect?.(itemId)}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          className={`p-2 text-sm ${
                            col.sticky === "left"
                              ? "sticky left-0 z-10 bg-white dark:bg-gray-800"
                              : col.sticky === "right"
                                ? "sticky right-0 z-10 bg-white dark:bg-gray-800"
                                : ""
                          }`}
                          key={col.key}
                          style={{
                            maxWidth: col.minWidth,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col.render
                            ? col.render(item, index)
                            : String((item as Record<string, unknown>)[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div className="mt-6 space-y-4">
          {/* Pagination Info */}
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground text-sm">
              {pagination.total > 0 ? (
                <>
                  {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} /{" "}
                  {pagination.total.toLocaleString()}개 표시
                </>
              ) : (
                "0개 표시"
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-center gap-1">
            <Button
              className="px-3"
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(1)}
              size="sm"
              variant="outline"
            >
              처음
            </Button>

            <Button
              className="px-3"
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>

            {getPageNumbers().map((page) => (
              <Button
                className="min-w-[40px] px-3"
                key={page}
                onClick={() => handlePageChange(page)}
                size="sm"
                variant={page === pagination.page ? "default" : "outline"}
              >
                {page}
              </Button>
            ))}

            <Button
              className="px-3"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
              size="sm"
              variant="outline"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              className="px-3"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.totalPages)}
              size="sm"
              variant="outline"
            >
              마지막
            </Button>
          </div>

          {/* Page Jump */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-muted-foreground text-sm">페이지:</span>
            <Input
              className="h-8 w-20 text-center text-sm"
              max={pagination.totalPages || 1}
              min="1"
              onBlur={handlePageInputBlur}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={handlePageInputKeyDown}
              type="number"
              value={pageInputValue}
            />
            <span className="text-muted-foreground text-sm">/ {pagination.totalPages || 1}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Status Badge Component
// ============================================================================

export type StatusBadgeProps = {
  status: string
  variant?: "default" | "success" | "warning" | "error" | "info"
  label?: string
}

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  warning: "secondary",
  error: "destructive",
  info: "outline",
  default: "outline",
}

export function StatusBadge({ status, variant = "default", label }: StatusBadgeProps) {
  const badgeVariant = statusVariantMap[variant] || "outline"

  return (
    <Badge className="text-xs" variant={badgeVariant}>
      {label || status}
    </Badge>
  )
}

// ============================================================================
// Bulk Actions Bar Component
// ============================================================================

export type BulkAction = {
  id: string
  label: string
  icon?: ReactNode
  variant?: "default" | "destructive" | "outline"
  onClick: () => void
}

export type BulkActionsBarProps = {
  selectedCount: number
  actions: BulkAction[]
}

export function BulkActionsBar({ selectedCount, actions }: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="text-muted-foreground text-sm">
        <span className="font-medium">{selectedCount}개 선택됨</span>
      </div>
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button
            className={action.variant === "destructive" ? "text-red-600 hover:text-red-700" : ""}
            key={action.id}
            onClick={action.onClick}
            size="sm"
            variant={action.variant || "outline"}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
