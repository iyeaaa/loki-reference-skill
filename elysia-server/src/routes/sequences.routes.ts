import { Elysia, t } from 'elysia'
import * as sequenceService from '../services/sequence.service'
import { errorResponse, ResponseCode } from '../types/response.types'

const sequenceSchema = t.Object({
  workspaceId: t.String({ format: 'uuid' }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  status: t.Optional(
    t.Union([t.Literal('draft'), t.Literal('active'), t.Literal('paused'), t.Literal('archived')]),
  ),
  createdBy: t.Optional(t.String({ format: 'uuid' })),
})

const updateSequenceSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  status: t.Union([
    t.Literal('draft'),
    t.Literal('active'),
    t.Literal('paused'),
    t.Literal('archived'),
  ]),
})

const sequenceStepSchema = t.Object({
  stepOrder: t.Number(),
  delayDays: t.Number(),
  emailSubject: t.String({ minLength: 1, maxLength: 500 }),
  emailBodyText: t.Optional(t.String()),
  emailBodyHtml: t.Optional(t.String()),
  emailTemplateId: t.Optional(t.String({ format: 'uuid' })),
})

const enrollmentSchema = t.Object({
  leadId: t.String({ format: 'uuid' }),
  userEmailAccountId: t.String({ format: 'uuid' }),
  enrolledBy: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(
    t.Union([
      t.Literal('active'),
      t.Literal('paused'),
      t.Literal('completed'),
      t.Literal('stopped'),
      t.Literal('bounced'),
      t.Literal('unsubscribed'),
    ]),
  ),
})

export const sequenceRoutes = new Elysia({ prefix: '/api/v1/sequences' })
  // Search sequences with filters (must be before /:id route)
  .get(
    '/search',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      // Parse workspaceIds and createdByIds from comma-separated string
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(',').filter(Boolean)
        : undefined
      const createdByIds = query.createdByIds
        ? query.createdByIds.split(',').filter(Boolean)
        : undefined

      const filters = {
        status: query.status as any,
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
    '/:id',
    async ({ params: { id }, set }) => {
      const sequence = await sequenceService.getSequence(id)
      if (!sequence) {
        set.status = 404
        return errorResponse('시퀀스를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return sequence
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create new sequence
  .post(
    '/',
    async ({ body }) => {
      const sequence = await sequenceService.createSequence(body)
      return sequence
    },
    {
      body: sequenceSchema,
    },
  )

  // Update sequence
  .put(
    '/:id',
    async ({ params: { id }, body, set }) => {
      const sequence = await sequenceService.updateSequence(id, body)
      if (!sequence) {
        set.status = 404
        return errorResponse('시퀀스를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return sequence
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: updateSequenceSchema,
    },
  )

  // Delete sequence
  .delete(
    '/:id',
    async ({ params: { id } }) => {
      await sequenceService.deleteSequence(id)
      return { success: true, message: '시퀀스가 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // List sequences with pagination
  .get(
    '/',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

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
    '/workspace/:workspaceId',
    async ({ params: { workspaceId } }) => {
      const sequences = await sequenceService.getSequencesByWorkspace(workspaceId)
      return sequences
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
    },
  )

  // ====================================
  // SEQUENCE STEPS ROUTES
  // ====================================

  // Get sequence steps
  .get(
    '/:id/steps',
    async ({ params: { id } }) => {
      const steps = await sequenceService.getSequenceSteps(id)
      return steps
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create sequence step
  .post(
    '/:id/steps',
    async ({ params: { id }, body }) => {
      const step = await sequenceService.createSequenceStep({
        sequenceId: id,
        ...body,
      })
      return step
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: sequenceStepSchema,
    },
  )

  // Update sequence step
  .put(
    '/:id/steps/:stepId',
    async ({ params: { stepId }, body, set }) => {
      const step = await sequenceService.updateSequenceStep(stepId, body)
      if (!step) {
        set.status = 404
        return errorResponse('시퀀스 스텝을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return step
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        stepId: t.String({ format: 'uuid' }),
      }),
      body: sequenceStepSchema,
    },
  )

  // Delete sequence step
  .delete(
    '/:id/steps/:stepId',
    async ({ params: { stepId } }) => {
      await sequenceService.deleteSequenceStep(stepId)
      return { success: true, message: '시퀀스 스텝이 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        stepId: t.String({ format: 'uuid' }),
      }),
    },
  )

  // ====================================
  // SEQUENCE ENROLLMENTS ROUTES
  // ====================================

  // Get sequence enrollments
  .get(
    '/:id/enrollments',
    async ({ params: { id }, query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

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
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Create sequence enrollment
  .post(
    '/:id/enrollments',
    async ({ params: { id }, body }) => {
      const enrollment = await sequenceService.createSequenceEnrollment({
        sequenceId: id,
        ...body,
      })
      return enrollment
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: enrollmentSchema,
    },
  )

  // Update enrollment status
  .patch(
    '/:id/enrollments/:enrollmentId/status',
    async ({ params: { enrollmentId }, body, set }) => {
      const enrollment = await sequenceService.updateEnrollmentStatus(enrollmentId, body.status)
      if (!enrollment) {
        set.status = 404
        return errorResponse('등록을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return enrollment
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        enrollmentId: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal('active'),
          t.Literal('paused'),
          t.Literal('completed'),
          t.Literal('stopped'),
          t.Literal('bounced'),
          t.Literal('unsubscribed'),
        ]),
      }),
    },
  )

// Admin bulk update routes
export const adminSequenceRoutes = new Elysia({ prefix: '/api/v1/admin/sequences' })
  // Bulk update status
  .put(
    '/bulk/status',
    async ({ body }) => {
      const updatedCount = await sequenceService.bulkUpdateStatus(body.sequenceIds, body.status)
      return { updatedCount }
    },
    {
      body: t.Object({
        sequenceIds: t.Array(t.String({ format: 'uuid' })),
        status: t.Union([
          t.Literal('draft'),
          t.Literal('active'),
          t.Literal('paused'),
          t.Literal('archived'),
        ]),
      }),
    },
  )

  // Bulk delete
  .delete(
    '/bulk',
    async ({ body }) => {
      const deletedCount = await sequenceService.bulkDelete(body.sequenceIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        sequenceIds: t.Array(t.String({ format: 'uuid' })),
      }),
    },
  )

  // Bulk enroll
  .post(
    '/:id/enrollments/bulk',
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
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        leadIds: t.Array(t.String({ format: 'uuid' })),
        userEmailAccountId: t.String({ format: 'uuid' }),
        enrolledBy: t.Optional(t.String({ format: 'uuid' })),
      }),
    },
  )

  // Bulk unenroll
  .put(
    '/enrollments/bulk/unenroll',
    async ({ body }) => {
      const unenrolledCount = await sequenceService.bulkUnenroll(body.enrollmentIds)
      return { unenrolledCount }
    },
    {
      body: t.Object({
        enrollmentIds: t.Array(t.String({ format: 'uuid' })),
      }),
    },
  )
