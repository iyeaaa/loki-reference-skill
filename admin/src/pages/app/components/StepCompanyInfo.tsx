import { ArrowRight, Globe, Loader2, Settings } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/api/client"
import { useCompleteStep1, useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { usePatchWorkspace, useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type SalesStrategyData = {
  companyName: string
  companyDescription: string
  industry: string
  target: string
  country: string
  experience: string
  websiteUrl?: string
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
    companyDescription: "",
    industry: "",
    target: "",
    country: "",
    experience: "",
    websiteUrl: "",
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

  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(
    userId,
    !!userId,
  )

  // Get the first workspace (trial users have one workspace)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  console.log("[StepCompanyInfo] 2. isLoadingWorkspaces:", isLoadingWorkspaces)
  console.log("[StepCompanyInfo] 3. workspace:", workspace?.id, workspace?.name)

  // Onboarding hooks
  const { data: onboardingData } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeStep1Mutation = useCompleteStep1()
  const patchWorkspaceMutation = usePatchWorkspace()

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
          apiFetch<{ data: { companyName?: string; companyDescription?: string } }>(
            `/api/v1/workspaces/${workspace.id}`,
          ).catch(() => null),
        ])

        const strategyData = strategyResponse?.data
        const workspaceData = workspaceResponse?.data

        console.log("[StepCompanyInfo] 8. ✅ Data fetched:", { strategyData, workspaceData })

        if (strategyData) {
          const mergedData: SalesStrategyData = {
            ...strategyData,
            companyName: workspaceData?.companyName || strategyData.companyName || "",
            companyDescription:
              workspaceData?.companyDescription || strategyData.companyDescription || "",
            websiteUrl: strategyData.websiteUrl || "",
          }
          setEditedData(mergedData)
        } else {
          // 데이터가 없으면 workspace 정보로 초기화
          setEditedData((prev) => ({
            ...prev,
            companyName: workspaceData?.companyName || "",
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
  }, [workspace?.id])

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
      // 1. workspace 업데이트 (companyName, companyDescription, companyWebsite) - tanstack-query mutation 사용
      console.log(`[StepCompanyInfo] 📤 Updating workspace at /api/v1/workspaces/${workspace.id}`)
      const workspacePayload = {
        name: editedData.companyName, // 사이드바에 표시되는 워크스페이스 이름도 업데이트
        companyName: editedData.companyName,
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
        }),
      })
      console.log("[StepCompanyInfo] ✅ Sales strategy updated:", salesResponse)

      // DB에 Step 1 완료 기록
      try {
        await completeStep1Mutation.mutateAsync({ workspaceId: workspace.id, userId })
      } catch (error) {
        console.error("Failed to complete step 1:", error)
      }

      // 다음 단계로 이동
      setSearchParams({ step: "2" })
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
            {isKorean ? "회사를 알려주세요" : "Tell us about your company"}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {isKorean
              ? "입력해주신 내용으로 딱 맞는 바이어를 찾아드릴게요"
              : "We'll find the perfect buyers based on what you share"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Company Name - Toss style */}
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
              {errors.companyName ? (
                <p className="text-red-500 text-sm">
                  {isKorean ? "회사 이름을 입력해주세요" : "Please enter your company name"}
                </p>
              ) : (
                <p className="text-gray-500 text-sm">
                  {isKorean
                    ? "바이어에게 보내는 이메일에 이 이름이 표시돼요"
                    : "This name appears in emails to buyers"}
                </p>
              )}
            </div>

            {/* Company Description - Toss style */}
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
                    ? "예: 천연 성분 기반 K-뷰티 스킨케어 브랜드입니다.\n\n주력 제품: 비타민C 세럼, 히알루론산 크림\n강점: FDA 인증, 비건 제품, 20년 OEM 경험"
                    : "e.g., Natural K-beauty skincare brand.\n\nMain products: Vitamin C serum, Hyaluronic acid cream\nStrengths: FDA certified, Vegan products, 20 years OEM"
                }
                rows={5}
                style={{ minHeight: "140px", maxHeight: "300px" }}
                value={editedData.companyDescription}
              />
              {errors.companyDescription ? (
                <p className="text-red-500 text-sm">
                  {isKorean ? "회사 설명을 입력해주세요" : "Please enter your company description"}
                </p>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                  <span className="text-blue-500">✨</span>
                  <p className="text-blue-700 text-sm">
                    {isKorean
                      ? "자세히 써주실수록 AI가 딱 맞는 바이어를 찾고, 설득력 있는 이메일을 작성해드려요"
                      : "The more detail you provide, the better AI can find matching buyers and craft compelling emails"}
                  </p>
                </div>
              )}
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2" htmlFor={websiteUrlId}>
                <Globe className="h-4 w-4" />
                {isKorean ? "홈페이지" : "Website"}
                <span className="font-normal text-gray-400 text-sm">
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
              <p className="text-gray-500 text-xs">
                {isKorean
                  ? "입력하시면 AI가 더 정확하게 바이어를 찾아드려요"
                  : "Helps AI find more relevant buyers for you"}
              </p>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label>{isKorean ? "어떤 분야인가요?" : "What's your industry?"}</Label>
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
              <Label>{isKorean ? "누구에게 판매하세요?" : "Who do you sell to?"}</Label>
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
              <Label>
                {isKorean ? "어디로 진출하고 싶으세요?" : "Where do you want to expand?"}
              </Label>
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
              <Label>{isKorean ? "해외 수출 경험이 있으세요?" : "Any export experience?"}</Label>
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
              {isKorean ? "바이어 찾아보기" : "Find buyers"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
