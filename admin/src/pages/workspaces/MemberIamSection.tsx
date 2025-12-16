import { AlertCircle, Plus, Shield, X } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  // useAttachPolicyToMember,
  // useDetachPolicyFromMember,
  useGrantRoleToMember,
  // useIamPolicies,
  useIamRolePolicies,
  useIamRoles,
  // useMemberPolicies,
  useMemberRoles,
  useRevokeRoleFromMember,
} from "@/lib/api/hooks/iam"

type MemberIamSectionProps = {
  memberId: string
  memberName: string
  memberEmail?: string
  workspaceId: string
  memberRole?: string
}

function RolePoliciesBadges({ roleId }: { roleId: string }) {
  const { data: rolePolicies = [], isLoading } = useIamRolePolicies(roleId)

  if (isLoading) {
    return <span className="text-[10px] text-gray-400">...</span>
  }
  if (rolePolicies.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1">
      {rolePolicies.map((rp) => (
        <Badge className="h-4 bg-white px-1 text-[10px]" key={rp.policyId} variant="outline">
          {rp.policy?.name || "Unknown"}
        </Badge>
      ))}
    </div>
  )
}

export function MemberIamSection({ memberId, workspaceId }: MemberIamSectionProps) {
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  // const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  // const [selectedPolicyId, setSelectedPolicyId] = useState("")

  const { data: memberRoles = [], isLoading: rolesLoading } = useMemberRoles(memberId)
  // const { data: memberPolicies = [], isLoading: policiesLoading } = useMemberPolicies(memberId)
  const { data: availableRolesData } = useIamRoles({ workspaceId, limit: 100 })
  // 백엔드에서 워크스페이스에 사용 가능한 정책만 필터링하여 반환
  // const { data: availablePoliciesData } = useIamPolicies({
  //   limit: 100,
  //   isActive: true,
  //   workspaceId,
  //   filterForWorkspace: true,
  // })

  const availableRoles = availableRolesData?.data || []
  // const availablePolicies = availablePoliciesData?.data || []

  const unassignedRoles = availableRoles.filter(
    (role) => !memberRoles.some((mr) => mr.roleId === role.id),
  )
  // const unassignedPolicies = availablePolicies.filter(
  //   (policy) => !memberPolicies.some((mp) => mp.policyId === policy.id),
  // )

  const grantRole = useGrantRoleToMember()
  const revokeRole = useRevokeRoleFromMember()
  // const attachPolicy = useAttachPolicyToMember()
  // const detachPolicy = useDetachPolicyFromMember()

  const handleGrantRole = async () => {
    if (!selectedRoleId) {
      return
    }
    await grantRole.mutateAsync({ memberId, roleId: selectedRoleId })
    setSelectedRoleId("")
    setIsRoleDialogOpen(false)
  }

  const handleRevokeRole = async (roleId: string, roleName: string) => {
    if (!confirm(`"${roleName}" 역할을 해제하시겠습니까?`)) {
      return
    }
    await revokeRole.mutateAsync({ memberId, roleId })
  }

  // const handleAttachPolicy = async () => {
  //   if (!selectedPolicyId) return
  //   await attachPolicy.mutateAsync({ memberId, policyId: selectedPolicyId })
  //   setSelectedPolicyId("")
  //   setIsPolicyDialogOpen(false)
  // }

  // const handleDetachPolicy = async (policyId: string, policyName: string) => {
  //   if (!confirm(`"${policyName}" 정책을 해제하시겠습니까?`)) return
  //   await detachPolicy.mutateAsync({ memberId, policyId })
  // }

  const showNoRoleWarning = !rolesLoading && memberRoles.length === 0

  return (
    <div className="space-y-3 border-t bg-gray-50/50 p-3">
      {/* No Role Warning */}
      {showNoRoleWarning && (
        <Alert className="px-3 py-1.5" variant="destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="ml-2 text-xs">
            할당된 역할이 없습니다. 기본 권한만 적용됩니다.
          </AlertDescription>
        </Alert>
      )}

      {/* Single Column Layout - 직접 정책 부분 임시 주석처리 */}
      <div className="grid grid-cols-1 gap-3">
        {/* Roles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium text-gray-600 text-xs">
              <Shield className="h-3 w-3" /> 역할
            </span>
            <Button
              className="h-6 px-2 text-gray-500 text-xs"
              disabled={unassignedRoles.length === 0}
              onClick={() => setIsRoleDialogOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {rolesLoading ? (
            <div className="text-gray-400 text-xs">로딩...</div>
          ) : memberRoles.length === 0 ? (
            <div className="rounded border border-dashed bg-white py-2 text-center text-gray-400 text-xs">
              없음
            </div>
          ) : (
            <div className="space-y-1.5">
              {memberRoles.map((mr) => {
                const roleName = mr.role?.name || "Unknown"
                return (
                  <div
                    className="flex items-center justify-between rounded border bg-white p-2 text-xs"
                    key={mr.roleId}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{roleName}</span>
                        {mr.role?.isSystem && (
                          <Badge className="h-3.5 px-1 text-[9px]" variant="secondary">
                            시스템
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1">
                        <RolePoliciesBadges roleId={mr.roleId} />
                      </div>
                    </div>
                    <button
                      className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      onClick={() => handleRevokeRole(mr.roleId, roleName)}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Policies - 임시 주석처리 */}
        {/* <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <FileKey className="h-3 w-3" /> 직접 정책
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsPolicyDialogOpen(true)}
              disabled={unassignedPolicies.length === 0}
              className="h-6 text-xs px-2 text-gray-500"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {policiesLoading ? (
            <div className="text-xs text-gray-400">로딩...</div>
          ) : memberPolicies.length === 0 ? (
            <div className="text-xs text-gray-400 py-2 text-center border border-dashed rounded bg-white">
              없음
            </div>
          ) : (
            <div className="space-y-1.5">
              {memberPolicies.map((mp) => {
                const policyName = mp.policy?.name || "Unknown"
                return (
                  <div
                    key={mp.policyId}
                    className="flex items-center justify-between p-2 bg-white border rounded text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate">{policyName}</span>
                      {mp.policy?.isManaged && (
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                          시스템
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachPolicy(mp.policyId, policyName)}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div> */}
      </div>

      {/* Add Role Dialog */}
      <Dialog onOpenChange={setIsRoleDialogOpen} open={isRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">역할 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Select onValueChange={setSelectedRoleId} value={selectedRoleId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="역할 선택" />
              </SelectTrigger>
              <SelectContent>
                {unassignedRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <span>{role.name}</span>
                      {role.isSystem && (
                        <Badge className="h-4 text-[9px]" variant="secondary">
                          시스템
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleId && (
              <Textarea
                className="h-16 resize-none text-gray-500 text-xs"
                readOnly
                rows={2}
                value={
                  unassignedRoles.find((r) => r.id === selectedRoleId)?.description || "설명 없음"
                }
              />
            )}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setIsRoleDialogOpen(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={!selectedRoleId || grantRole.isPending}
                onClick={handleGrantRole}
                size="sm"
                type="button"
              >
                {grantRole.isPending ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Policy Dialog - 임시 주석처리 */}
      {/* <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">정책 연결</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="정책 선택" />
              </SelectTrigger>
              <SelectContent>
                {unassignedPolicies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    <div className="flex items-center gap-2">
                      <span>{policy.name}</span>
                      {policy.isManaged && (
                        <Badge variant="secondary" className="text-[9px] h-4">
                          시스템
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPolicyId && (
              <Textarea
                value={
                  unassignedPolicies.find((p) => p.id === selectedPolicyId)?.description ||
                  "설명 없음"
                }
                readOnly
                className="text-xs text-gray-500 resize-none h-16"
                rows={2}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPolicyDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAttachPolicy}
                disabled={!selectedPolicyId || attachPolicy.isPending}
              >
                {attachPolicy.isPending ? "연결 중..." : "연결"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}
    </div>
  )
}
