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

// 분할 업로드 설정
const MAX_ROWS_PER_CHUNK = 20000 // 한 파일당 최대 행 수 (안정적인 인덱싱을 위해)

/**
 * Gemini API 초기화
 */
export function initializeGemini(key?: string): void {
  apiKey = key || config.gemini.apiKey

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
      // 공용 Store 사용 - 워크스페이스 구분 없이 첫 번째 Store 사용
      logger.info("Looking for shared File Search Store")
      const allStores = await listFileSearchStores()

      logger.debug(
        {
          totalStores: allStores.total,
          storeNames: allStores.stores.map((s) => s.displayName),
        },
        "🔍 Available stores",
      )

      if (allStores.stores.length > 0) {
        // 기존 공용 Store 재사용
        const firstStore = allStores.stores[0]
        if (firstStore) {
          finalStoreName = firstStore.name
          logger.info(
            { storeName: finalStoreName, displayName: firstStore.displayName },
            "✅ Using existing shared Store",
          )
        }
      }

      if (!finalStoreName) {
        // 공용 Store 없으면 새로 생성
        logger.info({ totalRows }, "No existing store found, creating new shared store")
        const newStore = await createFileSearchStore("Global Lead Database")
        finalStoreName = newStore.name
        logger.info(
          { storeName: finalStoreName, displayName: newStore.displayName, totalRows },
          "Created new shared File Search Store",
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

    // 📦 대용량 데이터 분할 처리
    const chunks: Array<Record<string, unknown>>[] = []
    if (cleanedData.length > MAX_ROWS_PER_CHUNK) {
      // 데이터 분할
      for (let i = 0; i < cleanedData.length; i += MAX_ROWS_PER_CHUNK) {
        chunks.push(cleanedData.slice(i, i + MAX_ROWS_PER_CHUNK))
      }
      logger.info(
        {
          totalRows: cleanedData.length,
          chunkCount: chunks.length,
          rowsPerChunk: MAX_ROWS_PER_CHUNK,
        },
        "📦 Large dataset detected, splitting into chunks for stable upload",
      )
    } else {
      // 분할 필요 없음
      chunks.push(cleanedData)
    }

    const uploadedDocuments: string[] = []
    const uploadStartTime = Date.now()

    // 각 청크를 순차적으로 업로드
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      if (!chunk) continue

      // 청크를 CSV로 변환
      const chunkWorkbook = XLSX.utils.book_new()
      const chunkWorksheet = XLSX.utils.json_to_sheet(chunk)
      XLSX.utils.book_append_sheet(chunkWorkbook, chunkWorksheet, "Sheet1")
      const chunkCsvBuffer = XLSX.write(chunkWorkbook, { type: "buffer", bookType: "csv" })

      // 파일명에 청크 번호 추가
      const chunkFileName =
        chunks.length > 1
          ? file.name.replace(/\.csv$/, `-part${chunkIndex + 1}of${chunks.length}.csv`)
          : file.name

      // customMetadata 생성 (리드 수, 청크 정보, 국가 등)
      const customMetadata: Array<{ key: string; stringValue: string }> = [
        { key: "leadCount", stringValue: String(chunk.length) },
        { key: "chunkIndex", stringValue: String(chunkIndex + 1) },
        { key: "totalChunks", stringValue: String(chunks.length) },
      ]

      // 요청에서 전달된 메타데이터 추가
      if (metadata?.country) {
        customMetadata.push({ key: "country", stringValue: metadata.country })
      }
      if (metadata?.region) {
        customMetadata.push({ key: "region", stringValue: metadata.region })
      }
      if (metadata?.vertical) {
        customMetadata.push({ key: "industry", stringValue: metadata.vertical })
      }
      if (metadata?.source) {
        customMetadata.push({ key: "source", stringValue: metadata.source })
      }

      logger.info(
        {
          storeName: finalStoreName,
          fileName: chunkFileName,
          chunkIndex: chunkIndex + 1,
          totalChunks: chunks.length,
          rowsInChunk: chunk.length,
          customMetadata,
        },
        `📤 Uploading chunk ${chunkIndex + 1}/${chunks.length} with customMetadata`,
      )

      // SDK로 업로드 (customMetadata 포함)
      let uploadOp = await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: finalStoreName,
        file: new File([chunkCsvBuffer], chunkFileName, { type: "text/csv" }),
        config: {
          displayName: chunkFileName,
          customMetadata,
        },
      })

      // 핵심 수정: response 필드가 있으면 업로드 완료! ✨
      const startTime = Date.now()
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
        uploadedDocuments.push(opWithResponse.response.documentName)
        logger.info(
          {
            storeName: finalStoreName,
            fileName: chunkFileName,
            documentName: opWithResponse.response.documentName,
            chunkIndex: chunkIndex + 1,
            totalChunks: chunks.length,
          },
          `✅ Chunk ${chunkIndex + 1}/${chunks.length} uploaded successfully`,
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
              uploadedDocuments.push(updatedOp.response.documentName || "unknown")
              logger.info(
                {
                  pollCount,
                  documentName: updatedOp.response.documentName,
                  chunkIndex: chunkIndex + 1,
                  totalChunks: chunks.length,
                },
                `✅ Chunk ${chunkIndex + 1}/${chunks.length} upload completed (after polling)`,
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
    } // End of for loop for chunks

    logger.info(
      {
        storeName: finalStoreName,
        originalFileName: file.name,
        totalRows,
        chunksUploaded: chunks.length,
        documentsCreated: uploadedDocuments.length,
        totalTime: `${((Date.now() - uploadStartTime) / 1000).toFixed(1)}s`,
      },
      "📦 All chunks uploaded and indexed successfully",
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
      chunksUploaded: chunks.length.toString(),
      documentsCreated: uploadedDocuments.length.toString(),
      ...metadata,
    }

    const chunkInfo =
      chunks.length > 1 ? ` (split into ${chunks.length} chunks for stable indexing)` : ""

    return {
      success: true,
      storeName: finalStoreName,
      fileName: file.name,
      fileId: finalStoreName, // Store name as file ID
      totalRows,
      message: `CSV uploaded and indexed with ${duplicatesRemoved} duplicates removed (${totalRows}/${originalRowCount} rows retained)${chunkInfo}`,
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
      // 공용 Store 사용 - 워크스페이스 구분 없이 첫 번째 Store 사용
      const allStores = await listFileSearchStores()

      logger.info(
        {
          totalStores: allStores.total,
          storeNames: allStores.stores.map((s) => s.name),
        },
        "Looking for shared store",
      )

      if (allStores.stores.length > 0) {
        const firstStore = allStores.stores[0]
        if (!firstStore) {
          throw new Error(`No File Search Store found. Please upload a file first.`)
        }
        finalStoreNames = [firstStore.name]
        logger.info(
          {
            usingStore: finalStoreNames[0],
            displayName: firstStore.displayName,
          },
          "Using shared store for all workspaces",
        )
      } else {
        throw new Error(`No File Search Store found. Please upload a file first.`)
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

    // Store 메타데이터 조회
    let storeMetadata = ""
    try {
      const storeDetails = await fetch(`${GEMINI_API_BASE}/${finalStoreNames[0]}?key=${apiKey}`)
      if (storeDetails.ok) {
        const storeData = (await storeDetails.json()) as { displayName?: string }
        if (storeData?.displayName) {
          storeMetadata = `\nDatabase: ${storeData.displayName}`
        }
        logger.debug({ storeData }, "📊 Store metadata fetched")
      }
    } catch (error) {
      logger.warn({ error }, "Failed to fetch store metadata")
    }

    // 🚀 최적화된 검색 프롬프트 (CRITICAL 지시사항을 최상단에 배치)
    let searchPrompt = `
═══════════════════════════════════════════════════════════════
🎯 CRITICAL INSTRUCTION (READ THIS FIRST!)
═══════════════════════════════════════════════════════════════
1. You MUST return AT LEAST ${Math.min(limit, 30)} and UP TO ${limit} matching leads
2. EXHAUSTIVELY SEARCH through ALL data in the file search store
3. DO NOT stop at the first few matches - keep searching until you find ${limit} results
4. Include BOTH exact matches AND related/similar matches
5. If you find fewer than ${Math.min(limit, 10)} results, EXPAND your search criteria
═══════════════════════════════════════════════════════════════
SEARCH QUERY: "${query}"
${storeMetadata}
`

    if (filters && Object.keys(filters).length > 0) {
      searchPrompt += "\nAPPLIED FILTERS:\n"
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          searchPrompt += `• ${key}: ${value}\n`
        }
      }
    }

    searchPrompt += `

SEARCH STRATEGY (use ALL of these):
1. PRIMARY: Match "Company Industry" field (exact or related)
2. SECONDARY: Match "Job title" field (e.g., "IT Manager" for IT query)
3. TERTIARY: Match "Company Name" (e.g., "Tech Solutions" for IT query)
4. QUATERNARY: Match any field containing relevant keywords

🌍 GEOGRAPHIC DIVERSITY (IMPORTANT!):
- Search across ALL countries/regions in the database
- DO NOT focus only on one country (e.g., United States)
- Include leads from diverse locations: USA, Indonesia, Europe, Asia, etc.
- If no country filter is specified, return a MIX of results from different countries

FIELD EXTRACTION (copy EXACTLY from database):
• Company Name, Company Industry, Company Size
• Emails, Full name, Job title
• Company Website, Location

CONFIDENCE SCORING (BE STRICT - quality over quantity):
• 0.9-1.0: Exact industry match (BEST - prioritize these)
• 0.8-0.9: Closely related industry match
• 0.7-0.8: Related industry or exact job title match  
• 0.6-0.7: Loosely related or keyword match
• 0.5-0.6: Weak match (include only if need more results)
• Below 0.5: DO NOT INCLUDE

⚠️ QUALITY RULE: Prioritize HIGH confidence (0.7+) matches first.
   Only include lower confidence matches to reach the quantity target.

OUTPUT FORMAT (JSON only):
{
  "results": [
    {
      "Company Name": "exact value",
      "Company Industry": "exact value",
      "Company Size": "exact value",
      "Emails": "exact value",
      "Full name": "exact value",
      "Job title": "exact value",
      "Company Website": "exact value",
      "Location": "exact value",
      "matchReason": "why this matches the query",
      "confidenceScore": 0.85
    }
  ],
  "explanation": "summary of search results"
}

⚠️ REMINDER: Return ${limit} results. If you have fewer, your search was not exhaustive enough.`

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
        temperature: 0.2,
        queryLength: query.length,
      },
      "🚀 Calling Gemini API with File Search",
    )

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: searchPrompt,
      config: {
        temperature: 0.2,
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
