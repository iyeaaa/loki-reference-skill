import { ArrowRight, Building2, CheckCircle2, Edit3, Globe, Save, Settings, X } from "lucide-react"
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
import { useCompleteStep1, useOnboardingProgress, useSaveSurvey } from "@/lib/api/hooks/onboarding"
import { useSalesStrategy, useUpdateSalesStrategy } from "@/lib/api/hooks/sales-strategy"
import { useUpdateWorkspace, useUserWorkspaces } from "@/lib/api/hooks/workspaces"

interface SalesStrategyData {
  companyName: string
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
  const [isEditing, setIsEditing] = useState(false)

  // Generate unique IDs for form fields
  const companyNameId = useId()
  const websiteUrlId = useId()

  // Form state for editing
  const [editedData, setEditedData] = useState<SalesStrategyData>({
    companyName: "",
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
  const updateWorkspaceMutation = useUpdateWorkspace()
  const saveSurveyMutation = useSaveSurvey()
  const updateSalesStrategyMutation = useUpdateSalesStrategy()

  // Sales strategy query
  const {
    data: salesStrategy,
    isLoading: isSalesStrategyLoading,
    isError: isSalesStrategyError,
  } = useSalesStrategy(workspace?.id || "", !!workspace?.id)

  console.log("[StepCompanyInfo] 4. onboardingData:", JSON.stringify(onboardingData, null, 2))
  console.log("[StepCompanyInfo] 5. salesStrategy:", JSON.stringify(salesStrategy, null, 2))

  // Initialize editedData when salesStrategy loads
  useEffect(() => {
    if (salesStrategy) {
      setEditedData({
        ...salesStrategy,
        companyName: salesStrategy.companyName || workspace?.name || "",
        websiteUrl: salesStrategy.websiteUrl || "",
      })
    }
  }, [salesStrategy, workspace?.name])

  // Set editing mode if no sales strategy data
  useEffect(() => {
    if (isSalesStrategyError && !isEditing) {
      console.log("[StepCompanyInfo] Setting isEditing=true due to fetch error")
      setIsEditing(true)
    }
  }, [isSalesStrategyError, isEditing])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    // Reset to original data
    if (salesStrategy) {
      setEditedData({
        ...salesStrategy,
        companyName: salesStrategy.companyName || workspace?.name || "",
        websiteUrl: salesStrategy.websiteUrl || "",
      })
    }
    setIsEditing(false)
  }

  const isSaving =
    saveSurveyMutation.isPending ||
    updateSalesStrategyMutation.isPending ||
    updateWorkspaceMutation.isPending

  const handleSave = async () => {
    console.log("[StepCompanyInfo] handleSave called")
    console.log("[StepCompanyInfo] workspace?.id:", workspace?.id)
    console.log("[StepCompanyInfo] editedData:", JSON.stringify(editedData, null, 2))

    if (!workspace?.id) {
      console.log("[StepCompanyInfo] ❌ No workspace ID, aborting save")
      return
    }

    // 필수 필드 검증
    if (!editedData.companyName?.trim()) {
      console.log("[StepCompanyInfo] ❌ Missing company name")
      toast.error(isKorean ? "회사 이름을 입력해주세요" : "Please enter your company name")
      return
    }

    if (
      !editedData.industry ||
      !editedData.target ||
      !editedData.country ||
      !editedData.experience
    ) {
      console.log("[StepCompanyInfo] ❌ Missing required fields")
      toast.error(isKorean ? "모든 필드를 입력해주세요" : "Please fill in all fields")
      return
    }

    try {
      // 1. onboarding_progress.survey_data 저장
      console.log(`[StepCompanyInfo] 📤 Saving survey data`)
      await saveSurveyMutation.mutateAsync({
        workspaceId: workspace.id,
        surveyData: {
          industry: editedData.industry,
          target: editedData.target,
          country: editedData.country,
          experience: editedData.experience,
          lang: i18n.language,
        },
        userId,
      })
      console.log("[StepCompanyInfo] ✅ Survey data saved")

      // 2. workspace_sales_strategies 업데이트 (websiteUrl 포함)
      console.log(`[StepCompanyInfo] 📤 Updating sales strategy`)
      await updateSalesStrategyMutation.mutateAsync({
        workspaceId: workspace.id,
        data: editedData,
      })
      console.log("[StepCompanyInfo] ✅ Sales strategy updated")

      // 3. 워크스페이스 이름 업데이트 (회사 이름으로)
      console.log(`[StepCompanyInfo] 📤 Updating workspace name to "${editedData.companyName}"`)
      await updateWorkspaceMutation.mutateAsync({
        workspaceId: workspace.id,
        data: { name: editedData.companyName.trim(), isActive: true },
      })
      console.log("[StepCompanyInfo] ✅ Workspace name updated")

      setIsEditing(false)
      toast.success(isKorean ? "저장되었습니다" : "Saved successfully")
    } catch (error) {
      console.error("[StepCompanyInfo] ❌ Failed to save:", error)
      toast.error(isKorean ? "저장에 실패했습니다" : "Failed to save")
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
    if (!option) return value
    return isKorean ? option.ko : option.en
  }

  // Show loading spinner
  if (isLoadingWorkspaces || isSalesStrategyLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show message if no workspace is available
  if (!workspace) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isKorean ? "워크스페이스를 찾을 수 없습니다" : "No Workspace Found"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                {isKorean
                  ? "온보딩을 진행하려면 워크스페이스가 필요합니다. 워크스페이스를 먼저 생성해주세요."
                  : "A workspace is required to proceed with onboarding. Please create a workspace first."}
              </p>
              <Button
                onClick={() => navigate("/settings?tab=workspaces")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                {isKorean ? "워크스페이스 생성하러 가기" : "Go to Create Workspace"}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">
              {isKorean ? "정보 입력" : "Enter Information"}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {isKorean
                ? "온보딩에서 입력하신 정보를 확인하고 수정할 수 있습니다"
                : "Review and edit the information you entered during onboarding"}
            </p>
          </div>
          {salesStrategy && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit3 className="w-4 h-4 mr-2" />
              {isKorean ? "수정" : "Edit"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            // Edit mode
            <>
              <div className="space-y-4">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor={companyNameId} className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {isKorean ? "회사 이름" : "Company Name"}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={companyNameId}
                    type="text"
                    placeholder={isKorean ? "회사 이름을 입력하세요" : "Enter your company name"}
                    value={editedData.companyName}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {isKorean
                      ? "이메일 발송 시 발신자 회사 이름으로 사용됩니다"
                      : "This will be used as your company name when sending emails"}
                  </p>
                </div>

                {/* Website URL */}
                <div className="space-y-2">
                  <Label htmlFor={websiteUrlId} className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {isKorean ? "회사 웹사이트 URL" : "Company Website URL"}
                    <span className="text-gray-400 font-normal text-sm">
                      {isKorean ? "(선택사항)" : "(Optional)"}
                    </span>
                  </Label>
                  <Input
                    id={websiteUrlId}
                    type="url"
                    placeholder="https://example.com"
                    value={editedData.websiteUrl}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {isKorean
                      ? "회사 웹사이트를 입력하면 더 정확한 리드를 찾을 수 있습니다 (건너뛰기 가능)"
                      : "Enter your website for more accurate lead discovery (can be skipped)"}
                  </p>
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label>{isKorean ? "산업군" : "Industry"}</Label>
                  <Select
                    value={editedData.industry}
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, industry: value }))
                    }
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
                    value={editedData.target}
                    onValueChange={(value) => setEditedData((prev) => ({ ...prev, target: value }))}
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
                    value={editedData.country}
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, country: value }))
                    }
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
                    value={editedData.experience}
                    onValueChange={(value) =>
                      setEditedData((prev) => ({ ...prev, experience: value }))
                    }
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
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="w-4 h-4 mr-2" />
                  {isKorean ? "취소" : "Cancel"}
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isKorean ? "저장" : "Save"}
                </Button>
              </div>
            </>
          ) : salesStrategy ? (
            // Display mode
            <>
              <div className="space-y-4">
                {/* Company Name */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Building2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "회사 이름" : "Company Name"}
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {salesStrategy.companyName ||
                        workspace?.name ||
                        (isKorean ? "미입력" : "Not entered")}
                    </div>
                  </div>
                </div>

                {/* Website URL */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Globe className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "회사 웹사이트" : "Company Website"}
                      <span className="text-gray-400 font-normal ml-1">
                        {isKorean ? "(선택사항)" : "(Optional)"}
                      </span>
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {editedData.websiteUrl || (isKorean ? "미입력" : "Not entered")}
                    </div>
                  </div>
                </div>

                {/* Industry */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "산업군" : "Industry"}
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {getLabel(INDUSTRY_OPTIONS, salesStrategy.industry)}
                    </div>
                  </div>
                </div>

                {/* Target Customer */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "타겟 고객" : "Target Customer"}
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {getLabel(TARGET_OPTIONS, salesStrategy.target)}
                    </div>
                  </div>
                </div>

                {/* Target Country */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "희망 진출 국가" : "Target Country"}
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {getLabel(COUNTRY_OPTIONS, salesStrategy.country)}
                    </div>
                  </div>
                </div>

                {/* Export Experience */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      {isKorean ? "수출 경험" : "Export Experience"}
                    </div>
                    <div className="text-base font-semibold text-gray-900 mt-1">
                      {getLabel(EXPERIENCE_OPTIONS, salesStrategy.experience)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  {t("app.onboarding.step1.nextButton", "다음 단계")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          ) : (
            // No data found
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                {isKorean
                  ? "설문 정보를 찾을 수 없습니다. 계속 진행하시겠습니까?"
                  : "Survey information not found. Would you like to continue?"}
              </p>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                {t("app.onboarding.step1.nextButton", "다음 단계")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
