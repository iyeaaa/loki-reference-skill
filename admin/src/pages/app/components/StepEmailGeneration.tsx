import { ArrowRight, CheckCircle2, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api/client"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { Sequence, SequenceStep } from "@/lib/api/types/sequence"

interface Lead {
  id: string
  companyName: string
}

interface GeneratedEmail {
  id: string
  subject: string
  body: string
  leadId: string
  leadName: string
}

export function StepEmailGeneration() {
  const { t, i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [error, setError] = useState<string | null>(null)

  // Ref to prevent double execution
  const hasStartedGeneration = useRef(false)

  // Get user's workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  // Get leads and company info from session storage (memoized)
  const leads = useMemo<Lead[]>(
    () => JSON.parse(sessionStorage.getItem("onboarding_leads") || "[]"),
    [],
  )
  const companyInfo = useMemo(
    () => JSON.parse(sessionStorage.getItem("onboarding_company_info") || "{}"),
    [],
  )

  const generateEmailSequence = useCallback(async () => {
    if (!workspace?.id || leads.length === 0 || hasStartedGeneration.current) return

    hasStartedGeneration.current = true
    setIsGenerating(true)
    setProgress(0)
    setError(null)

    try {
      // Step 1: Create a demo sequence (20%)
      setProgress(20)
      const sequenceResponse = await apiFetch<Sequence>("/api/v1/sequences", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: isKorean ? "데모 이메일 시퀀스" : "Demo Email Sequence",
          description: isKorean
            ? "온보딩에서 생성된 데모 시퀀스"
            : "Demo sequence created during onboarding",
          status: "draft", // Use draft to skip customerGroupId requirement
          createdBy: userId,
          selectedLeadIds: leads.map((l) => l.id),
        }),
      })

      // API returns Sequence directly, not wrapped in data
      const newSequence = sequenceResponse
      if (!newSequence?.id) {
        throw new Error("Failed to create sequence")
      }

      setProgress(40)

      // Step 2: Create a single step with AI-generated email template (60%)
      const templateResponse = await apiFetch<{
        emailSubject: string
        emailBodyText: string
        emailBodyHtml: string
      }>("/api/v1/sequences/generate-template", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          country: companyInfo.country || "us",
          prompt: isKorean
            ? `${companyInfo.industry || "일반"} 산업의 ${companyInfo.target === "b2b" ? "B2B" : "B2C"} 고객에게 보내는 첫 번째 영업 이메일을 작성해주세요.`
            : `Write a first sales email to ${companyInfo.target === "b2b" ? "B2B" : "B2C"} customers in the ${companyInfo.industry || "general"} industry.`,
        }),
      })

      setProgress(70)

      // Step 3: Create the step in the sequence
      await apiFetch<SequenceStep>(`/api/v1/sequences/${newSequence.id}/steps`, {
        method: "POST",
        body: JSON.stringify({
          stepOrder: 1,
          delayDays: 0,
          scheduledHour: 9,
          scheduledMinute: 0,
          emailSubject: templateResponse.emailSubject,
          emailBodyText: templateResponse.emailBodyText,
          emailBodyHtml: templateResponse.emailBodyHtml,
          generationSource: "ai",
        }),
      })

      setProgress(90)

      // Step 4: Generate email previews for leads
      const generatedEmails: GeneratedEmail[] = leads.slice(0, 5).map((lead, index) => ({
        id: `email-${index}`,
        subject: templateResponse.emailSubject,
        body: templateResponse.emailBodyText,
        leadId: lead.id,
        leadName: lead.companyName,
      }))

      setEmails(generatedEmails)
      setProgress(100)
      setGenerationComplete(true)

      // Store sequence info for next step
      sessionStorage.setItem(
        "onboarding_sequence",
        JSON.stringify({
          id: newSequence.id,
          name: newSequence.name,
          emailSubject: templateResponse.emailSubject,
          emailBodyText: templateResponse.emailBodyText,
          leadsCount: leads.length,
        }),
      )

      toast.success(
        isKorean ? "이메일이 성공적으로 생성되었습니다" : "Emails generated successfully",
      )
    } catch (err) {
      console.error("Email generation failed:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      toast.error(isKorean ? "이메일 생성에 실패했습니다" : "Email generation failed")
      hasStartedGeneration.current = false
    } finally {
      setIsGenerating(false)
    }
  }, [workspace?.id, leads, companyInfo, isKorean, userId])

  // Start generation on mount
  useEffect(() => {
    if (workspace?.id && leads.length > 0 && !hasStartedGeneration.current) {
      generateEmailSequence()
    }
  }, [workspace?.id, leads.length, generateEmailSequence])

  const handleNext = () => {
    setSearchParams({ step: "4" })
  }

  const handleRetry = () => {
    hasStartedGeneration.current = false
    setGenerationComplete(false)
    setEmails([])
    setProgress(0)
    setError(null)
    generateEmailSequence()
  }

  // No leads available
  if (leads.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-10 px-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-gray-600 mb-4">
                {isKorean
                  ? "리드가 없습니다. 이전 단계로 돌아가세요."
                  : "No leads available. Go back to the previous step."}
              </p>
              <Button variant="outline" onClick={() => setSearchParams({ step: "2" })}>
                {isKorean ? "이전 단계로" : "Go Back"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-500" />
            {t("app.onboarding.step3.generatingTitle", "AI 이메일 생성 중")}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {t(
              "app.onboarding.step3.generatingDescription",
              "잠재 고객에게 보낼 맞춤형 이메일을 생성하고 있습니다",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isGenerating ? (
            // Generating state
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
                <p className="text-lg font-medium text-gray-900">
                  {t("app.onboarding.step3.generating", "생성 중...")}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {progress < 40
                    ? isKorean
                      ? "시퀀스 생성 중..."
                      : "Creating sequence..."
                    : progress < 70
                      ? isKorean
                        ? "AI 이메일 템플릿 생성 중..."
                        : "Generating AI email template..."
                      : isKorean
                        ? "이메일 적용 중..."
                        : "Applying emails..."}
                </p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-gray-500">{progress}%</p>
            </div>
          ) : generationComplete && emails.length > 0 ? (
            // Generation complete
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">
                    {leads.length}
                    {t("app.onboarding.step3.emailsGenerated", "개의 이메일이 생성되었습니다")}
                  </p>
                </div>
              </div>

              {/* Email preview */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {t("app.onboarding.step5.previewEmail", "이메일 미리보기")}
                </h3>
                {emails.slice(0, 1).map((email) => (
                  <div key={email.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900 mb-2">
                      {isKorean ? "제목:" : "Subject:"} {email.subject}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-4">
                      {email.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  {t("app.onboarding.step1.nextButton", "다음 단계")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-gray-600">
                {t("app.onboarding.step3.generationFailed", "이메일 생성 실패")}
              </p>
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("app.onboarding.step3.retryGeneration", "다시 생성")}
              </Button>
            </div>
          ) : (
            // Initial/waiting state
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600">
                {isKorean ? "이메일 생성을 시작합니다..." : "Starting email generation..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
