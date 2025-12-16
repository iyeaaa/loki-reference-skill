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
    if (!editingRole) {
      return
    }
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
    if (selectedRoles.length === 0) {
      return
    }
    if (!confirm(`선택한 ${selectedRoles.length}개의 역할을 삭제하시겠습니까?`)) {
      return
    }

    for (const id of selectedRoles) {
      await deleteRole.mutateAsync(id)
    }
    setSelectedRoles([])
  }

  const handleAttachPolicy = async () => {
    if (!(viewingRole && selectedPolicyId)) {
      return
    }
    await attachPolicy.mutateAsync({
      roleId: viewingRole.id,
      policyId: selectedPolicyId,
    })
    setSelectedPolicyId("")
    setIsAttachPolicyDialogOpen(false)
  }

  const handleDetachPolicy = async (policyId: string) => {
    if (!viewingRole) {
      return
    }
    if (!confirm("이 정책을 역할에서 분리하시겠습니까?")) {
      return
    }
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
          <div className="truncate font-medium text-gray-900 dark:text-gray-100" title={item.name}>
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
            className="line-clamp-2 text-gray-500 text-xs"
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
          className="block max-w-[100px] truncate text-gray-600 text-sm"
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
        <Badge className="text-xs" variant={item.isSystem ? "secondary" : "outline"}>
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
          <Badge className="text-xs" variant="default">
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
            onClick={() => setViewingRole(item)}
            size="sm"
            title="상세 보기"
            variant="outline"
          >
            <Eye className="h-3 w-3" />
          </Button>
          {!item.isSystem && (
            <>
              <Button
                className="h-7 w-7 p-0 text-xs"
                onClick={() => setEditingRole(item)}
                size="sm"
                title="수정"
                variant="outline"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                className="h-7 w-7 p-0 text-red-600 text-xs hover:text-red-700"
                onClick={() => {
                  if (confirm("이 역할을 삭제하시겠습니까?")) {
                    deleteRole.mutate(item.id)
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

      {/* Roles Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">역할</CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />새 역할
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <SearchInput
              onChange={handleSearch}
              placeholder="역할명, 설명으로 검색..."
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
            selectedCount={selectedRoles.length}
          />

          {/* Table */}
          <DataTable
            columns={columns}
            data={roles}
            emptyMessage="아직 역할이 없어요"
            getItemId={(item) => item.id}
            isLoading={isFetching}
            onPageChange={handlePageChange}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            pagination={pagination}
            selectable
            selectedIds={selectedRoles}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">새 역할</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <RoleForm
              isLoading={createRole.isPending}
              onCancel={() => setIsCreateDialogOpen(false)}
              onSave={handleCreateRole}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog onOpenChange={() => setEditingRole(null)} open={!!editingRole}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">역할 편집</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingRole && (
              <RoleForm
                isLoading={updateRole.isPending}
                onCancel={() => setEditingRole(null)}
                onSave={handleUpdateRole}
                role={editingRole}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog onOpenChange={() => setViewingRole(null)} open={!!viewingRole}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">역할 상세</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-4">
            {viewingRole && (
              <div className="space-y-6">
                {/* Role Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-500 text-sm">역할명</span>
                    <p className="mt-1 font-medium">{viewingRole.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">타입</span>
                    <p className="mt-1">
                      <Badge variant={viewingRole.isSystem ? "secondary" : "outline"}>
                        {viewingRole.isSystem ? "시스템" : "커스텀"}
                      </Badge>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-500 text-sm">설명</span>
                    <p className="mt-1 text-gray-600">{viewingRole.description || "-"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">기본 역할</span>
                    <p className="mt-1">{viewingRole.isDefault ? "예" : "아니오"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500 text-sm">우선순위</span>
                    <p className="mt-1">{viewingRole.priority}</p>
                  </div>
                </div>

                {/* Tabs for Policies and Members */}
                <Tabs className="border-t pt-4" defaultValue="policies">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger className="flex items-center gap-2" value="policies">
                      <Link className="h-4 w-4" />
                      정책 ({rolePolicies?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger className="flex items-center gap-2" value="members">
                      <Users className="h-4 w-4" />
                      멤버 ({roleMembers?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  {/* Policies Tab */}
                  <TabsContent className="mt-4" value="policies">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-medium text-gray-700 text-sm">연결된 정책</h4>
                      {!viewingRole.isSystem && (
                        <Button
                          onClick={() => setIsAttachPolicyDialogOpen(true)}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          연결
                        </Button>
                      )}
                    </div>
                    {rolePolicies && rolePolicies.length > 0 ? (
                      <div className="space-y-2">
                        {rolePolicies.map((rp) => (
                          <div
                            className="flex items-center justify-between rounded-lg border bg-gray-50 p-3 dark:bg-gray-800"
                            key={rp.id}
                          >
                            <div>
                              <div className="font-medium text-sm">{rp.policy?.name || "-"}</div>
                              {rp.policy?.description && (
                                <div className="text-gray-500 text-xs">{rp.policy.description}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs">
                                {rp.attachedAt && formatRelativeTime(rp.attachedAt)}
                              </span>
                              {!viewingRole.isSystem && (
                                <Button
                                  className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => handleDetachPolicy(rp.policyId)}
                                  size="sm"
                                  title="정책 분리"
                                  variant="ghost"
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
                  <TabsContent className="mt-4" value="members">
                    <h4 className="mb-3 font-medium text-gray-700 text-sm">역할 멤버</h4>
                    {roleMembers && roleMembers.length > 0 ? (
                      <div className="space-y-2">
                        {roleMembers.map((rm) => (
                          <div
                            className="flex items-center justify-between rounded-lg border bg-gray-50 p-3 dark:bg-gray-800"
                            key={rm.id}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                                <Users className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {rm.member?.user?.username || rm.member?.user?.email || "Unknown"}
                                </div>
                                {rm.member?.user?.email && (
                                  <div className="text-gray-500 text-xs">
                                    {rm.member.user.email}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-gray-400 text-xs">
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
      <Dialog onOpenChange={setIsAttachPolicyDialogOpen} open={isAttachPolicyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-lg">정책 연결</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>정책 선택</Label>
              <Select onValueChange={setSelectedPolicyId} value={selectedPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="연결할 정책을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {attachablePolicies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      <div className="flex flex-col">
                        <span>{policy.name}</span>
                        {policy.description && (
                          <span className="text-gray-500 text-xs">{policy.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {attachablePolicies.length === 0 && (
                <p className="text-gray-500 text-sm">연결 가능한 정책이 없습니다.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                onClick={() => {
                  setSelectedPolicyId("")
                  setIsAttachPolicyDialogOpen(false)
                }}
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={!selectedPolicyId || attachPolicy.isPending}
                onClick={handleAttachPolicy}
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
