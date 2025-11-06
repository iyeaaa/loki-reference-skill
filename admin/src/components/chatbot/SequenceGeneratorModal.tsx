import { Loader2, Sparkles } from "lucide-react"
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
}

export function SequenceGeneratorModal({
  open,
  onOpenChange,
  workspaceId,
  onSubmit,
}: SequenceGeneratorModalProps) {
  const customerGroupId = useId()
  const promptId = useId()
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [prompt, setPrompt] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: customerGroups, isLoading: isLoadingGroups } = useCustomerGroupsByWorkspace(
    workspaceId,
    open,
  )

  const handleSubmit = async () => {
    if (!selectedGroupId || !prompt.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        customerGroupId: selectedGroupId,
        prompt: prompt.trim(),
      })
      // Reset form and close modal
      setSelectedGroupId("")
      setPrompt("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to submit sequence generation:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            시퀀스 자동 생성
          </DialogTitle>
          <DialogDescription>
            고객 그룹을 선택하고 요구사항을 입력하면 AI가 자동으로 시퀀스를 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Group Selection */}
          <div className="space-y-2">
            <Label htmlFor={customerGroupId}>고객 그룹</Label>
            {isLoadingGroups ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                고객 그룹 불러오는 중...
              </div>
            ) : (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger id={customerGroupId}>
                  <SelectValue placeholder="고객 그룹을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                      {group.leadCount !== undefined && ` (${group.leadCount}명)`}
                    </SelectItem>
                  ))}
                  {(!customerGroups || customerGroups.length === 0) && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      생성된 고객 그룹이 없습니다
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor={promptId}>요구사항</Label>
            <Textarea
              id={promptId}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: B2B SaaS 기업을 위한 5단계 육성 시퀀스를 만들어줘. 첫 이메일은 회사 소개, 이후에는 제품 소개와 케이스 스터디를 포함해줘."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              생성하고 싶은 시퀀스의 목적, 단계, 내용 등을 자세히 설명해주세요.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedGroupId || !prompt.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                생성하기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
