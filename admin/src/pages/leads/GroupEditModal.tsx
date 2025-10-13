import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CustomerGroup } from "@/lib/api/types/customer-group"

interface GroupEditModalProps {
  group: CustomerGroup | null
  isOpen: boolean
  onClose: () => void
  onSave: (groupId: string, name: string, description: string) => void
}

export function GroupEditModal({ group, isOpen, onClose, onSave }: GroupEditModalProps) {
  const nameId = useId()
  const descriptionId = useId()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  // Update local state when modal opens with a group
  useEffect(() => {
    if (isOpen && group) {
      setName(group.name)
      setDescription(group.description || "")
    }
  }, [isOpen, group])

  const handleSave = () => {
    if (!group || !name.trim()) return
    onSave(group.id, name, description)
  }

  const handleClose = () => {
    onClose()
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      setName("")
      setDescription("")
    }, 200)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>그룹 정보 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>그룹 이름 *</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="그룹 이름을 입력하세요"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={descriptionId}>그룹 설명</Label>
            <Input
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="그룹 설명을 입력하세요"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
