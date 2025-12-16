import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
        return t("sequences.bulkAction.changeStatus")
      case "delete":
        return t("sequences.bulkAction.deleteSequences")
      default:
        return t("sequences.bulkAction.bulkOperation")
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "status":
        return t("sequences.bulkAction.changeStatusDesc", { count: sequenceCount })
      case "delete":
        return t("sequences.bulkAction.deleteSequencesDesc", { count: sequenceCount })
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
              <Label>{t("sequences.bulkAction.statusToChange")}</Label>
              <Select onValueChange={setSelectedValue} value={selectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder={t("sequences.bulkAction.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("sequences.bulkAction.status.draft")}</SelectItem>
                  <SelectItem value="active">{t("sequences.bulkAction.status.active")}</SelectItem>
                  <SelectItem value="paused">{t("sequences.bulkAction.status.paused")}</SelectItem>
                  <SelectItem value="archived">
                    {t("sequences.bulkAction.status.archived")}
                  </SelectItem>
                  <SelectItem value="no_response">
                    {t("sequences.bulkAction.status.noResponse")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {t("sequences.bulkAction.cancel")}
          </Button>
          <Button
            disabled={actionType === "status" && !selectedValue}
            onClick={handleConfirm}
            variant={actionType === "delete" ? "destructive" : "default"}
          >
            {actionType === "delete"
              ? t("sequences.bulkAction.delete")
              : t("sequences.bulkAction.change")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
