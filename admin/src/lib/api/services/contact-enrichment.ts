import { apiFetch } from "@/lib/api/client"

// Types
export type EmailStatusResult = {
  total: number
  withEmail: number
  withoutEmail: number
  leads: Array<{
    id: string
    companyName: string | null
    websiteUrl: string | null
    hasEmail: boolean
    primaryEmail: string | null
  }>
}

export type EnrichmentProgress = {
  type: "init" | "progress" | "complete" | "error"
  processed: number
  total: number
  percentage: number
  currentLead?: {
    id: string
    companyName: string | null
  }
  completedLeadId?: string
  result?: SingleEnrichmentResult
  stats?: {
    success: number
    failed: number
    skipped: number
  }
  error?: string
}

export type SingleEnrichmentResult = {
  leadId: string
  companyName: string | null
  success: boolean
  emails: Array<{ value: string; type: string; confidence?: number }>
  socialLinks?: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  companyInfo?: {
    description?: string
    industry?: string
  }
  error?: string
}

export type EnrichmentBatchResult = {
  total: number
  success: number
  failed: number
  skipped: number
  results: SingleEnrichmentResult[]
}

export type ApplyResultsResponse = {
  applied: number
  skipped: number
  errors: Array<{ leadId: string; error: string }>
}

export type EnrichmentCallbacks = {
  onInit?: (data: EnrichmentProgress) => void
  onProgress?: (data: EnrichmentProgress) => void
  onComplete?: (data: EnrichmentProgress) => void
  onError?: (error: string) => void
}

export const contactEnrichmentApi = {
  /**
   * 리드들의 이메일 상태 확인
   */
  checkEmailStatus: async (leadIds: string[]): Promise<EmailStatusResult> => {
    const response = await apiFetch<{ success: boolean; data: EmailStatusResult; error?: string }>(
      `/api/v1/contact-enrichment/check-email-status?leadIds=${leadIds.join(",")}`,
    )
    if (!response.success) {
      throw new Error(response.error || "이메일 상태 확인 실패")
    }
    return response.data
  },

  /**
   * 이메일 없는 리드 목록 조회
   */
  getLeadsWithoutEmail: async (
    leadIds: string[],
  ): Promise<Array<{ id: string; companyName: string | null; websiteUrl: string | null }>> => {
    const response = await apiFetch<{
      success: boolean
      data: Array<{ id: string; companyName: string | null; websiteUrl: string | null }>
      error?: string
    }>(`/api/v1/contact-enrichment/leads-without-email?leadIds=${leadIds.join(",")}`)
    if (!response.success) {
      throw new Error(response.error || "리드 조회 실패")
    }
    return response.data
  },

  /**
   * SSE 기반 배치 Enrichment 실행
   */
  enrichLeadsSSE: (leadIds: string[], callbacks: EnrichmentCallbacks): EventSource => {
    const url = `/api/v1/contact-enrichment/enrich-leads?leadIds=${leadIds.join(",")}`
    const eventSource = new EventSource(url)

    eventSource.addEventListener("init", (event) => {
      const data = JSON.parse(event.data) as EnrichmentProgress
      callbacks.onInit?.(data)
    })

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data) as EnrichmentProgress
      callbacks.onProgress?.(data)
    })

    eventSource.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data) as EnrichmentProgress
      callbacks.onComplete?.(data)
      eventSource.close()
    })

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data) as { error?: string }
        callbacks.onError?.(data.error || "알 수 없는 오류")
      } else {
        callbacks.onError?.("연결 오류")
      }
      eventSource.close()
    })

    eventSource.onerror = () => {
      callbacks.onError?.("연결이 끊어졌습니다")
      eventSource.close()
    }

    return eventSource
  },

  /**
   * 일반 POST 기반 배치 Enrichment 실행 (완료 대기)
   */
  enrichLeads: async (leadIds: string[]): Promise<EnrichmentBatchResult> => {
    const response = await apiFetch<{
      success: boolean
      data: EnrichmentBatchResult
      error?: string
    }>("/api/v1/contact-enrichment/enrich-leads", {
      method: "POST",
      body: JSON.stringify({ leadIds }),
    })
    if (!response.success) {
      throw new Error(response.error || "Enrichment 실패")
    }
    return response.data
  },

  /**
   * Enrichment 결과를 DB에 저장 (수동 적용)
   */
  applyResults: async (results: SingleEnrichmentResult[]): Promise<ApplyResultsResponse> => {
    const response = await apiFetch<{
      success: boolean
      data: ApplyResultsResponse
      error?: string
    }>("/api/v1/contact-enrichment/apply-results", {
      method: "POST",
      body: JSON.stringify({ results }),
    })
    if (!response.success) {
      throw new Error(response.error || "결과 적용 실패")
    }
    return response.data
  },
}
