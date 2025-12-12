import { Edit, Eye, Plus, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DataFilters,
  type FilterConfig,
  SearchInput,
  useFilters,
} from "@/components/ui/data-filters"
import { BulkActionsBar, type Column, DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  useBillingPlans,
  useBillingProducts,
  useCreateBillingPlan,
  useDeleteBillingPlan,
  useUpdateBillingPlan,
} from "@/lib/api/hooks/billing"
import type {
  BillingPlan,
  BillingPlansParams,
  CreateBillingPlanRequest,
  PlanType,
} from "@/lib/api/types/billing"
import {
  PLAN_INTERVAL_LABELS,
  PLAN_TYPE_LABELS,
  SUBSCRIPTION_TIER_LABELS,
} from "@/lib/api/types/billing"
import { PlanForm } from "./PlanForm"

const filterConfigs: FilterConfig[] = [
  {
    type: "checkbox",
    key: "planType",
    label: "결제 유형",
    options: [
      { value: "recurring", label: "정기" },
      { value: "one_time", label: "일회성" },
    ],
  },
  {
    type: "checkbox",
    key: "isActive",
    label: "상태",
    options: [
      { value: "true", label: "활성" },
      { value: "false", label: "비활성" },
    ],
  },
]

export default function PlansPage() {
  const {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
  } = useFilters()

  const [selectedPlans, setSelectedPlans] = useState<string[]>([])
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null)
  const [viewingPlan, setViewingPlan] = useState<BillingPlan | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Build API params
  const params: BillingPlansParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
    planType:
      (filterValues.planType as string[])?.length === 1
        ? ((filterValues.planType as string[])[0] as PlanType)
        : undefined,
    isActive:
      (filterValues.isActive as string[])?.length === 1
        ? (filterValues.isActive as string[])[0] === "true"
        : undefined,
  }

  const { data, isFetching } = useBillingPlans(params)
  const { data: productsData } = useBillingProducts({ limit: 100 })
  const createPlan = useCreateBillingPlan()
  const updatePlan = useUpdateBillingPlan()
  const deletePlan = useDeleteBillingPlan()

  const plans = data?.data || []
  const products = productsData?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedPlans((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }, [])

  const handleToggleSelectAll = useCallback((ids: string[]) => {
    setSelectedPlans((prev) => (prev.length === ids.length ? [] : ids))
  }, [])

  const handleCreatePlan = async (data: CreateBillingPlanRequest) => {
    await createPlan.mutateAsync(data)
    setIsCreateDialogOpen(false)
  }

  const handleUpdatePlan = async (data: CreateBillingPlanRequest) => {
    if (!editingPlan) return
    await updatePlan.mutateAsync({
      planId: editingPlan.id,
      data: {
        name: data.name,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        planType: data.planType,
        billingInterval: data.billingInterval,
        intervalCount: data.intervalCount,
        trialDays: data.trialDays,
        isActive: data.isActive,
        isDefault: data.isDefault,
      },
    })
    setEditingPlan(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedPlans.length === 0) return
    if (!confirm(`선택한 ${selectedPlans.length}개의 요금제를 삭제하시겠습니까?`)) return

    for (const id of selectedPlans) {
      await deletePlan.mutateAsync(id)
    }
    setSelectedPlans([])
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const columns: Column<BillingPlan>[] = [
    {
      key: "name",
      header: "요금제명",
      minWidth: "160px",
      render: (item) => (
        <div className="max-w-[160px]">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={item.name}>
            {item.name}
          </div>
          {item.description && (
            <div className="text-xs text-gray-500 line-clamp-2" title={item.description}>
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "product",
      header: "상품",
      minWidth: "120px",
      render: (item) => (
        <div className="max-w-[120px]">
          <div className="font-medium truncate" title={item.product?.name}>
            {item.product?.name || "-"}
          </div>
          {item.product?.tier && (
            <Badge variant="outline" className="text-xs mt-1">
              {SUBSCRIPTION_TIER_LABELS[item.product.tier]}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "price",
      header: "가격",
      width: "100px",
      render: (item) => (
        <div className="text-right whitespace-nowrap">
          <div className="font-medium">{formatPrice(item.amount, item.currency)}</div>
          {item.planType === "recurring" && item.billingInterval && (
            <div className="text-xs text-gray-500">
              / {item.intervalCount > 1 ? `${item.intervalCount}` : ""}
              {PLAN_INTERVAL_LABELS[item.billingInterval]}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "planType",
      header: "유형",
      width: "70px",
      render: (item) => (
        <Badge
          variant={item.planType === "recurring" ? "default" : "secondary"}
          className="text-xs"
        >
          {PLAN_TYPE_LABELS[item.planType]}
        </Badge>
      ),
    },
    {
      key: "trialDays",
      header: "체험",
      width: "50px",
      render: (item) =>
        item.trialDays > 0 ? (
          <span className="text-sm whitespace-nowrap">{item.trialDays}일</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "status",
      header: "상태",
      width: "100px",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
            {item.isActive ? "활성" : "비활성"}
          </Badge>
          {item.isDefault && (
            <Badge variant="outline" className="text-xs">
              기본
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "subscriptionsCount",
      header: "구독",
      width: "60px",
      render: (item) => (
        <span className="text-gray-600 whitespace-nowrap">{item.subscriptionsCount || 0}건</span>
      ),
    },
    {
      key: "actions",
      header: "액션",
      width: "110px",
      sticky: "right",
      render: (item) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewingPlan(item)}
            className="text-xs h-7 w-7 p-0"
            title="상세 보기"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingPlan(item)}
            className="text-xs h-7 w-7 p-0"
            title="수정"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("이 요금제을 삭제하시겠습니까?")) {
                deletePlan.mutate(item.id)
              }
            }}
            className="text-xs h-7 w-7 p-0 text-red-600 hover:text-red-700"
            title="삭제"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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

      {/* Plans Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">요금제</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />새 요금제
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="요금제명, 설명으로 검색..."
            />
          </div>

          {/* Bulk Actions */}
          <BulkActionsBar
            selectedCount={selectedPlans.length}
            actions={[
              {
                id: "delete",
                label: "삭제",
                icon: <Trash2 className="h-4 w-4 mr-1" />,
                variant: "destructive",
                onClick: handleDeleteSelected,
              },
            ]}
          />

          {/* Table */}
          <DataTable
            data={plans}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            selectable
            selectedIds={selectedPlans}
            getItemId={(item) => item.id}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onPageChange={handlePageChange}
            emptyMessage="아직 요금제가 없어요"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">새 요금제</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <PlanForm
              products={products}
              onSave={handleCreatePlan}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createPlan.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">요금제 편집</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingPlan && (
              <PlanForm
                plan={editingPlan}
                products={products}
                onSave={handleUpdatePlan}
                onCancel={() => setEditingPlan(null)}
                isLoading={updatePlan.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingPlan} onOpenChange={() => setViewingPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">요금제 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {viewingPlan && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">요금제명</span>
                    <p className="mt-1 font-medium">{viewingPlan.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">상품</span>
                    <p className="mt-1">{viewingPlan.product?.name || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-500">설명</span>
                    <p className="mt-1 text-gray-600">{viewingPlan.description || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">가격</span>
                    <p className="mt-1 font-medium">
                      {formatPrice(viewingPlan.amount, viewingPlan.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">결제 유형</span>
                    <p className="mt-1">
                      <Badge
                        variant={viewingPlan.planType === "recurring" ? "default" : "secondary"}
                      >
                        {PLAN_TYPE_LABELS[viewingPlan.planType]}
                      </Badge>
                    </p>
                  </div>
                  {viewingPlan.planType === "recurring" && viewingPlan.billingInterval && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">결제 주기</span>
                      <p className="mt-1">
                        {viewingPlan.intervalCount > 1 ? `${viewingPlan.intervalCount}` : ""}
                        {PLAN_INTERVAL_LABELS[viewingPlan.billingInterval]}마다
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-500">체험 기간</span>
                    <p className="mt-1">
                      {viewingPlan.trialDays > 0 ? `${viewingPlan.trialDays}일` : "없음"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">상태</span>
                    <p className="mt-1 flex gap-1">
                      <Badge variant={viewingPlan.isActive ? "default" : "secondary"}>
                        {viewingPlan.isActive ? "활성" : "비활성"}
                      </Badge>
                      {viewingPlan.isDefault && <Badge variant="outline">기본</Badge>}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
