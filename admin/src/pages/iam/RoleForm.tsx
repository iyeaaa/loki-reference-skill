import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CreateIamRoleRequest, IamWorkspaceRole } from "@/lib/api/types/iam"

interface RoleFormProps {
  role?: IamWorkspaceRole
  onSave: (data: CreateIamRoleRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  workspaceId?: string
}

export function RoleForm({ role, onSave, onCancel, isLoading, workspaceId }: RoleFormProps) {
  const formId = useId()
  const [name, setName] = useState(role?.name || "")
  const [description, setDescription] = useState(role?.description || "")
  const [isDefault, setIsDefault] = useState(role?.isDefault ?? false)
  const [priority, setPriority] = useState(role?.priority || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // workspaceId is required for new roles
    const finalWorkspaceId = role?.workspaceId || workspaceId
    if (!finalWorkspaceId && !role) {
      alert("워크스페이스를 선택해주세요.")
      return
    }

    await onSave({
      workspaceId: finalWorkspaceId || "",
      name,
      description: description || undefined,
      isDefault,
      priority,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>역할명 *</Label>
        <Input
          id={`${formId}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: Editor, Viewer, Manager"
          required
          maxLength={50}
        />
        <p className="text-xs text-gray-500">워크스페이스 내에서 유일해야 합니다.</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>설명</Label>
        <Textarea
          id={`${formId}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="역할에 대한 설명을 입력하세요..."
          rows={2}
        />
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-priority`}>우선순위</Label>
        <Input
          id={`${formId}-priority`}
          type="number"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
          min={0}
          className="w-32"
        />
        <p className="text-xs text-gray-500">권한 충돌 시 높은 우선순위의 역할이 적용됩니다.</p>
      </div>

      {/* Is Default */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${formId}-isDefault`}
          checked={isDefault}
          onCheckedChange={(checked) => setIsDefault(checked as boolean)}
        />
        <Label htmlFor={`${formId}-isDefault`} className="cursor-pointer">
          기본 역할 (새 멤버에게 자동 할당)
        </Label>
      </div>

      {/* Note for system roles */}
      {role?.isSystem && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            시스템 역할은 이름 변경 및 삭제가 불가능합니다.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim() || role?.isSystem}>
          {isLoading ? "저장 중..." : role ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  )
}
