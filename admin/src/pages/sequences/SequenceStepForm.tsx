import { ChevronDown, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Textarea } from "@/components/ui/textarea"
import { TimePicker } from "@/components/ui/time-picker"
import { leadsApi } from "@/lib/api/services/leads"
import { sequencesApi } from "@/lib/api/services/sequences"
import type { SequenceStep } from "@/lib/api/types/sequence"
import { useAuth } from "@/lib/auth-provider"
import { generateSignatureHtml } from "@/lib/utils/email-signature"
import { markdownToHtml } from "@/lib/utils/markdown"

// HTML을 Markdown으로 변환하는 유틸리티 함수
const htmlToMarkdown = (html: string): string => {
  if (!html) return ""

  const markdown = html
    // 코드 블록 마커 제거 (```html, ``` 등)
    .replace(/```html\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/^html\s*/gim, "")

    // 불필요한 메타데이터 제거
    .replace(/^Email\s*Template\s*/gim, "")
    .replace(/^Email\s*/gim, "")
    .replace(/^Sales\s*Email\s*/gim, "")
    .replace(/^\*\*\s*/gm, "")
    .replace(/^\*\s*/gm, "")
    .replace(/^Email\s*Template\s*$/gim, "")
    .replace(/^Email\s*$/gim, "")
    .replace(/^Sales\s*Email\s*$/gim, "")
    .replace(/^\*\*\s*$/gm, "")
    .replace(/^\*\s*$/gm, "")

    // HTML 엔티티 디코딩
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")

    // 줄바꿈 처리
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")

    // 리스트 처리
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")

    // 강조 처리
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<b[^>]*>/gi, "**")
    .replace(/<\/b>/gi, "**")
    .replace(/<em[^>]*>/gi, "*")
    .replace(/<\/em>/gi, "*")
    .replace(/<i[^>]*>/gi, "*")
    .replace(/<\/i>/gi, "*")

    // 링크 처리
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")

    // 나머지 HTML 태그 제거
    .replace(/<[^>]*>/g, "")

    // 연속된 공백과 줄바꿈 정리 (3개 이상의 연속 줄바꿈만 2개로 줄임)
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()

  // 추가 정리: 빈 줄과 불필요한 텍스트 제거
  const lines = markdown.split("\n")
  const cleanedLines = lines
    .filter((line) => {
      const trimmed = line.trim()
      // 빈 줄이거나 불필요한 메타데이터가 아닌 경우만 유지
      return (
        trimmed !== "" &&
        !trimmed.match(/^(Email\s*Template|Email|Sales\s*Email|\*\*|\*)$/i) &&
        !trimmed.match(/^Feel\s+free\s+to\s+replace/i) &&
        !trimmed.match(/^to\s+personalize\s+your\s+email/i)
      )
    })
    .map((line) => line.trim())

  return cleanedLines.join("\n").trim()
}

interface SequenceStepFormProps {
  step?: SequenceStep
  stepOrder: number
  workspaceId?: string
  customerGroupId?: string
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

export function SequenceStepForm({
  step,
  stepOrder,
  workspaceId,
  customerGroupId,
  onSave,
  onCancel,
}: SequenceStepFormProps) {
  const { user } = useAuth()
  const subjectId = useId()
  const delayDaysId = useId()
  const bodyTextId = useId()
  const promptId = useId()

  // 사용자 정보를 기반으로 서명 생성
  const generateUserSignature = () => {
    if (user) {
      const name = user.name || user.username || "사용자"
      const title = user.department_name || "직원"
      return generateSignatureHtml({ name, title })
    }
    return generateSignatureHtml() // 기본값 사용
  }

  const [formData, setFormData] = useState({
    stepOrder: step?.stepOrder ?? stepOrder,
    delayDays: step?.delayDays ?? 0,
    scheduledHour: step?.scheduledHour ?? new Date().getHours(),
    scheduledMinute: step?.scheduledMinute ?? new Date().getMinutes(),
    timezone: step?.timezone ?? "Asia/Seoul",
    emailSubject: step?.emailSubject || "",
    emailBodyText: step?.emailBodyText || `\n\n${generateUserSignature()}`,
  })

  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [targetCountry, setTargetCountry] = useState<string>("")
  const [isLoadingCountry, setIsLoadingCountry] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 고객 그룹의 리드에서 country 가져오기
  useEffect(() => {
    if (customerGroupId && showAIGenerator) {
      setIsLoadingCountry(true)
      leadsApi
        .list({ customerGroupId, limit: 1 })
        .then((response) => {
          if (response.leads.length > 0 && response.leads[0]?.country) {
            setTargetCountry(response.leads[0].country)
          } else {
            setTargetCountry("")
            toast.info("고객 그룹에 국가 정보가 있는 리드가 없습니다.")
          }
        })
        .catch((error) => {
          console.error("리드 조회 실패:", error)
          toast.error("리드 정보를 가져오는데 실패했습니다.")
        })
        .finally(() => {
          setIsLoadingCountry(false)
        })
    }
  }, [customerGroupId, showAIGenerator])

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

  useEffect(() => {
    if (formData.delayDays === 0) {
      return
    }
    setFormData((prev) => ({
      ...prev,
      scheduledHour: 0,
      scheduledMinute: 0,
    }))
  }, [formData.delayDays])

  const handleGenerateWithAI = async () => {
    if (!workspaceId) {
      toast.error("워크스페이스 정보가 없습니다.")
      return
    }

    if (!customerGroupId) {
      toast.error("시퀀스에 고객 그룹이 설정되어 있지 않습니다.")
      return
    }

    if (!targetCountry) {
      toast.error("고객 그룹에 국가 정보가 있는 리드가 없습니다.")
      return
    }

    if (!aiPrompt.trim()) {
      toast.error("이메일 내용 요청사항을 입력해주세요.")
      return
    }

    if (aiPrompt.trim().length < 10) {
      toast.error("이메일 내용 요청사항을 10자 이상 입력해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      const result = await sequencesApi.generateTemplate({
        workspaceId,
        country: targetCountry,
        prompt: aiPrompt,
      })

      setFormData({
        ...formData,
        emailSubject: result.emailSubject,
        emailBodyText: `${htmlToMarkdown(result.emailBodyText)}\n\n${generateUserSignature()}`,
      })

      toast.success(`이메일 템플릿이 생성되었습니다! (언어: ${result.detectedLanguage || "auto"})`)
      setShowAIGenerator(false)
    } catch (error) {
      console.error("AI 템플릿 생성 실패:", error)
      toast.error(error instanceof Error ? error.message : "템플릿 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
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
              value={{
                hour: Number.isInteger(formData.scheduledHour) ? formData.scheduledHour : 9,
                minute: Number.isInteger(formData.scheduledMinute) ? formData.scheduledMinute : 0,
              }}
              onChange={(time) => {
                console.log("TimePicker onChange:", time)
                setFormData({
                  ...formData,
                  scheduledHour: time.hour,
                  scheduledMinute: time.minute,
                })
              }}
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

      {/* AI 생성 섹션 */}
      {workspaceId && customerGroupId && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI 이메일 템플릿 생성
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAIGenerator(!showAIGenerator)}
            >
              {showAIGenerator ? "닫기" : "열기"}
            </Button>
          </div>

          {showAIGenerator && (
            <div className="space-y-3 pt-2 border-t">
              {/* 타겟 국가 표시 */}
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm font-medium text-primary">
                  {isLoadingCountry
                    ? "🔄 국가 정보 조회 중..."
                    : targetCountry
                      ? `🌍 타겟 국가: ${targetCountry}`
                      : "⚠️ 고객 그룹에 국가 정보가 없습니다."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  고객 그룹의 리드에서 자동으로 국가를 감지합니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={promptId}>
                  이메일 내용 요청사항 <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id={promptId}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="예: K-뷰티 제품의 글로벌 유통 파트너십을 제안하는 이메일을 작성해주세요. 우리 제품의 강점과 파트너십 혜택을 강조해주세요."
                  className="bg-background min-h-[100px]"
                />
              </div>

              <Button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !aiPrompt.trim() || aiPrompt.trim().length < 10}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? "생성 중..." : "AI로 템플릿 생성"}
              </Button>
            </div>
          )}
        </div>
      )}

      {workspaceId && !customerGroupId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            💡 AI 이메일 생성을 사용하려면 시퀀스에 고객 그룹을 먼저 설정해주세요.
          </p>
        </div>
      )}

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
          placeholder={`\n\n--\n${generateUserSignature()}`}
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
