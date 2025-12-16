import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { useCustomerGroupsByWorkspace } from "@/lib/api/hooks/customer-groups"

type SequenceGeneratorModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSubmit: (data: { customerGroupId: string; prompt: string }) => void
  defaultCustomerGroupId?: string
}

export function SequenceGeneratorModal({
  open,
  onOpenChange,
  workspaceId,
  onSubmit,
  defaultCustomerGroupId,
}: SequenceGeneratorModalProps) {
  const { t } = useTranslation()
  const customerGroupIdHtmlId = useId()
  const promptId = useId()
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [prompt, setPrompt] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: customerGroups, isLoading: isLoadingGroups } = useCustomerGroupsByWorkspace(
    workspaceId,
    open,
  )

  // Auto-select default customer group when modal opens
  useEffect(() => {
    if (open && defaultCustomerGroupId && customerGroups) {
      // Verify the group exists in the list
      const groupExists = customerGroups.some((g) => g.id === defaultCustomerGroupId)
      if (groupExists) {
        setSelectedGroupId(defaultCustomerGroupId)
      }
    }
  }, [open, defaultCustomerGroupId, customerGroups])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedGroupId("")
      setPrompt("")
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!(selectedGroupId && prompt.trim())) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        customerGroupId: selectedGroupId,
        prompt: prompt.trim(),
      })
      // Close modal - form will be reset by useEffect
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to submit sequence generation:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("chatbot.modal.autoGenerate.title")}
          </DialogTitle>
          <DialogDescription>{t("chatbot.modal.autoGenerate.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Group Selection */}
          <div className="space-y-2">
            <Label htmlFor={customerGroupIdHtmlId}>{t("chatbot.modal.customerGroup")}</Label>
            {isLoadingGroups ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("chatbot.modal.loadingGroups")}
              </div>
            ) : (
              <Select onValueChange={setSelectedGroupId} value={selectedGroupId}>
                <SelectTrigger id={customerGroupIdHtmlId}>
                  <SelectValue placeholder={t("chatbot.modal.selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                      {group.leadCount !== undefined &&
                        ` (${group.leadCount} ${t("chatbot.modal.leads")})`}
                    </SelectItem>
                  ))}
                  {(!customerGroups || customerGroups.length === 0) && (
                    <div className="px-2 py-3 text-center text-muted-foreground text-sm">
                      {t("chatbot.modal.noGroups")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor={promptId}>{t("chatbot.modal.requirementsLabel")}</Label>
            <Textarea
              className="min-h-[120px] resize-none"
              id={promptId}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("chatbot.modal.requirementsPlaceholder")}
              value={prompt}
            />
            <p className="text-muted-foreground text-xs">{t("chatbot.modal.requirementsHelp")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} variant="outline">
            {t("chatbot.button.cancel")}
          </Button>
          <Button
            disabled={!(selectedGroupId && prompt.trim()) || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("chatbot.modal.generating")}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("chatbot.modal.generate")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
