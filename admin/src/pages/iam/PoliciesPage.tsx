import { Edit, Eye, Plus, Trash2 } from "lucide-react"
import { useCallback, useId, useState } from "react"
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
  useAddPolicyStatement,
  useCreateIamPolicy,
  useDeleteIamPolicy,
  useDeletePolicyStatement,
  useIamPolicies,
  useIamPolicyStatements,
  useUpdateIamPolicy,
  useUpdatePolicyStatement,
} from "@/lib/api/hooks/iam"
import type {
  CreateIamPolicyRequest,
  CreatePolicyStatementRequest,
  IamPoliciesParams,
  IamPolicy,
  IamPolicyStatement,
  PolicyEffect,
} from "@/lib/api/types/iam"
import { COMMON_ACTIONS, COMMON_RESOURCES, POLICY_EFFECT_LABELS } from "@/lib/api/types/iam"
import { formatRelativeTime } from "@/lib/date-utils"
import { PolicyForm } from "./PolicyForm"

const filterConfigs: FilterConfig[] = [
  {
    type: "checkbox",
    key: "isManaged",
    label: "타입",
    options: [
      { value: "true", label: "시스템 관리" },
      { value: "false", label: "사용자 정의" },
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

export default function PoliciesPage() {
  const {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
  } = useFilters()

  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([])
  const [editingPolicy, setEditingPolicy] = useState<IamPolicy | null>(null)
  const [viewingPolicy, setViewingPolicy] = useState<IamPolicy | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Statement management state
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false)
  const [editingStatement, setEditingStatement] = useState<IamPolicyStatement | null>(null)
  const statementFormId = useId()

  // Build API params
  const params: IamPoliciesParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
    isManaged:
      (filterValues.isManaged as string[])?.length === 1
        ? (filterValues.isManaged as string[])[0] === "true"
        : undefined,
    isActive:
      (filterValues.isActive as string[])?.length === 1
        ? (filterValues.isActive as string[])[0] === "true"
        : undefined,
  }

  const { data, isFetching } = useIamPolicies(params)
  const createPolicy = useCreateIamPolicy()
  const updatePolicy = useUpdateIamPolicy()
  const deletePolicy = useDeleteIamPolicy()

  // Fetch statements for viewing policy
  const { data: statements, refetch: refetchStatements } = useIamPolicyStatements(
    viewingPolicy?.id || "",
    !!viewingPolicy,
  )

  // Statement mutations
  const addStatement = useAddPolicyStatement()
  const updateStatement = useUpdatePolicyStatement()
  const deleteStatement = useDeletePolicyStatement()

  const policies = data?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedPolicies((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }, [])

  const handleToggleSelectAll = useCallback((ids: string[]) => {
    setSelectedPolicies((prev) => (prev.length === ids.length ? [] : ids))
  }, [])

  const handleCreatePolicy = async (data: CreateIamPolicyRequest) => {
    await createPolicy.mutateAsync(data)
    setIsCreateDialogOpen(false)
  }

  const handleUpdatePolicy = async (data: CreateIamPolicyRequest) => {
    if (!editingPolicy) {
      return
    }
    await updatePolicy.mutateAsync({
      policyId: editingPolicy.id,
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    })
    setEditingPolicy(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedPolicies.length === 0) {
      return
    }
    if (!confirm(`선택한 ${selectedPolicies.length}개의 정책을 삭제하시겠습니까?`)) {
      return
    }

    for (const id of selectedPolicies) {
      await deletePolicy.mutateAsync(id)
    }
    setSelectedPolicies([])
  }

  // Statement management handlers
  const handleAddStatement = async (data: CreatePolicyStatementRequest) => {
    if (!viewingPolicy) {
      return
    }
    await addStatement.mutateAsync({
      policyId: viewingPolicy.id,
      data,
    })
    setIsStatementDialogOpen(false)
    refetchStatements()
  }

  const handleUpdateStatement = async (data: CreatePolicyStatementRequest) => {
    if (!(viewingPolicy && editingStatement)) {
      return
    }
    await updateStatement.mutateAsync({
      policyId: viewingPolicy.id,
      statementId: editingStatement.id,
      data,
    })
    setEditingStatement(null)
    setIsStatementDialogOpen(false)
    refetchStatements()
  }

  const handleDeleteStatement = async (statementId: string) => {
    if (!viewingPolicy) {
      return
    }
    if (!confirm("이 명세문을 삭제하시겠습니까?")) {
      return
    }
    await deleteStatement.mutateAsync({
      policyId: viewingPolicy.id,
      statementId,
    })
    refetchStatements()
  }

  const openStatementDialog = (statement?: IamPolicyStatement) => {
    setEditingStatement(statement || null)
    setIsStatementDialogOpen(true)
  }

  const columns: Column<IamPolicy & { statementsCount?: number }>[] = [
    {
      key: "name",
      header: "정책명",
      minWidth: "160px",
      render: (item) => (
        <div className="max-w-[160px]">
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
      key: "workspace",
      header: "워크스페이스",
      width: "100px",
      render: (item) => (
        <span
          className="block max-w-[100px] truncate text-gray-600 text-sm"
          title={item.workspace?.name}
        >
          {item.workspace?.name || <span className="font-medium text-blue-600">전역</span>}
        </span>
      ),
    },
    {
      key: "type",
      header: "타입",
      width: "70px",
      render: (item) => (
        <Badge className="text-xs" variant={item.isManaged ? "secondary" : "outline"}>
          {item.isManaged ? "시스템" : "사용자"}
        </Badge>
      ),
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
      key: "statementsCount",
      header: "명세",
      width: "50px",
      render: (item) => <span className="text-gray-600">{item.statementsCount || 0}개</span>,
    },
    {
      key: "version",
      header: "버전",
      width: "50px",
      render: (item) => <span className="text-gray-500">v{item.version}</span>,
    },
    {
      key: "creator",
      header: "생성자",
      width: "80px",
      render: (item) => (
        <span
          className="block max-w-[80px] truncate text-gray-500 text-xs"
          title={item.creator?.username}
        >
          {item.creator?.username || "시스템"}
        </span>
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
            onClick={() => setViewingPolicy(item)}
            size="sm"
            title="상세 보기"
            variant="outline"
          >
            <Eye className="h-3 w-3" />
          </Button>
          {!item.isManaged && (
            <>
              <Button
                className="h-7 w-7 p-0 text-xs"
                onClick={() => setEditingPolicy(item)}
                size="sm"
                title="수정"
                variant="outline"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                className="h-7 w-7 p-0 text-red-600 text-xs hover:text-red-700"
                onClick={() => {
                  if (confirm("이 정책을 삭제하시겠습니까?")) {
                    deletePolicy.mutate(item.id)
                  }
                }}
                size="sm"
                title="삭제"
                variant="outline"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
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

      {/* Policies Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">정책</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />새 정책
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              onChange={handleSearch}
              placeholder="정책명, 설명으로 검색..."
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
            selectedCount={selectedPolicies.length}
          />

          {/* Table */}
          <DataTable
            columns={columns}
            data={policies}
            emptyMessage="아직 정책이 없어요"
            getItemId={(item) => item.id}
            isLoading={isFetching}
            onPageChange={handlePageChange}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            pagination={pagination}
            selectable
            selectedIds={selectedPolicies}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">새 정책</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <PolicyForm
              isLoading={createPolicy.isPending}
              onCancel={() => setIsCreateDialogOpen(false)}
              onSave={handleCreatePolicy}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog onOpenChange={() => setEditingPolicy(null)} open={!!editingPolicy}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">정책 편집</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingPolicy && (
              <PolicyForm
                isLoading={updatePolicy.isPending}
                onCancel={() => setEditingPolicy(null)}
                onSave={handleUpdatePolicy}
                policy={editingPolicy}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog onOpenChange={() => setViewingPolicy(null)} open={!!viewingPolicy}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">정책 상세</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
            {viewingPolicy && (
              <div className="space-y-6">
                {/* Policy Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-500 text-sm">정책명</span>
                    <p className="mt-1 font-medium">{viewingPolicy.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">버전</span>
                    <p className="mt-1">v{viewingPolicy.version}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-500 text-sm">설명</span>
                    <p className="mt-1 text-gray-600">{viewingPolicy.description || "-"}</p>
                  </div>
                </div>

                {/* Statements */}
                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium text-gray-700 text-sm">
                      정책 명세 ({statements?.length || 0}개)
                    </h4>
                    {!viewingPolicy.isManaged && (
                      <Button onClick={() => openStatementDialog()} size="sm" variant="outline">
                        <Plus className="mr-1 h-4 w-4" />새 명세
                      </Button>
                    )}
                  </div>
                  {statements && statements.length > 0 ? (
                    <div className="space-y-3">
                      {statements.map((stmt, index) => (
                        <div
                          className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-800"
                          key={stmt.id}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {stmt.sid || `Statement ${index + 1}`}
                              </span>
                              <Badge
                                className="text-xs"
                                variant={stmt.effect === "allow" ? "default" : "destructive"}
                              >
                                {POLICY_EFFECT_LABELS[stmt.effect]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs">
                                우선순위: {stmt.priority}
                              </span>
                              {!viewingPolicy.isManaged && (
                                <div className="flex gap-1">
                                  <Button
                                    className="h-6 w-6 p-0"
                                    onClick={() => openStatementDialog(stmt)}
                                    size="sm"
                                    title="수정"
                                    variant="ghost"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteStatement(stmt.id)}
                                    size="sm"
                                    title="삭제"
                                    variant="ghost"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">리소스:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {stmt.resources.map((r, i) => (
                                  <code
                                    className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-200"
                                    key={i}
                                  >
                                    {r}
                                  </code>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">액션:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {stmt.actions.map((a, i) => (
                                  <code
                                    className="rounded bg-green-100 px-1.5 py-0.5 text-green-800 text-xs dark:bg-green-900 dark:text-green-200"
                                    key={i}
                                  >
                                    {a}
                                  </code>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">아직 명세가 없어요</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement Add/Edit Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setIsStatementDialogOpen(false)
            setEditingStatement(null)
          }
        }}
        open={isStatementDialogOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              {editingStatement ? "명세 편집" : "새 명세"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
            <StatementForm
              formId={statementFormId}
              isLoading={addStatement.isPending || updateStatement.isPending}
              onCancel={() => {
                setIsStatementDialogOpen(false)
                setEditingStatement(null)
              }}
              onSave={editingStatement ? handleUpdateStatement : handleAddStatement}
              statement={editingStatement}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Statement Form Component
type StatementFormProps = {
  formId: string
  statement?: IamPolicyStatement | null
  onSave: (data: CreatePolicyStatementRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

function StatementForm({ formId, statement, onSave, onCancel, isLoading }: StatementFormProps) {
  const [sid, setSid] = useState(statement?.sid || "")
  const [effect, setEffect] = useState<PolicyEffect>(statement?.effect || "allow")
  const [resources, setResources] = useState<string[]>(statement?.resources || [])
  const [actions, setActions] = useState<string[]>(statement?.actions || [])
  const [priority, setPriority] = useState(statement?.priority || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resources.length === 0 || actions.length === 0) {
      alert("리소스와 액션을 각각 하나 이상 선택해주세요.")
      return
    }
    await onSave({
      sid: sid || undefined,
      effect,
      resources,
      actions,
      priority,
    })
  }

  const toggleResource = (resource: string) => {
    setResources((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource],
    )
  }

  const toggleAction = (action: string) => {
    setActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action],
    )
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        {/* SID */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-sid`}>식별자 (SID)</Label>
          <Input
            id={`${formId}-sid`}
            onChange={(e) => setSid(e.target.value)}
            placeholder="예: AllowLeadRead"
            value={sid}
          />
        </div>

        {/* Effect */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-effect`}>효과 *</Label>
          <Select onValueChange={(v) => setEffect(v as PolicyEffect)} value={effect}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(POLICY_EFFECT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resources */}
      <div className="space-y-2">
        <Label>리소스 * ({resources.length}개 선택됨)</Label>
        <div className="flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
          {COMMON_RESOURCES.map((resource) => (
            <button
              className={`inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs transition-colors ${
                resources.includes(resource.value)
                  ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
              key={resource.value}
              onClick={() => toggleResource(resource.value)}
              type="button"
            >
              {resource.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Label>액션 * ({actions.length}개 선택됨)</Label>
        <div className="flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
          {COMMON_ACTIONS.map((action) => (
            <button
              className={`inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs transition-colors ${
                actions.includes(action.value)
                  ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900 dark:text-green-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
              key={action.value}
              onClick={() => toggleAction(action.value)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-priority`}>우선순위</Label>
        <Input
          className="w-24"
          id={`${formId}-priority`}
          min={0}
          onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
          type="number"
          value={priority}
        />
        <p className="text-gray-500 text-xs">높을수록 먼저 평가됩니다.</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button
          disabled={isLoading || resources.length === 0 || actions.length === 0}
          type="submit"
        >
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  )
}
