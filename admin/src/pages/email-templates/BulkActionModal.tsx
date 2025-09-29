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
import { Input } from "@/components/ui/input"
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
  templateCount: number
  actionType: "category" | "shared" | null
  workspaces?: Array<{ id: string; name: string }>
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  templateCount,
  actionType,
  // workspaces = [],
}: BulkActionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>("")
  const [customCategory, setCustomCategory] = useState<string>("")

  const handleConfirm = () => {
    if (actionType === "category") {
      const categoryValue = customCategory || selectedValue
      if (categoryValue) {
        onConfirm(actionType, categoryValue)
        setSelectedValue("")
        setCustomCategory("")
        onClose()
      }
    } else if (selectedValue && actionType) {
      onConfirm(actionType, selectedValue)
      setSelectedValue("")
      onClose()
    }
  }

  const getTitle = () => {
    switch (actionType) {
      case "category":
        return "템플릿 카테고리 일괄 변경"
      case "shared":
        return "템플릿 공유 상태 일괄 변경"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "category":
        return `선택된 ${templateCount}개의 템플릿 카테고리를 변경합니다.`
      case "shared":
        return `선택된 ${templateCount}개의 템플릿 공유 상태를 변경합니다.`
      default:
        return ""
    }
  }

  // Predefined category options
  const categoryOptions = [
    { value: "welcome", label: "환영" },
    { value: "promotion", label: "프로모션" },
    { value: "transaction", label: "거래" },
    { value: "notification", label: "알림" },
    { value: "newsletter", label: "뉴스레터" },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {actionType === "category" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>미리 정의된 카테고리</Label>
                <Select
                  value={selectedValue}
                  onValueChange={(value) => {
                    setSelectedValue(value)
                    setCustomCategory("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">또는</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>커스텀 카테고리</Label>
                <Input
                  placeholder="새 카테고리 입력..."
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value)
                    setSelectedValue("")
                  }}
                />
              </div>
            </div>
          )}

          {actionType === "shared" && (
            <div className="space-y-2">
              <Label>변경할 공유 상태</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="공유 상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">공유됨</SelectItem>
                  <SelectItem value="false">비공개</SelectItem>
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
            disabled={
              actionType === "category" ? !selectedValue && !customCategory : !selectedValue
            }
          >
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
