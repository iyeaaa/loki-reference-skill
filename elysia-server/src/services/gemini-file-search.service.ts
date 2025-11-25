/**
 * Gemini File Search Service
 * Google Gemini File Search (공식 @google/genai 패키지 사용)
 */

import { GoogleGenAI } from "@google/genai"
import * as XLSX from "xlsx"
import { config } from "../config"
import type {
  LeadSearchRequest,
  LeadSearchResponse,
  LeadSearchResult,
  ListStoresResponse,
  UploadCSVRequest,
  UploadCSVResponse,
} from "../types/gemini-file-search.types"
import { GEMINI_CONSTANTS } from "../types/gemini-file-search.types"
import logger from "../utils/logger"

// Gemini AI 인스턴스 (공식 SDK)
let ai: GoogleGenAI
let apiKey: string

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

/**
 * Gemini API 초기화
 */
export function initializeGemini(key?: string): void {
  apiKey = key || config.gemini?.apiKey || process.env.GEMINI_API_KEY || ""

  if (!apiKey) {
    throw new Error("Gemini API key is not configured")
  }

  ai = new GoogleGenAI({ apiKey })
  logger.info("Gemini File Search initialized (official SDK)")
}

/**
 * File Search Store 생성 (공식 SDK)
 */
export async function createFileSearchStore(displayName: string): Promise<{
  name: string
  displayName: string
}> {
  if (!ai) initializeGemini()

  try {
    const ragStore = await ai.fileSearchStores.create({
      config: { displayName },
    })

    if (!ragStore.name) {
      throw new Error("Failed to create RAG store: name is missing.")
    }

    logger.info({ storeName: ragStore.name, displayName }, "File Search Store created successfully")

    return {
      name: ragStore.name,
      displayName: ragStore.displayName || displayName,
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        displayName,
      },
      "Failed to create File Search Store",
    )
    throw error
  }
}

/**
 * 데이터 중복 제거 (이메일 기준)
 */
function deduplicateData(data: Array<Record<string, unknown>>): {
  cleaned: Array<Record<string, unknown>>
  duplicatesRemoved: number
} {
  const seen = new Set<string>()
  const cleaned: Array<Record<string, unknown>> = []
  let duplicatesRemoved = 0

  for (const row of data) {
    // 이메일 필드 찾기 (대소문자 무관)
    const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email"))
    const email = emailKey ? String(row[emailKey]).toLowerCase().trim() : ""

    // 이메일이 있는 경우에만 중복 체크
    if (email && email !== "" && email !== "undefined" && email !== "null") {
      if (seen.has(email)) {
        duplicatesRemoved++
        continue
      }
      seen.add(email)
    }

    // 이메일이 없어도 데이터는 보존
    cleaned.push(row)
  }

  return { cleaned, duplicatesRemoved }
}

/**
 * 데이터 정제 (불필요한 필드 제거, null/undefined 처리)
 */
function cleanData(data: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return data.map((row) => {
    const cleaned: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      // 빈 값이나 불필요한 필드 제거
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "null" ||
        value === "undefined" ||
        key.startsWith("_") || // 내부 필드 제거
        key.toLowerCase().includes("raw") // raw 데이터 제거
      ) {
        continue
      }

      // 문자열 정제 (앞뒤 공백 제거)
      if (typeof value === "string") {
        cleaned[key] = value.trim()
      } else {
        cleaned[key] = value
      }
    }

    return cleaned
  })
}

/**
 * 구조화된 텍스트로 변환 (청킹 최적화)
 * Gemini가 더 잘 이해할 수 있도록 각 레코드를 의미있는 텍스트 블록으로 변환
 *
 * NOTE: 현재 사용하지 않음. Gemini File Search는 CSV 형식을 더 잘 처리함.
 * 추후 필요시 재활성화 가능.
 */
// function convertToStructuredText(
//   data: Array<Record<string, unknown>>,
//   columns: string[],
// ): { text: string; chunkCount: number } {
//   const chunks: string[] = []

