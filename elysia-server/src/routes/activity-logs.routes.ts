import { Elysia, t } from 'elysia'
import * as activityLogService from '../services/activity-log.service'
import { errorResponse, ResponseCode } from '../types/response.types'

const activityLogSchema = t.Object({
  workspaceId: t.String({ format: 'uuid' }),
  userId: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
  entityType: t.String({ minLength: 1, maxLength: 100 }),
  entityId: t.String({ format: 'uuid' }),
  action: t.String({ minLength: 1, maxLength: 100 }),
  details: t.Optional(t.Any()),
  ipAddress: t.Optional(t.Union([t.String({ maxLength: 50 }), t.Null()])),
  userAgent: t.Optional(t.Union([t.String(), t.Null()])),
})

export const activityLogRoutes = new Elysia({ prefix: '/api/v1/activity-logs' })
  // Search activity logs with filters (must be before /:id route)
  .get(
    '/search',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      // Parse workspaceIds and userIds from comma-separated strings
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(',').filter(Boolean)
        : undefined

      const userIds = query.userIds ? query.userIds.split(',').filter(Boolean) : undefined

      // Parse date range
      const startDate = query.startDate ? new Date(query.startDate) : undefined
      const endDate = query.endDate ? new Date(query.endDate) : undefined

      const filters = {
        entityType: query.entityType,
        action: query.action,
        search: query.search,
        workspaceIds,
        userIds,
        startDate,
        endDate,
      }

      const logs = await activityLogService.listActivityLogsWithFilters(limit, offset, filters)
      const total = await activityLogService.countActivityLogsWithFilters(filters)

      return {
        data: logs,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        entityType: t.Optional(t.String()),
        action: t.Optional(t.String()),
        search: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        userIds: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    },
  )

  // Get recent activity
  .get(
    '/recent',
    async ({ query }) => {
      const limit = parseInt(query.limit || '20', 10)
      const workspaceId = query.workspaceId

      const logs = await activityLogService.getRecentActivity(limit, workspaceId)

      return {
        data: logs,
        limit,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: 'uuid' })),
      }),
    },
  )

  // Get logs by entity
  .get(
    '/entity/:entityType/:entityId',
    async ({ params: { entityType, entityId }, query }) => {
      const limit = parseInt(query.limit || '50', 10)
      const offset = parseInt(query.offset || '0', 10)

      const logs = await activityLogService.getLogsByEntity(entityType, entityId, limit, offset)

      return {
        data: logs,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        entityType: t.String(),
        entityId: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get logs by user
  .get(
    '/user/:userId',
    async ({ params: { userId }, query }) => {
      const limit = parseInt(query.limit || '50', 10)
      const offset = parseInt(query.offset || '0', 10)

      const logs = await activityLogService.getLogsByUser(userId, limit, offset)

      return {
        data: logs,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        userId: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get activity log by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const log = await activityLogService.getActivityLog(id)
      if (!log) {
        set.status = 404
        return errorResponse('활동 로그를 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return log
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create new activity log (typically for internal use)
  .post(
    '/',
    async ({ body }) => {
      const log = await activityLogService.createActivityLog(body)
      return log
    },
    {
      body: activityLogSchema,
    },
  )

  // List activity logs with pagination
  .get(
    '/',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      const logs = await activityLogService.listActivityLogs(limit, offset)
      const total = await activityLogService.countActivityLogs()

      return {
        data: logs,
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
