/**
 * Lead Import Service
 * Excel 파일 업로드 및 리드 임포트 관련 API 호출
 */

import { API_BASE_URL, apiFetch, getToken } from "../client"

export interface SheetNamesResponse {
  success: boolean
  sheetNames: string[]
  error?: string
}

export interface ImportProgress {
  type: "progress" | "complete" | "error"
  total?: number
  processed?: number
  success?: number
  skipped?: number
  failed?: number
  currentRow?: number
  currentCompanyName?: string
  result?: ImportResult
  error?: string
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
  errors: Array<{
    row: number
    companyName: string | null
    websiteUrl: string | null
    error: string
  }>
  duration: number
}

/**
 * Excel 파일에서 시트 이름 목록 가져오기
 */
export async function fetchSheetNames(file: File): Promise<SheetNamesResponse> {
  const formData = new FormData()
  formData.append("file", file)

  return apiFetch<SheetNamesResponse>("/api/v1/admin/lead-import/sheet-names", {
    method: "POST",
    body: formData,
  })
}

/**
 * Excel 파일 업로드 및 리드 임포트 (SSE)
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
  formData.append("sheetName", sheetName)
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

  // SSE 스트림 처리
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error("응답 스트림을 읽을 수 없습니다")
  }

  let buffer = ""
  let finalResult: ImportResult | null = null

  console.log("Starting SSE stream reading...")

  while (true) {
    const { done, value } = await reader.read()

    console.log("SSE chunk received:", { done, valueLength: value?.length })

    if (done) {
      console.log("SSE stream completed")
      break
    }

    buffer += decoder.decode(value, { stream: true })
    console.log("Current buffer:", buffer.substring(0, 200))

    // SSE 메시지 파싱 (data: {...}\n\n 형식)
    const messages = buffer.split("\n\n")
    buffer = messages.pop() || "" // 마지막 불완전한 메시지는 버퍼에 남김

    console.log("Messages to process:", messages.length)

    for (const message of messages) {
      if (!message.trim()) continue

      // "data: " 접두사 제거
      const dataStr = message.replace(/^data:\s*/, "")
      if (!dataStr) continue

      console.log("Parsing SSE message:", dataStr.substring(0, 100))

      try {
        const progress: ImportProgress = JSON.parse(dataStr)
        console.log("Parsed progress:", progress.type, progress)

        if (progress.type === "progress") {
          onProgress?.(progress)
        } else if (progress.type === "complete") {
          console.log("Import complete!", progress.result)
          onProgress?.(progress)
          finalResult = progress.result || null
        } else if (progress.type === "error") {
          throw new Error(progress.error || "임포트 중 오류가 발생했습니다")
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError)
        console.error("Raw message:", dataStr)
        // JSON 파싱 에러가 발생해도 계속 진행
      }
    }
  }

  console.log("Final result:", finalResult)

  if (!finalResult) {
    console.error("No final result received. Buffer remaining:", buffer)
    throw new Error("임포트 결과를 받지 못했습니다")
  }

  return finalResult
}
