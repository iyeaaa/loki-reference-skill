import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { userEmailAccounts } from "../db/schema/email-accounts"
import * as sequenceService from "../services/sequence.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

const sequenceSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  status: t.Optional(
    t.Union([t.Literal("draft"), t.Literal("active"), t.Literal("paused"), t.Literal("archived")]),
  ),
  workflowData: t.Optional(t.String()),
  createdBy: t.Optional(t.String({ format: "uuid" })),
  customerGroupId: t.Optional(t.String({ format: "uuid" })),
})

const updateSequenceSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String()),
  status: t.Optional(
    t.Union([t.Literal("draft"), t.Literal("active"), t.Literal("paused"), t.Literal("archived")]),
  ),
  workflowData: t.Optional(t.String()),
  customerGroupId: t.Optional(t.String({ format: "uuid" })),
})

const sequenceStepSchema = t.Object({
  stepOrder: t.Number(),
  delayDays: t.Number(),
  emailSubject: t.String({ minLength: 1, maxLength: 500 }),
  emailBodyText: t.Optional(t.String()),
  emailBodyHtml: t.Optional(t.String()),
  emailTemplateId: t.Optional(t.String({ format: "uuid" })),
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
      if (!body.customerGroupId) {
        set.status = 400
        return errorResponse(
          "워크플로우 실행을 위해 고객그룹을 선택해주세요",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 생성 시 상태 검증 (draft 또는 paused만 허용)
      if (body.status && body.status !== "draft" && body.status !== "paused") {
        set.status = 400
        return errorResponse(
          "시퀀스 생성 시 초안(draft) 또는 일시정지(paused) 상태만 가능합니다",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 상태가 없으면 기본값 draft 설정
      const sequence = await sequenceService.createSequence({
        ...body,
        status: body.status || "draft",
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
      // 활성화 상태로 변경 시 워크플로우 검증 및 자동 시작
      if (body.status === "active") {
        // 현재 시퀀스 조회
        const currentSequence = await sequenceService.getSequence(id)
        if (!currentSequence) {
          set.status = 404
          return errorResponse("시퀀스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
        }

        // 워크플로우 데이터 검증
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
      await sequenceService.deleteSequence(id)
      return { success: true, message: "시퀀스가 삭제되었습니다." }
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
      const step = await sequenceService.createSequenceStep({
        sequenceId: id,
        ...body,
      })
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
    async ({ params: { stepId }, body, set }) => {
      const step = await sequenceService.updateSequenceStep(stepId, body)
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

      const enrollments = await sequenceService.getSequenceEnrollments(id, limit, offset)
      const total = await sequenceService.countEnrollments(id)

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

// Admin bulk update routes
export const adminSequenceRoutes = new Elysia({ prefix: "/api/v1/admin/sequences" })
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
        return { error: error instanceof Error ? error.message : "Unknown error" }
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
