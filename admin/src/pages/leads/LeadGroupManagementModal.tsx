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

interface LeadGroupManagementModalProps {
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
    if (!lead) return

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

  if (!lead) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>리드 그룹 관리</DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            {lead.companyName || lead.foundCompanyName}
          </div>
        </DialogHeader>
        <div className="py-4">
          {availableGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>사용 가능한 그룹이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableGroups.map((group) => {
                const isSelected = selectedGroups.has(group.id)
                const wasPreviouslyInGroup = currentGroups.some((g) => g.id === group.id)

                return (
                  <div
                    key={group.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleToggleGroup(group.id)}
                    />
                    <Label
                      htmlFor={`group-${group.id}`}
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {group.name}
                          {wasPreviouslyInGroup && (
                            <Badge variant="secondary" className="text-xs">
                              현재 속함
                            </Badge>
                          )}
                        </div>
                        {group.description && (
                          <div className="text-sm text-muted-foreground">{group.description}</div>
                        )}
                      </div>
                      {group.leadCount !== undefined && (
                        <Badge variant="outline" className="ml-2">
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
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
