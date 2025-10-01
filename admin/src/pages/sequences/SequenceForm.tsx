import { useId, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCustomerGroupsByWorkspace } from "@/lib/api/hooks/customer-groups"
import { useSuspenseWorkspaces } from "@/lib/api/hooks/workspaces"
import type { Sequence, SequenceStatus } from "@/lib/api/types/sequence"

interface SequenceFormProps {
  sequence?: Sequence
  isEdit?: boolean
  onSave: (sequenceData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function SequenceForm({ sequence, isEdit = false, onSave, onCancel }: SequenceFormProps) {
  const {
    data: { workspaces },
  } = useSuspenseWorkspaces({ limit: 100 })
  const [formData, setFormData] = useState({
    name: sequence?.name || "",
    description: sequence?.description || "",
    workspaceId: sequence?.workspaceId || "",
    status: (sequence?.status || "draft") as SequenceStatus,
    customerGroupId: sequence?.customerGroupId || "",
  })
  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    formData.workspaceId,
    Boolean(formData.workspaceId)
  )
  const nameId = useId()
  const descriptionId = useId()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 고객그룹 필수 검증
    if (!formData.customerGroupId) {
      toast.error("워크플로우 실행을 위해 고객그룹을 선택해주세요")
      return
    }

    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>시퀀스명</Label>
        <Input
          id={nameId}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="예: 신규 고객 온보딩 시퀀스"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>설명</Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="시퀀스에 대한 설명을 입력하세요..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerGroup">워크스페이스</Label>
        <Select
          value={formData.workspaceId}
          onValueChange={(value) => setFormData({ ...formData, workspaceId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="워크스페이스 선택" />
          </SelectTrigger>
          {workspaces && workspaces.length === 0 && (
            <SelectContent>
              <SelectItem disabled value="none">
                워크스페이스가 없습니다.
              </SelectItem>
            </SelectContent>
          )}
          {workspaces && workspaces.length > 0 && (
            <SelectContent className="mt-2 max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerGroup" className="flex items-center gap-2">
          고객그룹
          <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.customerGroupId}
          onValueChange={(value) => setFormData({ ...formData, customerGroupId: value })}
          disabled={!formData.workspaceId}
          required
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                formData.workspaceId ? "고객그룹 선택 (필수)" : "먼저 워크스페이스를 선택하세요"
              }
            />
          </SelectTrigger>
          {customerGroups && customerGroups.length === 0 && (
            <SelectContent>
              <SelectItem disabled value="none">
                고객그룹이 없습니다.
              </SelectItem>
            </SelectContent>
          )}
          {customerGroups && customerGroups.length > 0 && (
            <SelectContent>
              {customerGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.leadCount || 0}개 리드)
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
        <p className="text-xs text-gray-500">
          💡 워크플로우 실행을 위해 고객그룹을 반드시 선택해야 합니다
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">상태</Label>
        <Select
          value={formData.status}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              status: value as SequenceStatus,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">초안</SelectItem>
            {isEdit && <SelectItem value="active">활성</SelectItem>}
            <SelectItem value="paused">일시정지</SelectItem>
            {isEdit && <SelectItem value="archived">보관됨</SelectItem>}
          </SelectContent>
        </Select>
        {!isEdit && (
          <p className="text-xs text-gray-500">
            💡 시퀀스 생성 후 워크플로우를 설정하고 활성화할 수 있습니다
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  )
}
