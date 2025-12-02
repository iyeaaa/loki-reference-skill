/**
 * Lead Import Routes
 * Excel 파일로 리드 데이터를 일괄 임포트하는 API
 */

import * as chardet from "chardet"
import { Elysia, t } from "elysia"
import * as iconv from "iconv-lite"
import * as XLSX from "xlsx"
import type { ImportProgress } from "../services/lead-import.service"
import { importLeadsBatch } from "../services/lead-import.service"
import { parseExcelRowToLeadData } from "../utils/excel-parser.util"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

export const leadImportRoutes = new Elysia({ prefix: "/api/v1/admin/lead-import" })
  /**
   * POST /api/v1/admin/lead-import/upload
   * Excel 파일 업로드 및 리드 임포트 (SSE로 진행상황 전송)
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      const { file, workspaceId, sheetName } = body

      logger.info(
        {
          workspaceId,
          sheetName,
          fileSize: file.size,
          fileName: file.name,
        },
        "Starting lead import",
      )

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isExcel) {
        set.status = 400
        return {
          success: false,
          error: "Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed",
        }
      }

      // 파일명에서 확장자 제거하여 그룹명 생성
      const fileNameWithoutExt = file.name.replace(/\.(xlsx?|xls|csv)$/i, "")

      // Customer Group 생성 (이미 존재하면 기존 그룹 사용)
      const { db } = await import("../db")
      const { customerGroups } = await import("../db/schema")
      const { eq, and } = await import("drizzle-orm")

      let customerGroupId: string

      // 같은 workspace에 같은 이름의 그룹이 있는지 확인
      const existingGroup = await db.query.customerGroups.findFirst({
        where: and(
          eq(customerGroups.workspaceId, workspaceId),
          eq(customerGroups.name, fileNameWithoutExt),
        ),
      })

      if (existingGroup) {
        customerGroupId = existingGroup.id
        logger.info(
          { groupId: customerGroupId, groupName: fileNameWithoutExt },
          "Using existing customer group",
        )
      } else {
        // 새 그룹 생성
        const [newGroup] = await db
          .insert(customerGroups)
          .values({
            workspaceId,
            name: fileNameWithoutExt,
            description: `Group auto-generated from ${file.name}`,
          })
          .returning()

        if (!newGroup) {
          set.status = 500
          return {
            success: false,
            error: "Failed to create customer group",
          }
        }

        customerGroupId = newGroup.id
        logger.info(
          { groupId: customerGroupId, groupName: fileNameWithoutExt },
          "Created new customer group",
        )
      }

      try {
        // 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer()

        let workbook: XLSX.WorkBook
        if (isCSV) {
          // CSV 파일: 인코딩 감지 및 변환 후 읽기
          const uint8Array = new Uint8Array(arrayBuffer)

          // 1. 인코딩 감지
          const detectedEncoding = chardet.detect(Buffer.from(uint8Array))
          const encoding = detectedEncoding || "UTF-8"

          logger.info({ detectedEncoding: encoding, fileName }, "CSV encoding detected")

          // 2. UTF-8 BOM 제거 (있는 경우)
          let startIndex = 0
          if (
            uint8Array.length >= 3 &&
            uint8Array[0] === 0xef &&
            uint8Array[1] === 0xbb &&
            uint8Array[2] === 0xbf
          ) {
            startIndex = 3
            logger.debug("UTF-8 BOM detected and removed")
          }

          const dataWithoutBOM = uint8Array.slice(startIndex)

          // 3. 감지된 인코딩을 UTF-8로 변환
          let utf8String: string
          try {
            // 감지된 인코딩이 UTF-8이 아닌 경우 변환
            if (encoding.toUpperCase() !== "UTF-8" && encoding.toUpperCase() !== "UTF8") {
              // iconv-lite로 UTF-8로 변환
              const buffer = Buffer.from(dataWithoutBOM)
              utf8String = iconv.decode(buffer, encoding)
              logger.info({ from: encoding, to: "UTF-8" }, "Encoding conversion performed")
            } else {
              // 이미 UTF-8인 경우 그대로 사용
              utf8String = new TextDecoder("utf-8").decode(dataWithoutBOM)
            }
          } catch (conversionError) {
            // 변환 실패 시 UTF-8로 강제 디코딩
            logger.warn(
              { error: conversionError, encoding },
              "Encoding conversion failed, forcing UTF-8",
            )
            utf8String = new TextDecoder("utf-8", { fatal: false }).decode(dataWithoutBOM)
          }

          // 4. UTF-8 문자열을 XLSX가 읽을 수 있는 형식으로 변환
          const utf8Buffer = Buffer.from(utf8String, "utf-8")
          workbook = XLSX.read(utf8Buffer, { type: "buffer", raw: false })
        } else {
          // Excel 파일: 그대로 읽기
          workbook = XLSX.read(arrayBuffer, { type: "buffer" })
        }

        // 시트 선택
        let selectedSheetName: string | undefined
        if (isCSV) {
          // CSV 파일: 항상 첫 번째 시트 사용
          selectedSheetName = workbook.SheetNames[0]
        } else {
          // Excel 파일: sheetName이 제공되면 사용, 아니면 첫 번째 시트 사용
          selectedSheetName = sheetName || workbook.SheetNames[0]
        }

        const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : undefined

        if (!sheet) {
          set.status = 400
          return {
            success: false,
            error: "Sheet not found",
          }
        }

        // 데이터를 JSON으로 변환
        // raw: false - 셀 값을 문자열로 변환하여 인코딩 문제 방지
        // defval: null - 빈 셀은 null로 처리
        const rawData = XLSX.utils.sheet_to_json(sheet, {
          defval: null,
          raw: false, // 문자열로 변환
          dateNF: "yyyy-mm-dd", // 날짜 형식 통일
        })

        logger.info({ rowCount: rawData.length, fileType: isCSV ? "CSV" : "Excel" }, "File parsed")

        if (rawData.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "No data found in the sheet",
          }
        }

        // 데이터 파싱
        const parsedLeads = (rawData as Record<string, unknown>[]).map((row) =>
          parseExcelRowToLeadData(row),
        )

        logger.info({ leadCount: parsedLeads.length }, "Leads parsed")

        // SSE 스트림 생성 (better-sse 패턴 적용)
        logger.info("[Lead Import] Starting SSE stream with better-sse pattern")

        return createSSEResponse(
          async (session) => {
            try {
              // 초기 연결 이벤트
              session.push({
                event: "connected",
                data: {
                  type: "init",
                  message: `Importing leads to customer group '${fileNameWithoutExt}' (workspace-scoped duplicate detection)`,
                  timestamp: new Date().toISOString(),
                  total: parsedLeads.length,
                  customerGroupId,
                  customerGroupName: fileNameWithoutExt,
                  workspaceId,
                },
              })
              logger.info(
                { workspaceId, customerGroupId, total: parsedLeads.length },
                "[Lead Import] Sent init event with workspace-scoped duplicate detection",
              )

              // 임포트 시작 (자동 생성된 customerGroupId 사용)
              const result = await importLeadsBatch(
                workspaceId,
                parsedLeads,
                null, // createdBy는 인증 구현 후 추가
                customerGroupId, // 파일명으로 생성된 그룹 ID
                (progress: ImportProgress) => {
                  if (session.closed) return

                  try {
                    // 진행상황을 SSE로 전송
                    session.push({
                      event: "progress",
                      data: {
                        type: "progress",
                        timestamp: new Date().toISOString(),
                        ...progress,
                      },
                    })
                    logger.debug(
                      { processed: progress.processed, total: progress.total },
                      "[Lead Import] Sent progress",
                    )
                  } catch (err) {
                    logger.error({ err }, "[Lead Import] Failed to send progress")
                  }
                },
              )

              if (session.closed) return

              // 완료 메시지 전송
              session.push({
                event: "complete",
                data: {
                  type: "complete",
                  timestamp: new Date().toISOString(),
                  result,
                },
              })

              logger.info(
                {
                  success: result.success,
                  skipped: result.skipped,
                  failed: result.failed,
                },
                "[Lead Import] Sent complete message",
              )

              // 클라이언트가 마지막 메시지를 처리할 시간 제공
              await new Promise((resolve) => setTimeout(resolve, 100))

              logger.info("[Lead Import] Stream completed successfully")
            } catch (error: unknown) {
              logger.error({ error }, "[Lead Import] Stream error")
              session.push({
                event: "error",
                data: {
                  type: "error",
                  timestamp: new Date().toISOString(),
                  error: error instanceof Error ? error.message : "Import failed",
                },
              })
            }
          },
          {
            keepAlive: true,
            keepAliveInterval: 15000,
            onClose: () => {
              logger.info("[Lead Import] Client disconnected")
            },
          },
        )
      } catch (error: unknown) {
        logger.error({ error }, "Failed to parse Excel file")

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse Excel file",
        }
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: 50 * 1024 * 1024, // 50MB
        }),
        workspaceId: t.String(),
        sheetName: t.Optional(t.String()),
        customerGroupId: t.Optional(t.String()),
      }),
      detail: {
        tags: ["admin", "lead-import"],
        summary: "Excel 또는 CSV 파일로 리드 일괄 임포트 (SSE)",
        description:
          "Excel 또는 CSV 파일을 업로드하여 여러 리드를 일괄 임포트합니다. 파일명(확장자 제외)으로 자동으로 고객 그룹을 생성하고 리드를 연결합니다. 같은 이름의 그룹이 이미 있으면 기존 그룹을 사용합니다. 실시간 진행상황을 SSE로 전송합니다. CSV 파일의 경우 UTF-8 BOM이 자동으로 제거됩니다. \n\n**워크스페이스 기준 중복 처리**: (1) Website URL 중복: 워크스페이스 내에 동일한 URL이 존재하면 리드 전체가 스킵됩니다. (2) 이메일 중복: 파일 내부의 중복 이메일과 워크스페이스 내 기존 DB의 중복 이메일이 자동으로 감지되어 제외되지만, 리드 자체는 생성됩니다. 완료 시 중복 이메일 목록(existingLeadId, rowNumber, companyName 포함)이 반환됩니다.",
      },
    },
  )

  /**
   * POST /api/v1/admin/lead-import/sheet-names
   * Excel 파일의 시트 이름 목록 조회 (미리보기)
   * CSV 파일의 경우 빈 배열 반환
   */
  .post(
    "/sheet-names",
    async ({ body, set }) => {
      const { file } = body

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isExcel) {
        set.status = 400
        return {
          success: false,
          error: "Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed",
        }
      }

      try {
        // CSV 파일의 경우 빈 배열 반환 (시트 선택 불필요)
        if (isCSV) {
          return {
            success: true,
            sheetNames: [],
          }
        }

        // Excel 파일의 시트 이름 조회
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "buffer" })

        return {
          success: true,
          sheetNames: workbook.SheetNames,
        }
      } catch (error: unknown) {
        logger.error({ error }, "Failed to read sheet names")

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to read sheet names",
        }
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: 50 * 1024 * 1024,
        }),
      }),
      detail: {
        tags: ["admin", "lead-import"],
        summary: "Excel 또는 CSV 파일의 시트 이름 목록 조회",
        description:
          "Excel 파일을 업로드하여 포함된 시트 이름 목록을 조회합니다. CSV 파일의 경우 빈 배열이 반환됩니다.",
      },
    },
  )

  /**
   * POST /api/v1/admin/lead-import/preview
   * Excel/CSV 파일 데이터 미리보기 (DB 저장 전)
   */
  .post(
    "/preview",
    async ({ body, set }) => {
      const { file, sheetName } = body

      logger.info(
        {
          fileSize: file.size,
          fileName: file.name,
          sheetName,
        },
        "Starting lead preview",
      )

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isExcel) {
        set.status = 400
        return {
          success: false,
          error: "Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed",
        }
      }

      try {
        // 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer()

        let workbook: XLSX.WorkBook
        if (isCSV) {
          // CSV 파일: 인코딩 감지 및 변환 후 읽기
          const uint8Array = new Uint8Array(arrayBuffer)

          // 1. 인코딩 감지
          const detectedEncoding = chardet.detect(Buffer.from(uint8Array))
          const encoding = detectedEncoding || "UTF-8"

          logger.info({ detectedEncoding: encoding, fileName }, "CSV encoding detected for preview")

          // 2. UTF-8 BOM 제거 (있는 경우)
          let startIndex = 0
          if (
            uint8Array.length >= 3 &&
            uint8Array[0] === 0xef &&
            uint8Array[1] === 0xbb &&
            uint8Array[2] === 0xbf
          ) {
            startIndex = 3
            logger.debug("UTF-8 BOM detected and removed")
          }

          const dataWithoutBOM = uint8Array.slice(startIndex)

          // 3. 감지된 인코딩을 UTF-8로 변환
          let utf8String: string
          try {
            if (encoding.toUpperCase() !== "UTF-8" && encoding.toUpperCase() !== "UTF8") {
              const buffer = Buffer.from(dataWithoutBOM)
              utf8String = iconv.decode(buffer, encoding)
              logger.info({ from: encoding, to: "UTF-8" }, "Encoding conversion performed for preview")
            } else {
              utf8String = new TextDecoder("utf-8").decode(dataWithoutBOM)
            }
          } catch (conversionError) {
            logger.warn(
              { error: conversionError, encoding },
              "Encoding conversion failed, forcing UTF-8",
            )
            utf8String = new TextDecoder("utf-8", { fatal: false }).decode(dataWithoutBOM)
          }

          // 4. UTF-8 문자열을 XLSX가 읽을 수 있는 형식으로 변환
          const utf8Buffer = Buffer.from(utf8String, "utf-8")
          workbook = XLSX.read(utf8Buffer, { type: "buffer", raw: false })
        } else {
          // Excel 파일: 그대로 읽기
          workbook = XLSX.read(arrayBuffer, { type: "buffer" })
        }

        // 시트 선택
        let selectedSheetName: string | undefined
        if (isCSV) {
          // CSV 파일: 항상 첫 번째 시트 사용
          selectedSheetName = workbook.SheetNames[0]
        } else {
          // Excel 파일: sheetName이 제공되면 사용, 아니면 첫 번째 시트 사용
          selectedSheetName = sheetName || workbook.SheetNames[0]
        }

        if (!selectedSheetName) {
          set.status = 400
          return {
            success: false,
            error: "No sheets found in the file",
          }
        }

        const sheet = workbook.Sheets[selectedSheetName]

        if (!sheet) {
          set.status = 400
          return {
            success: false,
            error: "Sheet not found",
          }
        }

        // 데이터를 JSON으로 변환
        const rawData = XLSX.utils.sheet_to_json(sheet, {
          defval: null,
          raw: false,
          dateNF: "yyyy-mm-dd",
        })

        logger.info({ rowCount: rawData.length, fileType: isCSV ? "CSV" : "Excel" }, "File preview parsed")

        if (rawData.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "No data found in the sheet",
          }
        }

        // 데이터 파싱 (전체 데이터 미리보기)
        const parsedLeads = (rawData as Record<string, unknown>[]).map((row, index) => ({
          rowNumber: index + 2, // Excel row number (1-based, +1 for header)
          ...parseExcelRowToLeadData(row),
        }))

        // AI 분석 (최대 20행 랜덤 샘플링)
        let aiAnalysis: string | null = null
        try {
          const { ChatOpenAI } = await import("@langchain/openai")
          const llm = new ChatOpenAI({
            model: "gpt-4o-mini",
            temperature: 0.7,
          })

          // 최대 20행 랜덤 샘플링
          const sampleSize = Math.min(20, parsedLeads.length)
          let sampleData: typeof parsedLeads

          if (parsedLeads.length <= 20) {
            // 20개 이하면 전체 사용
            sampleData = parsedLeads
          } else {
            // 20개 초과면 랜덤으로 샘플링
            const shuffled = [...parsedLeads].sort(() => Math.random() - 0.5)
            sampleData = shuffled.slice(0, sampleSize)
          }

          // 컬럼 정보 추출
          const columns = Object.keys(rawData[0] || {})

          const analysisPrompt = `You are a professional sales analyst. Analyze the following lead data from an uploaded Excel file and provide a comprehensive sales intelligence report.

**Dataset Overview:**
- Total Records: ${rawData.length}
- Sample Size Analyzed: ${sampleSize} rows (randomly selected)
- Available Columns: ${columns.join(", ")}

**Sample Data:**
${JSON.stringify(sampleData, null, 2)}

**Instructions:**
Generate a professional sales analysis report with the following sections. Use a business-formal tone suitable for executive presentation.

### 1. Executive Summary
Provide a high-level overview of the lead dataset. Identify the primary industry sectors represented and key characteristics. Include at least 3 specific company examples with their industry classifications (e.g., "XYZ Corporation operates in the manufacturing sector, ABC Inc. specializes in B2B software...").

### 2. Data Completeness Assessment
Evaluate the quality and completeness of critical sales fields (company name, website URL, email addresses, phone numbers, contact information). Provide quantitative metrics with specific examples (e.g., "85% (17 of 20) records contain valid email addresses. Notable gaps exist for Company X and Company Y, requiring data enrichment...").

### 3. Market Intelligence Insights
Identify significant patterns, trends, or characteristics that could inform sales strategy. Include at least 3 data-driven observations with concrete examples (e.g., "40% of leads maintain active LinkedIn corporate pages with 500+ connections, notably Company A, Company B, and Company C, indicating strong digital presence...").

### 4. Sales Action Recommendations
Provide strategic recommendations for lead engagement and data optimization. Include at least 3 specific, actionable steps (e.g., "Priority 1: Enrich 15% of records missing contact emails through LinkedIn prospecting or website contact forms. Priority 2: Segment leads by company size for targeted outreach...").

**Report Requirements:**
- Maintain professional business language throughout
- Reference specific company names and exact figures from the dataset
- Use precise percentages and counts (avoid vague terms like "several" or "many")
- Target length: 500-700 words
- Focus on actionable sales intelligence rather than generic observations`

          const response = await llm.invoke(analysisPrompt)
          aiAnalysis = response.content as string

          logger.info({ sampleSize, totalRows: rawData.length }, "AI analysis completed")
        } catch (error) {
          logger.error({ error }, "Failed to generate AI analysis")
          // AI 분석 실패해도 미리보기는 계속 진행
        }

        return {
          success: true,
          data: {
            totalRows: rawData.length,
            previewRows: parsedLeads.length,
            leads: parsedLeads,
            sheetName: selectedSheetName,
            availableSheets: workbook.SheetNames,
            aiAnalysis, // AI 분석 결과 추가
          },
        }
      } catch (error: unknown) {
        logger.error({ error }, "Failed to preview file")

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to preview file",
        }
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: 50 * 1024 * 1024,
        }),
        sheetName: t.Optional(t.String()),
      }),
      detail: {
        tags: ["admin", "lead-import"],
        summary: "Excel 또는 CSV 파일 데이터 미리보기",
        description:
          "Excel(.xlsx, .xls) 또는 CSV(.csv) 파일을 업로드하여 DB에 저장하기 전 데이터를 미리 확인합니다. 전체 데이터를 미리보기로 제공하며, 최대 20행을 샘플링하여 AI 분석 결과도 함께 제공합니다. CSV 파일의 경우 인코딩을 자동 감지하여 UTF-8로 변환합니다.",
      },
    },
  )
