import { ArrowRight, CheckCircle2, Edit3, Globe, Save, Settings, X } from "lucide-react"
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
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type SalesStrategyData = {
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [salesStrategy, setSalesStrategy] = useState<SalesStrategyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Generate unique IDs for form fields
  const websiteUrlId = useId()

  // Form state for editing
  const [editedData, setEditedData] = useState<SalesStrategyData>({
    industry: "",
    target: "",
    country: "",
    experience: "",
    websiteUrl: "",
  })

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

  console.log("[StepCompanyInfo] 4. onboardingData:", JSON.stringify(onboardingData, null, 2))

  // Fetch sales strategy data
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
        console.log("[StepCompanyInfo] 7. Fetching sales strategy from API...")
        const response = await apiFetch<{
          data: SalesStrategyData
        }>(`/api/v1/workspace-sales-strategies/${workspace.id}`)

        console.log(
          "[StepCompanyInfo] 8. ✅ Sales strategy fetched:",
          JSON.stringify(response.data, null, 2),
        )
        setSalesStrategy(response.data)
        setEditedData({
          ...response.data,
          websiteUrl: response.data.websiteUrl || "",
        })
      } catch (error) {
        console.error("[StepCompanyInfo] 9. ❌ Failed to fetch sales strategy:", error)
        // 데이터가 없으면 자동으로 수정 모드(입력 폼)로 시작
        console.log("[StepCompanyInfo] 10. Setting isEditing=true due to fetch error")
        setIsEditing(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSalesStrategy()
  }, [workspace?.id])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    // Reset to original data
    if (salesStrategy) {
      setEditedData({
        ...salesStrategy,
        websiteUrl: salesStrategy.websiteUrl || "",
      })
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    console.log("[StepCompanyInfo] handleSave called")
    console.log("[StepCompanyInfo] workspace?.id:", workspace?.id)
    console.log("[StepCompanyInfo] editedData:", JSON.stringify(editedData, null, 2))

    if (!workspace?.id) {
      console.log("[StepCompanyInfo] ❌ No workspace ID, aborting save")
      return
    }

    // 필수 필드 검증
    if (
      !(editedData.industry && editedData.target && editedData.country && editedData.experience)
    ) {
      console.log("[StepCompanyInfo] ❌ Missing required fields")
      toast.error(isKorean ? "모든 필드를 입력해주세요" : "Please fill in all fields")
      return
    }

    setIsSaving(true)
    try {
      // 1. onboarding_progress.survey_data 저장
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

      // 2. workspace_sales_strategies 업데이트 (websiteUrl 포함)
      console.log(
        `[StepCompanyInfo] 📤 Updating sales strategy at /api/v1/workspace-sales-strategies/${workspace.id}`,
      )
      const salesResponse = await apiFetch(`/api/v1/workspace-sales-strategies/${workspace.id}`, {
        method: "PUT",
        body: JSON.stringify(editedData),
      })
      console.log("[StepCompanyInfo] ✅ Sales strategy updated:", salesResponse)

      setSalesStrategy(editedData)
      setIsEditing(false)
      toast.success(isKorean ? "저장되었습니다" : "Saved successfully")
    } catch (error) {
      console.error("[StepCompanyInfo] ❌ Failed to save:", error)
      toast.error(isKorean ? "저장에 실패했습니다" : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = async () => {
    // DB에 Step 1 완료 기록
    if (workspace?.id) {
      try {
        await completeStep1Mutation.mutateAsync({ workspaceId: workspace.id, userId })
      } catch (error) {
        console.error("Failed to complete step 1:", error)
      }
    }
    setSearchParams({ step: "2" })
  }

  const getLabel = (
    options: Array<{ value: string; ko: string; en: string }>,
    value: string,
  ): string => {
    const option = options.find((opt) => opt.value === value)
    if (!option) {
      return value
    }
    return isKorean ? option.ko : option.en
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">
              {isKorean ? "정보 입력" : "Enter Information"}
            </CardTitle>
            <p className="mt-1 text-gray-600 text-sm">
              {isKorean
                ? "온보딩에서 입력하신 정보를 확인하고 수정할 수 있습니다"
                : "Review and edit the information you entered during onboarding"}
            </p>
          </div>
          {salesStrategy && !isEditing && (
            <Button onClick={handleEdit} size="sm" variant="outline">
              <Edit3 className="mr-2 h-4 w-4" />
              {isKorean ? "수정" : "Edit"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            // Edit mode
            <>
              <div className="space-y-4">
                {/* Website URL */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2" htmlFor={websiteUrlId}>
                    <Globe className="h-4 w-4" />
                    {isKorean ? "회사 웹사이트 URL" : "Company Website URL"}
                    <span className="font-normal text-gray-400 text-sm">
                      {isKorean ? "(선택사항)" : "(Optional)"}
                    </span>
                  </Label>
                  <Input
                    id={websiteUrlId}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                    }
                    placeholder="https://example.com"
                    type="url"
                    value={editedData.websiteUrl}
                  />
                  <p className="text-gray-500 text-xs">
                    {isKorean
                      ? "회사 웹사이트를 입력하면 더 정확한 리드를 찾을 수 있습니다 (건너뛰기 가능)"
                      : "Enter your website for more accurate lead discovery (can be skipped)"}
                  </p>
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label>{isKorean ? "산업군" : "Industry"}</Label>
                  <Select
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, industry: value }))
                    }
                    value={editedData.industry}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isKorean ? "산업군 선택" : "Select industry"} />
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
                  <Label>{isKorean ? "타겟 고객" : "Target Customer"}</Label>
                  <Select
                    onValueChange={(value) => setEditedData((prev) => ({ ...prev, target: value }))}
                    value={editedData.target}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isKorean ? "타겟 고객 선택" : "Select target"} />
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
                  <Label>{isKorean ? "희망 진출 국가" : "Target Country"}</Label>
                  <Select
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, country: value }))
                    }
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
                  <Label>{isKorean ? "수출 경험" : "Export Experience"}</Label>
                  <Select
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, experience: value }))
                    }
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

              {/* Edit action buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button disabled={isSaving} onClick={handleCancel} variant="outline">
                  <X className="mr-2 h-4 w-4" />
                  {isKorean ? "취소" : "Cancel"}
                </Button>
                <Button disabled={isSaving} onClick={handleSave}>
                  {isSaving ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isKorean ? "저장" : "Save"}
                </Button>
              </div>
            </>
          ) : salesStrategy ? (
            // Display mode
            <>
              <div className="space-y-4">
                {/* Website URL */}
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Globe className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 text-sm">
                      {isKorean ? "회사 웹사이트" : "Company Website"}
                      <span className="ml-1 font-normal text-gray-400">
                        {isKorean ? "(선택사항)" : "(Optional)"}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-base text-gray-900">
                      {editedData.websiteUrl || (isKorean ? "미입력" : "Not entered")}
                    </div>
                  </div>
                </div>

                {/* Industry */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 text-sm">
                      {isKorean ? "산업군" : "Industry"}
                    </div>
                    <div className="mt-1 font-semibold text-base text-gray-900">
                      {getLabel(INDUSTRY_OPTIONS, salesStrategy.industry)}
                    </div>
                  </div>
                </div>

                {/* Target Customer */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 text-sm">
                      {isKorean ? "타겟 고객" : "Target Customer"}
                    </div>
                    <div className="mt-1 font-semibold text-base text-gray-900">
                      {getLabel(TARGET_OPTIONS, salesStrategy.target)}
                    </div>
                  </div>
                </div>

                {/* Target Country */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 text-sm">
                      {isKorean ? "희망 진출 국가" : "Target Country"}
                    </div>
                    <div className="mt-1 font-semibold text-base text-gray-900">
                      {getLabel(COUNTRY_OPTIONS, salesStrategy.country)}
                    </div>
                  </div>
                </div>

                {/* Export Experience */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 text-sm">
                      {isKorean ? "수출 경험" : "Export Experience"}
                    </div>
                    <div className="mt-1 font-semibold text-base text-gray-900">
                      {getLabel(EXPERIENCE_OPTIONS, salesStrategy.experience)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
                  {t("app.onboarding.step1.nextButton", "다음 단계")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            // No data found
            <div className="py-8 text-center">
              <p className="mb-4 text-gray-600">
                {isKorean
                  ? "설문 정보를 찾을 수 없습니다. 계속 진행하시겠습니까?"
                  : "Survey information not found. Would you like to continue?"}
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
                {t("app.onboarding.step1.nextButton", "다음 단계")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
