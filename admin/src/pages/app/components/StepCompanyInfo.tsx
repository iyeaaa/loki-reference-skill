import { ArrowRight, Globe, Loader2, Settings } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Switch } from "@/components/ui/switch" // Temporarily hidden
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trackOnboardingStep1Complete } from "@/lib/analytics"
import { apiFetch } from "@/lib/api/client"
import {
  useCompanyDescriptionAIEnhance,
  useCompleteStep1,
  useOnboardingProgress,
} from "@/lib/api/hooks/onboarding"
import {
  usePatchWorkspace,
  useTranslateCompanyName,
  useUserWorkspaces,
} from "@/lib/api/hooks/workspaces"

type SalesStrategyData = {
  companyName: string
  companyNameEn: string
  companyDescription: string
  industry: string
  target: string
  country: string
  experience: string
  websiteUrl?: string
  includeSignature: boolean
}

// Industry options
const INDUSTRY_OPTIONS = [
  { value: "manufacturing", ko: "제조 / 부품", en: "Manufacturing / Parts" },
  { value: "it_saas", ko: "IT / 소프트웨어", en: "IT / Software" },
  { value: "beauty", ko: "뷰티 / 화장품", en: "Beauty / Cosmetics" },
  { value: "food", ko: "식품 / 건기식", en: "Food / Health Supple." },
  { value: "fashion", ko: "패션 / 의류", en: "Fashion / Apparel" },
  { value: "electronics", ko: "전자제품", en: "Electronics" },
  { value: "healthcare", ko: "헬스케어", en: "Healthcare" },
  { value: "guitar", ko: "기타", en: "Other" },
]

// Target options
const TARGET_OPTIONS = [
  { value: "b2b", ko: "기업 대상 (B2B)", en: "Business to Business (B2B)" },
  { value: "b2c", ko: "소비자 대상 (B2C)", en: "Business to Consumer (B2C)" },
  { value: "both", ko: "둘 다", en: "Both" },
]

// Country options
const COUNTRY_OPTIONS = [
  { value: "jp", ko: "일본", en: "Japan" },
  { value: "us", ko: "미국", en: "United States" },
  { value: "cn", ko: "중국", en: "China" },
  { value: "sea", ko: "동남아", en: "Southeast Asia" },
  { value: "eu", ko: "유럽", en: "Europe" },
  { value: "ae", ko: "중동", en: "Middle East" },
]

// Experience options
const EXPERIENCE_OPTIONS = [
  { value: "none", ko: "처음입니다", en: "First time" },
  { value: "some", ko: "1~3회 (초기)", en: "1-3 times (Early stage)" },
  { value: "experienced", ko: "능숙함 (4회 이상)", en: "Experienced (4+ times)" },
]

