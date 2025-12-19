/**
 * StepLeadCheck Component
 *
 * Step 2: 리드 확인 - CSV 업로드 또는 AI 자동 생성
 * SSE를 통해 실시간으로 백엔드 진행 상황을 표시
 */

import { ArrowRight, CheckCircle2, Loader2, Upload, Users, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useOnboardingProgress, useOnboardingSSE } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { cn } from "@/lib/utils"

type ViewState = "initial" | "generating" | "complete" | "error"

export function StepLeadCheck() {
  const { i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [viewState, setViewState] = useState<ViewState>("initial")
  const isKorean = i18n.language === "ko"

  // Get current user and workspace
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  })()
  const userId = currentUser?.id || ""

  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Get onboarding progress from DB
  const { data: onboardingData, refetch: refetchOnboarding } = useOnboardingProgress(
    workspaceId,
    !!workspaceId,
  )

  // SSE for real-time progress updates
  const {
    progress: sseProgress,
    phase,
    progressPercent,
    message,
    isComplete: sseComplete,
    hasError: sseError,
  } = useOnboardingSSE(workspaceId, {
    enabled: viewState === "generating" && !!workspaceId,
    onComplete: () => {
      console.log("[StepLeadCheck] SSE complete event received")
      setViewState("complete")
      refetchOnboarding()
    },
    onError: (event) => {
      console.error("[StepLeadCheck] SSE error event received:", event)
      setViewState("error")
    },
  })

  // Check if job is already running on mount
  useEffect(() => {
    if (onboardingData?.jobStatus === "active" || onboardingData?.jobStatus === "waiting") {
      console.log("[StepLeadCheck] Job already running, switching to generating view")
      setViewState("generating")
    } else if (
      onboardingData?.jobStatus === "completed" &&
      onboardingData?.selectedLeadIds?.length
    ) {
      console.log("[StepLeadCheck] Job already completed")
      setViewState("complete")
    }
  }, [onboardingData?.jobStatus, onboardingData?.selectedLeadIds])

  // Handle SSE phase changes
  useEffect(() => {
    if (sseComplete && viewState === "generating") {
      setViewState("complete")
      refetchOnboarding()
    }
    if (sseError && viewState === "generating") {
      setViewState("error")
    }
  }, [sseComplete, sseError, viewState, refetchOnboarding])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  })

  const handleNext = () => {
    setSearchParams({ step: "3" })
  }

  const handleAutoGenerate = () => {
    // Job is already triggered during auth, just switch to generating view
    // to start listening to SSE progress
    console.log("[StepLeadCheck] Starting to listen for SSE progress")
    setViewState("generating")
  }

  const handleComplete = () => {
    setSearchParams({ step: "3" })
  }

  const handleRetry = () => {
    setViewState("generating")
  }

  // Get lead count from SSE progress or DB
  const getLeadCount = (): number => {
    // From SSE progress details
    if (sseProgress?.details?.leadsFound) {
      return sseProgress.details.leadsFound
    }
    if (sseProgress?.details?.leadsEnriched) {
      return sseProgress.details.leadsEnriched
    }
    // From DB
    if (onboardingData?.selectedLeadIds?.length) {
      return onboardingData.selectedLeadIds.length
    }
    return 0
  }

  // 자동 생성 중 화면
  if (viewState === "generating") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {message ||
                (isKorean ? "맞춤 리드를 생성하고 있습니다..." : "Generating custom leads...")}
            </h2>
            <p className="mb-2 text-center text-gray-500 text-sm">
              {isKorean
                ? "AI가 귀사에 최적화된 해외 바이어를 찾고 있습니다"
                : "AI is finding the best overseas buyers for your business"}
            </p>
            <div className="mt-6 w-full max-w-xs">
              <Progress className="h-2" value={progressPercent} />
              <div className="mt-2 flex justify-between text-gray-500 text-sm">
                <span>{phase || "init"}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
            {/* Show details if available (templates/previews only) */}
            {sseProgress?.details && (
              <div className="mt-4 text-center text-gray-500 text-xs">
                {sseProgress.details.templatesGenerated !== undefined &&
                  sseProgress.details.totalTemplates && (
                    <p>
                      {isKorean
                        ? `템플릿 ${sseProgress.details.templatesGenerated}/${sseProgress.details.totalTemplates}`
                        : `Templates ${sseProgress.details.templatesGenerated}/${sseProgress.details.totalTemplates}`}
                    </p>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 에러 화면
  if (viewState === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "리드 생성 중 오류가 발생했습니다" : "Error generating leads"}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {sseProgress?.details?.error ||
                (isKorean ? "잠시 후 다시 시도해주세요" : "Please try again later")}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRetry}>
              {isKorean ? "다시 시도" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 생성 완료 화면
  if (viewState === "complete") {
    const leadCount = getLeadCount()

    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "맞춤 리드 생성 완료!" : "Custom leads generated!"}
            </h2>
            <div className="mb-6 flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-600 text-lg">{leadCount || "N/A"}</span>
              <span className="text-gray-600">
                {isKorean ? "개의 리드가 생성되었습니다" : "leads generated"}
              </span>
            </div>
            <p className="mb-8 text-center text-gray-500 text-sm">
              {isKorean
                ? "귀사의 산업군과 타겟 국가에 최적화된 바이어 리스트입니다"
                : "Buyer list optimized for your industry and target country"}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleComplete}>
              {isKorean ? "다음 단계" : "Next Step"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 초기 화면
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-center px-8 py-12">
          {/* Title */}
          <h2 className="mb-8 text-center font-semibold text-2xl text-gray-900">
            {isKorean ? "보유한 리드가 있으신가요?" : "Do you have existing leads?"}
          </h2>

          {/* CSV Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : uploadedFile
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50",
            )}
          >
            <input {...getInputProps()} />
            <Upload
              className={cn("mb-4 h-12 w-12", uploadedFile ? "text-green-500" : "text-gray-400")}
            />
            {uploadedFile ? (
              <>
                <p className="font-medium text-green-700">{uploadedFile.name}</p>
                <p className="mt-1 text-gray-500 text-sm">
                  {isKorean
                    ? "다른 파일을 업로드하려면 클릭하세요"
                    : "Click to upload a different file"}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  {isKorean
                    ? "CSV 파일을 드래그하거나 클릭하여 업로드"
                    : "Drag & drop a CSV file or click to upload"}
                </p>
                <p className="mt-1 text-gray-500 text-sm">
                  {isKorean ? "리드 목록이 포함된 CSV 파일" : "CSV file containing your lead list"}
                </p>
              </>
            )}
          </div>

          {/* Next Button - only show when file is uploaded */}
          {uploadedFile && (
            <Button className="mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
              {isKorean ? "다음 단계" : "Next Step"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {/* Auto Generate Button */}
          <div className="mt-8 flex w-full flex-col items-center gap-2">
            <span className="text-gray-500 text-sm">{isKorean ? "또는" : "or"}</span>
            <Button
              className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={handleAutoGenerate}
              size="lg"
              variant="outline"
            >
              {isKorean
                ? "아니오, AI가 자동으로 생성해주세요"
                : "No, let AI generate leads automatically"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
