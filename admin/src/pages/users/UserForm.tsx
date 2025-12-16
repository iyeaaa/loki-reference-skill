import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@/lib/api/types/user"

type UserFormProps = {
  user?: User
  isEdit?: boolean
  onSave: (userData: unknown) => Promise<void> | void
  onCancel: () => void
}

export function UserForm({ user, isEdit = false, onSave, onCancel }: UserFormProps) {
  const usernameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const isActiveId = useId()

  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    userRole: user?.userRole || ("user" as const),
    isActive: user?.isActive ?? true,
    // Keep existing values (Hidden in UI, prevents data loss during editing)
    departmentId: user?.departmentId || null,
    employeeId: user?.employeeId || null,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit && !formData.password) {
      const { password: _password, ...dataWithoutPassword } = formData
      onSave(dataWithoutPassword)
    } else {
      onSave(formData)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={usernameId}>사용자명</Label>
        <Input
          id={usernameId}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
          value={formData.username}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={emailId}>이메일</Label>
        <Input
          id={emailId}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          type="email"
          value={formData.email}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_role">역할</Label>
        <Select
          onValueChange={(value) =>
            setFormData({
              ...formData,
              userRole: value as "user" | "admin",
            })
          }
          value={formData.userRole}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">사용자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor={passwordId}>비밀번호</Label>
          <Input
            id={passwordId}
            minLength={8}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!isEdit}
            type="password"
            value={formData.password}
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          checked={formData.isActive}
          id={isActiveId}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
        />
        <Label htmlFor={isActiveId}>활성 상태</Label>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button className="min-w-[100px]" type="submit">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  )
}
