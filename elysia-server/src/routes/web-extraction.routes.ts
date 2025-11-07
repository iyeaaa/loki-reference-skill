/**
 * Web Data Extraction Routes
 * 웹사이트에서 회사 정보 및 연락처 추출 API
 */

import { Elysia, t } from "elysia"
import * as XLSX from "xlsx"
import { getActiveApiKeyCount } from "../services/openai-api-key.service"
import { processBatch } from "../services/web-extraction.service"
import {
  type CompanyRecord,
  DEFAULT_EXTRACTION_CONFIG,
  type ExtractionProgress,
} from "../types/web-extraction.types"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

// 추출 결과를 저장하는 Map (다운로드용)
const resultsMap = new Map<string, CompanyRecord[]>()

export const webExtractionRoutes = new Elysia({ prefix: "/api/v1/admin/web-extraction" })
  /**
   * POST /api/v1/admin/web-extraction/upload
   * Excel/CSV 파일 업로드 및 웹 데이터 추출 (SSE로 진행상황 전송)
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      const { file, workspaceId, config } = body

      logger.info(
        {
          workspaceId,
          fileSize: file.size,
          fileName: file.name,
        },
        "Starting web data extraction",
      )

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isExcel) {
        set.status = 400
        return {
          success: false,
          error: "Excel 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다",
        }
      }

      try {
        // 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // XLSX로 파싱
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
          set.status = 400
          return {
            success: false,
            error: "시트를 찾을 수 없습니다",
          }
        }

        const worksheet = workbook.Sheets[sheetName]

        if (!worksheet) {
          set.status = 400
          return {
            success: false,
            error: "워크시트를 찾을 수 없습니다",
          }
        }

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

        if (jsonData.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "파일에 데이터가 없습니다",
          }
        }

        logger.info({ recordCount: jsonData.length }, "Parsed Excel file")

        // CompanyRecord 배열로 변환
        const records: CompanyRecord[] = jsonData.map((row) => ({
          websiteUrl: String(row.website_url || row.websiteUrl || row.website || ""),
          businessType: row.business_type ? String(row.business_type) : undefined,
          companyName: row.company_name ? String(row.company_name) : undefined,
        }))

        // 빈 URL 제거
        const validRecords = records.filter((r) => r.websiteUrl && r.websiteUrl.trim().length > 0)

        if (validRecords.length === 0) {
          set.status = 400
          return {
            success: false,
            error: "유효한 website_url이 없습니다. 컬럼명을 확인해주세요.",
          }
        }

        // API 키 개수에 따른 동시성 계산 (키 개수 * 20)
        const apiKeyCount = await getActiveApiKeyCount(workspaceId)
        const calculatedConcurrency = apiKeyCount > 0 ? apiKeyCount * 20 : 20

        logger.info(
          {
            workspaceId,
            apiKeyCount,
            calculatedConcurrency,
          },
          "Calculated concurrency based on API key count",
        )

        // 중복 제거 (설정에 따라)
        const extractionConfig = {
          ...DEFAULT_EXTRACTION_CONFIG,
          ...config,
          maxConcurrent: config?.maxConcurrent ?? calculatedConcurrency, // config에 명시적으로 설정되지 않으면 계산된 값 사용
        }
        let finalRecords = validRecords

        if (extractionConfig.deduplicateByUrl) {
          const seenUrls = new Set<string>()
          finalRecords = validRecords.filter((r) => {
            const url = r.websiteUrl.trim().toLowerCase()
            if (seenUrls.has(url)) {
              return false
            }
            seenUrls.add(url)
            return true
          })

          logger.info(
            {
              original: validRecords.length,
              deduplicated: finalRecords.length,
              removed: validRecords.length - finalRecords.length,
            },
            "Deduplicated by URL",
          )
        }

        logger.info(
          {
            finalRecords: finalRecords.length,
            maxConcurrent: extractionConfig.maxConcurrent,
          },
          "[Web Extraction] Starting SSE stream with better-sse pattern",
        )

        // SSE 스트림 생성 (better-sse 패턴 적용)
        return createSSEResponse(
          async (session) => {
            try {
              // 초기 연결 이벤트
              session.push({
                event: "connected",
                data: {
                  type: "init",
                  message: `${finalRecords.length}개의 웹사이트에서 데이터를 추출합니다`,
                  timestamp: new Date().toISOString(),
                  total: finalRecords.length,
                },
              })
              logger.info("[Web Extraction] Sent init event")

              // 추출 시작
              const results = await processBatch(
                finalRecords,
                extractionConfig,
                (progress: ExtractionProgress) => {
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
                      "[Web Extraction] Sent progress",
                    )
                  } catch (err) {
                    logger.error({ err }, "[Web Extraction] Failed to send progress")
                  }
                },
                workspaceId,
              )

              if (session.closed) return

              // 결과 저장 (다운로드를 위해)
              const jobId = `${workspaceId}-${Date.now()}`
              resultsMap.set(jobId, results)

              // 완료 메시지 전송
              session.push({
                event: "complete",
                data: {
                  type: "complete",
                  timestamp: new Date().toISOString(),
                  jobId,
                  totalRecords: results.length,
                  message: "웹 데이터 추출이 완료되었습니다",
                },
              })

              logger.info(
                {
                  totalRecords: results.length,
                  jobId,
                },
                "[Web Extraction] Sent complete message",
              )

              // 클라이언트가 마지막 메시지를 처리할 시간 제공
              await new Promise((resolve) => setTimeout(resolve, 100))

              logger.info("[Web Extraction] Stream completed successfully")
            } catch (error: unknown) {
              logger.error({ error }, "[Web Extraction] Stream error")
              session.push({
                event: "error",
                data: {
                  type: "error",
                  timestamp: new Date().toISOString(),
                  error: error instanceof Error ? error.message : "Extraction failed",
                },
              })
            }
          },
          {
            keepAlive: true,
            keepAliveInterval: 15000,
            onClose: () => {
              logger.info("[Web Extraction] Client disconnected")
            },
          },
        )
      } catch (error: unknown) {
        logger.error({ error, fileName: file.name }, "Failed to parse file")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse file",
        }
      }
    },
    {
      body: t.Object({
        file: t.File({
          type: [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          maxSize: 50 * 1024 * 1024, // 50MB
        }),
        workspaceId: t.String(),
        config: t.Optional(
          t.Object({
            maxConcurrent: t.Optional(t.Number()),
            timeoutSeconds: t.Optional(t.Number()),
            gptTimeout: t.Optional(t.Number()),
            crawlDepth: t.Optional(t.Number()),
            deduplicateByUrl: t.Optional(t.Boolean()),
            expandEmailsToRows: t.Optional(t.Boolean()),
            randomDelayMin: t.Optional(t.Number()),
            randomDelayMax: t.Optional(t.Number()),
          }),
        ),
      }),
      detail: {
        tags: ["admin", "web-extraction"],
        summary: "Excel 또는 CSV 파일로 웹 데이터 추출 (SSE)",
        description:
          "Excel 또는 CSV 파일을 업로드하여 웹사이트에서 회사 정보 및 연락처를 추출합니다. 실시간 진행상황을 SSE로 전송합니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/web-extraction/results/:jobId
   * 추출 결과 다운로드 (Excel)
   */
  .get(
    "/results/:jobId",
    async ({ params, set }) => {
      const { jobId } = params

      const results = resultsMap.get(jobId)

      if (!results) {
        set.status = 404
        return {
          success: false,
          error: "결과를 찾을 수 없습니다",
        }
      }

      try {
        // Excel 생성
        const worksheet = XLSX.utils.json_to_sheet(
          results.map((r) => ({
            website_url: r.websiteUrl,
            business_type: r.businessType || "",
            company_name: r.companyName || "",
            final_url: r.finalUrl || "",
            http_status: r.httpStatus || "",
            found_company_name: r.foundCompanyName || "",
            name_url_match: r.nameUrlMatch || "",
            is_business_type_matched: r.isBusinessTypeMatched || "",
            description: r.description || "",
            address: r.address || "",
            country: r.country || "",
            city: r.city || "",
            state: r.state || "",
            founded_year: r.foundedYear || "",
            phone_number: r.phoneNumber || "",
            email: r.email || "",
            facebook_url: r.facebookUrl || "",
            instagram_url: r.instagramUrl || "",
            twitter_url: r.twitterUrl || "",
            linkedin_url: r.linkedinUrl || "",
            employee_count: r.employeeCount || "",
            products: r.products || "",
            business_sectors: r.businessSectors || "",
            product_categories: r.productCategories || "",
            industry_types: r.industryTypes || "",
            crawl_time_seconds: r.crawlTimeSeconds || "",
            gpt_time_seconds: r.gptTimeSeconds || "",
            collected_at: r.collectedAt || "",
            error_message: r.errorMessage || "",
          })),
        )

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results")

        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        set.headers["Content-Type"] =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        set.headers["Content-Disposition"] =
          `attachment; filename="web_extraction_results_${jobId}.xlsx"`

        return new Response(excelBuffer)
      } catch (error) {
        logger.error({ error, jobId }, "Failed to generate Excel file")
        set.status = 500
        return {
          success: false,
          error: "Excel 파일 생성 실패",
        }
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )

  /**
   * DELETE /api/v1/admin/web-extraction/cleanup/:jobId
   * 작업 데이터 정리 (메모리 절약)
   */
  .delete(
    "/cleanup/:jobId",
    async ({ params }) => {
      const { jobId } = params

      resultsMap.delete(jobId)

      logger.info({ jobId }, "Cleaned up web extraction job data")

      return {
        success: true,
        message: "작업 데이터가 정리되었습니다",
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )
