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
    if (reason === null) {
      return // User clicked cancel
    }

    await cancelSubscription.mutateAsync({
      subscriptionId: subscription.id,
      reason: reason || undefined,
    })
  }

  const handleReactivateSubscription = async (subscription: Subscription) => {
    if (!confirm("이 구독을 다시 활성화하시겠습니까?")) {
      return
    }
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
      <Badge className="text-xs" variant={variantMap[variant] || "outline"}>
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
            className="truncate font-medium text-gray-900 dark:text-gray-100"
            title={item.workspace?.name}
          >
            {item.workspace?.name || "-"}
          </div>
          <div className="font-mono text-gray-400 text-xs">{item.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "요금제",
      minWidth: "120px",
      render: (item) => (
        <div className="max-w-[120px]">
          <div className="truncate font-medium" title={item.plan?.name}>
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
          <span className="text-gray-600 text-xs">
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
        <Badge className="text-xs" variant={item.isPrimary ? "default" : "outline"}>
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
        <span className="whitespace-nowrap text-gray-500 text-xs">
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
          <Badge className="text-xs" variant="destructive">
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
            className="h-7 w-7 p-0 text-xs"
            onClick={() => handleViewDetails(item)}
            size="sm"
            title="상세 보기"
            variant="outline"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            className="h-7 w-7 p-0 text-xs"
            onClick={() => handleViewHistory(item)}
            size="sm"
            title="변경 이력"
            variant="outline"
          >
            <History className="h-3 w-3" />
          </Button>
          <Button
            className="h-7 w-7 p-0 text-xs"
            onClick={() => handleEditSubscription(item)}
            size="sm"
            title="수정"
            variant="outline"
          >
            <Edit className="h-3 w-3" />
          </Button>
          {item.status === "active" && !item.cancelAtPeriodEnd && (
            <Button
              className="h-7 w-7 p-0 text-red-600 text-xs hover:text-red-700"
              onClick={() => handleCancelSubscription(item)}
              size="sm"
              title="구독 취소"
              variant="outline"
            >
              <Ban className="h-3 w-3" />
            </Button>
          )}
          {item.cancelAtPeriodEnd && (
            <Button
              className="h-7 w-7 p-0 text-green-600 text-xs hover:text-green-700"
              onClick={() => handleReactivateSubscription(item)}
              size="sm"
              title="재활성화"
              variant="outline"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Filters */}
      <DataFilters
        filters={filterConfigs}
        onChange={updateFilter}
        onClear={clearFilters}
        values={filterValues}
      />

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">구독</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />새 구독
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              onChange={handleSearch}
              placeholder="워크스페이스명으로 검색..."
              value={searchQuery}
            />
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={subscriptions}
            emptyMessage="아직 구독이 없어요"
            getItemId={(item) => item.id}
            isLoading={isFetching}
            onPageChange={handlePageChange}
            pagination={pagination}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog onOpenChange={setIsDetailDialogOpen} open={isDetailDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">구독 상세</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
            {selectedSubscription && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-500 text-sm">워크스페이스</span>
                    <p className="mt-1">{selectedSubscription.workspace?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">상태</span>
                    <p className="mt-1">{getStatusBadge(selectedSubscription.status)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">요금제</span>
                    <p className="mt-1">{selectedSubscription.plan?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">수량</span>
                    <p className="mt-1">{selectedSubscription.quantity}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">현재 기간 시작</span>
                    <p className="mt-1">
                      {selectedSubscription.currentPeriodStart
                        ? new Date(selectedSubscription.currentPeriodStart).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">현재 기간 종료</span>
                    <p className="mt-1">
                      {selectedSubscription.currentPeriodEnd
                        ? new Date(selectedSubscription.currentPeriodEnd).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  {selectedSubscription.trialStart && (
                    <>
                      <div>
                        <span className="font-medium text-gray-500 text-sm">체험 시작</span>
                        <p className="mt-1">
                          {new Date(selectedSubscription.trialStart).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 text-sm">체험 종료</span>
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
                        <span className="font-medium text-gray-500 text-sm">취소 일시</span>
                        <p className="mt-1">
                          {new Date(selectedSubscription.canceledAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 text-sm">취소 사유</span>
                        <p className="mt-1">{selectedSubscription.cancelReason || "-"}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Customer Info */}
                {selectedSubscription.customer && (
                  <div className="border-t pt-4">
                    <h4 className="mb-3 font-medium text-gray-700 text-sm">고객 정보</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium text-gray-500 text-sm">이메일</span>
                        <p className="mt-1">{selectedSubscription.customer.email || "-"}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 text-sm">이름</span>
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
      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">새 구독</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <SubscriptionForm
              customers={customers}
              isLoading={createSubscription.isPending}
              onCancel={() => setIsCreateDialogOpen(false)}
              onSave={async (data) => {
                await createSubscription.mutateAsync(data)
                setIsCreateDialogOpen(false)
              }}
              plans={plans}
              workspaces={workspaces}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog onOpenChange={setIsEditDialogOpen} open={isEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">구독 편집</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {selectedSubscription && (
              <SubscriptionEditForm
                isLoading={updateSubscription.isPending}
                onCancel={() => {
                  setIsEditDialogOpen(false)
                  setSelectedSubscription(null)
                }}
                onSave={async (data) => {
                  await updateSubscription.mutateAsync({
                    subscriptionId: selectedSubscription.id,
                    data,
                  })
                  setIsEditDialogOpen(false)
                  setSelectedSubscription(null)
                }}
                plans={plans}
                subscription={selectedSubscription}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog onOpenChange={setIsHistoryDialogOpen} open={isHistoryDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              구독 변경 이력 - {selectedSubscription?.workspace?.name || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
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

type SubscriptionFormProps = {
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
    if (!(workspaceId && customerId && planId)) {
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
    <form className="space-y-6 py-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={`${formId}-workspace`}>워크스페이스 *</Label>
        <Select onValueChange={setWorkspaceId} value={workspaceId}>
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
        <Select onValueChange={setCustomerId} value={customerId}>
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
        <Select onValueChange={setPlanId} value={planId}>
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
          className="w-32"
          id={`${formId}-quantity`}
          min={1}
          onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
          type="number"
          value={quantity}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          checked={isPrimary}
          id={`${formId}-isPrimary`}
          onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
        />
        <Label className="cursor-pointer" htmlFor={`${formId}-isPrimary`}>
          메인 구독 (워크스페이스당 하나의 메인 구독만 가능)
        </Label>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button disabled={isLoading || !workspaceId || !customerId || !planId} type="submit">
          {isLoading ? "생성 중..." : "확인"}
        </Button>
      </div>
    </form>
  )
}

// ============================================================================
// Subscription Edit Form Component
// ============================================================================

type SubscriptionEditFormProps = {
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
    <form className="space-y-6 py-4" onSubmit={handleSubmit}>
      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <div className="text-gray-500 text-sm">워크스페이스</div>
        <div className="font-medium">{subscription.workspace?.name || "-"}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-plan`}>요금제</Label>
        <Select onValueChange={setPlanId} value={planId}>
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
        <Select onValueChange={(v) => setStatus(v as SubscriptionStatus)} value={status}>
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
          className="w-32"
          id={`${formId}-quantity`}
          min={1}
          onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
          type="number"
          value={quantity}
        />
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button disabled={isLoading} type="submit">
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
      <div className="flex h-32 items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-gray-500">변경 이력이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div
          className="relative border-gray-200 border-l-2 pb-4 pl-6 last:border-l-0 dark:border-gray-700"
          key={item.id}
        >
          {/* Timeline dot */}
          <div className="-left-[9px] absolute top-0 h-4 w-4 rounded-full border-2 border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700" />

          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <Badge className="text-xs" variant="outline">
                {CHANGE_TYPE_LABELS[item.changeType] || item.changeType}
              </Badge>
              <span className="text-gray-500 text-xs">
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {item.previousStatus && item.newStatus && (
                <>
                  <div>
                    <span className="text-gray-500">이전 상태:</span>{" "}
                    <Badge className="ml-1 text-xs" variant="secondary">
                      {SUBSCRIPTION_STATUS_LABELS[item.previousStatus] || item.previousStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">변경 상태:</span>{" "}
                    <Badge className="ml-1 text-xs" variant="default">
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
              <div className="mt-2 border-gray-200 border-t pt-2 dark:border-gray-700">
                <span className="text-gray-500 text-xs">변경 사유: </span>
                <span className="text-sm">{item.changeReason}</span>
              </div>
            )}

            {item.changedByUser && (
              <div className="mt-2 text-gray-400 text-xs">
                변경자: {item.changedByUser.username}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
