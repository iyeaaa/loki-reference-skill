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
  useCreateBillingProduct,
  useDeleteBillingPlan,
  useDeleteBillingProduct,
  useUpdateBillingProduct,
} from "@/lib/api/hooks/billing"
import type {
  BillingProduct,
  BillingProductsParams,
  CreateBillingProductRequest,
  SubscriptionTier,
} from "@/lib/api/types/billing"
import {
  PLAN_INTERVAL_LABELS,
  PLAN_TYPE_LABELS,
  SUBSCRIPTION_TIER_LABELS,
  SUBSCRIPTION_TIER_VARIANTS,
} from "@/lib/api/types/billing"
import { formatRelativeTime } from "@/lib/date-utils"
import { PlanForm } from "./PlanForm"
import { ProductForm } from "./ProductForm"

const filterConfigs: FilterConfig[] = [
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
    key: "isActive",
    label: "상태",
    options: [
      { value: "true", label: "활성" },
      { value: "false", label: "비활성" },
    ],
  },
]

export default function ProductsPage() {
  const {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
  } = useFilters()

  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<BillingProduct | null>(null)
  const [viewingProduct, setViewingProduct] = useState<BillingProduct | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false)

  // Build API params
  const params: BillingProductsParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
    tier:
      (filterValues.tier as string[])?.length === 1
        ? ((filterValues.tier as string[])[0] as SubscriptionTier)
        : undefined,
    isActive:
      (filterValues.isActive as string[])?.length === 1
        ? (filterValues.isActive as string[])[0] === "true"
        : undefined,
  }

  const { data, isFetching } = useBillingProducts(params)
  const createProduct = useCreateBillingProduct()
  const updateProduct = useUpdateBillingProduct()
  const deleteProduct = useDeleteBillingProduct()
  const createPlan = useCreateBillingPlan()
  const deletePlan = useDeleteBillingPlan()

  // Fetch plans for viewing product
  const { data: productPlans } = useBillingPlans(
    { productId: viewingProduct?.id, limit: 100 },
    !!viewingProduct,
  )

  const products = data?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }, [])

  const handleToggleSelectAll = useCallback((ids: string[]) => {
    setSelectedProducts((prev) => (prev.length === ids.length ? [] : ids))
  }, [])

  const handleCreateProduct = async (data: CreateBillingProductRequest) => {
    await createProduct.mutateAsync(data)
    setIsCreateDialogOpen(false)
  }

  const handleUpdateProduct = async (data: CreateBillingProductRequest) => {
    if (!editingProduct) {
      return
    }
    await updateProduct.mutateAsync({ productId: editingProduct.id, data })
    setEditingProduct(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedProducts.length === 0) {
      return
    }
    if (!confirm(`선택한 ${selectedProducts.length}개의 상품을 삭제하시겠습니까?`)) {
      return
    }

    for (const id of selectedProducts) {
      await deleteProduct.mutateAsync(id)
    }
    setSelectedProducts([])
  }

  const columns: Column<BillingProduct>[] = [
    {
      key: "name",
      header: "상품명",
      minWidth: "180px",
      render: (item) => (
        <div className="max-w-[180px]">
          <div className="truncate font-medium text-gray-900 dark:text-gray-100" title={item.name}>
            {item.name}
          </div>
          {item.description && (
            <div className="line-clamp-2 text-gray-500 text-xs" title={item.description}>
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tier",
      header: "등급",
      width: "80px",
      render: (item) => {
        const variant = SUBSCRIPTION_TIER_VARIANTS[item.tier]
        return (
          <Badge
            className={`text-xs ${variant === "warning" ? "bg-yellow-100 text-yellow-800" : ""}`}
            variant={variant === "success" ? "default" : "outline"}
          >
            {SUBSCRIPTION_TIER_LABELS[item.tier]}
          </Badge>
        )
      },
    },
    {
      key: "isActive",
      header: "상태",
      width: "70px",
      render: (item) => (
        <Badge className="text-xs" variant={item.isActive ? "default" : "secondary"}>
          {item.isActive ? "활성" : "비활성"}
        </Badge>
      ),
    },
    {
      key: "plansCount",
      header: "요금제",
      width: "70px",
      render: (item) => <span className="text-gray-600">{item.plansCount || 0}개</span>,
    },
    {
      key: "subscriptionsCount",
      header: "구독",
      width: "60px",
      render: (item) => <span className="text-gray-600">{item.subscriptionsCount || 0}건</span>,
    },
    {
      key: "displayOrder",
      header: "순서",
      width: "50px",
      render: (item) => <span className="text-gray-500">{item.displayOrder}</span>,
    },
    {
      key: "features",
      header: "기능",
      minWidth: "180px",
      render: (item) => (
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {(item.features || []).slice(0, 3).map((feature, idx) => (
            <span
              className="inline-block max-w-[55px] truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700"
              key={idx}
              title={feature}
            >
              {feature}
            </span>
          ))}
          {(item.features || []).length > 3 && (
            <span className="text-gray-500 text-xs">+{item.features.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "수정일",
      width: "80px",
      render: (item) => (
        <span className="whitespace-nowrap text-gray-500 text-xs">
          {formatRelativeTime(item.updatedAt)}
        </span>
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
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setViewingProduct(item)}
            size="sm"
            title="상세 보기"
            variant="outline"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setEditingProduct(item)}
            size="sm"
            title="수정"
            variant="outline"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            className="h-7 w-7 p-0 text-red-600 text-xs hover:text-red-700"
            onClick={() => {
              if (confirm("이 상품을 삭제하시겠습니까?")) {
                deleteProduct.mutate(item.id)
              }
            }}
            size="sm"
            title="삭제"
            variant="outline"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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

      {/* Products Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">상품</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />새 상품
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              onChange={handleSearch}
              placeholder="상품명, 설명으로 검색..."
              value={searchQuery}
            />
          </div>

          {/* Bulk Actions */}
          <BulkActionsBar
            actions={[
              {
                id: "delete",
                label: "삭제",
                icon: <Trash2 className="mr-1 h-4 w-4" />,
                variant: "destructive",
                onClick: handleDeleteSelected,
              },
            ]}
            selectedCount={selectedProducts.length}
          />

          {/* Table */}
          <DataTable
            columns={columns}
            data={products}
            emptyMessage="아직 상품이 없어요"
            getItemId={(item) => item.id}
            isLoading={isFetching}
            onPageChange={handlePageChange}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            pagination={pagination}
            selectable
            selectedIds={selectedProducts}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">새 상품</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <ProductForm
              isLoading={createProduct.isPending}
              onCancel={() => setIsCreateDialogOpen(false)}
              onSave={handleCreateProduct}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog onOpenChange={() => setEditingProduct(null)} open={!!editingProduct}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">상품 편집</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingProduct && (
              <ProductForm
                isLoading={updateProduct.isPending}
                onCancel={() => setEditingProduct(null)}
                onSave={handleUpdateProduct}
                product={editingProduct}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog - Product Detail with Plans */}
      <Dialog onOpenChange={() => setViewingProduct(null)} open={!!viewingProduct}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">상품 상세</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
            {viewingProduct && (
              <div className="space-y-6">
                {/* Product Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-500 text-sm">상품명</span>
                    <p className="mt-1 font-medium">{viewingProduct.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">등급</span>
                    <p className="mt-1">
                      <Badge variant="outline">
                        {SUBSCRIPTION_TIER_LABELS[viewingProduct.tier]}
                      </Badge>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-500 text-sm">설명</span>
                    <p className="mt-1 text-gray-600">{viewingProduct.description || "-"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">상태</span>
                    <p className="mt-1">
                      <Badge variant={viewingProduct.isActive ? "default" : "secondary"}>
                        {viewingProduct.isActive ? "활성" : "비활성"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">표시 순서</span>
                    <p className="mt-1">{viewingProduct.displayOrder}</p>
                  </div>
                </div>

                {/* Features */}
                {viewingProduct.features && viewingProduct.features.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="mb-3 font-medium text-gray-700 text-sm">기능</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingProduct.features.map((feature, idx) => (
                        <span
                          className="inline-block rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-700"
                          key={idx}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plans */}
                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium text-gray-700 text-sm">
                      요금제 ({productPlans?.data?.length || 0}개)
                    </h4>
                    <Button
                      onClick={() => setIsCreatePlanDialogOpen(true)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="mr-1 h-3 w-3" />새 요금제
                    </Button>
                  </div>
                  {productPlans?.data && productPlans.data.length > 0 ? (
                    <div className="space-y-2">
                      {productPlans.data.map((plan) => (
                        <div
                          className="flex items-center justify-between rounded-lg border bg-gray-50 p-3 dark:bg-gray-800"
                          key={plan.id}
                        >
                          <div>
                            <div className="flex items-center gap-2 font-medium text-sm">
                              {plan.name}
                              <Badge
                                className="text-xs"
                                variant={plan.planType === "recurring" ? "default" : "secondary"}
                              >
                                {PLAN_TYPE_LABELS[plan.planType]}
                              </Badge>
                              {!plan.isActive && (
                                <Badge className="text-xs" variant="outline">
                                  비활성
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 text-gray-500 text-xs">
                              {new Intl.NumberFormat("ko-KR", {
                                style: "currency",
                                currency: plan.currency,
                                minimumFractionDigits: 0,
                              }).format(plan.amount)}
                              {plan.planType === "recurring" &&
                                plan.billingInterval &&
                                ` / ${plan.intervalCount > 1 ? plan.intervalCount : ""}${PLAN_INTERVAL_LABELS[plan.billingInterval]}`}
                              {plan.trialDays > 0 && ` (${plan.trialDays}일 체험)`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">
                              {formatRelativeTime(plan.updatedAt)}
                            </span>
                            <Button
                              className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                if (confirm("이 요금제를 삭제하시겠습니까?")) {
                                  deletePlan.mutate(plan.id)
                                }
                              }}
                              size="sm"
                              title="요금제 삭제"
                              variant="ghost"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">아직 요금제가 없어요</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog onOpenChange={setIsCreatePlanDialogOpen} open={isCreatePlanDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              새 요금제 - {viewingProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {viewingProduct && (
              <PlanForm
                defaultProductId={viewingProduct.id}
                isLoading={createPlan.isPending}
                onCancel={() => setIsCreatePlanDialogOpen(false)}
                onSave={async (data) => {
                  await createPlan.mutateAsync(data)
                  setIsCreatePlanDialogOpen(false)
                }}
                products={[viewingProduct]}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
