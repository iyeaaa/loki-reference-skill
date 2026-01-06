import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { userEmailAccounts } from "../db/schema/email-accounts"
import {
  cancelEnrollmentJobs,
  cancelSequenceJobs,
  enqueueExistingPendingExecutions,
} from "../lib/queue/queues"
import { getAITemplateGenerationService } from "../services/ai-template-generation.service"
import { generateAICampaign } from "../services/campaign-generation.service"
import * as sequenceService from "../services/sequence.service"
import * as workspaceService from "../services/workspace.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { convertFilesToAttachments } from "../utils/file.util"
import logger from "../utils/logger"

const sequenceSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  memo: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("draft"),
      t.Literal("ready"),
      t.Literal("active"),
      t.Literal("paused"),
      t.Literal("archived"),
    ]),
  ),
  workflowData: t.Optional(t.String()),
  createdBy: t.Optional(t.String({ format: "uuid" })),
  customerGroupId: t.Optional(t.String({ format: "uuid" })),
  selectedLeadIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
})

const updateSequenceSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String()),
  memo: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("draft"),
      t.Literal("ready"),
      t.Literal("active"),
      t.Literal("paused"),
      t.Literal("archived"),
    ]),
  ),
  workflowData: t.Optional(t.String()),
  customerGroupId: t.Optional(t.String({ format: "uuid" })),
  selectedLeadIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
})

const sequenceStepSchema = t.Object({
  // FormData로 전송되면 string이 되므로 union 타입 사용
  stepOrder: t.Union([t.Number(), t.String()]),
  delayDays: t.Union([t.Number(), t.String()]),
  scheduledHour: t.Optional(t.Union([t.Number({ minimum: 0, maximum: 23 }), t.String()])),
  scheduledMinute: t.Optional(t.Union([t.Number({ minimum: 0, maximum: 59 }), t.String()])),
  timezone: t.Optional(t.String({ maxLength: 50 })),
  emailSubject: t.String({ minLength: 1, maxLength: 500 }),
  emailBodyText: t.Optional(t.String()),
  emailBodyHtml: t.Optional(t.String()),
  emailTemplateId: t.Optional(t.String({ format: "uuid" })),
  generationSource: t.Optional(
    t.Union([t.Literal("template"), t.Literal("ai"), t.Literal("manual")]),
  ),
  files: t.Optional(t.Files()), // 첨부 파일
})

const enrollmentSchema = t.Object({
  leadId: t.String({ format: "uuid" }),
  userEmailAccountId: t.String({ format: "uuid" }),
  enrolledBy: t.Optional(t.String({ format: "uuid" })),
  status: t.Optional(
    t.Union([
      t.Literal("active"),
      t.Literal("paused"),
      t.Literal("completed"),
      t.Literal("stopped"),
      t.Literal("bounced"),
      t.Literal("unsubscribed"),
    ]),
  ),
})

