import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useEmailTemplates } from "@/lib/api/hooks/email-templates"
import type { EmailTemplate, EmailTemplatesParams } from "@/lib/api/types/email-template"
import { formatRelativeTime } from "@/lib/date-utils"

interface EmailTemplatesTableWithPaginationProps {
  searchQuery: string
  selectedCategories: string[]
  selectedSharedStatuses: string[]
  selectedWorkspaces: string[]
  selectedTemplates: string[]
  onToggleTemplate: (templateId: string) => void
  onToggleAll: (templateIds: string[]) => void
  onEditTemplate: (template: EmailTemplate) => void
}

export function EmailTemplatesTableWithPagination({
  searchQuery,
  selectedCategories,
  selectedSharedStatuses,
  selectedWorkspaces,
  selectedTemplates,
  onToggleTemplate,
  onToggleAll,
  onEditTemplate,
}: EmailTemplatesTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  const params: EmailTemplatesParams = {
    page: currentPage,
    limit: limit,
    category:
      selectedCategories.length === 1
        ? selectedCategories[0]
        : selectedCategories.length > 0
          ? undefined
          : undefined,
    isShared:
      selectedSharedStatuses.length === 1
        ? selectedSharedStatuses[0] === "shared"
        : selectedSharedStatuses.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    workspaceIds: selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined,
  }

  // Use React Query hook for fetching templates
  const { data: templatesData, isFetching } = useEmailTemplates(params)
  const templates = templatesData?.emailTemplates || []
  const totalPages = templatesData?.totalPages || 1
  const total = templatesData?.total || 0

  const getCategoryBadge = (category: string | null | undefined) => {
    if (!category) return <Badge variant="outline">미분류</Badge>
    return <Badge variant="outline">{category}</Badge>
  }

  const getSharedBadge = (isShared: boolean) => {
    return (
      <Badge variant={isShared ? "default" : "outline"}>{isShared ? "공유됨" : "비공개"}</Badge>
    )
  }

  const handleToggleAll = useCallback(() => {
    onToggleAll(templates.map((t) => t.id))
  }, [templates, onToggleAll])

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageInputValue(page.toString())
  }

  const handlePageInputChange = (value: string) => {
    setPageInputValue(value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = parseInt(pageInputValue, 10)
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    } else {
      setPageInputValue(currentPage.toString())
    }
  }

  const getPageNumbers = () => {
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
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

  return (
    <>
      {/* Templates Table */}
      <div className="rounded-md border">
        <div
          className="overflow-x-auto overflow-y-visible"
          style={{
            scrollbarGutter: "stable",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table className="w-full" style={{ tableLayout: "auto" }}>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={templates.length > 0 && selectedTemplates.length === templates.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  템플릿명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  제목
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  카테고리
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  공유상태
                </th>

                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  수정일
                </th>
                <th
                  className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  편집
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Checkbox
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={() => onToggleTemplate(template.id)}
                    />
                  </td>
                  <td
                    className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                    title={template.name}
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {template.name}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={template.subject}
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {template.subject}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm">
                    {getCategoryBadge(template.category)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm">
                    {getSharedBadge(template.isShared)}
                  </td>

                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(template.createdAt)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(template.updatedAt)}
                  </td>
                  <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditTemplate(template)}
                      className="text-xs h-8 px-3"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
            {total > 0 ? (
              <>
                {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, total)} /{" "}
                {total.toLocaleString()}개 표시
              </>
            ) : (
              "0개 표시"
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-1">
          {/* First Page */}
          <Button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            처음
          </Button>

          {/* Previous Page */}
          <Button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              key={page}
              onClick={() => handlePageChange(page)}
              disabled={isFetching}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="px-3 min-w-[40px]"
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            마지막
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">페이지:</span>
          <Input
            type="number"
            min="1"
            max={totalPages || 1}
            value={pageInputValue}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            onBlur={handlePageInputBlur}
            className="w-20 h-8 text-sm text-center"
            disabled={isFetching}
          />
          <span className="text-sm text-muted-foreground">/ {totalPages || 1}</span>
        </div>
      </div>
    </>
  )
}
