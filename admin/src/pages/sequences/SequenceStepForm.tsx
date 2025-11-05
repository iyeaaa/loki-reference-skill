import { ChevronDown, Mail, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TimePicker } from "@/components/ui/time-picker"
import { useDefaultEmailSignature } from "@/lib/api/hooks/email-signatures"
import { leadsApi } from "@/lib/api/services/leads"
import { sequencesApi } from "@/lib/api/services/sequences"
import type { SequenceStep, StepConditionType } from "@/lib/api/types/sequence"
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
    conditionType?: StepConditionType
    conditionConfig?: string
    previousStepId?: string
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
  const { t } = useTranslation()
  const { user } = useAuth()
  const subjectId = useId()
  const delayDaysId = useId()
  const bodyTextId = useId()
  const promptId = useId()
  const targetCountryId = useId()

  // Get default signature from database
  const { data: defaultSignature } = useDefaultEmailSignature(
    {
      workspaceId: workspaceId || "",
      userId: user?.id || "",
    },
    !!workspaceId && !!user?.id,
  )

  // 사용자 서명 가져오기
  const getUserSignature = () => {
    // DB에서 가져온 기본 서명이 있으면 사용
    if (defaultSignature) {
      return defaultSignature.signatureHtml
    }
    // 없으면 하드코딩된 기본 서명 사용 (폴백)
    if (user) {
      const name = user.name || user.username || "사용자"
      const title = user.department_name || "직원"
      return generateSignatureHtml({ name, title })
    }
    return generateSignatureHtml()
  }

  const [formData, setFormData] = useState({
    stepOrder: step?.stepOrder ?? stepOrder,
    delayDays: step?.delayDays ?? 0,
    scheduledHour: step?.scheduledHour ?? new Date().getHours(),
    scheduledMinute: step?.scheduledMinute ?? new Date().getMinutes(),
    timezone: step?.timezone ?? "Asia/Seoul",
    emailSubject: step?.emailSubject || "",
    emailBodyText: step?.emailBodyText || "",
    conditionType:
      step?.conditionType ?? ((stepOrder === 1 ? "always" : "no_response") as StepConditionType),
    conditionConfig: step?.conditionConfig || "",
    previousStepId: step?.previousStepId || "",
  })

  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [targetCountry, setTargetCountry] = useState<string>("")
  const [isLoadingCountry, setIsLoadingCountry] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 서명 편집 모달 상태
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)

  // DB에서 서명이 로드되면 초기 서명 설정 (새 스텝 생성 시에만)
  useEffect(() => {
    if (!step && !formData.emailBodyText && defaultSignature) {
      const signature = defaultSignature.signatureHtml
      setFormData((prev) => ({
        ...prev,
        emailBodyText: `\n\n${signature}`,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSignature, step, formData.emailBodyText])

  // 고객 그룹의 리드에서 country 가져오기
  useEffect(() => {
    if (customerGroupId && showAIGenerator) {
      setIsLoadingCountry(true)
      leadsApi
        .list({ customerGroupId, limit: 1000 })
        .then((response) => {
          // 모든 리드에서 country 수집 (중복 제거)
          const countries = new Set<string>()
          for (const lead of response.leads) {
            if (lead.country?.trim()) {
              countries.add(lead.country.trim())
            }
          }

          if (countries.size > 0) {
            // comma로 구분하여 저장
            setTargetCountry(Array.from(countries).join(","))
          } else {
            setTargetCountry("")
            toast.warning(t("sequences.stepForm.toast.noCountryInfo"))
          }
        })
        .catch((error) => {
          console.error("리드 조회 실패:", error)
          toast.error(t("sequences.stepForm.error.customerGroupRequired"))
        })
        .finally(() => {
          setIsLoadingCountry(false)
        })
    }
  }, [customerGroupId, showAIGenerator, t])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.stepOrder > 1 && !formData.conditionType) {
      toast.error("Step 2 이상에서는 발송 조건을 선택해야 합니다.")
      return
    }

    // Markdown을 HTML로 변환
    const emailBodyHtml = formData.emailBodyText
      ? markdownToHtml(formData.emailBodyText)
      : undefined

    onSave({
      ...formData,
      emailBodyHtml,
      conditionType: formData.stepOrder === 1 ? "always" : formData.conditionType,
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
      toast.error(t("sequences.stepForm.error.workspaceRequired"))
      return
    }

    if (!customerGroupId) {
      toast.error(t("sequences.stepForm.error.customerGroupRequired"))
      return
    }

    if (!targetCountry?.trim()) {
      toast.error(t("sequences.stepForm.error.targetCountryRequired"))
      return
    }

    if (!aiPrompt.trim()) {
      toast.error(t("sequences.stepForm.error.promptRequired"))
      return
    }

    if (aiPrompt.trim().length < 10) {
      toast.error(t("sequences.stepForm.error.promptTooShort"))
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
        emailBodyText: `${htmlToMarkdown(result.emailBodyText)}\n\n${getUserSignature()}`,
      })

      toast.success(
        t("sequences.stepForm.success.templateGenerated", {
          language: result.detectedLanguage || "auto",
        }),
      )
      setShowAIGenerator(false)
    } catch (error) {
      console.error("AI 템플릿 생성 실패:", error)
      toast.error(error instanceof Error ? error.message : "템플릿 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  // 서명 저장
  const handleSaveSignature = (signature: string) => {
    // 기존 본문에서 서명 부분을 제거하고 새 서명 추가
    let bodyWithoutSignature = formData.emailBodyText || ""

    // 기존 서명 패턴 제거 (여러 가능한 구분자)
    const signatureSeparators = [
      /\n\n--\n[\s\S]*$/,
      /\n\n---\n[\s\S]*$/,
      /<div dir="ltr">[\s\S]*<\/div>\s*$/,
    ]

    for (const separator of signatureSeparators) {
      bodyWithoutSignature = bodyWithoutSignature.replace(separator, "")
    }

    setFormData({
      ...formData,
      emailBodyText: `${bodyWithoutSignature.trim()}\n\n${signature}`,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 스텝 순서 표시 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("sequences.stepForm.stepOrder")}
        </span>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {formData.stepOrder}
        </span>
      </div>

      {formData.stepOrder > 1 && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-semibold">{t("sequence.step.sendCondition")}</h3>

          <div className="space-y-2">
            <Label htmlFor="conditionType">
              {t("sequence.step.sendConditionLabel")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.conditionType}
              onValueChange={(value: StepConditionType) =>
                setFormData({
                  ...formData,
                  conditionType: value,
                })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("sequence.step.sendConditionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">{t("sequence.step.condition.always")}</SelectItem>
                <SelectItem value="no_response">
                  {t("sequence.step.condition.noResponse")}
                </SelectItem>
                <SelectItem value="negative_response">
                  {t("sequence.step.condition.negativeResponse")}
                </SelectItem>
                <SelectItem value="positive_response">
                  {t("sequence.step.condition.positiveResponse")}
                </SelectItem>
                <SelectItem value="custom">{t("sequence.step.condition.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 발송 스케줄 섹션 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <h3 className="text-sm font-semibold">{t("sequences.stepForm.scheduleTitle")}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={delayDaysId}>
              {t("sequences.stepForm.delayDaysLabel")} <span className="text-red-500">*</span>
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
            <p className="text-xs text-muted-foreground">
              {t("sequences.stepForm.delayDaysHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="mb-3 inline-block">
              {t("sequences.stepForm.sendTimeLabel")} <span className="text-red-500">*</span>
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
            {t("sequences.stepForm.schedulePreview", {
              days: formData.delayDays,
              time: `${formData.scheduledHour.toString().padStart(2, "0")}:${formData.scheduledMinute.toString().padStart(2, "0")}`,
            })}
          </p>
        </div>
      </div>

      {/* AI 생성 섹션 */}
      {workspaceId && customerGroupId && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("sequences.stepForm.aiGeneratorTitle")}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAIGenerator(!showAIGenerator)}
            >
              {showAIGenerator
                ? t("sequences.stepForm.aiGeneratorClose")
                : t("sequences.stepForm.aiGeneratorOpen")}
            </Button>
          </div>

          {showAIGenerator && (
            <div className="space-y-3 pt-2 border-t">
              {/* 타겟 국가 입력 */}
              <div className="space-y-2">
                <Label htmlFor={targetCountryId}>
                  {t("sequences.stepForm.targetCountryLabel")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={targetCountryId}
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  placeholder={t("sequences.stepForm.targetCountryPlaceholder")}
                  className="bg-background"
                  disabled={isLoadingCountry}
                />
                <p className="text-xs text-muted-foreground">
                  {isLoadingCountry
                    ? t("sequences.stepForm.countryAutoDetecting")
                    : targetCountry
                      ? t("sequences.stepForm.countryAutoDetected", { country: targetCountry })
                      : t("sequences.stepForm.toast.noCountryInfo")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={promptId}>
                  {t("sequences.stepForm.emailContentRequestLabel")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id={promptId}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={t("sequences.stepForm.emailContentRequestPlaceholder")}
                  className="bg-background min-h-[100px]"
                />
              </div>

              <Button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={
                  isGenerating ||
                  !aiPrompt.trim() ||
                  aiPrompt.trim().length < 10 ||
                  !targetCountry?.trim()
                }
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating
                  ? t("sequences.stepForm.generating")
                  : t("sequences.stepForm.generateButton")}
              </Button>
            </div>
          )}
        </div>
      )}

      {workspaceId && !customerGroupId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("sequences.stepForm.aiRequiresCustomerGroup")}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={subjectId}>
          {t("sequences.stepForm.emailSubjectLabel")} <span className="text-red-500">*</span>
        </Label>
        <Input
          id={subjectId}
          value={formData.emailSubject}
          onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
          required
          maxLength={500}
          placeholder={t("sequences.stepForm.emailSubjectPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={bodyTextId}>{t("sequences.stepForm.emailBodyLabel")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSignatureModalOpen(true)}
            className="h-7"
          >
            <Mail className="h-3 w-3 mr-1" />
            {t("sequences.stepForm.editSignatureButton")}
          </Button>
        </div>
        <RichTextEditor
          value={formData.emailBodyText || ""}
          onChange={(value) => setFormData({ ...formData, emailBodyText: value })}
          placeholder={`\n\n--\n${getUserSignature()}`}
          height="300px"
        />
        <Collapsible className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
            {t("sequences.stepForm.viewVariablesButton")}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {t("sequences.stepForm.variablesCompanyInfo")}
                  </p>
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
                  <p className="font-medium text-foreground">
                    {t("sequences.stepForm.variablesLocationInfo")}
                  </p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{국가}}"}</li>
                    <li>{"{{도시}}"}</li>
                    <li>{"{{주/도}}"}</li>
                    <li>{"{{주소}}"}</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {t("sequences.stepForm.variablesContactInfo")}
                  </p>
                  <ul className="space-y-0.5 ml-2 text-[11px]">
                    <li>{"{{담당자명}}"}</li>
                    <li>{"{{이메일}}"}</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {t("sequences.stepForm.variablesLeadManagement")}
                  </p>
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
          {t("sequences.stepForm.cancelButton")}
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {step ? t("sequences.stepForm.updateButton") : t("sequences.stepForm.submitButton")}
        </Button>
      </div>

      {/* 서명 편집 모달 */}
      <SignatureEditorModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        defaultSignature={getUserSignature()}
        onSave={handleSaveSignature}
        workspaceId={workspaceId}
        userId={user?.id}
      />
    </form>
  )
}
