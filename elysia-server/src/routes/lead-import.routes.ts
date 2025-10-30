/**
 * Lead Import Routes
 * Excel 파일로 리드 데이터를 일괄 임포트하는 API
 */

import { Elysia, t } from "elysia"
import * as XLSX from "xlsx"
import type { ImportProgress } from "../services/lead-import.service"
import { importLeadsBatch } from "../services/lead-import.service"
import { parseExcelRowToLeadData } from "../utils/excel-parser.util"
import logger from "../utils/logger"

export const leadImportRoutes = new Elysia({ prefix: "/api/v1/admin/lead-import" })
  /**
   * POST /api/v1/admin/lead-import/upload
   * Excel 파일 업로드 및 리드 임포트 (SSE로 진행상황 전송)
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      const { file, workspaceId, sheetName, customerGroupId } = body

      logger.info(
        {
          workspaceId,
          sheetName,
          customerGroupId,
          fileSize: file.size,
          fileName: file.name,
        },
        "Starting lead import",
      )

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        set.status = 400
        return {
          success: false,
          error: "Excel 파일(.xlsx, .xls)만 업로드 가능합니다",
        }
      }

      try {
        // Excel 파일을 ArrayBuffer로 읽기
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "buffer" })

        // 시트 선택: sheetName이 제공되면 사용, 아니면 첫 번째 시트 사용
        const selectedSheetName = sheetName || workbook.SheetNames[0]
        const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : undefined

        if (!sheet) {
          set.status = 400
          return {
            success: false,
            error: "Sheet not found",
          }
        }

        // Excel 데이터를 JSON으로 변환
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null })

        logger.info({ rowCount: rawData.length }, "Excel file parsed")

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

        // SSE 스트림 생성
        set.headers["content-type"] = "text/event-stream"
        set.headers["cache-control"] = "no-cache"
        set.headers.connection = "keep-alive"

        // Stream 반환
        return new ReadableStream({
          async start(controller) {
            try {
              // 임포트 시작
              const result = await importLeadsBatch(
                workspaceId,
                parsedLeads,
                null, // createdBy는 인증 구현 후 추가
                customerGroupId || null, // 고객 그룹 ID (선택사항)
                (progress: ImportProgress) => {
                  // 진행상황을 SSE로 전송
                  const message = `data: ${JSON.stringify({
                    type: "progress",
                    ...progress,
                  })}\n\n`

                  controller.enqueue(new TextEncoder().encode(message))
                },
              )

              // 완료 메시지 전송
              const completeMessage = `data: ${JSON.stringify({
                type: "complete",
                result,
              })}\n\n`

              controller.enqueue(new TextEncoder().encode(completeMessage))

              logger.info(
                {
                  success: result.success,
                  skipped: result.skipped,
                  failed: result.failed,
                  duration: result.duration,
                },
                "Lead import completed",
              )

              controller.close()
            } catch (error: unknown) {
              logger.error({ error }, "Lead import failed")

              const errorMessage = `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Import failed",
              })}\n\n`

              controller.enqueue(new TextEncoder().encode(errorMessage))
              controller.close()
            }
          },
        })
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
        summary: "Excel 파일로 리드 일괄 임포트 (SSE)",
        description:
          "Excel 파일을 업로드하여 여러 리드를 일괄 임포트합니다. 실시간 진행상황을 SSE로 전송합니다. 중복 이메일 방지: (1) CSV 파일 내부의 중복 이메일과 (2) Workspace 내 기존 데이터베이스의 중복 이메일이 자동으로 감지되어 스킵되며, 완료 시 중복 이메일 목록(existingLeadId, rowNumber, companyName 포함)이 반환됩니다. 선택적으로 고객 그룹에 자동 추가할 수 있으며, 그룹 할당 정보(groupId, groupName, membersAdded)가 결과에 포함됩니다.",
      },
    },
  )

  /**
   * GET /api/v1/admin/lead-import/sheet-names
   * Excel 파일의 시트 이름 목록 조회 (미리보기)
   */
  .post(
    "/sheet-names",
    async ({ body, set }) => {
      const { file } = body

      // 파일 확장자 검증
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        set.status = 400
        return {
          success: false,
          error: "Excel 파일(.xlsx, .xls)만 업로드 가능합니다",
        }
      }

      try {
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
        summary: "Excel 파일의 시트 이름 목록 조회",
        description: "Excel 파일을 업로드하여 포함된 시트 이름 목록을 조회합니다.",
      },
    },
  )
