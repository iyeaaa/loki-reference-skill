import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useEmailTemplates } from "@/lib/api/hooks/email-templates"
import type { EmailTemplate, EmailTemplatesParams } from "@/lib/api/types/email-template"
import { formatRelativeTime } from "@/lib/date-utils"

type EmailTemplatesTableWithPaginationProps = {
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
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  const params: EmailTemplatesParams = {
    page: currentPage,
    limit,
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
    if (!category) {
      return <Badge variant="outline">{t("emailTemplates.table.uncategorized")}</Badge>
    }
    return <Badge variant="outline">{category}</Badge>
  }

  const getSharedBadge = (isShared: boolean) => (
    <Badge variant={isShared ? "default" : "outline"}>
      {isShared ? t("emailTemplates.filter.shared") : t("emailTemplates.filter.private")}
    </Badge>
  )

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
      const page = Number.parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = Number.parseInt(pageInputValue, 10)
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
                  className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={templates.length > 0 && selectedTemplates.length === templates.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  {t("emailTemplates.table.column.templateName")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  {t("emailTemplates.table.column.subject")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("emailTemplates.table.column.category")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("emailTemplates.table.column.sharedStatus")}
                </th>

                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("emailTemplates.table.column.createdAt")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("emailTemplates.table.column.updatedAt")}
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("emailTemplates.table.column.edit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {templates.map((template) => (
                <tr
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  key={template.id}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Checkbox
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={() => onToggleTemplate(template.id)}
                    />
                  </td>
                  <td
                    className="p-2 font-medium text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={template.name}
                  >
                    {template.name}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={template.subject}
                  >
                    {template.subject}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    {getCategoryBadge(template.category)}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    {getSharedBadge(template.isShared)}
                  </td>

                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(template.createdAt)}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(template.updatedAt)}
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onEditTemplate(template)}
                      size="sm"
                      variant="outline"
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
          <div className="text-muted-foreground text-sm">
            {total > 0 ? (
              <>
                {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, total)} /{" "}
                {t("emailTemplates.table.pagination.displaying", { count: total })}
              </>
            ) : (
              t("emailTemplates.table.pagination.displayingZero")
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-1">
          {/* First Page */}
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(1)}
            size="sm"
            variant="outline"
          >
            {t("emailTemplates.table.pagination.first")}
          </Button>

          {/* Previous Page */}
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("emailTemplates.table.pagination.previous")}
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              className="min-w-[40px] px-3"
              disabled={isFetching}
              key={page}
              onClick={() => handlePageChange(page)}
              size="sm"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            size="sm"
            variant="outline"
          >
            {t("emailTemplates.table.pagination.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(totalPages)}
            size="sm"
            variant="outline"
          >
            {t("emailTemplates.table.pagination.last")}
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t("emailTemplates.table.pagination.page")}
          </span>
          <Input
            className="h-8 w-20 text-center text-sm"
            disabled={isFetching}
            max={totalPages || 1}
            min="1"
            onBlur={handlePageInputBlur}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            type="number"
            value={pageInputValue}
          />
          <span className="text-muted-foreground text-sm">/ {totalPages || 1}</span>
        </div>
      </div>
    </>
  )
}
