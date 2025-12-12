import { Edit, Eye, Link, Plus, Trash2, Unlink, Users } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useAttachPolicyToRole,
  useCreateIamRole,
  useDeleteIamRole,
  useDetachPolicyFromRole,
  useIamPolicies,
  useIamRoleMembers,
  useIamRolePolicies,
  useIamRoles,
  useUpdateIamRole,
} from "@/lib/api/hooks/iam"
import type { CreateIamRoleRequest, IamRolesParams, IamWorkspaceRole } from "@/lib/api/types/iam"
import { formatRelativeTime } from "@/lib/date-utils"
import { RoleForm } from "./RoleForm"

const filterConfigs: FilterConfig[] = [
  {
    type: "checkbox",
    key: "isSystem",
    label: "타입",
    options: [
      { value: "true", label: "시스템 역할" },
      { value: "false", label: "커스텀 역할" },
    ],
  },
  {
    type: "checkbox",
    key: "isDefault",
    label: "기본값",
    options: [
      { value: "true", label: "기본 역할" },
      { value: "false", label: "일반 역할" },
    ],
  },
]

export default function RolesPage() {
  const {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
  } = useFilters()

  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [editingRole, setEditingRole] = useState<IamWorkspaceRole | null>(null)
  const [viewingRole, setViewingRole] = useState<IamWorkspaceRole | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAttachPolicyDialogOpen, setIsAttachPolicyDialogOpen] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState("")

  // Build API params
  const params: IamRolesParams = {
    page: currentPage,
    limit: 10,
    search: searchQuery || undefined,
    isSystem:
      (filterValues.isSystem as string[])?.length === 1
        ? (filterValues.isSystem as string[])[0] === "true"
        : undefined,
    isDefault:
      (filterValues.isDefault as string[])?.length === 1
        ? (filterValues.isDefault as string[])[0] === "true"
        : undefined,
  }

  const { data, isFetching } = useIamRoles(params)
  const createRole = useCreateIamRole()
  const updateRole = useUpdateIamRole()
  const deleteRole = useDeleteIamRole()
  const attachPolicy = useAttachPolicyToRole()
  const detachPolicy = useDetachPolicyFromRole()

  // Fetch policies for viewing role
  const { data: rolePolicies } = useIamRolePolicies(viewingRole?.id || "", !!viewingRole)
  // Fetch role members
  const { data: roleMembers } = useIamRoleMembers(viewingRole?.id || "", !!viewingRole)
  // Fetch all policies for attach dialog
  const { data: allPoliciesData } = useIamPolicies({ limit: 100 })
  const allPolicies = allPoliciesData?.data || []

  // Filter out already attached policies
  const attachablePolicies = allPolicies.filter(
    (p) => !rolePolicies?.some((rp) => rp.policyId === p.id),
  )

  const roles = data?.data || []
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      }
    : undefined

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }, [])

  const handleToggleSelectAll = useCallback((ids: string[]) => {
    setSelectedRoles((prev) => (prev.length === ids.length ? [] : ids))
  }, [])

  const handleCreateRole = async (data: CreateIamRoleRequest) => {
    await createRole.mutateAsync(data)
    setIsCreateDialogOpen(false)
  }

  const handleUpdateRole = async (data: CreateIamRoleRequest) => {
    if (!editingRole) return
    await updateRole.mutateAsync({
      roleId: editingRole.id,
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault,
        priority: data.priority,
      },
    })
    setEditingRole(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedRoles.length === 0) return
    if (!confirm(`선택한 ${selectedRoles.length}개의 역할을 삭제하시겠습니까?`)) return

    for (const id of selectedRoles) {
      await deleteRole.mutateAsync(id)
    }
    setSelectedRoles([])
  }

  const handleAttachPolicy = async () => {
    if (!viewingRole || !selectedPolicyId) return
    await attachPolicy.mutateAsync({
      roleId: viewingRole.id,
      policyId: selectedPolicyId,
    })
    setSelectedPolicyId("")
    setIsAttachPolicyDialogOpen(false)
  }

  const handleDetachPolicy = async (policyId: string) => {
    if (!viewingRole) return
    if (!confirm("이 정책을 역할에서 분리하시겠습니까?")) return
    await detachPolicy.mutateAsync({
      roleId: viewingRole.id,
      policyId,
    })
  }

  const columns: Column<IamWorkspaceRole & { policiesCount?: number; membersCount?: number }>[] = [
    {
      key: "name",
      header: "역할명",
      minWidth: "120px",
      render: (item) => (
        <div className="max-w-[120px]">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={item.name}>
            {item.name}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "설명",
      minWidth: "160px",
      render: (item) => (
        <div className="max-w-[160px]">
          <span
            className="text-xs text-gray-500 line-clamp-2"
            title={item.description || undefined}
          >
            {item.description || "-"}
          </span>
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
          {item.workspace?.name || "-"}
        </span>
      ),
    },
    {
      key: "type",
      header: "타입",
      width: "70px",
      render: (item) => (
        <Badge variant={item.isSystem ? "secondary" : "outline"} className="text-xs">
          {item.isSystem ? "시스템" : "커스텀"}
        </Badge>
      ),
    },
    {
      key: "isDefault",
      header: "기본",
      width: "50px",
      render: (item) =>
        item.isDefault ? (
          <Badge variant="default" className="text-xs">
            기본
          </Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "policiesCount",
      header: "정책",
      width: "50px",
      render: (item) => <span className="text-gray-600">{item.policiesCount || 0}개</span>,
    },
    {
      key: "membersCount",
      header: "멤버",
      width: "50px",
      render: (item) => <span className="text-gray-600">{item.membersCount || 0}명</span>,
    },
    {
      key: "priority",
      header: "순위",
      width: "50px",
      render: (item) => <span className="text-gray-500">{item.priority}</span>,
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
            onClick={() => setViewingRole(item)}
            className="text-xs h-7 w-7 p-0"
            title="상세 보기"
          >
            <Eye className="h-3 w-3" />
          </Button>
          {!item.isSystem && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingRole(item)}
                className="text-xs h-7 w-7 p-0"
                title="수정"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("이 역할을 삭제하시겠습니까?")) {
                    deleteRole.mutate(item.id)
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

      {/* Roles Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">역할</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />새 역할
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="역할명, 설명으로 검색..."
            />
          </div>

          {/* Bulk Actions */}
          <BulkActionsBar
            selectedCount={selectedRoles.length}
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
            data={roles}
            columns={columns}
            pagination={pagination}
            isLoading={isFetching}
            selectable
            selectedIds={selectedRoles}
            getItemId={(item) => item.id}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onPageChange={handlePageChange}
            emptyMessage="아직 역할이 없어요"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">새 역할</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <RoleForm
              onSave={handleCreateRole}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createRole.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">역할 편집</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingRole && (
              <RoleForm
                role={editingRole}
                onSave={handleUpdateRole}
                onCancel={() => setEditingRole(null)}
                isLoading={updateRole.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingRole} onOpenChange={() => setViewingRole(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">역할 상세</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1 py-4">
            {viewingRole && (
              <div className="space-y-6">
                {/* Role Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">역할명</span>
                    <p className="mt-1 font-medium">{viewingRole.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">타입</span>
                    <p className="mt-1">
                      <Badge variant={viewingRole.isSystem ? "secondary" : "outline"}>
                        {viewingRole.isSystem ? "시스템" : "커스텀"}
                      </Badge>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-500">설명</span>
                    <p className="mt-1 text-gray-600">{viewingRole.description || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">기본 역할</span>
                    <p className="mt-1">{viewingRole.isDefault ? "예" : "아니오"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">우선순위</span>
                    <p className="mt-1">{viewingRole.priority}</p>
                  </div>
                </div>

                {/* Tabs for Policies and Members */}
                <Tabs defaultValue="policies" className="pt-4 border-t">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="policies" className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      정책 ({rolePolicies?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="members" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      멤버 ({roleMembers?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  {/* Policies Tab */}
                  <TabsContent value="policies" className="mt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-gray-700">연결된 정책</h4>
                      {!viewingRole.isSystem && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsAttachPolicyDialogOpen(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          연결
                        </Button>
                      )}
                    </div>
                    {rolePolicies && rolePolicies.length > 0 ? (
                      <div className="space-y-2">
                        {rolePolicies.map((rp) => (
                          <div
                            key={rp.id}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-sm">{rp.policy?.name || "-"}</div>
                              {rp.policy?.description && (
                                <div className="text-xs text-gray-500">{rp.policy.description}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {rp.attachedAt && formatRelativeTime(rp.attachedAt)}
                              </span>
                              {!viewingRole.isSystem && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDetachPolicy(rp.policyId)}
                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="정책 분리"
                                >
                                  <Unlink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">아직 연결된 정책이 없어요</p>
                    )}
                  </TabsContent>

                  {/* Members Tab */}
                  <TabsContent value="members" className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">역할 멤버</h4>
                    {roleMembers && roleMembers.length > 0 ? (
                      <div className="space-y-2">
                        {roleMembers.map((rm) => (
                          <div
                            key={rm.id}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <Users className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {rm.member?.user?.username || rm.member?.user?.email || "Unknown"}
                                </div>
                                {rm.member?.user?.email && (
                                  <div className="text-xs text-gray-500">
                                    {rm.member.user.email}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {rm.grantedAt && formatRelativeTime(rm.grantedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">아직 멤버가 없어요</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Attach Policy Dialog */}
      <Dialog open={isAttachPolicyDialogOpen} onOpenChange={setIsAttachPolicyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">정책 연결</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>정책 선택</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="연결할 정책을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {attachablePolicies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      <div className="flex flex-col">
                        <span>{policy.name}</span>
                        {policy.description && (
                          <span className="text-xs text-gray-500">{policy.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {attachablePolicies.length === 0 && (
                <p className="text-sm text-gray-500">연결 가능한 정책이 없습니다.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPolicyId("")
                  setIsAttachPolicyDialogOpen(false)
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleAttachPolicy}
                disabled={!selectedPolicyId || attachPolicy.isPending}
              >
                {attachPolicy.isPending ? "연결 중..." : "확인"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