export function StepCompanyInfo() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Generate unique IDs for form fields
  const websiteUrlId = useId()

  // Form state for editing
  const [editedData, setEditedData] = useState<SalesStrategyData>({
    companyName: "",
    companyNameEn: "",
    companyDescription: "",
    industry: "",
    target: "",
    country: "",
    experience: "",
    websiteUrl: "",
    includeSignature: true,
  })

  // Validation error state
  const [errors, setErrors] = useState<{
    companyName?: boolean
    companyDescription?: boolean
  }>({})

  // Get user's workspace
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  console.log("[StepCompanyInfo] 1. userId:", userId)

  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(!!userId)

  // Get the first workspace (trial users have one workspace)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  console.log("[StepCompanyInfo] 2. isLoadingWorkspaces:", isLoadingWorkspaces)
  console.log("[StepCompanyInfo] 3. workspace:", workspace?.id, workspace?.name)

  // Onboarding hooks
  const { data: onboardingData } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeStep1Mutation = useCompleteStep1()
  const patchWorkspaceMutation = usePatchWorkspace()

  // AI description enhancement hook
  const {
    suggestions,
    isLoading: isAnalyzing,
    isRateLimited,
    hasAnalyzed,
  } = useCompanyDescriptionAIEnhance({
    description: editedData.companyDescription,
    industry: editedData.industry,
    target: editedData.target,
    enabled: !isLoading && !!workspace?.id, // Only enable after initial data is loaded
  })

  // Company name translation hook
  const translateMutation = useTranslateCompanyName()

  console.log("[StepCompanyInfo] 4. onboardingData:", JSON.stringify(onboardingData, null, 2))

  // Fetch sales strategy data and workspace company info
  useEffect(() => {
    async function fetchSalesStrategy() {
      console.log("[StepCompanyInfo] 5. fetchSalesStrategy called, workspace?.id:", workspace?.id)

      if (!workspace?.id) {
        console.log("[StepCompanyInfo] 6. No workspace ID, skipping fetch")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        // Fetch both sales strategy and workspace data in parallel
        console.log("[StepCompanyInfo] 7. Fetching sales strategy and workspace data...")
        const [strategyResponse, workspaceResponse] = await Promise.all([
          apiFetch<{ data: SalesStrategyData }>(
            `/api/v1/workspace-sales-strategies/${workspace.id}`,
          ).catch(() => null),
          apiFetch<{
            data: { companyName?: string; companyNameEn?: string; companyDescription?: string }
          }>(`/api/v1/workspaces/${workspace.id}`).catch(() => null),
        ])

        const strategyData = strategyResponse?.data
        const workspaceData = workspaceResponse?.data

        console.log("[StepCompanyInfo] 8. ✅ Data fetched:", { strategyData, workspaceData })

        if (strategyData) {
          const mergedData: SalesStrategyData = {
            ...strategyData,
            companyName: workspaceData?.companyName || strategyData.companyName || "",
            companyNameEn: workspaceData?.companyNameEn || "",
            companyDescription:
              workspaceData?.companyDescription || strategyData.companyDescription || "",
            websiteUrl: strategyData.websiteUrl || "",
            includeSignature: strategyData.includeSignature ?? true,
          }
          setEditedData(mergedData)
        } else {
          // 데이터가 없으면 workspace 정보로 초기화
          toast.warning(
            isKorean
              ? "전략 정보가 없습니다. 워크스페이스 정보로 초기화합니다."
              : "No strategy information found. Initializing with workspace information.",
          )
          setEditedData((prev) => ({
            ...prev,
            companyName: workspaceData?.companyName || "",
            companyNameEn: workspaceData?.companyNameEn || "",
            companyDescription: workspaceData?.companyDescription || "",
          }))
        }
      } catch (error) {
        console.error("[StepCompanyInfo] 9. ❌ Failed to fetch data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSalesStrategy()
  }, [workspace?.id, isKorean])

  // Auto-translate company name with debounce
  useEffect(() => {
    if (!editedData.companyName || editedData.companyName.trim() === "") {
      return
    }

    const timer = setTimeout(() => {
      translateMutation.mutate(
        {
          companyName: editedData.companyName,
          targetLanguage: "English",
        },
        {
          onSuccess: (translatedName) => {
            console.log("[Translation] Success:", translatedName)
            setEditedData((prev) => ({
              ...prev,
              companyNameEn: translatedName,
            }))
          },
          onError: (error) => {
            console.error("[Translation] Failed:", error)
          },
        },
      )
    }, 2000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedData.companyName, translateMutation.mutate])

  const handleSaveAndNext = async () => {
    console.log("[StepCompanyInfo] handleSave called")
    console.log("[StepCompanyInfo] workspace?.id:", workspace?.id)
    console.log("[StepCompanyInfo] editedData:", JSON.stringify(editedData, null, 2))

    if (!workspace?.id) {
      console.log("[StepCompanyInfo] ❌ No workspace ID, aborting save")
      return
    }

    // 필수 필드 검증
    const newErrors: { companyName?: boolean; companyDescription?: boolean } = {}
    const missingFields: string[] = []

    if (!editedData.companyName?.trim()) {
      newErrors.companyName = true
      missingFields.push(isKorean ? "회사명" : "Company Name")
    }
    if (!editedData.companyDescription?.trim()) {
      newErrors.companyDescription = true
      missingFields.push(isKorean ? "회사 소개" : "Company Description")
    }
    if (!editedData.industry) {
      missingFields.push(isKorean ? "산업군" : "Industry")
    }
    if (!editedData.target) {
      missingFields.push(isKorean ? "타겟 고객" : "Target Customer")
    }
    if (!editedData.country) {
      missingFields.push(isKorean ? "희망 진출 국가" : "Target Country")
    }
    if (!editedData.experience) {
      missingFields.push(isKorean ? "수출 경험" : "Export Experience")
    }

    // Set error states to highlight fields
    setErrors(newErrors)

    if (missingFields.length > 0) {
      console.log("[StepCompanyInfo] ❌ Missing required fields:", missingFields)
      toast.error(
        isKorean
          ? `다음 필드를 입력해주세요: ${missingFields.join(", ")}`
          : `Please fill in: ${missingFields.join(", ")}`,
      )
      return
    }

    setIsSaving(true)
    try {
      // 1. workspace 업데이트 (companyName, companyNameEn, companyDescription, companyWebsite) - tanstack-query mutation 사용
      console.log(`[StepCompanyInfo] 📤 Updating workspace at /api/v1/workspaces/${workspace.id}`)
      const workspacePayload = {
        name: editedData.companyName, // 사이드바에 표시되는 워크스페이스 이름도 업데이트
        companyName: editedData.companyName,
        companyNameEn: editedData.companyNameEn || null,
        companyDescription: editedData.companyDescription,
        companyWebsite: editedData.websiteUrl || null,
      }
      console.log("[StepCompanyInfo] Workspace payload:", JSON.stringify(workspacePayload, null, 2))

      await patchWorkspaceMutation.mutateAsync({
        workspaceId: workspace.id,
        data: workspacePayload,
      })
      console.log("[StepCompanyInfo] ✅ Workspace updated (cache invalidated)")

      // 2. onboarding_progress.survey_data 저장
      console.log(
        `[StepCompanyInfo] 📤 Saving survey data to /api/v1/onboarding/workspace/${workspace.id}/survey`,
      )
      const surveyPayload = {
        industry: editedData.industry,
        target: editedData.target,
        country: editedData.country,
        experience: editedData.experience,
        includeSignature: editedData.includeSignature,
        lang: i18n.language,
        userId,
      }
      console.log("[StepCompanyInfo] Survey payload:", JSON.stringify(surveyPayload, null, 2))

      const surveyResponse = await apiFetch(`/api/v1/onboarding/workspace/${workspace.id}/survey`, {
        method: "POST",
        body: JSON.stringify(surveyPayload),
      })
      console.log("[StepCompanyInfo] ✅ Survey data saved:", surveyResponse)

      // 3. workspace_sales_strategies 업데이트 (websiteUrl 포함)
      console.log(
        `[StepCompanyInfo] 📤 Updating sales strategy at /api/v1/workspace-sales-strategies/${workspace.id}`,
      )
      const salesResponse = await apiFetch(`/api/v1/workspace-sales-strategies/${workspace.id}`, {
        method: "PUT",
        body: JSON.stringify({
          industry: editedData.industry,
          target: editedData.target,
          country: editedData.country,
          experience: editedData.experience,
          websiteUrl: editedData.websiteUrl,
          includeSignature: editedData.includeSignature,
        }),
      })
      console.log("[StepCompanyInfo] ✅ Sales strategy updated:", salesResponse)

      // DB에 Step 1 완료 기록
      try {
        await completeStep1Mutation.mutateAsync({ workspaceId: workspace.id, userId })
      } catch (error) {
        console.error("Failed to complete step 1:", error)
      }

      // 4. 바이어 검색 Job 시작 (수정된 데이터 기반)
      console.log(
        `[StepCompanyInfo] 🚀 Starting discovery job at /api/v1/onboarding/workspace/${workspace.id}/start-discovery`,
      )

      const discoveryResponse = await apiFetch(
        `/api/v1/onboarding/workspace/${workspace.id}/start-discovery`,
        {
          method: "POST",
          body: JSON.stringify({
            userId,
            surveyData: {
              industry: editedData.industry,
              target: editedData.target,
              country: editedData.country,
              experience: editedData.experience,
              lang: i18n.language,
            },
          }),
        },
      )
      console.log("[StepCompanyInfo] ✅ Discovery job started:", discoveryResponse)

      // 시작 알림 toast
      toast.success(isKorean ? "바이어 찾기 시작!" : "Started finding buyers!", {
        description: isKorean
          ? "바이어 20명 + 이메일 40개 작성 중"
          : "Finding 20 buyers + writing 40 emails",
        duration: 4000,
      })

      // 📊 Analytics: Step 1 완료 이벤트 추적
      trackOnboardingStep1Complete({
        companyName: editedData.companyName,
        industry: editedData.industry,
        target: editedData.target,
        country: editedData.country,
      })

      // 다음 단계로 이동 (jobStarted 파라미터로 job 시작 상태 전달)
      setSearchParams({ step: "2", jobStarted: "true" })
    } catch (error) {
      console.error("[StepCompanyInfo] ❌ Failed to save:", error)
      toast.error(isKorean ? "저장에 실패했습니다" : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // Show loading spinner
  if (isLoadingWorkspaces || isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show message if no workspace is available
  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isKorean ? "워크스페이스를 찾을 수 없습니다" : "No Workspace Found"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="mb-4 text-gray-600">
                {isKorean
                  ? "온보딩을 진행하려면 워크스페이스가 필요합니다. 워크스페이스를 먼저 생성해주세요."
                  : "A workspace is required to proceed with onboarding. Please create a workspace first."}
              </p>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/settings?tab=workspaces")}
              >
                <Settings className="mr-2 h-4 w-4" />
                {isKorean ? "워크스페이스 생성하러 가기" : "Go to Create Workspace"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {isKorean ? "저에게 회사를 소개해주세요" : "Tell me about your company"}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {isKorean
              ? "이 정보로 관심있을 바이어를 찾아볼게요"
              : "I'll find buyers who might be interested"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name - Grid layout with English name */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold text-gray-900">
                {isKorean ? "회사 이름" : "Company Name"}
                <span
                  className={`font-normal text-xs ${errors.companyName ? "text-red-500" : "text-blue-500"}`}
                >
                  {isKorean ? "필수" : "Required"}
                </span>
              </Label>
              <Input
                className={`h-12 text-base ${errors.companyName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                onChange={(e) => {
                  setEditedData((prev) => ({ ...prev, companyName: e.target.value }))
                  if (errors.companyName) {
                    setErrors((prev) => ({ ...prev, companyName: false }))
                  }
                }}
                placeholder={isKorean ? "예: 린다 코스메틱" : "e.g., Rinda Cosmetics"}
                value={editedData.companyName}
              />
              {errors.companyName && (
                <p className="text-red-500 text-sm">
                  {isKorean ? "회사 이름을 입력해주세요" : "Please enter your company name"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold text-gray-900">
                {isKorean ? "회사 이름 (영문)" : "Company Name (English)"}
                <span className="font-normal text-gray-500 text-xs">
                  {isKorean ? "선택사항" : "Optional"}
                </span>
              </Label>
              <div className="relative">
                <Input
                  className="h-12 text-base"
                  onChange={(e) => {
                    setEditedData((prev) => ({ ...prev, companyNameEn: e.target.value }))
                  }}
                  placeholder={isKorean ? "예: Rinda Cosmetics" : "e.g., Rinda Cosmetics"}
                  value={editedData.companyNameEn}
                />
                {translateMutation.isPending && (
                  <Loader2 className="absolute top-3 right-3 h-6 w-6 animate-spin text-blue-500" />
                )}
              </div>
            </div>
          </div>

          {/* Company Description - Full width with AI feedback */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-semibold text-gray-900">
              {isKorean ? "어떤 회사인가요?" : "What does your company do?"}
              <span
                className={`font-normal text-xs ${errors.companyDescription ? "text-red-500" : "text-blue-500"}`}
              >
                {isKorean ? "필수" : "Required"}
              </span>
            </Label>
            <textarea
              className={`flex w-full resize-y rounded-md border bg-background px-4 py-3 text-base ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                errors.companyDescription
                  ? "border-red-500 focus-visible:ring-red-500"
                  : "border-input focus-visible:ring-blue-500"
              }`}
              onChange={(e) => {
                setEditedData((prev) => ({ ...prev, companyDescription: e.target.value }))
                if (errors.companyDescription) {
                  setErrors((prev) => ({ ...prev, companyDescription: false }))
                }
              }}
              placeholder={
                isKorean
                  ? "예: 천연 성분 기반 K-뷰티 스킨케어\n주력 제품: 비타민C 세럼, 히알루론산 크림\n강점: FDA 인증, 비건, 20년 OEM 경험"
                  : "e.g., Natural K-beauty skincare\nProducts: Vitamin C serum, HA cream\nStrengths: FDA certified, Vegan, 20yr OEM"
              }
              rows={4}
              style={{ minHeight: "100px", maxHeight: "200px" }}
              value={editedData.companyDescription}
            />
            {errors.companyDescription ? (
              <p className="text-red-500 text-sm">
                {isKorean ? "회사 설명을 입력해주세요" : "Please enter your company description"}
              </p>
            ) : (
              <>
                {/* AI Suggestions */}
                {isAnalyzing && editedData.companyDescription.trim().length >= 10 ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="h-3 w-3 animate-spin rounded-full border-gray-400 border-b-2" />
                    <span>{isKorean ? "AI가 분석 중..." : "AI analyzing..."}</span>
                  </div>
                ) : null}

                {isRateLimited ? (
                  <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2">
                    <p className="text-orange-700 text-sm">
                      {isKorean ? "⏱️ 분당 10회 제한" : "⏱️ 10 req/min limit"}
                    </p>
                  </div>
                ) : null}

                {!(isAnalyzing || isRateLimited) && suggestions.length > 0 ? (
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <div
                        className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2"
                        key={`${suggestion.type}-${index}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-amber-600">💡</span>
                          <p className="text-amber-800 text-sm">
                            {isKorean ? suggestion.messageKo : suggestion.messageEn}
                          </p>
                        </div>
                        <button
                          className="shrink-0 rounded bg-amber-600 px-2 py-1 text-white text-xs hover:bg-amber-700"
                          onClick={() => {
                            const currentDescription = editedData.companyDescription.trim()
                            const suggestionText = isKorean
                              ? suggestion.suggestionKo
                              : suggestion.suggestionEn
                            const newDescription = currentDescription
                              ? `${currentDescription}\n${suggestionText}`
                              : suggestionText
                            setEditedData((prev) => ({
                              ...prev,
                              companyDescription: newDescription,
                            }))
                          }}
                          type="button"
                        >
                          {isKorean ? "추가" : "Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {hasAnalyzed &&
                !isAnalyzing &&
                !isRateLimited &&
                suggestions.length === 0 &&
                editedData.companyDescription.trim().length >= 10 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-2">
                    <span className="text-green-600">✨</span>
                    <p className="text-green-800 text-sm">
                      {isKorean
                        ? "충분한 정보가 담겨있어요! 반드시 실제 정보로 수정해주세요 ✏️"
                        : "Good! If you added AI suggestions, please update them with your actual info ✏️"}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Website URL - Full width */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm" htmlFor={websiteUrlId}>
              <Globe className="h-4 w-4" />
              {isKorean ? "홈페이지" : "Website"}
              <span className="font-normal text-gray-400 text-xs">
                {isKorean ? "선택" : "Optional"}
              </span>
            </Label>
            <Input
              id={websiteUrlId}
              onChange={(e) => setEditedData((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              placeholder="https://example.com"
              type="url"
              value={editedData.websiteUrl}
            />
          </div>

          {/* Include Signature Toggle - Temporarily hidden
          <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
            <div className="space-y-0.5">
              <Label className="font-medium text-gray-900 text-sm">
                {isKorean ? "이메일에 서명 포함" : "Include signature in emails"}
              </Label>
              <p className="text-gray-500 text-xs">
                {isKorean
                  ? "발송되는 이메일에 서명을 자동으로 추가합니다"
                  : "Automatically add signature to outgoing emails"}
              </p>
            </div>
            <Switch
              checked={editedData.includeSignature}
              onCheckedChange={(checked) =>
                setEditedData((prev) => ({ ...prev, includeSignature: checked }))
              }
            />
          </div>
          */}

          {/* 2-Column Grid for 4 dropdowns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Industry */}
            <div className="space-y-2">
              <Label className="text-sm">{isKorean ? "산업 분야" : "Industry"}</Label>
              <Select
                onValueChange={(value) => setEditedData((prev) => ({ ...prev, industry: value }))}
                value={editedData.industry}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isKorean ? "분야 선택" : "Select industry"} />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {isKorean ? opt.ko : opt.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Customer */}
            <div className="space-y-2">
              <Label className="text-sm">{isKorean ? "판매 대상" : "Target Customer"}</Label>
              <Select
                onValueChange={(value) => setEditedData((prev) => ({ ...prev, target: value }))}
                value={editedData.target}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isKorean ? "대상 선택" : "Select target"} />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {isKorean ? opt.ko : opt.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Country */}
            <div className="space-y-2">
              <Label className="text-sm">{isKorean ? "진출 국가" : "Target Country"}</Label>
              <Select
                onValueChange={(value) => setEditedData((prev) => ({ ...prev, country: value }))}
                value={editedData.country}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isKorean ? "국가 선택" : "Select country"} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {isKorean ? opt.ko : opt.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Experience */}
            <div className="space-y-2">
              <Label className="text-sm">{isKorean ? "수출 경험" : "Export Experience"}</Label>
              <Select
                onValueChange={(value) => setEditedData((prev) => ({ ...prev, experience: value }))}
                value={editedData.experience}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isKorean ? "경험 선택" : "Select experience"} />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {isKorean ? opt.ko : opt.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-end pt-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSaving}
              onClick={handleSaveAndNext}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isKorean ? "다음 단계" : "Next step"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