//   for (let i = 0; i < data.length; i++) {
//     const row = data[i]
//     if (!row) continue

//     // 각 레코드를 구조화된 텍스트 블록으로 변환
//     const recordLines: string[] = []
//     recordLines.push(`--- 리드 ${i + 1} ---`)

//     // 중요 필드 우선 배치 (회사명, 산업, 이메일 등)
//     const priorityFields = [
//       "company name",
//       "회사명",
//       "company industry",
//       "산업",
//       "industry",
//       "email",
//       "이메일",
//       "full name",
//       "이름",
//       "job title",
//       "직책",
//     ]

//     // 우선순위 필드 먼저 추가
//     for (const field of priorityFields) {
//       const key = columns.find((k) => k.toLowerCase() === field.toLowerCase())
//       if (key && row[key]) {
//         recordLines.push(`${key}: ${row[key]}`)
//       }
//     }

//     // 나머지 필드 추가
//     for (const key of columns) {
//       if (!priorityFields.some((f) => f.toLowerCase() === key.toLowerCase()) && row[key]) {
//         recordLines.push(`${key}: ${row[key]}`)
//       }
//     }

//     recordLines.push("") // 레코드 간 구분을 위한 빈 줄

//     chunks.push(recordLines.join("\n"))
//   }

//   return {
//     text: chunks.join("\n"),
//     chunkCount: chunks.length,
//   }
// }

/**
 * CSV 파일을 File Search Store에 업로드
 * (완전 관리형 RAG - Google이 자동으로 파싱, 청킹, 임베딩, 벡터 저장)
 * + 데이터 전처리 (중복 제거, 정제, 청킹 최적화)
 */
