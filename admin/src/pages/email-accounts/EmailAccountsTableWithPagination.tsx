import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useEmailAccounts } from "@/lib/api/hooks/email-accounts"
import type {
  EmailAccountStatus,
  EmailAccountsParams,
  UserEmailAccount,
} from "@/lib/api/types/email-account"
import { formatRelativeTime } from "@/lib/date-utils"

type EmailAccountsTableWithPaginationProps = {
  searchQuery: string
  selectedStatuses: string[]
  selectedWorkspaces: string[]
  selectedIsDefault: string[]
  selectedAccounts: string[]
  onToggleAccount: (accountId: string) => void
  onToggleAll: (accountIds: string[]) => void
  onEditAccount: (account: UserEmailAccount) => void
}

export function EmailAccountsTableWithPagination({
  searchQuery,
  selectedStatuses,
  selectedWorkspaces,
  selectedIsDefault,
  selectedAccounts,
  onToggleAccount,
  onToggleAll,
  onEditAccount,
}: EmailAccountsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  const params: EmailAccountsParams = {
    page: currentPage,
    limit,
    status:
      selectedStatuses.length === 1
        ? (selectedStatuses[0] as EmailAccountStatus)
        : selectedStatuses.length > 0
          ? "all"
          : undefined,
    isDefault:
      selectedIsDefault.length === 1
        ? selectedIsDefault[0] === "true"
        : selectedIsDefault.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    workspaceIds: selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined,
  }

  // Use React Query hook for fetching email accounts
  const { data: accountsData, isFetching } = useEmailAccounts(params)
  const accounts = accountsData?.emailAccounts || []
  const totalPages = accountsData?.totalPages || 1
  const total = accountsData?.total || 0

  const getStatusText = (status: EmailAccountStatus) => {
    switch (status) {
      case "active":
        return "활성"
      case "inactive":
        return "비활성"
      case "error":
        return "오류"
      case "rate_limited":
        return "제한됨"
      case "suspended":
        return "정지됨"
      default:
        return status
    }
  }

  const getStatusBadgeVariant = (status: EmailAccountStatus) => {
    switch (status) {
      case "active":
        return "default" as const
      case "inactive":
        return "secondary" as const
      case "error":
        return "destructive" as const
      default:
        return "outline" as const
    }
  }

  const handleToggleAll = useCallback(() => {
    onToggleAll(accounts.map((a) => a.id))
  }, [accounts, onToggleAll])

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
      {/* Email Accounts Table */}
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
                    checked={accounts.length > 0 && selectedAccounts.length === accounts.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  이메일
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  표시 이름
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "120px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  기본
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  일일 발송
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  월별 발송
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  최근동기화
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  편집
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {accounts.map((account) => (
                <tr
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  key={account.id}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => onToggleAccount(account.id)}
                    />
                  </td>
                  <td
                    className="p-2 font-medium text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "250px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={account.emailAddress}
                  >
                    {account.emailAddress}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={account.displayName || "-"}
                  >
                    {account.displayName || "-"}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {account.workspaceId}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    <Badge className="text-xs" variant={getStatusBadgeVariant(account.status)}>
                      {getStatusText(account.status)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    {account.isDefault && (
                      <Badge className="text-xs" variant="outline">
                        기본
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-900 text-sm dark:text-gray-100">
                    {account.dailySentCount}
                    {account.dailyLimit && ` / ${account.dailyLimit}`}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-900 text-sm dark:text-gray-100">
                    {account.monthlySentCount}
                    {account.monthlyLimit && ` / ${account.monthlyLimit}`}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(account.lastSyncAt || null)}
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onEditAccount(account)}
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
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(1)}
            size="sm"
            variant="outline"
          >
            처음
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
            이전
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
            다음
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
            마지막
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">페이지:</span>
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
