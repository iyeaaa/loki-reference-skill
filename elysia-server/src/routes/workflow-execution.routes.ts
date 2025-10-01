import { Elysia, t } from 'elysia'
import * as workflowExecutionService from '../services/workflow-execution.service'
import { errorResponse, ResponseCode } from '../types/response.types'

export const workflowExecutionRoutes = new Elysia({ prefix: '/api/v1/sequences' })
  // Get node statistics
  .get(
    '/:id/nodes/:nodeId/stats',
    async ({ params }) => {
      const { id: sequenceId, nodeId } = params

      const stats = await workflowExecutionService.getNodeStatistics(sequenceId, nodeId)
      return stats
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        nodeId: t.String(),
      }),
    }
  )

  // Get workflow enrollments
  .get(
    '/:id/workflow-enrollments',
    async ({ params, query }) => {
      const { id: sequenceId } = params
      const limit = parseInt(query.limit || '50', 10)
      const offset = parseInt(query.offset || '0', 10)

      const enrollments = await workflowExecutionService.getWorkflowEnrollments(
        sequenceId,
        limit,
        offset
      )
      return enrollments
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )

  // Enroll single lead in workflow
  .post(
    '/:id/workflow-enrollments',
    async ({ params, body }) => {
      const { id: sequenceId } = params

      const enrollment = await workflowExecutionService.enrollInWorkflow({
        sequenceId,
        ...body,
      })

      return enrollment
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        leadId: t.String({ format: 'uuid' }),
        userEmailAccountId: t.String({ format: 'uuid' }),
        enrolledBy: t.Optional(t.String({ format: 'uuid' })),
      }),
    }
  )

  // Bulk enroll from customer group
  .post(
    '/:id/workflow-enrollments/bulk',
    async ({ params, body }) => {
      const { id: sequenceId } = params

      const result = await workflowExecutionService.bulkEnrollInWorkflow({
        sequenceId,
        ...body,
      })

      return {
        message: `${result.enrolledCount}명이 워크플로우에 등록되었습니다`,
        enrolledCount: result.enrolledCount,
        enrollments: result.enrollments,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        customerGroupId: t.String({ format: 'uuid' }),
        userEmailAccountId: t.String({ format: 'uuid' }),
        enrolledBy: t.Optional(t.String({ format: 'uuid' })),
      }),
    }
  )

  // Execute workflow manually (for testing)
  .post(
    '/:id/workflow-enrollments/:enrollmentId/execute',
    async ({ params, set }) => {
      const { enrollmentId } = params

      const result = await workflowExecutionService.executeWorkflow(enrollmentId)

      if (!result.success) {
        set.status = 400
        return errorResponse(result.error || '워크플로우 실행 실패', ResponseCode.BAD_REQUEST)
      }

      return {
        message: '워크플로우 실행 성공',
        ...result,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        enrollmentId: t.String({ format: 'uuid' }),
      }),
    }
  )