export async function uploadCSVToGemini(request: UploadCSVRequest): Promise<UploadCSVResponse> {
  if (!apiKey) initializeGemini()

  try {
    const { file, metadata, storeName } = request

    // 파일 크기 검증
    if (file.size > GEMINI_CONSTANTS.MAX_FILE_SIZE) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 100MB limit`)
    }

    // CSV 파일 파싱하여 행 수 및 컬럼 정보 추출
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error("No worksheet found")

    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) throw new Error("Failed to read worksheet")

    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    const originalRowCount = jsonData.length

    // 컬럼 정보 추출 (첫 번째 행의 키들)
    const columns = jsonData.length > 0 ? Object.keys(jsonData[0] as Record<string, unknown>) : []

    logger.info(
      { fileName: file.name, totalRows: originalRowCount, columnCount: columns.length },
      "Parsed CSV file",
    )

    // 1단계: 중복 제거
    const { cleaned: deduplicatedData, duplicatesRemoved } = deduplicateData(
      jsonData as Array<Record<string, unknown>>,
    )
    logger.info(
      {
        originalRows: originalRowCount,
        afterDeduplication: deduplicatedData.length,
        duplicatesRemoved,
      },
      "Deduplication completed",
    )

    // 2단계: 데이터 정제
    const cleanedData = cleanData(deduplicatedData)
    logger.info({ cleanedRows: cleanedData.length }, "Data cleaning completed")

    // 데이터가 너무 적으면 에러 발생
    if (cleanedData.length === 0) {
      throw new Error("No valid data remaining after cleaning. Please check your CSV file.")
    }

    // 📊 데이터 샘플 로그 (첫 3개 행)
    logger.info(
      {
        sampleData: cleanedData.slice(0, 3).map((row) => {
          const sample: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            // 긴 값은 잘라서 표시
            if (typeof value === "string" && value.length > 50) {
              sample[key] = `${value.substring(0, 50)}...`
            } else {
              sample[key] = value
            }
          }
          return sample
        }),
        totalColumns: columns.length,
        columnNames: columns,
      },
      "📊 Upload data sample (first 3 rows)",
    )

    // 3단계: 정제된 데이터를 CSV로 다시 변환
    const cleanedWorkbook = XLSX.utils.book_new()
    const cleanedWorksheet = XLSX.utils.json_to_sheet(cleanedData)
    XLSX.utils.book_append_sheet(cleanedWorkbook, cleanedWorksheet, "Sheet1")

    // CSV 버퍼 생성
    const cleanedCsvBuffer = XLSX.write(cleanedWorkbook, { type: "buffer", bookType: "csv" })

    logger.info(
      {
        cleanedRows: cleanedData.length,
        cleanedCsvSize: cleanedCsvBuffer.length,
        originalSize: buffer.length,
        sizeReduction: `${(((buffer.length - cleanedCsvBuffer.length) / buffer.length) * 100).toFixed(1)}%`,
      },
      "Data cleaning and CSV regeneration completed",
    )

    const totalRows = cleanedData.length

    // Store 이름 결정 (기존 Store 재사용 또는 새로 생성)
    let finalStoreName = storeName

    if (!finalStoreName) {
      // 기존 Store 목록 조회하여 워크스페이스에 맞는 Store 찾기
      logger.info({ workspaceId: request.workspaceId }, "Looking for existing File Search Store")
      const allStores = await listFileSearchStores()

      const workspaceStore = allStores.stores.find(
        (store) =>
          store.displayName?.includes(request.workspaceId) ||
          store.displayName?.includes(`Lead DB - ${request.workspaceId}`),
      )

      // 🔍 Store 매칭 로그
      logger.debug(
        {
          allStores: allStores.stores.map((s) => ({
            name: s.name,
            displayName: s.displayName,
          })),
          searchingFor: request.workspaceId,
          found: !!workspaceStore,
        },
        "🔍 Searching for workspace store",
      )

      if (workspaceStore) {
        // 기존 Store 재사용
        finalStoreName = workspaceStore.name
        logger.info(
          { storeName: finalStoreName, displayName: workspaceStore.displayName },
          "✅ Found existing File Search Store, will reuse",
        )
      } else {
        // 새로운 Store 생성
        logger.info(
          { workspaceId: request.workspaceId },
          "No existing store found, creating new one",
        )
        const newStore = await createFileSearchStore(`Lead DB - ${request.workspaceId}`)
        finalStoreName = newStore.name
        logger.info(
          { storeName: finalStoreName, displayName: newStore.displayName },
          "Created new File Search Store",
        )
      }
    } else {
      // storeName이 명시적으로 제공된 경우, 존재 여부 확인
      logger.info({ storeName: finalStoreName }, "Checking if provided File Search Store exists")
      const checkResponse = await fetch(`${GEMINI_API_BASE}/${finalStoreName}?key=${apiKey}`)

      if (!checkResponse.ok) {
        throw new Error(`Provided store '${finalStoreName}' does not exist`)
      }

      logger.info({ storeName: finalStoreName }, "Using provided File Search Store")
    }

    // 1. 공식 SDK로 File Search Store에 직접 업로드
    if (!ai) initializeGemini()

    logger.info(
      { storeName: finalStoreName, fileName: file.name },
      "Uploading cleaned CSV to File Search Store",
    )

    // 정제된 CSV 파일 업로드
    let uploadOp = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: finalStoreName,
      file: new File([cleanedCsvBuffer], file.name, { type: "text/csv" }),
    })

    // 핵심 수정: response 필드가 있으면 업로드 완료! ✨
    const startTime = Date.now() // 여기로 이동하여 스코프 문제 해결
    const MAX_WAIT_TIME = 10 * 60 * 1000 // 10분
    const POLL_INTERVAL = 3000 // 3초
    let pollCount = 0

    // Google GenAI SDK의 Operation은 동적으로 response 필드를 추가함
    type OperationWithResponse = typeof uploadOp & {
      response?: { documentName?: string; parent?: string }
    }

    const opWithResponse = uploadOp as OperationWithResponse
    // biome-ignore lint/complexity/useOptionalChain: response 필드는 동적으로 추가되므로 명시적 체크 필요
    if (opWithResponse.response && opWithResponse.response.documentName) {
      logger.info(
        {
          storeName: finalStoreName,
          fileName: file.name,
          documentName: opWithResponse.response.documentName,
          parent: opWithResponse.response.parent,
        },
        "File uploaded successfully (response field present)",
      )
    } else {
      // response가 없으면 polling 필요
      logger.warn(
        {
          uploadOp: JSON.stringify(uploadOp, null, 2),
        },
        "No response field in upload operation, starting polling",
      )

      while (!uploadOp.done && !(uploadOp as OperationWithResponse).response) {
        pollCount++
        const elapsed = Date.now() - startTime

        if (elapsed > MAX_WAIT_TIME) {
          throw new Error(`Upload timeout after ${MAX_WAIT_TIME / 1000}s (${pollCount} polls)`)
        }

        logger.info(
          {
            pollCount,
            elapsed: `${(elapsed / 1000).toFixed(1)}s`,
            operationName: uploadOp.name,
            done: uploadOp.done,
            hasResponse: !!(uploadOp as OperationWithResponse).response,
          },
          "Polling upload status",
        )

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))

        try {
          uploadOp = await ai.operations.get({ operation: uploadOp })

          // 에러 상태 체크
          if (uploadOp.error) {
            throw new Error(`Upload failed: ${JSON.stringify(uploadOp.error)}`)
          }

          // response 필드가 생겼으면 완료!
          const updatedOp = uploadOp as OperationWithResponse
          if (updatedOp.response) {
            logger.info(
              {
                pollCount,
                documentName: updatedOp.response.documentName,
              },
              "Upload completed (response field appeared)",
            )
            break
          }
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              pollCount,
              elapsed: `${(elapsed / 1000).toFixed(1)}s`,
            },
            "Error polling upload status",
          )
          throw error
        }
      }
    }

    logger.info(
      {
        storeName: finalStoreName,
        fileName: file.name,
        totalRows,
        pollCount,
        totalTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      "File uploaded and indexed successfully",
    )

    // ✅ 업로드 성공 요약 로그
    logger.info(
      {
        storeName: finalStoreName,
        fileName: file.name,
        originalRows: originalRowCount,
        cleanedRows: totalRows,
        duplicatesRemoved,
        retentionRate: `${((totalRows / originalRowCount) * 100).toFixed(1)}%`,
        csvSize: `${(cleanedCsvBuffer.length / 1024).toFixed(1)} KB`,
      },
      "✅ Upload completed - Data summary",
    )

    // 메타데이터 강화 (검색 시 활용)
    const deduplicationRate = ((duplicatesRemoved / originalRowCount) * 100).toFixed(1)
    const retentionRate = ((totalRows / originalRowCount) * 100).toFixed(1)
    const sizeReduction = (
      ((buffer.length - cleanedCsvBuffer.length) / buffer.length) *
      100
    ).toFixed(1)

    const enhancedMetadata = {
      workspaceId: request.workspaceId,
      originalRows: originalRowCount.toString(),
      cleanedRows: totalRows.toString(),
      duplicatesRemoved: duplicatesRemoved.toString(),
      columns: columns.join(", "), // CSV 컬럼 정보
      deduplicationRate: `${deduplicationRate}%`,
      retentionRate: `${retentionRate}%`,
      originalSize: buffer.length.toString(),
      cleanedSize: cleanedCsvBuffer.length.toString(),
      sizeReduction: `${sizeReduction}%`,
      indexingStrategy: "csv_deduplication_and_cleaning",
      ...metadata,
    }

    return {
      success: true,
      storeName: finalStoreName,
      fileName: file.name,
      fileId: finalStoreName, // Store name as file ID
      totalRows,
      message: `CSV uploaded and indexed with ${duplicatesRemoved} duplicates removed (${totalRows}/${originalRowCount} rows retained)`,
      metadata: enhancedMetadata,
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fileName: request.file.name,
      },
      "Failed to upload CSV to Gemini",
    )
    throw error
  }
}

/**
 * File Search Store에서 리드 검색
 * (시맨틱 검색 - 의미 기반)
 */
export async function searchLeads(request: LeadSearchRequest): Promise<LeadSearchResponse> {
  if (!ai) initializeGemini()

  try {
    const startTime = Date.now()
    const { query, filters, limit = 50, storeNames } = request

    // 🔍 검색 시작 로그
    logger.info(
      {
        workspaceId: request.workspaceId,
        query,
        filters,
        limit,
        storeNames: storeNames || "auto-detect",
      },
      "🔍 Starting Gemini file search",
    )

    // Store 이름 결정
    // Note: fileSearch tool은 full store name을 요구함 (fileSearchStores/ prefix 포함)
    let finalStoreNames: string[]

    if (storeNames && storeNames.length > 0) {
      finalStoreNames = storeNames
    } else {
      // 기본 store 이름으로 검색 (실제 존재하는 store를 찾아야 함)
      // 먼저 모든 store를 조회해서 workspaceId와 매칭되는 것을 찾음
      const allStores = await listFileSearchStores()

      logger.info(
        {
          totalStores: allStores.total,
          storeNames: allStores.stores.map((s) => s.name),
          searchingFor: request.workspaceId,
        },
        "Looking for workspace store",
      )

      const workspaceStore = allStores.stores.find(
        (store) =>
          store.name.includes(`lead-db-${request.workspaceId}`) ||
          store.displayName?.includes(request.workspaceId),
      )

      if (workspaceStore) {
        finalStoreNames = [workspaceStore.name]
        logger.info({ foundStore: workspaceStore.name }, "Found workspace store")
      } else {
        // workspaceId가 없으면 가장 최근 Store 사용
        if (allStores.stores.length > 0) {
          const firstStore = allStores.stores[0]
          if (!firstStore) {
            throw new Error(`No File Search Store found. Please upload a file first.`)
          }
          finalStoreNames = [firstStore.name]
          logger.warn(
            {
              workspaceId: request.workspaceId,
              usingStore: finalStoreNames[0],
            },
            "No exact match found, using most recent store",
          )
        } else {
          throw new Error(`No File Search Store found. Please upload a file first.`)
        }
      }
    }

    // ✅ 최종 Store 확정 로그
    logger.info(
      {
        finalStoreNames,
        storeCount: finalStoreNames.length,
        query,
        workspaceId: request.workspaceId,
      },
      "✅ Store selected for search",
    )

    // Store 메타데이터 조회 (컨텍스트 강화)
    let storeMetadata = ""
    try {
      const storeDetails = await fetch(`${GEMINI_API_BASE}/${finalStoreNames[0]}?key=${apiKey}`)
      if (storeDetails.ok) {
        const storeData = (await storeDetails.json()) as { displayName?: string }
        if (storeData?.displayName) {
          storeMetadata = `\n데이터베이스: ${storeData.displayName}`
        }

        // 📊 Store 메타데이터 로그
        logger.debug(
          {
            storeData,
          },
          "📊 Store metadata fetched",
        )
      }
    } catch (error) {
      logger.warn({ error }, "Failed to fetch store metadata")
    }

    // 검색 쿼리 구성 (메타데이터 활용)
    let searchPrompt = `You are a lead search assistant. Search the uploaded lead database for companies matching this query:

Query: "${query}"${storeMetadata}
`

    if (filters && Object.keys(filters).length > 0) {
      searchPrompt += "\nFilters:\n"
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          searchPrompt += `- ${key}: ${value}\n`
        }
      }
    }

    searchPrompt += `

DATABASE QUALITY:
The uploaded data has been preprocessed for quality:
- Duplicates have been removed based on email addresses
- Empty and invalid fields have been cleaned
- All data is validated and normalized

IMPORTANT GUIDELINES:
1. **Return UP TO ${limit} matching companies** - this is your PRIMARY goal
2. **Include companies that match OR are related to the query**
3. **Prioritize Company Industry matches, but include related results too**
4. **Balance quality with quantity** - aim for ${limit} results
5. **Use the structured format to accurately extract field values**

The database contains these fields:
Full name, Industry, Job title, Company Name, Company Industry, Company Size, Emails, Company Website, Location, etc.

EXTRACTION REQUIREMENTS:
Extract these exact values from the database source for EACH match:
- Company Name (from database)
- Company Industry (from database) - MUST match query topic
- Company Size (from database)
- Emails (from database)
- Full name (contact person from database)
- Job title (from database)
- Company Website (from database)
- Location (from database)

ANALYSIS FIELDS:
Generate these based on your analysis:
- matchReason: Explain WHY the Company Industry field matches the query
- confidenceScore: 0.7-1.0 for strong matches ONLY

MATCHING RULES:
- If query asks for "IT companies", prioritize Company Industry: technology/IT/software
- If query asks for "energy companies", prioritize Company Industry: energy/power
- If query asks for "marketing", prioritize Company Industry: marketing/advertising
- Primary match: Company Industry field
- Secondary match: Related industries or adjacent sectors (lower confidence score)
- Tertiary match: Job titles or skills in relevant domain (even lower confidence)
- Include diverse matches to reach the ${limit} result count

CONFIDENCE SCORING:
- 0.9-1.0: Perfect match (Company Industry exactly matches query)
- 0.8-0.9: Strong match (Company Industry closely related to query)
- 0.7-0.8: Good match (Company Industry somewhat related)
- 0.6-0.7: Fair match (Company Industry loosely related)
- 0.5-0.6: Weak match (some relevance exists)
- Below 0.5: DO NOT INCLUDE (too weak)

RESULT QUANTITY PRIORITY:
- Your PRIMARY goal is to return UP TO ${limit} relevant matches
- Cast a wider net - include good, fair, and even some weak matches
- Better to return ${limit} results with varying confidence than just 2-3 perfect matches
- Users prefer quantity + quality over just perfect matches

Return format:
{
  "results": [
    {
      "Company Name": "exact name from database",
      "Company Industry": "exact industry from database",
      "Company Size": "exact size from database",
      "Emails": "exact email from database",
      "Full name": "exact contact name from database",
      "Job title": "exact job title from database",
      "Company Website": "exact website from database",
      "Location": "exact location from database",
      "matchReason": "Company Industry is [X], which matches/relates to the query for [Y]",
      "confidenceScore": 0.85
    }
  ],
  "explanation": "Found X companies where Company Industry field matches or relates to the query criteria"
}

CRITICAL: Return AS MANY relevant companies as possible up to ${limit}. Include matches with confidence 0.5+. Prioritize quantity while maintaining reasonable quality.`

    // Gemini 모델 호출 (공식 SDK + File Search Tool)
    logger.info(
      {
        storeNames: finalStoreNames,
        model: "gemini-2.5-pro",
        promptLength: searchPrompt.length,
        // 프롬프트 일부 확인
        promptPreview: searchPrompt.substring(0, 200),
      },
      "Using File Search with official SDK",
    )

    // 🔍 검색 프롬프트 전체 로그 (디버깅용)
    logger.debug(
      {
        fullPrompt: searchPrompt,
        queryLength: query.length,
        filtersApplied: Object.keys(filters || {}).length,
      },
      "🔍 Full search prompt",
    )

    // 🚀 Gemini API 호출 시작
    logger.info(
      {
        model: "gemini-2.5-pro",
        storeNames: finalStoreNames,
        temperature: 2,
        queryLength: query.length,
      },
      "🚀 Calling Gemini API with File Search",
    )

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: searchPrompt,
      config: {
        temperature: 2,
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: finalStoreNames,
            },
          },
        ],
      },
    })

    logger.info(
      {
        storeNames: finalStoreNames,
        responseReceived: !!response,
      },
      "Gemini API call completed",
    )

    const text = response.text || ""
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    const candidate = response.candidates?.[0]

    // 🔍 Gemini 응답 상세 로그
    logger.info(
      {
        query,
        responseLength: text.length,
        groundingChunksCount: groundingChunks.length,
        hasText: !!text,
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length || 0,
        // Candidate 상세 정보
        candidateFinishReason: candidate?.finishReason,
        candidateSafetyRatings: candidate?.safetyRatings,
        candidateContent: candidate?.content
          ? JSON.stringify(candidate.content).substring(0, 300)
          : null,
        candidateIndex: candidate?.index,
        // groundingChunks 내용 확인 ✨
        groundingChunksPreview:
          groundingChunks.length > 0
            ? JSON.stringify(groundingChunks.slice(0, 2), null, 2).substring(0, 500)
            : null,
        // 응답 텍스트 미리보기
        responsePreview: text.substring(0, 500),
      },
      "Gemini search completed with File Search",
    )

    // 🚨 groundingChunks가 없으면 경고 및 빈 결과 반환
    if (groundingChunks.length === 0) {
      logger.warn(
        {
          query,
          storeNames: finalStoreNames,
          responseText: text,
        },
        "🚨 No grounding chunks found! Gemini couldn't find relevant data in the store",
      )

      // groundingChunks가 없으면 실제 데이터를 찾지 못한 것
      // Gemini가 생성한 예시 데이터를 반환하지 않음
      return {
        success: true,
        query,
        results: [],
        totalResults: 0,
        explanation:
          "데이터베이스에서 관련 데이터를 찾지 못했습니다. Store에 데이터가 올바르게 업로드되었는지 확인해주세요.",
        processingTime: (Date.now() - startTime) / 1000,
        citations: [],
      }
    }

    // 📊 groundingChunks 전체 로그 (디버깅용)
    if (groundingChunks.length > 0) {
      logger.debug(
        {
          groundingChunks: JSON.stringify(groundingChunks, null, 2),
        },
        "📊 Full grounding chunks data",
      )
    }

    // 📝 Gemini 전체 응답 로그 (디버깅용)
    logger.debug(
      {
        fullResponse: text,
      },
      "📝 Full Gemini response text",
    )

    // JSON 파싱
    let parsedResults: { results: LeadSearchResult[]; explanation?: string }

    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text

      logger.info(
        {
          jsonTextLength: jsonText.length,
          jsonTextPreview: jsonText.substring(0, 500),
        },
        "About to parse JSON",
      )

      parsedResults = JSON.parse(jsonText)

      logger.info(
        {
          resultsCount: parsedResults.results?.length || 0,
          firstResultKeys: parsedResults.results?.[0] ? Object.keys(parsedResults.results[0]) : [],
          firstResult: parsedResults.results?.[0]
            ? JSON.stringify(parsedResults.results[0], null, 2).substring(0, 500)
            : null,
        },
        "JSON parsed successfully",
      )
    } catch (parseError) {
      logger.error(
        {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined,
          responseText: text,
          responseLength: text.length,
          textPreview: text.substring(0, 1000),
          jsonMatchAttempt: text.match(/```json\n([\s\S]*?)\n```/)
            ? "Found json code block"
            : text.match(/\{[\s\S]*\}/)
              ? "Found JSON object"
              : "No JSON pattern found",
        },
        "🚨 Failed to parse Gemini response",
      )
      throw new Error(
        `Failed to parse search results: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      )
    }

    const processingTime = (Date.now() - startTime) / 1000

    const finalResponse = {
      success: true,
      query,
      results: parsedResults.results || [],
      totalResults: (parsedResults.results || []).length,
      explanation: parsedResults.explanation,
      processingTime,
      citations: groundingChunks.map(
        (chunk: { web?: { uri?: string; title?: string }; uri?: string; title?: string }) => ({
          startIndex: 0,
          endIndex: 0,
          uri: chunk.web?.uri || chunk.uri || "",
          title: chunk.web?.title || chunk.title || "",
        }),
      ),
    }

    logger.info(
      {
        finalResultsCount: finalResponse.results.length,
        finalFirstResultKeys: finalResponse.results[0] ? Object.keys(finalResponse.results[0]) : [],
        finalFirstResult: finalResponse.results[0]
          ? JSON.stringify(finalResponse.results[0], null, 2)
          : null,
      },
      "Returning final response",
    )

    return finalResponse
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: request.query,
        workspaceId: request.workspaceId,
      },
      "Failed to search leads",
    )
    throw error
  }
}

