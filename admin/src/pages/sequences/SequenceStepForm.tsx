import { ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { TimePicker } from "@/components/ui/time-picker"
import type { SequenceStep } from "@/lib/api/types/sequence"
import { markdownToHtml } from "@/lib/utils/markdown"

interface SequenceStepFormProps {
  step?: SequenceStep
  stepOrder: number
  onSave: (stepData: {
    stepOrder: number
    delayDays: number
    scheduledHour?: number
    scheduledMinute?: number
    timezone?: string
    emailSubject: string
    emailBodyText?: string
    emailBodyHtml?: string
  }) => void
  onCancel: () => void
}

export function SequenceStepForm({ step, stepOrder, onSave, onCancel }: SequenceStepFormProps) {
  const subjectId = useId()
  const delayDaysId = useId()
  const bodyTextId = useId()

  const [formData, setFormData] = useState({
    stepOrder: step?.stepOrder ?? stepOrder,
    delayDays: step?.delayDays ?? 0,
    scheduledHour: step?.scheduledHour ?? 9,
    scheduledMinute: step?.scheduledMinute ?? 0,
    timezone: step?.timezone ?? "Asia/Seoul",
    emailSubject: step?.emailSubject || "",
    emailBodyText: step?.emailBodyText || "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Markdown을 HTML로 변환
    const emailBodyHtml = formData.emailBodyText
      ? markdownToHtml(formData.emailBodyText)
      : undefined

    onSave({
      ...formData,
      emailBodyHtml,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 스텝 순서 표시 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">스텝 순서:</span>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {formData.stepOrder}
        </span>
      </div>

      {/* 발송 스케줄 섹션 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <h3 className="text-sm font-semibold">발송 스케줄</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={delayDaysId}>
              대기 일수 <span className="text-red-500">*</span>
            </Label>
            <Input
              id={delayDaysId}
              type="number"
              min="0"
              value={formData.delayDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  delayDays: parseInt(e.target.value, 10) || 0,
                })
              }
              required
              placeholder="0"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">이전 이메일 발송 후 며칠 뒤</p>
          </div>

          <div className="space-y-2">
            <Label className="mb-3 inline-block">
              발송 시각 (KST) <span className="text-red-500">*</span>
            </Label>
            <TimePicker
              value={{ hour: formData.scheduledHour, minute: formData.scheduledMinute }}
              onChange={(time) =>
                setFormData({
                  ...formData,
                  scheduledHour: time.hour,
                  scheduledMinute: time.minute,
                })
              }
            />
          </div>
        </div>

        {/* 발송 예정 미리보기 */}
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
          <p className="text-sm font-medium text-primary">
            📅 발송 예정: 이전 이메일 + {formData.delayDays}일 후{" "}
            {formData.scheduledHour.toString().padStart(2, "0")}:
            {formData.scheduledMinute.toString().padStart(2, "0")}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={subjectId}>
          이메일 제목 <span className="text-red-500">*</span>
        </Label>
        <Input
          id={subjectId}
          value={formData.emailSubject}
          onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
          required
          maxLength={500}
          placeholder="예: K-Beauty Partnership Opportunity with {{company_name}}"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={bodyTextId}>이메일 본문</Label>
        <RichTextEditor
          value={formData.emailBodyText || ""}
          onChange={(value) => setFormData({ ...formData, emailBodyText: value })}
          placeholder={`Dear {{company_name}} team,

I hope this email finds you well. I am reaching out from a Korean beauty company specializing in innovative skincare and cosmetics products.

We noticed your business in {{city}}, {{country}} and believe there could be a great partnership opportunity. Our K-Beauty products are currently exported to over 30 countries and have received excellent feedback from international buyers.

Would you be interested in exploring a distribution partnership? We offer:
• Competitive pricing for wholesale buyers
• High-quality Korean beauty products with proven results
• Full marketing and product training support
• Flexible MOQ (Minimum Order Quantity)

I would love to schedule a brief call to discuss how we can work together.

Best regards,
[Your Name]
[Your Company]`}
          height="300px"
        />
        <Collapsible className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
            사용 가능한 변수 보기
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">회사 정보:</p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{회사명}}"}</li>
                    <li>{"{{웹사이트}}"}</li>
                    <li>{"{{업종}}"}</li>
                    <li>{"{{설명}}"}</li>
                    <li>{"{{직원수}}"}</li>
                    <li>{"{{설립연도}}"}</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">위치 정보:</p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{국가}}"}</li>
                    <li>{"{{도시}}"}</li>
                    <li>{"{{주/도}}"}</li>
                    <li>{"{{주소}}"}</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">연락처:</p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{담당자명}}"}</li>
                    <li>{"{{이메일}}"}</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">리드 관리:</p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{리드소스}}"}</li>
                    <li>{"{{리드상태}}"}</li>
                    <li>{"{{리드점수}}"}</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {step ? "수정 완료" : "스텝 추가"}
        </Button>
      </div>
    </form>
  )
}