export const sequenceRoutes = new Elysia({ prefix: "/api/v1/sequences" })
  // Search sequences with filters (must be before /:id route)
  .get(
    "/search",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Parse workspaceIds and createdByIds from comma-separated string
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(",").filter(Boolean)
        : undefined
      const createdByIds = query.createdByIds
        ? query.createdByIds.split(",").filter(Boolean)
        : undefined

      const filters = {
        status: query.status as "draft" | "active" | "paused" | "archived" | undefined,
        search: query.search,
        workspaceIds,
        createdByIds,
      }

      const sequences = await sequenceService.listSequencesWithFilters(limit, offset, filters)
      const total = await sequenceService.countSequencesWithFilters(filters)

      return {
        data: sequences,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        createdByIds: t.Optional(t.String()),
      }),
    },
  )

  // Get sequence by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const sequence = await sequenceService.getSequence(id)
      if (!sequence) {
        set.status = 404
        return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return sequence
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new sequence
  .post(
    "/",
    async ({ body, set }) => {
      // 고객그룹 필수 검증 (워크플로우 실행을 위해)
      // draft 상태가 아닐 때만 필수
      if (!body.customerGroupId && body.status !== "draft") {
        set.status = 400
        return errorResponse(
          "워크플로우 실행을 위해 고객그룹을 선택해주세요",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 생성 시 상태 검증 (draft, ready, paused만 허용)
      if (
        body.status &&
        body.status !== "draft" &&
        body.status !== "ready" &&
        body.status !== "paused"
      ) {
        set.status = 400
        return errorResponse(
          "시퀀스 생성 시 초안(draft), 준비(ready), 일시정지(paused) 상태만 가능합니다",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 상태가 없으면 기본값 draft 설정
      const sequence = await sequenceService.createSequence({
        ...body,
        status: body.status || "draft",
        // status: "paused",
      })
      return sequence
    },
    {
      body: sequenceSchema,
    },
  )

  // Update sequence
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      // 현재 시퀀스 조회
      const currentSequence = await sequenceService.getSequence(id)
      if (!currentSequence) {
        set.status = 404
        return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 고객 그룹 변경 시 enrollment 체크
      if (
        body.customerGroupId !== undefined &&
        body.customerGroupId !== currentSequence.customerGroupId
      ) {
        const hasEnrollments = await sequenceService.hasAnyEnrollments(id)
        if (hasEnrollments) {
          set.status = 400
          return errorResponse(
            "이미 실행 이력이 있는 시퀀스는 고객 그룹을 변경할 수 없습니다.",
            ResponseCode.BAD_REQUEST,
          )
        }
      }

      // 활성화 상태로 변경 시 워크플로우 검증 및 자동 시작
      if (body.status === "active") {
        // 스텝 기반 시퀀스인지 확인
        const steps = await sequenceService.getSequenceSteps(id)
        const isStepBased = steps.length > 0

        // 스텝 기반 시퀀스는 activate-step-based API를 사용해야 함
        if (isStepBased) {
          set.status = 400
          return errorResponse(
            "스텝 기반 시퀀스는 활성화 토글 버튼을 사용해주세요.",
            ResponseCode.BAD_REQUEST,
          )
        }

        // 워크플로우 기반 시퀀스만 검증
        const workflowDataToValidate = body.workflowData || currentSequence.workflowData
        if (workflowDataToValidate) {
          const { parseAndValidateWorkflow } = await import(
            "../services/workflow-validation.service"
          )
          const validation = parseAndValidateWorkflow(workflowDataToValidate)

          if (!validation.valid) {
            set.status = 400
            return errorResponse(
              `워크플로우 검증 실패: ${validation.errors.map((e) => e.message).join(", ")}`,
              ResponseCode.BAD_REQUEST,
            )
          }
        } else {
          set.status = 400
          return errorResponse(
            "워크플로우가 설정되지 않았습니다. 먼저 워크플로우를 디자인해주세요.",
            ResponseCode.BAD_REQUEST,
          )
        }

        // 활성화 시 고객그룹의 모든 리드를 워크플로우에 자동 등록
        if (currentSequence.customerGroupId && currentSequence.status !== "active") {
          const customerGroupId = currentSequence.customerGroupId

          // 워크스페이스의 첫 번째 이메일 계정 조회 (기본값)
          const [defaultEmailAccount] = await db
            .select({ id: userEmailAccounts.id })
            .from(userEmailAccounts)
            .where(eq(userEmailAccounts.workspaceId, currentSequence.workspaceId))
            .limit(1)

          if (!defaultEmailAccount) {
            set.status = 400
            return errorResponse(
              "이메일 계정이 없습니다. 먼저 이메일 계정을 추가해주세요.",
              ResponseCode.BAD_REQUEST,
            )
          }
          // 백그라운드에서 비동기로 리드 등록 및 워크플로우 실행
          // await 없이 실행하여 응답을 즉시 반환
          ;(async () => {
            try {
              const { bulkEnrollInWorkflow, executeWorkflow } = await import(
                "../services/workflow-execution.service"
              )

              const enrollResult = await bulkEnrollInWorkflow({
                sequenceId: id,
                customerGroupId,
                userEmailAccountId: defaultEmailAccount.id,
              })

              logger.info(
                { enrolledCount: enrollResult.enrolledCount },
                "Enrolled leads to workflow",
              )

              // 등록 후 즉시 워크플로우 실행 (시작 노드 다음부터)
              for (const enrollment of enrollResult.enrollments) {
                await executeWorkflow(enrollment.id)
              }

              logger.info(
                { enrollmentCount: enrollResult.enrollments.length },
                "Successfully executed workflows",
              )
            } catch (error) {
              logger.error({ err: error }, "Background process failed")
              // 백그라운드 프로세스이므로 에러를 로깅만 하고 계속 진행
            }
          })()

          logger.info({ sequenceId: id }, "Started background enrollment")
        }
      }

      // 일시정지 상태로 변경 시 Redis Job 취소 (동기화)
      if (body.status === "paused" && currentSequence.status !== "paused") {
        try {
          const cancelResult = await cancelSequenceJobs(id)
          logger.info(
            { sequenceId: id, ...cancelResult },
            "✅ [Sync] Canceled BullMQ jobs on sequence pause",
          )
        } catch (error) {
          logger.warn(
            { sequenceId: id, error },
            "⚠️ [Sync] Failed to cancel BullMQ jobs, but continuing with pause",
          )
        }
      }

      // 일시정지에서 활성화로 변경 시 pending execution을 BullMQ에 재등록
      if (body.status === "active" && currentSequence.status === "paused") {
        try {
          const enqueueResult = await enqueueExistingPendingExecutions(id)
          logger.info(
            { sequenceId: id, ...enqueueResult },
            "✅ [Sync] Re-enqueued pending executions on sequence resume",
          )
        } catch (error) {
          logger.warn({ sequenceId: id, error }, "⚠️ [Sync] Failed to re-enqueue pending executions")
        }
      }

      const sequence = await sequenceService.updateSequence(id, body)
      if (!sequence) {
        set.status = 404
        return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return sequence
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateSequenceSchema,
    },
  )

  // Delete sequence
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      // 삭제 전 Redis Job 취소 (orphan job 방지)
      try {
        const cancelResult = await cancelSequenceJobs(id)
        logger.info(
          { sequenceId: id, ...cancelResult },
          "✅ [Sync] Canceled BullMQ jobs before sequence deletion",
        )
      } catch (error) {
        logger.warn(
          { sequenceId: id, error },
          "⚠️ [Sync] Failed to cancel BullMQ jobs, but continuing with deletion",
        )
      }

      await sequenceService.deleteSequence(id)
      return { success: true, message: "시퀀스가 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Copy sequence (시퀀스 복사 - 스텝 포함)
  .post(
    "/:id/copy",
    async ({ params: { id }, body, set }) => {
      try {
        const copiedSequence = await sequenceService.copySequence(id, body)
        logger.info(
          {
            originalId: id,
            copiedId: copiedSequence.id,
            copiedName: copiedSequence.name,
          },
          "✅ 시퀀스 복사 완료",
        )
        return successResponse(copiedSequence, "시퀀스가 복사되었습니다.")
      } catch (error) {
        logger.error({ err: error, sequenceId: id }, "❌ 시퀀스 복사 실패")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "시퀀스 복사에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        customerGroupId: t.Optional(t.String({ format: "uuid" })),
        selectedLeadIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
        createdBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Generate AI sequence (6 steps + personalized email drafts)
  .post(
    "/:id/generate",
    async ({ params: { id }, body, set }) => {
      console.log("🤖 [SEQUENCES] POST /:id/generate - Sequence ID:", id)
      console.log("Email Account ID:", body.userEmailAccountId)

      logger.info(
        {
          sequenceId: id,
        },
        "🤖 [SEQUENCE] AI generation request received",
      )

      // Get sequence details
      const sequence = await sequenceService.getSequence(id)
      if (!sequence) {
        console.log("❌ [SEQUENCES] Sequence not found:", id)
        set.status = 404
        return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      console.log("Sequence details:", { name: sequence.name, workspaceId: sequence.workspaceId })

      if (!sequence.customerGroupId) {
        console.log("❌ [SEQUENCES] No customer group:", id)
        set.status = 400
        return errorResponse("고객그룹이 설정되지 않았습니다.", ResponseCode.BAD_REQUEST)
      }

      console.log("Calling generateAICampaign...")
      // Generate AI sequence (reusing campaign generation logic)
      const result = await generateAICampaign({
        sequenceId: id,
        workspaceId: sequence.workspaceId,
        customerGroupId: sequence.customerGroupId,
        userEmailAccountId: body.userEmailAccountId,
      })

      if (!result.success) {
        console.log("❌ [SEQUENCES] AI sequence generation failed:", result.error)
        logger.error(
          {
            sequenceId: id,
            error: result.error,
          },
          "❌ [SEQUENCE] AI generation failed",
        )
        set.status = 500
        return errorResponse(result.error || "AI 시퀀스 생성 실패", ResponseCode.INTERNAL_ERROR)
      }

      console.log("✅ [SEQUENCES] AI sequence generated successfully")
      console.log("Results:", {
        totalLeads: result.totalLeads,
        totalDrafts: result.totalDrafts,
        stepsCreated: result.stepsCreated,
        enrollmentsCreated: result.enrollmentsCreated,
        executionsCreated: result.executionsCreated,
        aiGenerated: result.aiGenerated,
      })

      logger.info(
        {
          sequenceId: id,
          totalLeads: result.totalLeads,
          totalDrafts: result.totalDrafts,
        },
        "🎉 [SEQUENCE] AI generation completed",
      )

      return successResponse(
        {
          totalLeads: result.totalLeads,
          totalDrafts: result.totalDrafts,
          stepsCreated: result.stepsCreated,
          enrollmentsCreated: result.enrollmentsCreated,
          executionsCreated: result.executionsCreated,
          aiGenerated: result.aiGenerated,
        },
        "AI 시퀀스 생성 완료",
        ResponseCode.SUCCESS,
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        userEmailAccountId: t.Optional(t.String({ format: "uuid" })), // Optional - not needed for draft generation
      }),
    },
  )

  // Activate step-based sequence (without workflow validation)
  .post(
    "/:id/activate-step-based",
    async ({ params: { id }, set }) => {
      logger.info({ sequenceId: id }, "🚀 [STEP-BASED] Activation request received")

      // 현재 시퀀스 조회
      const currentSequence = await sequenceService.getSequence(id)
      if (!currentSequence) {
        logger.error({ sequenceId: id }, "❌ [STEP-BASED] Sequence not found")
        set.status = 404
        return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 이미 활성화된 시퀀스는 재활성화하지 않음 (중복 발송 방지)
      if (currentSequence.status === "active") {
        logger.info(
          { sequenceId: id, sequenceName: currentSequence.name },
          "✅ [STEP-BASED] Sequence is already active, skipping re-activation",
        )
        const steps = await sequenceService.getSequenceSteps(id)
        return {
          success: true,
          message: "시퀀스가 이미 활성화되어 있습니다.",
          stepsCount: steps.length,
          alreadyActive: true,
        }
      }

      logger.info(
        {
          sequenceId: id,
          sequenceName: currentSequence.name,
          workspaceId: currentSequence.workspaceId,
          customerGroupId: currentSequence.customerGroupId,
        },
        "✅ [STEP-BASED] Found sequence",
      )

      // 스텝이 있는지 확인
      const steps = await sequenceService.getSequenceSteps(id)
      if (steps.length === 0) {
        logger.error({ sequenceId: id }, "❌ [STEP-BASED] No steps found in sequence")
        set.status = 400
        return errorResponse(
          "시퀀스에 스텝이 없습니다. 먼저 스텝을 추가해주세요.",
          ResponseCode.BAD_REQUEST,
        )
      }

      logger.info(
        {
          sequenceId: id,
          stepsCount: steps.length,
          steps: steps.map((s) => ({
            stepOrder: s.stepOrder,
            delayDays: s.delayDays,
            subject: s.emailSubject,
          })),
        },
        "✅ [STEP-BASED] Found sequence steps",
      )

      // 고객그룹 확인
      if (!currentSequence.customerGroupId) {
        logger.error({ sequenceId: id }, "❌ [STEP-BASED] No customer group configured")
        set.status = 400
        return errorResponse(
          "고객그룹이 설정되지 않았습니다. 먼저 고객그룹을 선택해주세요.",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 이메일 계정 확인
      logger.debug(
        { sequenceId: id, workspaceId: currentSequence.workspaceId },
        "🔍 [STEP-BASED] Checking for email account",
      )

      const [defaultEmailAccount] = await db
        .select({
          id: userEmailAccounts.id,
          emailAddress: userEmailAccounts.emailAddress,
        })
        .from(userEmailAccounts)
        .where(eq(userEmailAccounts.workspaceId, currentSequence.workspaceId))
        .limit(1)

      if (!defaultEmailAccount) {
        logger.error(
          { sequenceId: id, workspaceId: currentSequence.workspaceId },
          "❌ [STEP-BASED] No email account found in workspace",
        )
        set.status = 400
        return errorResponse(
          "이메일 계정이 없습니다. 먼저 이메일 계정을 추가해주세요.",
          ResponseCode.BAD_REQUEST,
        )
      }

      logger.info(
        {
          sequenceId: id,
          emailAccountId: defaultEmailAccount.id,
          emailAddress: defaultEmailAccount.emailAddress,
        },
        "✅ [STEP-BASED] Found email account",
      )

      // 상태를 active로 변경
      await sequenceService.updateSequence(id, { status: "active" })

      logger.info({ sequenceId: id }, "✅ [STEP-BASED] Updated sequence status to active")

      // 백그라운드에서 스케줄링과 함께 리드 등록
      ;(async () => {
        try {
          logger.info(
            {
              sequenceId: id,
              customerGroupId: currentSequence.customerGroupId,
              hasSelectedLeads: !!currentSequence.selectedLeadIds,
            },
            "🔄 [STEP-BASED] Starting background enrollment",
          )

          let leadIds: string[] = []

          // 선택된 리드가 있으면 그것을 사용, 없으면 전체 고객 그룹 사용
          if (currentSequence.selectedLeadIds) {
            try {
              leadIds = JSON.parse(currentSequence.selectedLeadIds) as string[]
              logger.info(
                { sequenceId: id, selectedLeadCount: leadIds.length },
                "📋 [STEP-BASED] Using selected leads",
              )
            } catch (parseError) {
              logger.error(
                { err: parseError, sequenceId: id },
                "❌ [STEP-BASED] Failed to parse selectedLeadIds",
              )
            }
          }

          // 선택된 리드가 없거나 파싱 실패 시 전체 고객 그룹 사용
          if (leadIds.length === 0 && currentSequence.customerGroupId) {
            const { getCustomerGroupLeads } = await import("../services/customer-group.service")
            const leads = await getCustomerGroupLeads(currentSequence.customerGroupId)
            leadIds = leads.map((lead: { id: string }) => lead.id)
            logger.info(
              { sequenceId: id, leadCount: leadIds.length },
              "📋 [STEP-BASED] Using all leads from customer group",
            )
          }

          if (leadIds.length === 0) {
            logger.warn(
              { sequenceId: id },
              "⚠️ [STEP-BASED] No leads to enroll (no selected leads and no customer group)",
            )
            return
          }

          const result = await sequenceService.bulkEnrollWithScheduling({
            sequenceId: id,
            leadIds,
            userEmailAccountId: defaultEmailAccount.id,
          })

          logger.info(
            {
              sequenceId: id,
              enrolledCount: result.enrolledCount,
              updatedCount: result.updatedCount,
              totalSteps: result.totalSteps,
              scheduledExecutions: result.scheduledExecutions,
            },
            "🎉 [STEP-BASED] Successfully processed enrollments (new: " +
              result.enrolledCount +
              ", existing: " +
              result.updatedCount +
              ")",
          )
        } catch (error) {
          logger.error(
            { err: error, sequenceId: id },
            "💥 [STEP-BASED] Failed to enroll leads in background",
          )
        }
      })()

      logger.info(
        { sequenceId: id, stepsCount: steps.length },
        "🎯 [STEP-BASED] Activated step-based sequence - background enrollment started",
      )

      return {
        success: true,
        message: "스텝 기반 시퀀스가 활성화되었습니다.",
        stepsCount: steps.length,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List sequences with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const sequences = await sequenceService.listSequences(limit, offset)
      const total = await sequenceService.countSequences()

      return {
        data: sequences,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get sequences by workspace
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId } }) => {
      const sequences = await sequenceService.getSequencesByWorkspace(workspaceId)
      return sequences
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get leads for sequence (based on selectedLeadIds)
  .get(
    "/:id/leads",
    async ({ params: { id }, query: { page, limit: queryLimit } }) => {
      const pageNum = Number(page) || 1
      const limitNum = Number(queryLimit) || 10
      const offset = (pageNum - 1) * limitNum
      const result = await sequenceService.getSequenceLeads(id, limitNum, offset)
      return {
        data: result.leads,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum),
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // ====================================
  // SEQUENCE STEPS ROUTES
  // ====================================

  // Get sequence steps
  .get(
    "/:id/steps",
    async ({ params: { id } }) => {
      const steps = await sequenceService.getSequenceSteps(id)
      return steps
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create sequence step
  .post(
    "/:id/steps",
    async ({ params: { id }, body }) => {
      logger.info(
        {
          sequenceId: id,
          hasFiles: !!body.files,
          filesCount: body.files ? (Array.isArray(body.files) ? body.files.length : 1) : 0,
          hasEmailBodyHtml: !!body.emailBodyHtml,
          emailBodyHtmlLength: body.emailBodyHtml?.length || 0,
          emailBodyHtmlPreview: body.emailBodyHtml?.substring(0, 200),
          emailBodyTextLength: body.emailBodyText?.length || 0,
        },
        "📎 [API] Creating sequence step",
      )

      // Process attachments if files are provided
      let attachmentsData = null
      if (body.files && body.files.length > 0) {
        const files = Array.isArray(body.files) ? body.files : [body.files]

        try {
          const attachments = await convertFilesToAttachments(files)

          // Save metadata with base64 content for later use
          attachmentsData = attachments.map((att) => ({
            filename: att.filename,
            type: att.type || "application/octet-stream",
            content: att.content, // Base64 encoded
          }))

          logger.info(
            {
              sequenceId: id,
              fileCount: files.length,
            },
            "Files converted to attachments for sequence step",
          )
        } catch (error) {
          logger.error({ err: error }, "Failed to process attachments")
          throw new Error("첨부 파일 처리 중 오류가 발생했습니다.")
        }
      }

      // FormData로 전송되면 숫자 필드가 문자열로 변환되므로 명시적으로 변환
      const stepData = {
        sequenceId: id,
        stepOrder:
          typeof body.stepOrder === "string" ? Number.parseInt(body.stepOrder, 10) : body.stepOrder,
        delayDays:
          typeof body.delayDays === "string" ? Number.parseInt(body.delayDays, 10) : body.delayDays,
        scheduledHour:
          body.scheduledHour !== undefined
            ? typeof body.scheduledHour === "string"
              ? Number.parseInt(body.scheduledHour, 10)
              : body.scheduledHour
            : undefined,
        scheduledMinute:
          body.scheduledMinute !== undefined
            ? typeof body.scheduledMinute === "string"
              ? Number.parseInt(body.scheduledMinute, 10)
              : body.scheduledMinute
            : undefined,
        timezone: body.timezone,
        emailSubject: body.emailSubject,
        emailBodyText: body.emailBodyText,
        emailBodyHtml: body.emailBodyHtml,
        emailTemplateId: body.emailTemplateId,
        generationSource: body.generationSource,
        attachments: attachmentsData,
      }

      const step = await sequenceService.createSequenceStep(stepData)
      return step
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: sequenceStepSchema,
    },
  )

  // Update sequence step
  .put(
    "/:id/steps/:stepId",
    async ({ params: { id, stepId }, body, set }) => {
      logger.info(
        {
          sequenceId: id,
          stepId,
          hasFiles: !!body.files,
          filesCount: body.files ? (Array.isArray(body.files) ? body.files.length : 1) : 0,
          hasEmailBodyHtml: !!body.emailBodyHtml,
          emailBodyHtmlLength: body.emailBodyHtml?.length || 0,
          emailBodyHtmlPreview: body.emailBodyHtml?.substring(0, 200),
          emailBodyTextLength: body.emailBodyText?.length || 0,
        },
        "📎 [API] Updating sequence step",
      )

      // Process attachments if files are provided
      let attachmentsData = null
      if (body.files && body.files.length > 0) {
        const files = Array.isArray(body.files) ? body.files : [body.files]

        try {
          const attachments = await convertFilesToAttachments(files)

          // Save metadata with base64 content for later use
          attachmentsData = attachments.map((att) => ({
            filename: att.filename,
            type: att.type || "application/octet-stream",
            content: att.content, // Base64 encoded
          }))

          logger.info(
            {
              stepId,
              fileCount: files.length,
            },
            "Files converted to attachments for sequence step update",
          )
        } catch (error) {
          logger.error({ err: error }, "Failed to process attachments")
          throw new Error("첨부 파일 처리 중 오류가 발생했습니다.")
        }
      }

      // FormData로 전송되면 숫자 필드가 문자열로 변환되므로 명시적으로 변환
      const updateData = {
        stepOrder:
          typeof body.stepOrder === "string" ? Number.parseInt(body.stepOrder, 10) : body.stepOrder,
        delayDays:
          typeof body.delayDays === "string" ? Number.parseInt(body.delayDays, 10) : body.delayDays,
        scheduledHour:
          body.scheduledHour !== undefined
            ? typeof body.scheduledHour === "string"
              ? Number.parseInt(body.scheduledHour, 10)
              : body.scheduledHour
            : undefined,
        scheduledMinute:
          body.scheduledMinute !== undefined
            ? typeof body.scheduledMinute === "string"
              ? Number.parseInt(body.scheduledMinute, 10)
              : body.scheduledMinute
            : undefined,
        timezone: body.timezone,
        emailSubject: body.emailSubject,
        emailBodyText: body.emailBodyText,
        emailBodyHtml: body.emailBodyHtml,
        emailTemplateId: body.emailTemplateId,
        generationSource: body.generationSource,
        attachments: attachmentsData,
      }

      logger.info(
        {
          stepId,
          updateData: {
            ...updateData,
            emailBodyHtmlLength: updateData.emailBodyHtml?.length || 0,
            emailBodyHtmlPreview: updateData.emailBodyHtml?.substring(0, 200),
            emailBodyHtmlEndsWith: updateData.emailBodyHtml?.substring(
              Math.max(0, (updateData.emailBodyHtml?.length || 0) - 100),
            ),
          },
        },
        "📎 [API] updateData before calling updateSequenceStep",
      )

      const step = await sequenceService.updateSequenceStep(stepId, updateData)
      if (!step) {
        set.status = 404
        return errorResponse("시퀀스 스텝을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return step
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        stepId: t.String({ format: "uuid" }),
      }),
      body: sequenceStepSchema,
    },
  )

  // Delete sequence step
  .delete(
    "/:id/steps/:stepId",
    async ({ params: { stepId } }) => {
      await sequenceService.deleteSequenceStep(stepId)
      return { success: true, message: "시퀀스 스텝이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        stepId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // SEQUENCE ENROLLMENTS ROUTES
  // ====================================

  // Get sequence enrollments
  .get(
    "/:id/enrollments",
    async ({ params: { id }, query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        companyName: query.companyName,
        opened: query.opened === "true" ? true : query.opened === "false" ? false : undefined,
        clicked: query.clicked === "true" ? true : query.clicked === "false" ? false : undefined,
        replied: query.replied === "true" ? true : query.replied === "false" ? false : undefined,
        delivered:
          query.delivered === "true" ? true : query.delivered === "false" ? false : undefined,
      }

      // const enrollments = await sequenceService.getSequenceEnrollmentsNoContacts(id, limit, offset, filters)

      const enrollments = await sequenceService.getSequenceEnrollments(id, limit, offset, filters)
      const total = await sequenceService.countEnrollments(id, filters)

      return {
        data: enrollments,
        total,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        companyName: t.Optional(t.String()),
        opened: t.Optional(t.String()),
        clicked: t.Optional(t.String()),
        replied: t.Optional(t.String()),
        delivered: t.Optional(t.String()),
      }),
    },
  )

  // Create sequence enrollment
  .post(
    "/:id/enrollments",
    async ({ params: { id }, body }) => {
      const enrollment = await sequenceService.createSequenceEnrollment({
        sequenceId: id,
        ...body,
      })
      return enrollment
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: enrollmentSchema,
    },
  )

  // Update enrollment status
  .patch(
    "/:id/enrollments/:enrollmentId/status",
    async ({ params: { enrollmentId }, body, set }) => {
      // 중단/일시정지 상태로 변경 시 Redis Job 취소 (동기화)
      if (body.status === "stopped" || body.status === "paused" || body.status === "unsubscribed") {
        try {
          const cancelResult = await cancelEnrollmentJobs(enrollmentId)
          logger.info(
            { enrollmentId, status: body.status, ...cancelResult },
            "✅ [Sync] Canceled BullMQ jobs on enrollment status change",
          )
        } catch (error) {
          logger.warn(
            { enrollmentId, status: body.status, error },
            "⚠️ [Sync] Failed to cancel BullMQ jobs, but continuing with status update",
          )
        }
      }

      const enrollment = await sequenceService.updateEnrollmentStatus(enrollmentId, body.status)
      if (!enrollment) {
        set.status = 404
        return errorResponse("등록을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return enrollment
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        enrollmentId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal("active"),
          t.Literal("paused"),
          t.Literal("completed"),
          t.Literal("stopped"),
          t.Literal("bounced"),
          t.Literal("unsubscribed"),
        ]),
      }),
    },
  )

  // Get enrollment step executions
  .get(
    "/:id/enrollments/:enrollmentId/step-executions",
    async ({ params: { enrollmentId } }) => {
      const executions = await sequenceService.getEnrollmentStepExecutions(enrollmentId)
      return successResponse(executions)
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        enrollmentId: t.String({ format: "uuid" }),
      }),
    },
  )

  // SEQUENCE METRICS ROUTES
  // ====================================

  // Get overall sequence statistics (must be before /:id/metrics)
  .get(
    "/stats/overall",
    async ({ query }) => {
      const stats = await sequenceService.getOverallSequenceStats(query.workspaceId)
      return { data: stats }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Get sequence metrics
  .get(
    "/:id/metrics",
    async ({ params: { id } }) => {
      const metrics = await sequenceService.getSequenceMetrics(id)
      return { data: metrics }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get enrollment metrics
  .get(
    "/enrollments/:enrollmentId/metrics",
    async ({ params: { enrollmentId } }) => {
      const metrics = await sequenceService.getEnrollmentMetrics(enrollmentId)
      return { data: metrics }
    },
    {
      params: t.Object({
        enrollmentId: t.String({ format: "uuid" }),
      }),
    },
  )

  // AI 이메일 템플릿 생성
  .post(
    "/generate-template",
    async ({ body, set }) => {
      try {
        // 워크스페이스 정보 조회
        const workspace = await workspaceService.getWorkspace(body.workspaceId)
        if (!workspace) {
          set.status = 404
          return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
        }

        // AI 템플릿 생성 서비스 호출
        // 발신자의 회사 정보 사용 (companyName, companyDescription)
        const aiService = getAITemplateGenerationService()
        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.companyName || workspace.name,
          workspaceNameEn: workspace.companyNameEn || undefined,
          workspaceDescription: workspace.companyDescription || undefined,
          country: body.country,
          userPrompt: body.prompt,
          // model: body.model, // Hide model parameter because front can use any model is not intended
          temperature: body.temperature,
        })

        logger.info(
          {
            workspaceId: body.workspaceId,
            country: body.country,
            language: template.detectedLanguage,
          },
          "Email template generated successfully",
        )

        return successResponse(
          {
            emailSubject: template.subject,
            emailBodyText: template.bodyText,
            emailBodyHtml: template.bodyHtml,
            detectedLanguage: template.detectedLanguage,
          },
          "이메일 템플릿이 생성되었습니다.",
          ResponseCode.CREATED,
        )
      } catch (error) {
        logger.error({ err: error, body }, "Failed to generate email template")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "이메일 템플릿 생성에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        country: t.String({ minLength: 2, maxLength: 100 }),
        prompt: t.String({ minLength: 10 }),
        temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
      }),
    },
  )

// Admin bulk update routes
export const adminSequenceRoutes = new Elysia({
  prefix: "/api/v1/admin/sequences",
})
  // Bulk update status
  .put(
    "/bulk/status",
    async ({ body }) => {
      const updatedCount = await sequenceService.bulkUpdateStatus(body.sequenceIds, body.status)
      return { updatedCount }
    },
    {
      body: t.Object({
        sequenceIds: t.Array(t.String({ format: "uuid" })),
        status: t.Union([
          t.Literal("draft"),
          t.Literal("active"),
          t.Literal("paused"),
          t.Literal("archived"),
        ]),
      }),
    },
  )

  // Bulk delete
  .delete(
    "/bulk",
    async ({ body }) => {
      const deletedCount = await sequenceService.bulkDelete(body.sequenceIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        sequenceIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk enroll
  .post(
    "/:id/enrollments/bulk",
    async ({ params: { id }, body }) => {
      const enrolledCount = await sequenceService.bulkEnroll({
        sequenceId: id,
        leadIds: body.leadIds,
        userEmailAccountId: body.userEmailAccountId,
        enrolledBy: body.enrolledBy,
      })
      return { enrolledCount }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
        userEmailAccountId: t.String({ format: "uuid" }),
        enrolledBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk enroll with scheduling (new method with step execution scheduling)
  .post(
    "/:id/enrollments/bulk-with-scheduling",
    async ({ params: { id }, body, set }) => {
      try {
        const result = await sequenceService.bulkEnrollWithScheduling({
          sequenceId: id,
          leadIds: body.leadIds,
          userEmailAccountId: body.userEmailAccountId,
          enrolledBy: body.enrolledBy,
        })
        return result
      } catch (error: unknown) {
        set.status = 400
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        leadIds: t.Array(t.String({ format: "uuid" })),
        userEmailAccountId: t.String({ format: "uuid" }),
        enrolledBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk unenroll
  .put(
    "/enrollments/bulk/unenroll",
    async ({ body }) => {
      const unenrolledCount = await sequenceService.bulkUnenroll(body.enrollmentIds)
      return { unenrolledCount }
    },
    {
      body: t.Object({
        enrollmentIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Get pending step executions for email worker
  .get("/step-executions/pending", async ({ query }) => {
    const limit = parseInt(query.limit || "100", 10)
    const executions = await sequenceService.getPendingStepExecutions(limit)
    return { data: executions, count: executions.length }
  })

  // Update step execution status
  .patch(
    "/step-executions/:executionId/status",
    async ({ params: { executionId }, body }) => {
      const updated = await sequenceService.updateStepExecutionStatus(
        executionId,
        body.status,
        body.errorMessage,
        body.emailId,
      )
      return updated
    },
    {
      params: t.Object({
        executionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        status: t.Union([t.Literal("sent"), t.Literal("failed"), t.Literal("skipped")]),
        errorMessage: t.Optional(t.String()),
        emailId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
