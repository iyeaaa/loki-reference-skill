import { type JobProgress, QueueEvents } from "bullmq"
import { Elysia, t } from "elysia"
import { getAllQueues, testQueue } from "../lib/queue"
import { QUEUE_NAMES, type TestJob } from "../lib/queue/types"
import { createRedisConnection, redisConnection } from "../lib/redis"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

/**
 * BullMQ Test Routes
 * For testing and demonstrating BullMQ functionality
 */
export const bullmqTestRoutes = new Elysia({ prefix: "/api/v1/bullmq-test" })
  /**
   * Health check - Redis connection status
   */
  .get("/health", async () => {
    try {
      const ping = await redisConnection.ping()
      return {
        success: true,
        data: {
          redis: ping === "PONG" ? "connected" : "disconnected",
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Redis connection failed",
      }
    }
  })

  /**
   * Get all queue statuses
   */
  .get("/queues", async () => {
    try {
      const queues = getAllQueues()
      const statuses: Record<
        string,
        {
          name: string
          waiting: number
          active: number
          completed: number
          failed: number
          delayed: number
          paused: boolean
        }
      > = {}

      for (const [name, queue] of Object.entries(queues)) {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ])

        statuses[name] = {
          name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
        }
      }

      return { success: true, data: statuses }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get queue statuses",
      }
    }
  })

  /**
   * Get test queue details with jobs (with pagination and filters)
   */
  .get(
    "/queues/test",
    async ({ query }) => {
      try {
        const page = query.page ? Number.parseInt(query.page, 10) : 1
        const limit = query.limit ? Number.parseInt(query.limit, 10) : 10
        const status = query.status || "all"
        const search = query.search || ""
        const sortBy = query.sortBy || "timestamp"
        const sortOrder = query.sortOrder || "desc"

        // Get status types to query
        const statusTypes: ("waiting" | "active" | "completed" | "failed" | "delayed")[] =
          status === "all"
            ? ["waiting", "active", "completed", "failed", "delayed"]
            : [status as "waiting" | "active" | "completed" | "failed" | "delayed"]

        // Get all jobs for the selected statuses
        const allJobs = await testQueue.getJobs(statusTypes, 0, 1000)

        // Transform jobs with status
        let jobDetails = allJobs.map((job) => ({
          id: job.id || "",
          name: job.name,
          data: job.data,
          status: (job.finishedOn
            ? job.failedReason
              ? "failed"
              : "completed"
            : job.processedOn
              ? "active"
              : job.delay && job.delay > 0
                ? "delayed"
                : "waiting") as "waiting" | "active" | "completed" | "failed" | "delayed",
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        }))

        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase()
          jobDetails = jobDetails.filter(
            (job) =>
              job.id.toLowerCase().includes(searchLower) ||
              job.name.toLowerCase().includes(searchLower) ||
              JSON.stringify(job.data).toLowerCase().includes(searchLower),
          )
        }

        // Sort jobs
        jobDetails.sort((a, b) => {
          let aVal: number | string = 0
          let bVal: number | string = 0

          switch (sortBy) {
            case "id":
              aVal = a.id
              bVal = b.id
              break
            case "name":
              aVal = a.name
              bVal = b.name
              break
            case "status":
              aVal = a.status
              bVal = b.status
              break
            default:
              aVal = a.timestamp || 0
              bVal = b.timestamp || 0
          }

          if (typeof aVal === "string" && typeof bVal === "string") {
            return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
          }
          return sortOrder === "asc"
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number)
        })

        // Calculate pagination
        const total = jobDetails.length
        const totalPages = Math.ceil(total / limit)
        const startIndex = (page - 1) * limit
        const paginatedJobs = jobDetails.slice(startIndex, startIndex + limit)

        // Get counts
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          testQueue.getWaitingCount(),
          testQueue.getActiveCount(),
          testQueue.getCompletedCount(),
          testQueue.getFailedCount(),
          testQueue.getDelayedCount(),
        ])

        return {
          success: true,
          data: {
            jobs: paginatedJobs,
            counts: { waiting, active, completed, failed, delayed },
            pagination: {
              page,
              limit,
              total,
              totalPages,
            },
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get test queue details",
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Add a job to test queue
   */
  .post(
    "/jobs",
    async ({ body }) => {
      try {
        const jobData: TestJob = {
          message: body.message,
          delay: body.processingDelay,
          shouldFail: body.shouldFail,
          data: body.customData,
        }

        const job = await testQueue.add(body.jobName || "test-job", jobData, {
          delay: body.scheduleDelay,
          priority: body.priority,
          attempts: body.attempts || 3,
        })

        logger.info({ jobId: job.id, data: jobData }, "[BullMQ-Test] Job added")

        return {
          success: true,
          data: {
            jobId: job.id,
            name: job.name,
            data: job.data,
            opts: {
              delay: job.opts.delay,
              priority: job.opts.priority,
              attempts: job.opts.attempts,
            },
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add job",
        }
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1 }),
        jobName: t.Optional(t.String()),
        scheduleDelay: t.Optional(t.Number({ minimum: 0 })), // Delay before job starts (ms)
        processingDelay: t.Optional(t.Number({ minimum: 0 })), // Simulate processing time (ms)
        shouldFail: t.Optional(t.Boolean()),
        priority: t.Optional(t.Number()),
        attempts: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        customData: t.Optional(t.Record(t.String(), t.Any())),
      }),
    },
  )

  /**
   * Add multiple jobs (bulk)
   */
  .post(
    "/jobs/bulk",
    async ({ body }) => {
      try {
        const jobs = body.jobs.map((job, index) => ({
          name: job.jobName || `bulk-job-${index}`,
          data: {
            message: job.message,
            delay: job.processingDelay,
            shouldFail: job.shouldFail,
            data: job.customData,
          } as TestJob,
          opts: {
            delay: job.scheduleDelay,
            priority: job.priority,
          },
        }))

        const addedJobs = await testQueue.addBulk(jobs)

        logger.info({ count: addedJobs.length }, "[BullMQ-Test] Bulk jobs added")

        return {
          success: true,
          data: {
            count: addedJobs.length,
            jobs: addedJobs.map((job) => ({
              jobId: job.id,
              name: job.name,
            })),
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add bulk jobs",
        }
      }
    },
    {
      body: t.Object({
        jobs: t.Array(
          t.Object({
            message: t.String({ minLength: 1 }),
            jobName: t.Optional(t.String()),
            scheduleDelay: t.Optional(t.Number({ minimum: 0 })),
            processingDelay: t.Optional(t.Number({ minimum: 0 })),
            shouldFail: t.Optional(t.Boolean()),
            priority: t.Optional(t.Number()),
            customData: t.Optional(t.Record(t.String(), t.Any())),
          }),
          { minItems: 1, maxItems: 100 },
        ),
      }),
    },
  )

  /**
   * Get a specific job by ID
   */
  .get(
    "/jobs/:jobId",
    async ({ params }) => {
      try {
        const job = await testQueue.getJob(params.jobId)

        if (!job) {
          return { success: false, error: "Job not found" }
        }

        const state = await job.getState()

        return {
          success: true,
          data: {
            id: job.id,
            name: job.name,
            data: job.data,
            state,
            progress: job.progress,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            opts: job.opts,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get job",
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
   * Retry a failed job
   */
  .post(
    "/jobs/:jobId/retry",
    async ({ params }) => {
      try {
        const job = await testQueue.getJob(params.jobId)

        if (!job) {
          return { success: false, error: "Job not found" }
        }

        const state = await job.getState()
        if (state !== "failed") {
          return { success: false, error: `Cannot retry job in state: ${state}` }
        }

        await job.retry()

        logger.info({ jobId: params.jobId }, "[BullMQ-Test] Job retried")

        return {
          success: true,
          data: { jobId: params.jobId, message: "Job queued for retry" },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to retry job",
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
   * Remove a job
   */
  .delete(
    "/jobs/:jobId",
    async ({ params }) => {
      try {
        const job = await testQueue.getJob(params.jobId)

        if (!job) {
          return { success: false, error: "Job not found" }
        }

        await job.remove()

        logger.info({ jobId: params.jobId }, "[BullMQ-Test] Job removed")

        return {
          success: true,
          data: { jobId: params.jobId, message: "Job removed" },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to remove job",
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
   * Clean old jobs from queue
   */
  .post(
    "/queues/test/clean",
    async ({ body }) => {
      try {
        const grace = body.grace || 0 // Jobs older than this (ms)
        const limit = body.limit || 100

        const [cleanedCompleted, cleanedFailed] = await Promise.all([
          testQueue.clean(grace, limit, "completed"),
          testQueue.clean(grace, limit, "failed"),
        ])

        logger.info(
          { completed: cleanedCompleted.length, failed: cleanedFailed.length },
          "[BullMQ-Test] Queue cleaned",
        )

        return {
          success: true,
          data: {
            cleanedCompleted: cleanedCompleted.length,
            cleanedFailed: cleanedFailed.length,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to clean queue",
        }
      }
    },
    {
      body: t.Object({
        grace: t.Optional(t.Number({ minimum: 0 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
      }),
    },
  )

  /**
   * Pause/Resume test queue
   */
  .post("/queues/test/pause", async () => {
    try {
      await testQueue.pause()
      logger.info("[BullMQ-Test] Queue paused")
      return { success: true, data: { paused: true } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pause queue",
      }
    }
  })

  .post("/queues/test/resume", async () => {
    try {
      await testQueue.resume()
      logger.info("[BullMQ-Test] Queue resumed")
      return { success: true, data: { paused: false } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resume queue",
      }
    }
  })

  /**
   * Drain queue (remove all jobs)
   */
  .post("/queues/test/drain", async () => {
    try {
      await testQueue.drain()
      logger.info("[BullMQ-Test] Queue drained")
      return { success: true, data: { message: "Queue drained - all waiting jobs removed" } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to drain queue",
      }
    }
  })

  /**
   * Worker control - Start (Deprecated)
   * Worker now runs as an independent process via docker-compose
   */
  .post("/worker/start", async () => {
    return {
      success: true,
      data: {
        running: true,
        concurrency: 5,
        message: "Worker is managed as an independent process (bullmq-worker container)",
      },
    }
  })

  /**
   * Worker control - Stop (Deprecated)
   * Worker now runs as an independent process via docker-compose
   */
  .post("/worker/stop", async () => {
    return {
      success: false,
      data: {
        running: true,
        concurrency: 5,
        message:
          "Cannot stop worker from API. Worker is managed as an independent process (bullmq-worker container)",
      },
    }
  })

  /**
   * Worker status
   * Returns queue worker information
   */
  .get("/worker/status", async () => {
    try {
      // Get worker count from queue
      const workers = await testQueue.getWorkers()
      return {
        success: true,
        data: {
          running: workers.length > 0,
          workerCount: workers.length,
          concurrency: 5, // Default concurrency set in worker
          message:
            workers.length > 0
              ? `${workers.length} worker(s) connected`
              : "No workers connected. Check bullmq-worker container.",
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get worker status",
      }
    }
  })

  /**
   * SSE Stream for real-time job updates
   */
  .get("/stream", async () => {
    logger.info("[BullMQ-SSE] Starting SSE stream for test queue")

    return createSSEResponse(
      async (session) => {
        // Create QueueEvents instance for subscribing to queue events
        const queueEvents = new QueueEvents(QUEUE_NAMES.TEST_QUEUE, {
          connection: createRedisConnection(),
        })

        // Send initial connection event
        session.push({
          event: "connected",
          data: {
            message: "Connected to BullMQ event stream",
            queue: QUEUE_NAMES.TEST_QUEUE,
            timestamp: new Date().toISOString(),
          },
        })

        // Send initial queue state
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          testQueue.getWaitingCount(),
          testQueue.getActiveCount(),
          testQueue.getCompletedCount(),
          testQueue.getFailedCount(),
          testQueue.getDelayedCount(),
        ])

        session.push({
          event: "queue-state",
          data: {
            counts: { waiting, active, completed, failed, delayed },
            timestamp: new Date().toISOString(),
          },
        })

        // Event handlers
        const handleWaiting = async ({ jobId }: { jobId: string }) => {
          if (session.closed) return
          const job = await testQueue.getJob(jobId)
          session.push({
            event: "job-waiting",
            data: {
              jobId,
              name: job?.name,
              data: job?.data,
              timestamp: new Date().toISOString(),
            },
          })
          logger.debug({ jobId }, "[BullMQ-SSE] Job waiting")
        }

        const handleActive = async ({ jobId }: { jobId: string }) => {
          if (session.closed) return
          const job = await testQueue.getJob(jobId)
          session.push({
            event: "job-active",
            data: {
              jobId,
              name: job?.name,
              timestamp: new Date().toISOString(),
            },
          })
          logger.debug({ jobId }, "[BullMQ-SSE] Job active")
        }

        const handleProgress = async ({ jobId, data }: { jobId: string; data: JobProgress }) => {
          if (session.closed) return
          session.push({
            event: "job-progress",
            data: {
              jobId,
              progress: data,
              timestamp: new Date().toISOString(),
            },
          })
        }

        const handleCompleted = async ({
          jobId,
          returnvalue,
        }: {
          jobId: string
          returnvalue: string
        }) => {
          if (session.closed) return
          const job = await testQueue.getJob(jobId)
          let parsedResult: unknown
          try {
            parsedResult = JSON.parse(returnvalue)
          } catch {
            parsedResult = returnvalue
          }
          session.push({
            event: "job-completed",
            data: {
              jobId,
              name: job?.name,
              result: parsedResult,
              timestamp: new Date().toISOString(),
            },
          })
          logger.debug({ jobId }, "[BullMQ-SSE] Job completed")
        }

        const handleFailed = async ({
          jobId,
          failedReason,
        }: {
          jobId: string
          failedReason: string
        }) => {
          if (session.closed) return
          const job = await testQueue.getJob(jobId)
          session.push({
            event: "job-failed",
            data: {
              jobId,
              name: job?.name,
              failedReason,
              attemptsMade: job?.attemptsMade,
              timestamp: new Date().toISOString(),
            },
          })
          logger.debug({ jobId, failedReason }, "[BullMQ-SSE] Job failed")
        }

        const handleStalled = async ({ jobId }: { jobId: string }) => {
          if (session.closed) return
          session.push({
            event: "job-stalled",
            data: {
              jobId,
              timestamp: new Date().toISOString(),
            },
          })
          logger.warn({ jobId }, "[BullMQ-SSE] Job stalled")
        }

        const handleRemoved = async ({ jobId }: { jobId: string }) => {
          if (session.closed) return
          session.push({
            event: "job-removed",
            data: {
              jobId,
              timestamp: new Date().toISOString(),
            },
          })
        }

        // Subscribe to events
        queueEvents.on("waiting", handleWaiting)
        queueEvents.on("active", handleActive)
        queueEvents.on("progress", handleProgress)
        queueEvents.on("completed", handleCompleted)
        queueEvents.on("failed", handleFailed)
        queueEvents.on("stalled", handleStalled)
        queueEvents.on("removed", handleRemoved)

        logger.info("[BullMQ-SSE] Subscribed to queue events")

        // Keep connection alive until client disconnects
        // The session handles heartbeat automatically
        while (!session.closed) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // Cleanup on disconnect
        logger.info("[BullMQ-SSE] Client disconnected, cleaning up")
        queueEvents.off("waiting", handleWaiting)
        queueEvents.off("active", handleActive)
        queueEvents.off("progress", handleProgress)
        queueEvents.off("completed", handleCompleted)
        queueEvents.off("failed", handleFailed)
        queueEvents.off("stalled", handleStalled)
        queueEvents.off("removed", handleRemoved)
        await queueEvents.close()
      },
      {
        keepAlive: true,
        keepAliveInterval: 15000,
        onClose: () => {
          logger.info("[BullMQ-SSE] SSE session closed")
        },
      },
    )
  })
