import { API_BASE_URL } from "@/lib/api/client"
import type {
  ExtractionProgress,
  ExtractionResult,
  WebExtractionProgressCallback,
  WebExtractionUploadRequest,
  WebsiteAnalysisCallbacks,
  WebsiteAnalysisRequest,
} from "../types/web-extraction"

export const webExtractionApi = {
  /**
   * Upload file and extract web data with SSE progress updates
   */
  uploadAndExtract: async (
    request: WebExtractionUploadRequest,
    callbacks: WebExtractionProgressCallback,
  ): Promise<void> => {
    const { file, workspaceId, searchCriteria } = request
    const { onProgress, onComplete, onError } = callbacks

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("workspaceId", workspaceId)

      // Add search criteria if provided
      if (searchCriteria && searchCriteria.length > 0) {
        formData.append("searchCriteria", JSON.stringify(searchCriteria))
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/web-extraction/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다")
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let lastProgress: ExtractionProgress | null = null // 마지막 progress 데이터 저장

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() || ""

          for (const eventStr of events) {
            if (!eventStr.trim() || eventStr.trim().startsWith(":")) {
              continue
            }

            const lines = eventStr.split("\n")
            let eventType: string | undefined
            let eventData: string | undefined

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6)
              }
            }

            if (eventData) {
              try {
                const data = JSON.parse(eventData)
                const type = data.type || eventType

                if (type === "init") {
                  const initProgress = {
                    status: "processing" as const,
                    total: data.total || 0,
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
                    message: data.message,
                  }
                  lastProgress = initProgress
                  onProgress(initProgress)
                } else if (type === "progress") {
                  lastProgress = data
                  onProgress(data)
                } else if (type === "complete") {
                  // 마지막 progress 데이터와 complete 데이터 병합
                  const completeProgress = {
                    ...(lastProgress || {}),
                    ...data,
                    status: "completed" as const,
                  }
                  onProgress(completeProgress)
                  if (data.jobId) {
                    onComplete(data.jobId, completeProgress)
                  }
                } else if (type === "error") {
                  throw new Error(data.error || "추출 중 오류가 발생했습니다")
                }
              } catch (parseError) {
                console.error("Failed to parse event:", parseError)
                if (parseError instanceof Error) {
                  onError(parseError)
                }
              }
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // Ignore release errors
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        onError(error)
      } else {
        onError(new Error("업로드 중 알 수 없는 오류가 발생했습니다"))
      }
    }
  },

  /**
   * Download extraction results
   */
  downloadResults: async (jobId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/web-extraction/results/${jobId}`)

    if (!response.ok) {
      throw new Error("다운로드 실패")
    }

    return response.blob()
  },

  /**
   * Get extraction results as JSON
   */
  getResults: async (jobId: string): Promise<unknown[]> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin/web-extraction/results/${jobId}/json`,
    )

    if (!response.ok) {
      throw new Error("결과를 가져오는데 실패했습니다")
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || "결과를 가져오는데 실패했습니다")
    }

    return data.data || []
  },

  /**
   * Cleanup extraction results
   */
  cleanup: async (jobId: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/api/v1/admin/web-extraction/cleanup/${jobId}`, {
      method: "DELETE",
    })
  },

  /**
   * Analyze single URL (structured JSON response for web-extraction)
   */
  analyzeUrl: async (request: {
    websiteUrl: string
    workspaceId: string
    searchCriteria?: string[]
  }): Promise<{
    success: boolean
    error?: string
    data?: ExtractionResult
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/web-extraction/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `서버 오류 (${response.status})`)
    }

    return response.json()
  },

  /**
   * Analyze single website URL with SSE streaming updates
   */
  analyzeWebsite: async (
    request: WebsiteAnalysisRequest,
    callbacks: WebsiteAnalysisCallbacks,
  ): Promise<void> => {
    const { websiteUrl, workspaceId } = request
    const { onInit, onProgress, onPageFound, onComplete, onError, onChunk } = callbacks

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/admin/web-extraction/lead-discovery/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            websiteUrl,
            workspaceId,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() || ""

          for (const eventStr of events) {
            if (!eventStr.trim() || eventStr.trim().startsWith(":")) {
              continue
            }

            const lines = eventStr.split("\n")
            let eventType: string | undefined
            let eventData: string | undefined

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6)
              }
            }

            if (eventData) {
              try {
                const data = JSON.parse(eventData)
                const type = data.type || eventType

                if (type === "init") {
                  if (onInit) {
                    onInit(data.message || "분석을 시작합니다")
                  }
                } else if (type === "progress") {
                  if (onProgress) {
                    onProgress(
                      data.status || "processing",
                      data.message || "데이터를 처리하고 있습니다",
                    )
                  }
                } else if (type === "page_found") {
                  onPageFound?.({
                    url: data.url,
                    title: data.title,
                    contentLength: data.contentLength,
                  })
                } else if (type === "chunk") {
                  onChunk?.(data.content || "")
                } else if (type === "complete") {
                  onComplete(true, null)
                } else if (type === "error") {
                  onError(data.error || "분석 중 오류가 발생했습니다")
                }
              } catch (parseError) {
                console.error("Failed to parse event:", parseError)
              }
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // Ignore release errors
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        onError(error.message)
      } else {
        onError("분석 중 알 수 없는 오류가 발생했습니다")
      }
    }
  },
}
