import {
  ArrowRight,
  CheckCircle,
  FileText,
  Globe,
  Lightbulb,
  Loader2,
  Settings,
  Sparkles,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
// import { Switch } from "@/components/ui/switch" // Temporarily hidden
// Select 컴포넌트 - 설문 드롭다운 제거로 인해 사용하지 않음
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
import { trackOnboardingStep1Complete } from "@/lib/analytics"
import { apiFetch } from "@/lib/api/client"
import {
  useAnalyzeCompanyFile,
  useCompanyDescriptionAIEnhance,
  useCompleteStep1,
  useOnboardingProgress,
} from "@/lib/api/hooks/onboarding"
import {
  usePatchWorkspace,
  useTranslateCompanyName,
  useUserWorkspaces,
} from "@/lib/api/hooks/workspaces"
import { getSurveyFromStorage } from "@/store/survey"

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

// 설문 드롭다운 옵션들 - 온보딩 플로우 간소화로 회사정보 UI에서 제거됨
// 설문 데이터는 이제 온보딩 설문 페이지(/trial/survey)에서만 수집

export function StepCompanyInfo() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Generate unique IDs for form fields
  const websiteUrlId = useId()

  // Form state for editing - initialize with survey data from localStorage
  // 기본값: target="b2b", experience="none" (설문에서 수집하지 않는 필드)
  const [editedData, setEditedData] = useState<SalesStrategyData>(() => {
    const surveyData = getSurveyFromStorage()
    return {
      companyName: "",
      companyNameEn: "",
      companyDescription: "",
      industry: surveyData?.industry || "",
      target: surveyData?.target || "b2b",
      country: surveyData?.country || "",
      experience: surveyData?.experience || "none",
      websiteUrl: "",
      includeSignature: true,
    }
  })

  // Validation error state
  const [errors, setErrors] = useState<{
    companyName?: boolean
    companyDescription?: boolean
  }>({})

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isFilledByAI, setIsFilledByAI] = useState(false)
  const analyzeFileMutation = useAnalyzeCompanyFile()

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

  // File upload handlers
  const handleFileSelect = useCallback(
    (file: File) => {
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ]
      const allowedExtensions = [".pdf", ".docx", ".pptx", ".txt"]
      const fileName = file.name.toLowerCase()

      const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext))
      const hasValidMimeType = allowedTypes.includes(file.type)

      if (!(hasValidExtension || hasValidMimeType)) {
        toast.error(
          isKorean
            ? "지원하지 않는 파일 형식입니다. PDF, DOCX, PPTX, TXT 파일만 가능합니다."
            : "Unsupported file format. Only PDF, DOCX, PPTX, TXT files are allowed.",
        )
        return
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error(
          isKorean ? "파일 크기는 20MB를 초과할 수 없습니다." : "File size cannot exceed 20MB.",
        )
        return
      }

      setUploadedFileName(file.name)

      analyzeFileMutation.mutate(file, {
        onSuccess: (result) => {
          setIsFilledByAI(true)
          setEditedData((prev) => ({
            ...prev,
            companyName: result.companyName || prev.companyName,
            companyNameEn: result.companyNameEn || prev.companyNameEn,
            companyDescription: result.companyDescription || prev.companyDescription,
            websiteUrl: result.websiteUrl || prev.websiteUrl,
            industry: result.industry || prev.industry,
          }))
          // Clear validation errors if fields are filled
          setErrors({})
          toast.success(
            isKorean ? "회사 소개서 분석이 완료되었습니다!" : "Company profile analysis completed!",
          )
        },
        onError: () => {
          setUploadedFileName(null)
        },
      })
    },
    [analyzeFileMutation, isKorean],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  const clearUploadedFile = useCallback(() => {
    setUploadedFileName(null)
    setIsFilledByAI(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // 프로필 완성도 계산
  const profileCompleteness = useMemo(() => {
    let score = 0
    // 회사명 (20점)
    if (editedData.companyName?.trim().length >= 2) {
      score += 20
    }
    // 회사 설명 (50점 - 길이에 따라)
    const descLength = editedData.companyDescription?.trim().length || 0
    if (descLength >= 30) {
      score += 25
    }
    if (descLength >= 80) {
      score += 15
    }
    if (descLength >= 150) {
      score += 10
    }
    // 웹사이트 (30점)
    if (editedData.websiteUrl?.trim()) {
      score += 30
    }

    return Math.min(score, 100)
  }, [editedData.companyName, editedData.companyDescription, editedData.websiteUrl])

  const completenessLevel = useMemo(() => {
    if (profileCompleteness >= 80) {
      return "excellent"
    }
    if (profileCompleteness >= 50) {
      return "good"
    }
    return "basic"
  }, [profileCompleteness])

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

        // Load survey data from localStorage to ensure it's always available
        const surveyData = getSurveyFromStorage()
        console.log("[StepCompanyInfo] 9. Survey data from localStorage:", surveyData)

        if (strategyData) {
          const mergedData: SalesStrategyData = {
            ...strategyData,
            companyName: workspaceData?.companyName || strategyData.companyName || "",
            companyNameEn: workspaceData?.companyNameEn || "",
            companyDescription:
              workspaceData?.companyDescription || strategyData.companyDescription || "",
            // Merge survey data from localStorage to ensure it's not lost
            // 기본값: target="b2b", experience="none" (설문에서 수집하지 않는 필드)
            industry: strategyData.industry || surveyData?.industry || "",
            target: strategyData.target || surveyData?.target || "b2b",
            country: strategyData.country || surveyData?.country || "",
            experience: strategyData.experience || surveyData?.experience || "none",
            websiteUrl: strategyData.websiteUrl || "",
            includeSignature: strategyData.includeSignature ?? true,
          }
          setEditedData(mergedData)
        } else {
          // 데이터가 없으면 workspace 정보 + survey 정보로 초기화
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
            // Preserve survey data from localStorage
            // 기본값: target="b2b", experience="none" (설문에서 수집하지 않는 필드)
            industry: surveyData?.industry || prev.industry || "",
            target: surveyData?.target || prev.target || "b2b",
            country: surveyData?.country || prev.country || "",
            experience: surveyData?.experience || prev.experience || "none",
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

    // 필수 필드 검증 (회사명, 회사 소개만 필수 - 설문 데이터는 온보딩 설문 페이지에서 수집됨)
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
      toast.success(isKorean ? "바이어 찾기를 시작했어요" : "Started finding buyers", {
        description: isKorean
          ? "맞춤 바이어와 영업 이메일을 준비하고 있어요"
          : "Preparing matched buyers and sales emails",
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
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">
            {isKorean ? "RINDA에게 회사를 소개해주세요" : "Tell RINDA about your company"}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {isKorean
              ? "이 정보로 딱 맞는 해외 바이어를 찾아드릴게요"
              : "RINDA will find the perfect international buyers for you"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 가치 제안 배너 - 왜 상세하게 입력해야 하는지 안내 */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Lightbulb className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 text-sm">
                  {isKorean
                    ? "상세하게 입력할수록 더 정확한 바이어를 찾아드려요"
                    : "More details help us find better-matched buyers"}
                </h4>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2 text-gray-600 text-sm">
                    <Target className="h-3.5 w-3.5 text-blue-500" />
                    {isKorean
                      ? "제품 특성 → 관심 있는 바이어만 선별"
                      : "Product details → Filter interested buyers only"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-600 text-sm">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    {isKorean
                      ? "회사 강점 → AI가 설득력 있는 이메일 작성"
                      : "Company strengths → AI writes persuasive emails"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-600 text-sm">
                    <Globe className="h-3.5 w-3.5 text-blue-500" />
                    {isKorean
                      ? "웹사이트 → 바이어에게 신뢰감 전달"
                      : "Website → Build trust with buyers"}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 프로필 완성도 표시기 */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium text-gray-700 text-sm">
                <Users className="h-4 w-4" />
                {isKorean ? "프로필 완성도" : "Profile completeness"}
              </span>
              <span
                className={`font-semibold text-sm ${
                  completenessLevel === "excellent"
                    ? "text-green-600"
                    : completenessLevel === "good"
                      ? "text-blue-600"
                      : "text-gray-500"
                }`}
              >
                {profileCompleteness}%
              </span>
            </div>
            <Progress
              className={`h-2 ${
                completenessLevel === "excellent"
                  ? "[&>div]:bg-green-500"
                  : completenessLevel === "good"
                    ? "[&>div]:bg-blue-500"
                    : "[&>div]:bg-gray-400"
              }`}
              value={profileCompleteness}
            />
            <p className="mt-2 flex items-center gap-1.5 text-gray-500 text-xs">
              {completenessLevel === "excellent" ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {isKorean
                    ? "훌륭해요! 최적의 바이어 매칭이 가능해요"
                    : "Excellent! Best buyer matching available"}
                </>
              ) : completenessLevel === "good" ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                  {isKorean
                    ? "좋아요! 웹사이트를 추가하면 더 좋아요"
                    : "Good! Add your website for better results"}
                </>
              ) : isKorean ? (
                "회사 설명을 더 자세히 적어주세요"
              ) : (
                "Add more details about your company"
              )}
            </p>
          </div>

          {/* 회사 소개서 파일 업로드 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <Label className="font-semibold text-gray-900">
                {isKorean ? "회사 소개서로 자동 입력" : "Auto-fill with company profile"}
              </Label>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 text-xs">
                AI
              </span>
            </div>

            <input
              accept=".pdf,.docx,.pptx,.txt"
              className="hidden"
              onChange={handleFileInputChange}
              ref={fileInputRef}
              type="file"
            />

            {uploadedFileName ? (
              <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-3">
                <div className="flex items-center gap-2">
                  {analyzeFileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-purple-600" />
                  )}
                  <span className="text-purple-800 text-sm">{uploadedFileName}</span>
                  {analyzeFileMutation.isPending && (
                    <span className="text-purple-600 text-xs">
                      {isKorean ? "AI가 분석 중..." : "AI analyzing..."}
                    </span>
                  )}
                  {isFilledByAI && !analyzeFileMutation.isPending && (
                    <span className="text-green-600 text-xs">
                      {isKorean ? "✓ 분석 완료" : "✓ Analysis complete"}
                    </span>
                  )}
                </div>
                <button
                  className="rounded p-1 text-gray-400 hover:bg-purple-100 hover:text-gray-600"
                  onClick={clearUploadedFile}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: Drag and drop zone requires div element
              <div
                className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isDragging
                    ? "border-purple-400 bg-purple-50"
                    : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click()
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 text-gray-600 text-sm">
                  {isKorean
                    ? "회사 소개서를 드래그하거나 클릭하여 업로드"
                    : "Drag & drop or click to upload company profile"}
                </p>
                <p className="mt-1 text-gray-400 text-xs">PDF, DOCX, PPTX, TXT (최대 20MB)</p>
              </div>
            )}

            {isFilledByAI && (
              <p className="flex items-center gap-1.5 text-purple-600 text-xs">
                <Sparkles className="h-3 w-3" />
                {isKorean
                  ? "AI가 소개서에서 정보를 추출했어요. 내용을 확인하고 수정해주세요."
                  : "AI extracted info from your profile. Please review and edit."}
              </p>
            )}
          </div>

          {/* 또는 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-gray-300 border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">
                {isKorean ? "또는 직접 입력" : "or enter manually"}
              </span>
            </div>
          </div>

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
