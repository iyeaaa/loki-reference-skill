import { Ban, Edit, Eye, History, Plus, RefreshCw } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DataFilters,
  type FilterConfig,
  SearchInput,
  useFilters,
} from "@/components/ui/data-filters"
import { type Column, DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useBillingCustomers,
  useBillingPlans,
  useCancelSubscription,
  useCreateSubscription,
  useSubscriptionHistory,
  useSubscriptions,
  useUpdateSubscription,
} from "@/lib/api/hooks/billing"
import { useWorkspaces } from "@/lib/api/hooks/workspaces"
import type {
  CreateSubscriptionRequest,
  Subscription,
  SubscriptionStatus,
  SubscriptionsParams,
  SubscriptionTier,
  UpdateSubscriptionRequest,
} from "@/lib/api/types/billing"
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_VARIANTS,
  SUBSCRIPTION_TIER_LABELS,
} from "@/lib/api/types/billing"
import { formatRelativeTime } from "@/lib/date-utils"

const filterConfigs: FilterConfig[] = [
  {
    type: "checkbox",
    key: "status",
    label: "상태",
    options: [
      { value: "trialing", label: "체험 중" },
      { value: "active", label: "활성" },
      { value: "canceled", label: "취소됨" },
      { value: "past_due", label: "연체" },
      { value: "paused", label: "일시정지" },
    ],
  },
  {
    type: "checkbox",
    key: "tier",
    label: "등급",
    options: [
      { value: "trial", label: "체험" },
      { value: "basic", label: "기본" },
      { value: "pro", label: "프로" },
      { value: "enterprise", label: "엔터프라이즈" },
    ],
  },
  {
    type: "checkbox",
    key: "isPrimary",
    label: "구독 유형",
    options: [
      { value: "true", label: "메인 구독" },
      { value: "false", label: "애드온" },
    ],
  },
]

