import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { LeadStatus } from "@/lib/api/types/lead"

interface BulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (actionType: string, value: string | string[]) => void
  leadCount: number
  actionType: "status" | "businessType" | "copyToGroup" | null
  customerGroups?: CustomerGroup[]
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  leadCount,
  actionType,
  customerGroups = [],
}: BulkActionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>("")
  const statusSelectId = useId()
  const businessTypeInputId = useId()
  const groupSelectId = useId()

  const handleConfirm = () => {
    if (!actionType || !selectedValue) return

    onConfirm(actionType, selectedValue)
    setSelectedValue("")
    onClose()
  }

  const handleClose = () => {
    setSelectedValue("")
    onClose()
  }

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "new", label: "신규" },
    { value: "contacted", label: "연락됨" },
    { value: "qualified", label: "적격" },
    { value: "unqualified", label: "부적격" },
    { value: "converted", label: "전환됨" },
    { value: "lost", label: "실패" },
    { value: "unsubscribed", label: "구독취소" },
  ]

  const getTitle = () => {
    switch (actionType) {
      case "status":
        return "리드 상태 일괄 변경"
      case "businessType":
        return "업종 일괄 변경"
      case "copyToGroup":
        return "고객 그룹에 복사"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "copyToGroup":
        return `선택한 ${leadCount}개의 리드를 다른 고객 그룹에 복사합니다. 기존 그룹 소속은 유지됩니다.`
      default:
        return `선택한 ${leadCount}개의 리드에 대해 작업을 수행합니다.`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {actionType === "status" && (
            <div className="space-y-2">
              <Label htmlFor={statusSelectId}>상태 선택</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger id={statusSelectId}>
                  <SelectValue placeholder="상태를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "businessType" && (
            <div className="space-y-2">
              <Label htmlFor={businessTypeInputId}>업종</Label>
              <Input
                id={businessTypeInputId}
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                placeholder="업종을 입력하세요 (예: IT, 제조업, 서비스업)"
              />
            </div>
          )}

          {actionType === "copyToGroup" && (
            <div className="space-y-2">
              <Label htmlFor={groupSelectId}>대상 고객 그룹</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger id={groupSelectId}>
                  <SelectValue placeholder="그룹을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups.length === 0 ? (
                    <SelectItem disabled value="none">
                      사용 가능한 그룹이 없습니다
                    </SelectItem>
                  ) : (
                    customerGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.leadCount || 0}개 리드)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                💡 선택한 리드들이 해당 그룹에 추가됩니다 (기존 그룹 소속 유지)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedValue}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
