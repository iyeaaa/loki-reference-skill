/**
 * Job Logs API Routes
 *
 * BullMQ Job 로그 조회 API
 * - 목록 조회 (페이지네이션, 필터, 검색)
 * - 통계 조회
 * - 상세 조회
 */

import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { type JobStatus, jobLogs } from "../db/schema/job-logs"

// Job Status enum values
const _jobStatusValues = ["waiting", "active", "completed", "failed", "delayed", "stalled"] as const

export const jobLogsRoutes = new Elysia({ prefix: "/api/v1/admin/job-logs" })
  // Search job logs with filters and pagination
  .get(
    "/search",
    async ({ query }) => {
      const limit = parseInt(query.limit || "20", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Build conditions
      const conditions = []

      // Queue name filter
      if (query.queueName) {
        conditions.push(eq(jobLogs.queueName, query.queueName))
      }

      // Status filter (comma-separated)
      if (query.status) {
        const statuses = query.status
          .split(",")
          .filter((s): s is JobStatus => Boolean(s)) as JobStatus[]
        if (statuses.length === 1) {
          const status = statuses[0]
          if (status) {
            conditions.push(eq(jobLogs.status, status))
          }
        } else if (statuses.length > 1) {
          conditions.push(or(...statuses.map((s) => eq(jobLogs.status, s))))
        }
      }

      // Date range filter
      if (query.startDate) {
        conditions.push(gte(jobLogs.addedAt, new Date(query.startDate)))
      }
      if (query.endDate) {
        conditions.push(lte(jobLogs.addedAt, new Date(query.endDate)))
      }

      // Search filter (job ID, job name, error message)
      if (query.search) {
        const searchPattern = `%${query.search}%`
        conditions.push(
          or(
            ilike(jobLogs.jobId, searchPattern),
            ilike(jobLogs.jobName, searchPattern),
            ilike(jobLogs.errorMessage, searchPattern),
            ilike(jobLogs.errorCode, searchPattern),
          ),
        )
      }

      // Error code filter
      if (query.errorCode) {
        conditions.push(eq(jobLogs.errorCode, query.errorCode))
      }

      // Worker name filter
      if (query.workerName) {
        conditions.push(eq(jobLogs.workerName, query.workerName))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // Fetch data
      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(jobLogs)
          .where(whereClause)
          .orderBy(desc(jobLogs.addedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(jobLogs).where(whereClause),
      ])

      const total = totalResult[0]?.count ?? 0

      return {
        data,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        queueName: t.Optional(t.String()),
        status: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        search: t.Optional(t.String()),
        errorCode: t.Optional(t.String()),
        workerName: t.Optional(t.String()),
      }),
    },
  )

  // Get job log statistics
  .get(
    "/stats",
    async ({ query }) => {
      const hours = parseInt(query.hours || "24", 10)
      const since = new Date(Date.now() - hours * 60 * 60 * 1000)

      const conditions = [gte(jobLogs.addedAt, since)]
      if (query.queueName) {
        conditions.push(eq(jobLogs.queueName, query.queueName))
      }

      // Status counts by queue
      const statusCounts = await db
        .select({
          queueName: jobLogs.queueName,
          status: jobLogs.status,
          count: sql<number>`count(*)::int`,
          avgDurationMs: sql<number>`avg(${jobLogs.durationMs})::int`,
          maxDurationMs: sql<number>`max(${jobLogs.durationMs})::int`,
          minDurationMs: sql<number>`min(${jobLogs.durationMs})::int`,
        })
        .from(jobLogs)
        .where(and(...conditions))
        .groupBy(jobLogs.queueName, jobLogs.status)

      // Error code breakdown
      const errorStats = await db
        .select({
          errorCode: jobLogs.errorCode,
          count: sql<number>`count(*)::int`,
        })
        .from(jobLogs)
        .where(and(...conditions, eq(jobLogs.status, "failed")))
        .groupBy(jobLogs.errorCode)
        .orderBy(desc(sql`count(*)`))
        .limit(10)

      // Total counts
      const totalCounts = await db
        .select({
          status: jobLogs.status,
          count: sql<number>`count(*)::int`,
        })
        .from(jobLogs)
        .where(and(...conditions))
        .groupBy(jobLogs.status)

      // Get distinct queue names
      const queueNames = await db
        .selectDistinct({ queueName: jobLogs.queueName })
        .from(jobLogs)
        .where(and(...conditions))

      return {
        statusCounts,
        errorStats,
        totalCounts,
        queueNames: queueNames.map((q) => q.queueName),
        hours,
      }
    },
    {
      query: t.Object({
        hours: t.Optional(t.String()),
        queueName: t.Optional(t.String()),
      }),
    },
  )

  // Get distinct queue names
  .get("/queues", async () => {
    const queues = await db
      .selectDistinct({ queueName: jobLogs.queueName })
      .from(jobLogs)
      .orderBy(jobLogs.queueName)

    return {
      data: queues.map((q) => q.queueName),
    }
  })

  // Get distinct error codes
  .get("/error-codes", async () => {
    const errorCodes = await db
      .selectDistinct({ errorCode: jobLogs.errorCode })
      .from(jobLogs)
      .where(sql`${jobLogs.errorCode} IS NOT NULL`)
      .orderBy(jobLogs.errorCode)

    return {
      data: errorCodes.map((e) => e.errorCode).filter(Boolean),
    }
  })

  // Get single job log by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const [result] = await db.select().from(jobLogs).where(eq(jobLogs.id, id)).limit(1)

      if (!result) {
        set.status = 404
        return { error: "Job log not found" }
      }

      return result
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )
