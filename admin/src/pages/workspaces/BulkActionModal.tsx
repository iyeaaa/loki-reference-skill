import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type BulkActionModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: string, value: string | string[]) => void
  workspaceCount: number
  actionType: "status" | null
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  workspaceCount,
  actionType,
}: BulkActionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>("")

  const handleConfirm = () => {
    if (selectedValue && actionType) {
      onConfirm(actionType, selectedValue)
      setSelectedValue("")
      onClose()
    }
  }

  const getTitle = () => {
    switch (actionType) {
      case "status":
        return "워크스페이스 상태 일괄 변경"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "status":
        return `선택된 ${workspaceCount}개의 워크스페이스 상태를 변경합니다.`
      default:
        return ""
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {actionType === "status" && (
            <div className="space-y-2">
              <Label>변경할 상태</Label>
              <Select onValueChange={setSelectedValue} value={selectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            취소
          </Button>
          <Button disabled={!selectedValue} onClick={handleConfirm}>
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
