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

interface EmailRepliesBulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: string, value: string) => void
  emailCount: number
  actionType: "read_status" | null
}

export function EmailRepliesBulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  emailCount,
  actionType,
}: EmailRepliesBulkActionModalProps) {
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
      case "read_status":
        return "읽음 상태 일괄 변경"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "read_status":
        return `선택된 ${emailCount}개의 이메일 읽음 상태를 변경합니다.`
      default:
        return ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {actionType === "read_status" && (
            <div className="space-y-2">
              <Label>변경할 상태</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">읽음</SelectItem>
                  <SelectItem value="unread">읽지 않음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedValue}>
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
