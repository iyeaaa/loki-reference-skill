import { CreditCard, Eye, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput, useFilters } from "@/components/ui/data-filters"
import { type Column, DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useBillingCustomers, useSubscriptions } from "@/lib/api/hooks/billing"
import type { BillingCustomer, BillingCustomersParams, Subscription } from "@/lib/api/types/billing"
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_TIER_LABELS } from "@/lib/api/types/billing"
import { formatRelativeTime } from "@/lib/date-utils"

export default function CustomersPage() {
  const { searchQuery, currentPage, handleSearch, handlePageChange } = useFilters()

  const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  // Build API params
  const params: BillingCustomersParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
  }

  const { data, isFetching, refetch } = useBillingCustomers(params)

  // Fetch subscriptions for the selected customer
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useSubscriptions(
    { limit: 100 },
    // Only fetch if we have a selected customer
  )

  const customers = data?.data || []
  const allSubscriptions = subscriptionsData?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleViewDetails = (customer: BillingCustomer) => {
    setSelectedCustomer(customer)
    setIsDetailDialogOpen(true)
  }

  // Get subscriptions for the selected customer
  const getCustomerSubscriptions = (customerId: string): Subscription[] => {
    return allSubscriptions.filter((sub) => sub.customerId === customerId)
  }

  const columns: Column<BillingCustomer>[] = [
    {
      key: "user",
      header: "사용자",
      minWidth: "140px",
      render: (item) => (
        <div className="max-w-[140px]">
          <div
            className="font-medium text-gray-900 dark:text-gray-100 truncate"
            title={item.user?.username}
          >
            {item.user?.username || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "userEmail",
      header: "사용자 이메일",
      minWidth: "160px",
      render: (item) => (
        <span
          className="text-sm text-gray-500 truncate block max-w-[160px]"
          title={item.user?.email || undefined}
        >
          {item.user?.email || "-"}
        </span>
      ),
    },
    {
      key: "email",
      header: "결제 이메일",
      minWidth: "160px",
      render: (item) => (
        <span className="text-sm truncate block max-w-[160px]" title={item.email || undefined}>
          {item.email || "-"}
        </span>
      ),
    },
    {
      key: "name",
      header: "결제자명",
      minWidth: "100px",
      render: (item) => (
        <span className="text-sm truncate block max-w-[100px]" title={item.name || undefined}>
          {item.name || "-"}
        </span>
      ),
    },
    {
      key: "subscriptionsCount",
      header: "구독",
      width: "60px",
      render: (item) => <span className="text-gray-600">{item.subscriptionsCount || 0}건</span>,
    },
    {
      key: "activeSubscriptionsCount",
      header: "활성",
      width: "50px",
      render: (item) => (
        <span className={item.activeSubscriptionsCount ? "text-green-600" : "text-gray-400"}>
          {item.activeSubscriptionsCount || 0}
        </span>
      ),
    },
    {
      key: "externalCustomerId",
      header: "외부 ID",
      width: "100px",
      render: (item) => (
        <span className="text-xs font-mono text-gray-500" title={item.externalCustomerId}>
          {item.externalCustomerId.slice(0, 10)}...
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "등록일",
      width: "80px",
      render: (item) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatRelativeTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "액션",
      width: "50px",
      sticky: "right",
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewDetails(item)}
          className="text-xs h-7 w-7 p-0"
          title="상세 보기"
        >
          <Eye className="h-3 w-3" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Customers Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg">고객</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="이메일, 이름, 외부 ID로 검색..."
            />
          </div>

          {/* Table */}
          <DataTable
            data={customers}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            getItemId={(item) => item.id}
            onPageChange={handlePageChange}
            emptyMessage="아직 고객이 없어요"
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">고객 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {selectedCustomer && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">사용자</span>
                    <p className="mt-1 font-medium">{selectedCustomer.user?.username || "-"}</p>
                    <p className="text-xs text-gray-500">{selectedCustomer.user?.email || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">결제 이메일</span>
                    <p className="mt-1">{selectedCustomer.email || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">결제자명</span>
                    <p className="mt-1">{selectedCustomer.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">외부 고객 ID</span>
                    <p className="mt-1 text-sm font-mono">{selectedCustomer.externalCustomerId}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">등록일</span>
                    <p className="mt-1 text-sm">
                      {new Date(selectedCustomer.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">수정일</span>
                    <p className="mt-1 text-sm">
                      {new Date(selectedCustomer.updatedAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                {selectedCustomer.metadata && Object.keys(selectedCustomer.metadata).length > 0 && (
                  <div className="pt-4 border-t">
                    <span className="text-sm font-medium text-gray-500">메타데이터</span>
                    <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedCustomer.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Customer's Subscriptions */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    구독 목록
                  </h4>
                  {subscriptionsLoading ? (
                    <div className="text-sm text-gray-500">로딩 중...</div>
                  ) : (
                    <CustomerSubscriptionsList
                      subscriptions={getCustomerSubscriptions(selectedCustomer.id)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Customer Subscriptions List Component
// ============================================================================

function CustomerSubscriptionsList({ subscriptions }: { subscriptions: Subscription[] }) {
  if (subscriptions.length === 0) {
    return (
      <Card className="p-4 bg-gray-50 dark:bg-gray-800">
        <p className="text-sm text-gray-500">아직 구독이 없어요</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((sub) => (
        <Card key={sub.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{sub.workspace?.name || "Unknown"}</span>
                <Badge
                  variant={sub.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status}
                </Badge>
                {sub.isPrimary && (
                  <Badge variant="outline" className="text-xs">
                    메인
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {sub.plan?.name} (
                {SUBSCRIPTION_TIER_LABELS[
                  sub.plan?.product?.tier as keyof typeof SUBSCRIPTION_TIER_LABELS
                ] || "-"}
                )
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>
                기간 종료: {sub.currentPeriodEnd ? formatRelativeTime(sub.currentPeriodEnd) : "-"}
              </div>
              {sub.cancelAtPeriodEnd && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  취소 예정
                </Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
