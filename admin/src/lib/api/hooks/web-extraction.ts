import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import toast from "react-hot-toast"
import { webExtractionApi } from "../services/web-extraction"
import type {
  ExtractionProgress,
  PageInfo,
  WebExtractionUploadRequest,
  WebsiteAnalysisRequest,
} from "../types/web-extraction"

// Custom hook for managing web extraction with progress
export function useWebExtraction() {
  const [progress, setProgress] = useState<ExtractionProgress | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (request: WebExtractionUploadRequest) => {
      setIsProcessing(true)
      setProgress(null)
      setJobId(null)

      return webExtractionApi.uploadAndExtract(request, {
        onProgress: (progressData) => {
          setProgress(progressData)
        },
        onComplete: (completedJobId, finalProgress) => {
          setJobId(completedJobId)
          setProgress(finalProgress)
          setIsProcessing(false)
        },
        onError: (error) => {
          setProgress({
            status: "error",
            total: 0,
            processed: 0,
            success: 0,
            errors: 0,
            emailFound: 0,
            phoneFound: 0,
            addressFound: 0,
            socialFound: 0,
            gptRequests: 0,
            percentage: 0,
            elapsedTime: 0,
            estimatedTimeRemaining: 0,
            itemsPerSecond: 0,
            errorDetails: error.message,
          })
          setIsProcessing(false)
          throw error
        },
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || "업로드 중 오류가 발생했습니다")
    },
  })

  return {
    progress,
    jobId,
    isProcessing,
    upload: uploadMutation.mutate,
    uploadAsync: uploadMutation.mutateAsync,
    reset: () => {
      setProgress(null)
      setJobId(null)
      setIsProcessing(false)
    },
  }
}

// Download results mutation
export function useDownloadResults() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const blob = await webExtractionApi.downloadResults(jobId)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `web_extraction_results_${jobId}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return jobId
    },
    onSuccess: () => {
      toast.success("결과 다운로드가 완료되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "다운로드 중 오류가 발생했습니다")
    },
  })
}

// Cleanup results mutation
export function useCleanupResults() {
  return useMutation({
    mutationFn: (jobId: string) => webExtractionApi.cleanup(jobId),
    onError: (error: Error) => {
      console.error("Cleanup error:", error)
    },
  })
}

// 단일 웹사이트 분석 훅 (스트리밍)
export type WebsiteAnalysisState = {
  status: "idle" | "crawling" | "analyzing" | "streaming" | "complete" | "error"
  message: string
  streamingContent: string
  foundPages: PageInfo[]
  error: string | null
}

export type UseWebsiteAnalysisOptions = {
  onContentUpdate?: (content: string) => void
}

export function useWebsiteAnalysis(options?: UseWebsiteAnalysisOptions) {
  const [state, setState] = useState<WebsiteAnalysisState>({
    status: "idle",
    message: "",
    streamingContent: "",
    foundPages: [],
    error: null,
  })

  const analyze = useCallback(
    async (request: WebsiteAnalysisRequest): Promise<string> => {
      // 초기 상태 리셋 - 백엔드가 모든 과정을 관리함
      setState({
        status: "idle",
        message: "서버에 연결 중...",
        streamingContent: "",
        foundPages: [],
        error: null,
      })

      return new Promise((resolve) => {
        let accumulatedContent = ""

        webExtractionApi.analyzeWebsite(request, {
          onInit: (message) => {
            setState((prev) => ({
              ...prev,
              message,
            }))
          },
          onProgress: (status, message) => {
            setState((prev) => ({
              ...prev,
              status: status as WebsiteAnalysisState["status"],
              message,
            }))
          },
          onPageFound: (pageInfo) => {
            setState((prev) => ({
              ...prev,
              foundPages: [...prev.foundPages, pageInfo],
            }))
          },
          onChunk: (content) => {
            accumulatedContent += content

            // Call the callback directly for immediate updates
            if (options?.onContentUpdate) {
              options.onContentUpdate(accumulatedContent)
            }

            // Use functional update to ensure we're working with latest state
            setState((prev) => ({
              ...prev,
              status: "streaming" as const,
              streamingContent: accumulatedContent,
            }))
          },
          onComplete: () => {
            setState((prev) => ({
              ...prev,
              status: "complete",
              message: "분석이 완료되었습니다",
            }))
            resolve(accumulatedContent)
          },
          onError: (error) => {
            console.error("[useWebsiteAnalysis] onError:", error)
            setState({
              status: "error",
              message: error,
              streamingContent: "",
              foundPages: [],
              error,
            })
            resolve("")
          },
        })
      })
    },
    [options],
  )

  const reset = useCallback(() => {
    setState({
      status: "idle",
      message: "",
      streamingContent: "",
      foundPages: [],
      error: null,
    })
  }, [])

  return {
    ...state,
    isAnalyzing:
      state.status === "crawling" || state.status === "analyzing" || state.status === "streaming",
    analyze,
    reset,
  }
}
