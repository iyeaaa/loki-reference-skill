/**
 * Lead Import Service
 * Excel/CSV 파일 업로드 및 리드 임포트 관련 API 호출
 */

import { API_BASE_URL, apiFetch, getToken } from "../client"

export interface ProgressLog {
  timestamp: number
  message: string
  type: "info" | "success" | "warning" | "error"
  processed?: number
  total?: number
}

export interface SheetNamesResponse {
  success: boolean
  sheetNames: string[]
  error?: string
}

export interface DuplicateEmailInfo {
  email: string
  existingLeadId: string
  rowNumber: number
  companyName: string | null
}

export interface SkippedLeadInfo {
  rowNumber: number
  companyName: string | null
  websiteUrl: string | null
  reason: string
  existingLeadId?: string
}

export interface ImportProgress {
  type: "init" | "progress" | "complete" | "error"
  message?: string
  timestamp?: string
  total?: number
  processed?: number
  success?: number
  skipped?: number
  failed?: number
  currentRow?: number
  currentCompanyName?: string
  skippedLeads?: SkippedLeadInfo[]
  result?: ImportResult
  error?: string
  customerGroupId?: string
  customerGroupName?: string
}

export interface ImportResult {
  total: number
  success: number
  skipped: number
  failed: number
  details: {
    leadsCreated: number
    contactsCreated: number
    socialMediaCreated: number
    productsCreated: number
    sectorsCreated: number
    categoriesCreated: number
    industriesCreated: number
    groupMembersCreated: number
  }
  duplicateEmails: DuplicateEmailInfo[]
  emailsSkipped: number
  skippedLeads: SkippedLeadInfo[]
  groupAssignment: {
    groupId: string
    groupName: string
    membersAdded: number
  } | null
  errors: Array<{
    row: number
    companyName: string | null
    websiteUrl: string | null
    error: string
  }>
  duration: number
}

export interface PreviewLeadData {
  rowNumber: number
  // Lead 메인 정보
  companyName: string | null
  websiteUrl: string | null
  address: string | null
  description: string | null
  employeeCount: string | null
  foundedYear: number | null

  // 연락처 (배열)
  phoneNumbers: string[]
  emails: string[]

  // 소셜 미디어
  facebookUrl: string | null
  instagramUrl: string | null
  twitterUrl: string | null
  linkedinUrl: string | null

  // 관계형 데이터 (배열)
  products: string[]
  businessSectors: string[]
  productCategories: string[]
  industryTypes: string[]
}

export interface PreviewResponse {
  success: boolean
  data?: {
    totalRows: number
    previewRows: number
    leads: PreviewLeadData[]
    sheetName: string
    availableSheets: string[]
    aiAnalysis?: string | null // AI 분석 결과 (최대 10행 분석)
  }
  error?: string
}

/**
 * Excel 파일에서 시트 이름 목록 가져오기
 * CSV 파일의 경우 빈 배열 반환
 */
export async function fetchSheetNames(file: File): Promise<SheetNamesResponse> {
  // CSV 파일인 경우 즉시 빈 배열 반환 (API 호출 불필요)
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith(".csv")) {
    return {
      success: true,
      sheetNames: [],
    }
  }

  const formData = new FormData()
  formData.append("file", file)

  return apiFetch<SheetNamesResponse>("/api/v1/admin/lead-import/sheet-names", {
    method: "POST",
    body: formData,
  })
}

/**
 * Excel 또는 CSV 파일 업로드 및 리드 임포트 (SSE)
 * Note: SSE는 apiFetch를 사용할 수 없으므로 직접 fetch 사용
 */
export async function uploadLeadsFile(params: {
  file: File
  workspaceId: string
  sheetName: string
  customerGroupId?: string
  onProgress?: (progress: ImportProgress) => void
}): Promise<ImportResult> {
  const { file, workspaceId, sheetName, customerGroupId, onProgress } = params

  const formData = new FormData()
  formData.append("file", file)
  formData.append("workspaceId", workspaceId)

  // CSV 파일이 아닌 경우에만 sheetName 전달
  const fileName = file.name.toLowerCase()
  const isCSV = fileName.endsWith(".csv")
  if (!isCSV && sheetName) {
    formData.append("sheetName", sheetName)
  }

  if (customerGroupId) {
    formData.append("customerGroupId", customerGroupId)
  }

  const token = getToken()
  const headers: HeadersInit = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/admin/lead-import/upload`, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `서버 오류 (${response.status})`)
  }

  // SSE 스트림 처리 (SSE 테스트 패턴 적용)
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("응답 스트림을 읽을 수 없습니다")
  }

  const decoder = new TextDecoder()
  console.log("[Lead Import] Starting SSE stream reading...")

  let streamCompleted = false
  let buffer = ""
  let finalResult: ImportResult | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log("[Lead Import] Stream reading completed")
        streamCompleted = true
        break
      }

      // 청크 디코딩 및 버퍼에 추가
      buffer += decoder.decode(value, { stream: true })

      // 완전한 이벤트 처리 (이벤트는 \n\n으로 종료)
      const events = buffer.split("\n\n")

      // 마지막 불완전한 이벤트는 버퍼에 유지
      buffer = events.pop() || ""

      // 완전한 이벤트 처리 (better-sse 패턴)
      for (const eventStr of events) {
        if (!eventStr.trim()) continue

        // Heartbeat 무시
        if (eventStr.trim().startsWith(":")) continue

        // 이벤트 파싱: event: <type>\ndata: <json> 형식
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

        // data 필드가 있는 경우만 처리
        if (eventData) {
          try {
            const data = JSON.parse(eventData)
            console.log(`[Lead Import] Received event: ${eventType || data.type}`, data)

            // 이벤트 타입별 처리
            const type = data.type || eventType
            if (type === "init") {
              console.log("[Lead Import] Stream initialized", data)
              // init 이벤트는 정보만 표시
            } else if (type === "progress") {
              onProgress?.(data)
            } else if (type === "complete") {
              console.log("[Lead Import] Import complete!", data.result)
              onProgress?.(data)
              finalResult = data.result || null
              streamCompleted = true
            } else if (type === "error") {
              throw new Error(data.error || "임포트 중 오류가 발생했습니다")
            }
          } catch (parseError) {
            console.error("[Lead Import] Failed to parse event:", parseError, eventData)
          }
        }
      }
    }

    if (streamCompleted) {
      console.log("[Lead Import] Stream completed successfully")
    }
  } catch (error) {
    console.error("[Lead Import] Stream error:", error)
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    throw new Error(errorMessage)
  } finally {
    // Reader 해제
    try {
      reader.releaseLock()
      console.log("[Lead Import] Reader released")
    } catch (_releaseError) {
      console.debug("[Lead Import] Reader already released")
    }
  }

  if (!finalResult) {
    console.error("[Lead Import] No final result received. Buffer remaining:", buffer)
    throw new Error("임포트 결과를 받지 못했습니다")
  }

  return finalResult
}

/**
 * Excel 파일 미리보기 (DB 저장 전)
 */
export async function previewLeadsFile(params: {
  file: File
  sheetName?: string
}): Promise<PreviewResponse> {
  const { file, sheetName } = params

  const formData = new FormData()
  formData.append("file", file)
  if (sheetName) {
    formData.append("sheetName", sheetName)
  }

  return apiFetch<PreviewResponse>("/api/v1/admin/lead-import/preview", {
    method: "POST",
    body: formData,
  })
}
