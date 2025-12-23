/**
 * StepLeadCheck Component
 *
 * Step 2: 리드 확인 - CSV 업로드 또는 AI 자동 생성
 * SSE를 통해 실시간으로 백엔드 진행 상황을 표시
 */

import { ArrowRight, CheckCircle2, Upload, Users, XCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useOnboardingProgress, useOnboardingSSE } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { cn } from "@/lib/utils"

type ViewState = "initial" | "generating" | "complete" | "error"

/**
 * Fake Progress Hook
 * UX Best Practice: Progress bar should never stop (Nielsen Norman Group)
 * - Slowly increases from 0% to maxFakeProgress while waiting for real data
 * - Uses easing: starts slow, speeds up over time
 * - Transitions smoothly to real progress when SSE data arrives
 */
function useFakeProgress(realProgress: number, isActive: boolean, maxFakeProgress = 15): number {
  const [fakeProgress, setFakeProgress] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isActive) {
      setFakeProgress(0)
      startTimeRef.current = null
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    // If real progress arrived, use it
    if (realProgress > 0) {
      setFakeProgress(0) // Reset fake progress
      return
    }

    // Start fake progress animation
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    const animate = () => {
      if (!startTimeRef.current) {
        return
      }

      const elapsed = Date.now() - startTimeRef.current
      // Easing: slow start, accelerates over time (ease-in-quad)
      // Reaches maxFakeProgress in ~30 seconds
      const duration = 30_000
      const t = Math.min(elapsed / duration, 1)
      const easedProgress = t * t * maxFakeProgress // Quadratic easing

      setFakeProgress(easedProgress)

      if (t < 1 && realProgress === 0) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isActive, realProgress, maxFakeProgress])

  // Return real progress if available, otherwise fake progress
  return realProgress > 0 ? realProgress : fakeProgress
}

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

  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Get onboarding progress from DB
  const { data: onboardingData, refetch: refetchOnboarding } = useOnboardingProgress(
    workspaceId,
    !!workspaceId,
  )

  // SSE for real-time progress updates
  const {
    progress: sseProgress,
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

  // UX: Fake progress for initial loading (prevents 0% stall)
  const displayProgress = useFakeProgress(
    progressPercent,
    viewState === "generating",
    15, // Max fake progress before real data arrives
  )

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
              <StarSpinner size={40} />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {message || (isKorean ? "바이어 찾는 중" : "Finding buyers")}
            </h2>
            <p className="mb-2 text-center text-gray-500 text-sm">
              {isKorean
                ? "바이어 30명 + 이메일 90개 작성 중"
                : "Finding 30 buyers + writing 90 emails"}
            </p>
            <div className="mt-6 w-full max-w-xs">
              <Progress className="h-2" value={displayProgress} />
              <div className="mt-2 flex justify-between text-gray-500 text-sm">
                <span>{Math.round(displayProgress)}%</span>
              </div>
            </div>
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
              {isKorean ? "잠깐 문제가 생겼어요" : "Something went wrong"}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {isKorean ? "다시 시도해 주세요" : "Please try again"}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRetry}>
              {isKorean ? "다시 시도" : "Try again"}
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
              {isKorean ? "바이어 찾기 완료!" : "Found your buyers!"}
            </h2>
            <div className="mb-6 flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-600 text-lg">{leadCount || "N/A"}</span>
              <span className="text-gray-600">{isKorean ? "명" : "buyers"}</span>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleComplete}>
              {isKorean ? "다음" : "Next"}
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
            {isKorean ? "이미 보유한 바이어 리스트가 있나요?" : "Do you have existing buyer lists?"}
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
                  {isKorean ? "다른 파일 업로드하려면 클릭" : "Click to upload a different file"}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  {isKorean ? "CSV 파일을 여기에 드래그하세요" : "Drag & drop a CSV file here"}
                </p>
                <p className="mt-1 text-gray-500 text-sm">
                  {isKorean ? "또는 클릭해서 업로드" : "or click to upload"}
                </p>
              </>
            )}
          </div>

          {/* Next Button - only show when file is uploaded */}
          {uploadedFile && (
            <Button className="mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
              {isKorean ? "다음" : "Next"}
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
              {isKorean ? "없어요, 자동으로 찾아주세요" : "No, find buyers automatically"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
