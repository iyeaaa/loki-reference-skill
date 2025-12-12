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
    if (!editingPolicy) return
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
    if (selectedPolicies.length === 0) return
    if (!confirm(`선택한 ${selectedPolicies.length}개의 정책을 삭제하시겠습니까?`)) return

    for (const id of selectedPolicies) {
      await deletePolicy.mutateAsync(id)
    }
    setSelectedPolicies([])
  }

  // Statement management handlers
  const handleAddStatement = async (data: CreatePolicyStatementRequest) => {
    if (!viewingPolicy) return
    await addStatement.mutateAsync({
      policyId: viewingPolicy.id,
      data,
    })
    setIsStatementDialogOpen(false)
    refetchStatements()
  }

  const handleUpdateStatement = async (data: CreatePolicyStatementRequest) => {
    if (!viewingPolicy || !editingStatement) return
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
    if (!viewingPolicy) return
    if (!confirm("이 명세문을 삭제하시겠습니까?")) return
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
      key: "workspace",
      header: "워크스페이스",
      width: "100px",
      render: (item) => (
        <span
          className="text-sm text-gray-600 truncate block max-w-[100px]"
          title={item.workspace?.name}
        >
          {item.workspace?.name || <span className="text-blue-600 font-medium">전역</span>}
        </span>
      ),
    },
    {
      key: "type",
      header: "타입",
      width: "70px",
      render: (item) => (
        <Badge variant={item.isManaged ? "secondary" : "outline"} className="text-xs">
          {item.isManaged ? "시스템" : "사용자"}
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "상태",
      width: "70px",
      render: (item) => (
        <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
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
          className="text-xs text-gray-500 truncate block max-w-[80px]"
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
        <span className="text-xs text-gray-500 whitespace-nowrap">
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
            variant="outline"
            size="sm"
            onClick={() => setViewingPolicy(item)}
            className="text-xs h-7 w-7 p-0"
            title="상세 보기"
          >
            <Eye className="h-3 w-3" />
          </Button>
          {!item.isManaged && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPolicy(item)}
                className="text-xs h-7 w-7 p-0"
                title="수정"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("이 정책을 삭제하시겠습니까?")) {
                    deletePolicy.mutate(item.id)
                  }
                }}
                className="text-xs h-7 w-7 p-0 text-red-600 hover:text-red-700"
                title="삭제"
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
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <DataFilters
        filters={filterConfigs}
        values={filterValues}
        onChange={updateFilter}
        onClear={clearFilters}
      />

      {/* Policies Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">정책</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />새 정책
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="정책명, 설명으로 검색..."
            />
          </div>

          {/* Bulk Actions */}
          <BulkActionsBar
            selectedCount={selectedPolicies.length}
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
            data={policies}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            selectable
            selectedIds={selectedPolicies}
            getItemId={(item) => item.id}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onPageChange={handlePageChange}
            emptyMessage="아직 정책이 없어요"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">새 정책</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <PolicyForm
              onSave={handleCreatePolicy}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createPolicy.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPolicy} onOpenChange={() => setEditingPolicy(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">정책 편집</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingPolicy && (
              <PolicyForm
                policy={editingPolicy}
                onSave={handleUpdatePolicy}
                onCancel={() => setEditingPolicy(null)}
                isLoading={updatePolicy.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingPolicy} onOpenChange={() => setViewingPolicy(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">정책 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {viewingPolicy && (
              <div className="space-y-6">
                {/* Policy Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">정책명</span>
                    <p className="mt-1 font-medium">{viewingPolicy.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">버전</span>
                    <p className="mt-1">v{viewingPolicy.version}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-500">설명</span>
                    <p className="mt-1 text-gray-600">{viewingPolicy.description || "-"}</p>
                  </div>
                </div>

                {/* Statements */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      정책 명세 ({statements?.length || 0}개)
                    </h4>
                    {!viewingPolicy.isManaged && (
                      <Button variant="outline" size="sm" onClick={() => openStatementDialog()}>
                        <Plus className="h-4 w-4 mr-1" />새 명세
                      </Button>
                    )}
                  </div>
                  {statements && statements.length > 0 ? (
                    <div className="space-y-3">
                      {statements.map((stmt, index) => (
                        <div
                          key={stmt.id}
                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {stmt.sid || `Statement ${index + 1}`}
                              </span>
                              <Badge
                                variant={stmt.effect === "allow" ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {POLICY_EFFECT_LABELS[stmt.effect]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                우선순위: {stmt.priority}
                              </span>
                              {!viewingPolicy.isManaged && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openStatementDialog(stmt)}
                                    className="h-6 w-6 p-0"
                                    title="수정"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteStatement(stmt.id)}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    title="삭제"
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
                              <div className="flex flex-wrap gap-1 mt-1">
                                {stmt.resources.map((r, i) => (
                                  <code
                                    key={i}
                                    className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                                  >
                                    {r}
                                  </code>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">액션:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {stmt.actions.map((a, i) => (
                                  <code
                                    key={i}
                                    className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs"
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
        open={isStatementDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsStatementDialogOpen(false)
            setEditingStatement(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              {editingStatement ? "명세 편집" : "새 명세"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            <StatementForm
              formId={statementFormId}
              statement={editingStatement}
              onSave={editingStatement ? handleUpdateStatement : handleAddStatement}
              onCancel={() => {
                setIsStatementDialogOpen(false)
                setEditingStatement(null)
              }}
              isLoading={addStatement.isPending || updateStatement.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Statement Form Component
interface StatementFormProps {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* SID */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-sid`}>식별자 (SID)</Label>
          <Input
            id={`${formId}-sid`}
            value={sid}
            onChange={(e) => setSid(e.target.value)}
            placeholder="예: AllowLeadRead"
          />
        </div>

        {/* Effect */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-effect`}>효과 *</Label>
          <Select value={effect} onValueChange={(v) => setEffect(v as PolicyEffect)}>
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
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
          {COMMON_RESOURCES.map((resource) => (
            <button
              key={resource.value}
              type="button"
              onClick={() => toggleResource(resource.value)}
              className={`inline-flex items-center px-2 py-1 rounded text-xs cursor-pointer border transition-colors ${
                resources.includes(resource.value)
                  ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {resource.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Label>액션 * ({actions.length}개 선택됨)</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
          {COMMON_ACTIONS.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => toggleAction(action.value)}
              className={`inline-flex items-center px-2 py-1 rounded text-xs cursor-pointer border transition-colors ${
                actions.includes(action.value)
                  ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              }`}
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
          id={`${formId}-priority`}
          type="number"
          value={priority}
          onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
          min={0}
          className="w-24"
        />
        <p className="text-xs text-gray-500">높을수록 먼저 평가됩니다.</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button
          type="submit"
          disabled={isLoading || resources.length === 0 || actions.length === 0}
        >
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  )
}
