import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
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

interface SequenceGeneratorModalProps {
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
    if (!selectedGroupId || !prompt.trim()) return

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-Generate Sequence
          </DialogTitle>
          <DialogDescription>
            Select a customer group and describe your requirements. AI will automatically generate a
            sequence for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Group Selection */}
          <div className="space-y-2">
            <Label htmlFor={customerGroupIdHtmlId}>Customer Group</Label>
            {isLoadingGroups ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading customer groups...
              </div>
            ) : (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger id={customerGroupIdHtmlId}>
                  <SelectValue placeholder="Select a customer group" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                      {group.leadCount !== undefined && ` (${group.leadCount} leads)`}
                    </SelectItem>
                  ))}
                  {(!customerGroups || customerGroups.length === 0) && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No customer groups available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor={promptId}>Requirements</Label>
            <Textarea
              id={promptId}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create a 5-step nurturing sequence for B2B SaaS companies. Start with company introduction, then include product demos and case studies in follow-ups."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Describe the purpose, steps, and content of the sequence you want to create.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedGroupId || !prompt.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
