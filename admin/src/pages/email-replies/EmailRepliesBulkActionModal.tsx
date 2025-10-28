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
      case "read_status":
        return t("email-replies.bulkModal.title.readStatus")
      default:
        return t("email-replies.bulkModal.title.default")
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "read_status":
        return t("email-replies.bulkModal.description.readStatus", { count: emailCount })
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
              <Label>{t("email-replies.bulkModal.label.status")}</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("email-replies.bulkModal.placeholder.selectStatus")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">{t("email-replies.bulkModal.option.read")}</SelectItem>
                  <SelectItem value="unread">
                    {t("email-replies.bulkModal.option.unread")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("email-replies.bulkModal.button.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedValue}>
            {t("email-replies.bulkModal.button.change")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
