import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: string) => void
  customerGroupCount: number
  actionType: "delete" | null
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  customerGroupCount,
  actionType,
}: BulkActionModalProps) {
  const handleConfirm = () => {
    if (actionType) {
      onConfirm(actionType)
      onClose()
    }
  }

  const getTitle = () => {
    switch (actionType) {
      case "delete":
        return "고객 그룹 일괄 삭제"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "delete":
        return `선택된 ${customerGroupCount}개의 고객 그룹을 삭제합니다. 이 작업은 취소할 수 없습니다.`
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} variant="destructive">
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
