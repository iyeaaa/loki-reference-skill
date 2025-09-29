import { useId, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usersApi } from "@/lib/api/services/users"
import type { User } from "@/lib/api/types/user"

interface PasswordChangeDialogProps {
  user: User
  onClose: () => void
}

export function PasswordChangeDialog({ user, onClose }: PasswordChangeDialogProps) {
  const passwordId = useId()
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error("비밀번호는 최소 8자 이상이어야 합니다.")
      return
    }

    setLoading(true)
    try {
      await usersApi.changePassword(user.id, newPassword)
      toast.success("비밀번호가 변경되었습니다.")
      onClose()
    } catch {
      toast.error("비밀번호 변경에 실패했습니다.")
    }
    setLoading(false)
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{user.username}의 비밀번호 변경</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor={passwordId}>새 비밀번호</Label>
          <Input
            id={passwordId}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