/**
 * File Search Store 목록 조회
 */
export async function listFileSearchStores(): Promise<ListStoresResponse> {
  if (!apiKey) initializeGemini()

  try {
    const response = await fetch(`${GEMINI_API_BASE}/fileSearchStores?key=${apiKey}`)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list stores: ${error}`)
    }

    const data = (await response.json()) as {
      fileSearchStores?: Array<{
        name: string
        displayName?: string
        createTime?: string
        updateTime?: string
      }>
    }
    const stores = data.fileSearchStores || []

    logger.info({ storeCount: stores.length }, "Listed File Search Stores")

    return {
      success: true,
      stores: stores.map((store) => ({
        name: store.name,
        displayName: store.displayName || store.name,
        fileCount: 1,
        createTime: store.createTime || "",
        updateTime: store.updateTime || "",
      })),
      total: stores.length,
    }
  } catch (error) {
    logger.error({ error }, "Failed to list stores")
    throw error
  }
}

/**
 * File Search Store 삭제 (공식 SDK)
 */
export async function deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
  if (!ai) initializeGemini()

  try {
    await ai.fileSearchStores.delete({
      name: fileId,
      config: { force: true },
    })

    logger.info({ fileId }, "File Search Store deleted")

    return {
      success: true,
      message: "Store deleted successfully",
    }
  } catch (error) {
    logger.error({ error, fileId }, "Failed to delete store")
    throw error
  }
}

/**
 * 모든 Store 삭제 (유틸리티)
 */
export async function deleteAllStores(): Promise<{ success: boolean; deletedCount: number }> {
  if (!ai) initializeGemini()

  try {
    const allStores = await listFileSearchStores()
    let deletedCount = 0

    for (const store of allStores.stores) {
      try {
        await ai.fileSearchStores.delete({
          name: store.name,
          config: { force: true },
        })
        deletedCount++
        logger.info({ storeName: store.name }, "Store deleted")
      } catch (error) {
        logger.warn({ storeName: store.name, error }, "Failed to delete store")
      }
    }

    return {
      success: true,
      deletedCount,
    }
  } catch (error) {
    logger.error({ error }, "Failed to delete stores")
    throw error
  }
}

/**
 * Google Drive 파일을 File Search Store에 업로드
 */
export async function uploadDriveFileToGemini(params: {
  workspaceId: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  metadata?: Record<string, string>
}): Promise<UploadCSVResponse> {
  const { workspaceId, fileBuffer, fileName, mimeType, metadata } = params

  // Buffer를 File 객체로 변환
  const file = new File([fileBuffer], fileName, { type: mimeType })

  return uploadCSVToGemini({
    workspaceId,
    file,
    metadata,
  })
}

/**
 * 비용 추정
 */
export function estimateCost(params: { csvSizeBytes: number; expectedSearchesPerMonth: number }): {
  indexingCost: number
  monthlyCost: number
  costPerSearch: number
} {
  const { csvSizeBytes, expectedSearchesPerMonth } = params

  const estimatedTokens = csvSizeBytes / 4

  const indexingCost =
    (estimatedTokens / 1_000_000) * GEMINI_CONSTANTS.INDEXING_COST_PER_MILLION_TOKENS

  const avgInputTokensPerSearch = 6000
  const avgOutputTokensPerSearch = 1000

  const costPerSearch =
    (avgInputTokensPerSearch / 1_000_000) * GEMINI_CONSTANTS.QUERY_INPUT_COST_PER_MILLION_TOKENS +
    (avgOutputTokensPerSearch / 1_000_000) * GEMINI_CONSTANTS.QUERY_OUTPUT_COST_PER_MILLION_TOKENS

  const monthlyCost = costPerSearch * expectedSearchesPerMonth

  return {
    indexingCost: Number.parseFloat(indexingCost.toFixed(4)),
    monthlyCost: Number.parseFloat(monthlyCost.toFixed(2)),
    costPerSearch: Number.parseFloat(costPerSearch.toFixed(4)),
  }
}
