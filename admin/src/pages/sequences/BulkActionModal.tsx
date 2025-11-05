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

interface BulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: string, value: string | string[]) => void
  sequenceCount: number
  actionType: "status" | "delete" | null
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  sequenceCount,
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
        return "시퀀스 상태 일괄 변경"
      case "delete":
        return "시퀀스 일괄 삭제"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "status":
        return `선택된 ${sequenceCount}개의 시퀀스 상태를 변경합니다.`
      case "delete":
        return `선택된 ${sequenceCount}개의 시퀀스를 삭제합니다. 이 작업은 취소할 수 없습니다.`
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
          {actionType === "status" && (
            <div className="space-y-2">
              <Label>변경할 상태</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">초안</SelectItem>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="paused">일시정지</SelectItem>
                  <SelectItem value="archived">보관됨</SelectItem>
                  <SelectItem value="no_response">답변 없음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={actionType === "status" && !selectedValue}
            variant={actionType === "delete" ? "destructive" : "default"}
          >
            {actionType === "delete" ? "삭제" : "변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
