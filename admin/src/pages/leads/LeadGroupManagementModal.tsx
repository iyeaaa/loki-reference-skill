import { Users } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { Lead } from "@/lib/api/types/lead"

type LeadGroupManagementModalProps = {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  availableGroups: CustomerGroup[]
  currentGroups: CustomerGroup[]
  onSave: (leadId: string, groupsToAdd: string[], groupsToRemove: string[]) => Promise<void>
}

export function LeadGroupManagementModal({
  lead,
  isOpen,
  onClose,
  availableGroups,
  currentGroups,
  onSave,
}: LeadGroupManagementModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize selected groups when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      const currentGroupIds = new Set(currentGroups.map((g) => g.id))
      setSelectedGroups(currentGroupIds)
    }
  }, [isOpen, lead, currentGroups])

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!lead) {
      return
    }

    const currentGroupIds = new Set(currentGroups.map((g) => g.id))
    const groupsToAdd = Array.from(selectedGroups).filter((id) => !currentGroupIds.has(id))
    const groupsToRemove = Array.from(currentGroupIds).filter((id) => !selectedGroups.has(id))

    if (groupsToAdd.length === 0 && groupsToRemove.length === 0) {
      toast.success("변경사항이 없습니다")
      onClose()
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(lead.id, groupsToAdd, groupsToRemove)
      onClose()
    } catch (error) {
      console.error("Failed to update lead groups:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!lead) {
    return null
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>리드 그룹 관리</DialogTitle>
          <div className="mt-2 text-muted-foreground text-sm">
            {lead.companyName || lead.foundCompanyName}
          </div>
        </DialogHeader>
        <div className="py-4">
          {availableGroups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>사용 가능한 그룹이 없습니다</p>
            </div>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {availableGroups.map((group) => {
                const isSelected = selectedGroups.has(group.id)
                const wasPreviouslyInGroup = currentGroups.some((g) => g.id === group.id)

                return (
                  <div
                    className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
                    key={group.id}
                  >
                    <Checkbox
                      checked={isSelected}
                      id={`group-${group.id}`}
                      onCheckedChange={() => handleToggleGroup(group.id)}
                    />
                    <Label
                      className="flex flex-1 cursor-pointer items-center justify-between"
                      htmlFor={`group-${group.id}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          {group.name}
                          {wasPreviouslyInGroup && (
                            <Badge className="text-xs" variant="secondary">
                              현재 속함
                            </Badge>
                          )}
                        </div>
                        {group.description && (
                          <div className="text-muted-foreground text-sm">{group.description}</div>
                        )}
                      </div>
                      {group.leadCount !== undefined && (
                        <Badge className="ml-2" variant="outline">
                          {group.leadCount}
                        </Badge>
                      )}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={isSubmitting} onClick={onClose} variant="outline">
            취소
          </Button>
          <Button disabled={isSubmitting} onClick={handleSave}>
            {isSubmitting ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