export default function SubscriptionsPage() {
  const {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
  } = useFilters()

  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)

  // Build API params
  const params: SubscriptionsParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
    statuses:
      (filterValues.status as string[])?.length > 0
        ? (filterValues.status as SubscriptionStatus[])
        : undefined,
    tier:
      (filterValues.tier as string[])?.length === 1
        ? ((filterValues.tier as string[])[0] as SubscriptionTier)
        : undefined,
    isPrimary:
      (filterValues.isPrimary as string[])?.length === 1
        ? (filterValues.isPrimary as string[])[0] === "true"
        : undefined,
  }

  const { data, isFetching } = useSubscriptions(params)
  const cancelSubscription = useCancelSubscription()
  const createSubscription = useCreateSubscription()
  const updateSubscription = useUpdateSubscription()

  // Fetch data for create dialog
  const { data: workspacesData } = useWorkspaces({ limit: 100 })
  const { data: customersData } = useBillingCustomers({ limit: 100 })
  const { data: plansData } = useBillingPlans({ limit: 100, isActive: true })

  const workspaces = workspacesData?.workspaces || []
  const customers = customersData?.data || []
  const plans = plansData?.data || []

  const subscriptions = data?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleViewDetails = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setIsDetailDialogOpen(true)
  }

  const handleEditSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setIsEditDialogOpen(true)
  }

  const handleViewHistory = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setIsHistoryDialogOpen(true)
  }

  const handleCancelSubscription = async (subscription: Subscription) => {
    const reason = prompt("취소 사유를 입력하세요 (선택사항):")
    if (reason === null) return // User clicked cancel

    await cancelSubscription.mutateAsync({
      subscriptionId: subscription.id,
      reason: reason || undefined,
    })
  }

  const handleReactivateSubscription = async (subscription: Subscription) => {
    if (!confirm("이 구독을 다시 활성화하시겠습니까?")) return
    await updateSubscription.mutateAsync({
      subscriptionId: subscription.id,
      data: { cancelAtPeriodEnd: false },
    })
  }

  const getStatusBadge = (status: SubscriptionStatus) => {
    const variant = SUBSCRIPTION_STATUS_VARIANTS[status]
    const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      warning: "secondary",
      error: "destructive",
      info: "outline",
      default: "outline",
    }
    return (
      <Badge variant={variantMap[variant] || "outline"} className="text-xs">
        {SUBSCRIPTION_STATUS_LABELS[status]}
      </Badge>
    )
  }

  const columns: Column<Subscription>[] = [
    {
      key: "workspace",
      header: "워크스페이스",
      minWidth: "140px",
      render: (item) => (
        <div className="max-w-[140px]">
          <div
            className="font-medium text-gray-900 dark:text-gray-100 truncate"
            title={item.workspace?.name}
          >
            {item.workspace?.name || "-"}
          </div>
          <div className="text-xs text-gray-400 font-mono">{item.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "요금제",
      minWidth: "120px",
      render: (item) => (
        <div className="max-w-[120px]">
          <div className="font-medium truncate" title={item.plan?.name}>
            {item.plan?.name || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "등급",
      width: "80px",
      render: (item) =>
        item.plan?.product ? (
          <span className="text-xs text-gray-600">
            {SUBSCRIPTION_TIER_LABELS[item.plan.product.tier as SubscriptionTier]}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "status",
      header: "상태",
      width: "80px",
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: "isPrimary",
      header: "유형",
      width: "70px",
      render: (item) => (
        <Badge variant={item.isPrimary ? "default" : "outline"} className="text-xs">
          {item.isPrimary ? "메인" : "애드온"}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "수량",
      width: "50px",
      render: (item) => <span className="text-gray-600">{item.quantity}</span>,
    },
    {
      key: "currentPeriodEnd",
      header: "기간 종료",
      width: "90px",
      render: (item) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {item.currentPeriodEnd ? formatRelativeTime(item.currentPeriodEnd) : "-"}
        </span>
      ),
    },
    {
      key: "cancelAtPeriodEnd",
      header: "취소예정",
      width: "70px",
      render: (item) =>
        item.cancelAtPeriodEnd ? (
          <Badge variant="destructive" className="text-xs">
            예정
          </Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "actions",
      header: "액션",
      width: "140px",
      sticky: "right",
      render: (item) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewDetails(item)}
            className="text-xs h-7 w-7 p-0"
            title="상세 보기"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewHistory(item)}
            className="text-xs h-7 w-7 p-0"
            title="변경 이력"
          >
            <History className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditSubscription(item)}
            className="text-xs h-7 w-7 p-0"
            title="수정"
          >
            <Edit className="h-3 w-3" />
          </Button>
          {item.status === "active" && !item.cancelAtPeriodEnd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelSubscription(item)}
              className="text-xs h-7 w-7 p-0 text-red-600 hover:text-red-700"
              title="구독 취소"
            >
              <Ban className="h-3 w-3" />
            </Button>
          )}
          {item.cancelAtPeriodEnd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReactivateSubscription(item)}
              className="text-xs h-7 w-7 p-0 text-green-600 hover:text-green-700"
              title="재활성화"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <DataFilters
        filters={filterConfigs}
        values={filterValues}
        onChange={updateFilter}
        onClear={clearFilters}
      />

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">구독</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />새 구독
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="워크스페이스명으로 검색..."
            />
          </div>

          {/* Table */}
          <DataTable
            data={subscriptions}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            getItemId={(item) => item.id}
            onPageChange={handlePageChange}
            emptyMessage="아직 구독이 없어요"
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">구독 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {selectedSubscription && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">워크스페이스</span>
                    <p className="mt-1">{selectedSubscription.workspace?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">상태</span>
                    <p className="mt-1">{getStatusBadge(selectedSubscription.status)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">요금제</span>
                    <p className="mt-1">{selectedSubscription.plan?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">수량</span>
                    <p className="mt-1">{selectedSubscription.quantity}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">현재 기간 시작</span>
                    <p className="mt-1">
                      {selectedSubscription.currentPeriodStart
                        ? new Date(selectedSubscription.currentPeriodStart).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">현재 기간 종료</span>
                    <p className="mt-1">
                      {selectedSubscription.currentPeriodEnd
                        ? new Date(selectedSubscription.currentPeriodEnd).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  {selectedSubscription.trialStart && (
                    <>
                      <div>
                        <span className="text-sm font-medium text-gray-500">체험 시작</span>
                        <p className="mt-1">
                          {new Date(selectedSubscription.trialStart).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">체험 종료</span>
                        <p className="mt-1">
                          {selectedSubscription.trialEnd
                            ? new Date(selectedSubscription.trialEnd).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                    </>
                  )}
                  {selectedSubscription.canceledAt && (
                    <>
                      <div>
                        <span className="text-sm font-medium text-gray-500">취소 일시</span>
                        <p className="mt-1">
                          {new Date(selectedSubscription.canceledAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">취소 사유</span>
                        <p className="mt-1">{selectedSubscription.cancelReason || "-"}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Customer Info */}
                {selectedSubscription.customer && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">고객 정보</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">이메일</span>
                        <p className="mt-1">{selectedSubscription.customer.email || "-"}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">이름</span>
                        <p className="mt-1">{selectedSubscription.customer.name || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">새 구독</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <SubscriptionForm
              workspaces={workspaces}
              customers={customers}
              plans={plans}
              onSave={async (data) => {
                await createSubscription.mutateAsync(data)
                setIsCreateDialogOpen(false)
              }}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createSubscription.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">구독 편집</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {selectedSubscription && (
              <SubscriptionEditForm
                subscription={selectedSubscription}
                plans={plans}
                onSave={async (data) => {
                  await updateSubscription.mutateAsync({
                    subscriptionId: selectedSubscription.id,
                    data,
                  })
                  setIsEditDialogOpen(false)
                  setSelectedSubscription(null)
                }}
                onCancel={() => {
                  setIsEditDialogOpen(false)
                  setSelectedSubscription(null)
                }}
                isLoading={updateSubscription.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              구독 변경 이력 - {selectedSubscription?.workspace?.name || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {selectedSubscription && (
              <SubscriptionHistoryView subscriptionId={selectedSubscription.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Subscription Create Form Component
// ============================================================================

interface SubscriptionFormProps {
  workspaces: Array<{ id: string; name: string }>
  customers: Array<{ id: string; email: string | null; name: string | null }>
  plans: Array<{ id: string; name: string; product?: { name: string; tier?: string } | null }>
  onSave: (data: CreateSubscriptionRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

function SubscriptionForm({
  workspaces,
  customers,
  plans,
  onSave,
  onCancel,
  isLoading,
}: SubscriptionFormProps) {
  const formId = useId()
  const [workspaceId, setWorkspaceId] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [planId, setPlanId] = useState("")
  const [isPrimary, setIsPrimary] = useState(true)
  const [quantity, setQuantity] = useState(1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !customerId || !planId) {
      alert("필수 항목을 모두 선택해주세요.")
      return
    }
    await onSave({
      workspaceId,
      customerId,
      planId,
      isPrimary,
      quantity,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${formId}-workspace`}>워크스페이스 *</Label>
        <Select value={workspaceId} onValueChange={setWorkspaceId}>
          <SelectTrigger>
            <SelectValue placeholder="워크스페이스 선택" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-customer`}>결제 고객 *</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger>
            <SelectValue placeholder="결제 고객 선택" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name || c.email || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-plan`}>요금제 *</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue placeholder="요금제 선택" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.product && ` (${p.product.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-quantity`}>수량</Label>
        <Input
          id={`${formId}-quantity`}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
          min={1}
          className="w-32"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${formId}-isPrimary`}
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
        />
        <Label htmlFor={`${formId}-isPrimary`} className="cursor-pointer">
          메인 구독 (워크스페이스당 하나의 메인 구독만 가능)
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading || !workspaceId || !customerId || !planId}>
          {isLoading ? "생성 중..." : "확인"}
        </Button>
      </div>
    </form>
  )
}

// ============================================================================
// Subscription Edit Form Component
// ============================================================================

interface SubscriptionEditFormProps {
  subscription: Subscription
  plans: Array<{ id: string; name: string; product?: { name: string; tier?: string } | null }>
  onSave: (data: UpdateSubscriptionRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

function SubscriptionEditForm({
  subscription,
  plans,
  onSave,
  onCancel,
  isLoading,
}: SubscriptionEditFormProps) {
  const formId = useId()
  const [planId, setPlanId] = useState(subscription.planId)
  const [quantity, setQuantity] = useState(subscription.quantity)
  const [status, setStatus] = useState<SubscriptionStatus>(subscription.status)

  // Auto-update status to 'active' when any field changes
  useEffect(() => {
    if (planId !== subscription.planId || quantity !== subscription.quantity) {
      setStatus("active")
    }
  }, [planId, quantity, subscription.planId, subscription.quantity])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      planId: planId !== subscription.planId ? planId : undefined,
      quantity: quantity !== subscription.quantity ? quantity : undefined,
      status: status !== subscription.status ? status : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-500">워크스페이스</div>
        <div className="font-medium">{subscription.workspace?.name || "-"}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-plan`}>요금제</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue placeholder="요금제 선택" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.product && ` (${p.product.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-status`}>상태</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-quantity`}>수량</Label>
        <Input
          id={`${formId}-quantity`}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
          min={1}
          className="w-32"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  )
}

// ============================================================================
// Subscription History View Component
// ============================================================================

const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: "구독 생성",
  plan_changed: "요금제 변경",
  status_changed: "상태 변경",
  renewed: "갱신",
  canceled: "취소",
  quantity_changed: "수량 변경",
}

function SubscriptionHistoryView({ subscriptionId }: { subscriptionId: string }) {
  const { data: history, isLoading } = useSubscriptionHistory(subscriptionId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">변경 이력이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div
          key={item.id}
          className="relative pl-6 pb-4 border-l-2 border-gray-200 dark:border-gray-700 last:border-l-0"
        >
          {/* Timeline dot */}
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900" />

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-xs">
                {CHANGE_TYPE_LABELS[item.changeType] || item.changeType}
              </Badge>
              <span className="text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {item.previousStatus && item.newStatus && (
                <>
                  <div>
                    <span className="text-gray-500">이전 상태:</span>{" "}
                    <Badge variant="secondary" className="text-xs ml-1">
                      {SUBSCRIPTION_STATUS_LABELS[item.previousStatus] || item.previousStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">변경 상태:</span>{" "}
                    <Badge variant="default" className="text-xs ml-1">
                      {SUBSCRIPTION_STATUS_LABELS[item.newStatus] || item.newStatus}
                    </Badge>
                  </div>
                </>
              )}
              {item.previousPlanId && (
                <div className="col-span-2">
                  <span className="text-gray-500">이전 요금제 ID:</span>{" "}
                  <span className="font-mono text-xs">{item.previousPlanId.slice(0, 8)}...</span>
                </div>
              )}
              {item.newPlanId && (
                <div className="col-span-2">
                  <span className="text-gray-500">변경 요금제 ID:</span>{" "}
                  <span className="font-mono text-xs">{item.newPlanId.slice(0, 8)}...</span>
                </div>
              )}
            </div>

            {item.changeReason && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">변경 사유: </span>
                <span className="text-sm">{item.changeReason}</span>
              </div>
            )}

            {item.changedByUser && (
              <div className="mt-2 text-xs text-gray-400">
                변경자: {item.changedByUser.username}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
