/**
 * Worker Health Check Server
 *
 * BullMQ Worker의 종합적인 Health Check를 제공하는 HTTP 서버
 * - Liveness probe: 프로세스 생존 확인
 * - Readiness probe: 트래픽 처리 준비 상태
 * - 상세 메트릭: Queue/Worker/Memory 상태
 */

import os from "node:os"
import { Elysia } from "elysia"
import logger from "../../utils/logger"
import { getTestWorkerStatus } from "../../workers/bullmq"
import { testQueue } from "../queue"
import { redisConnection } from "../redis"

// ============================================================================
// Types
// ============================================================================

type CheckStatus = "pass" | "warn" | "fail"
type OverallStatus = "healthy" | "degraded" | "unhealthy"

interface HealthCheck {
  status: CheckStatus
  message?: string
  data?: Record<string, unknown>
}

interface HealthStatus {
  status: OverallStatus
  timestamp: string
  uptime: number
  version: string
  checks: {
    redis: HealthCheck
    worker: HealthCheck
    queue: HealthCheck
    memory: HealthCheck
  }
}

interface QueueMetrics {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

// ============================================================================
// State Tracking
// ============================================================================

/** Worker 시작 시간 */
const startTime = Date.now()

/** 마지막 Job 처리 시간 */
let lastJobProcessedAt: Date | null = null

/** 처리된 총 Job 수 */
let totalJobsProcessed = 0

/** 실패한 총 Job 수 */
let totalJobsFailed = 0

// ============================================================================
// State Update Functions (Worker에서 호출)
// ============================================================================

/**
 * Job 처리 완료 시 호출
 */
export function recordJobCompleted(): void {
  lastJobProcessedAt = new Date()
  totalJobsProcessed++
}

/**
 * Job 실패 시 호출
 */
export function recordJobFailed(): void {
  lastJobProcessedAt = new Date()
  totalJobsFailed++
}

/**
 * 상태 초기화 (테스트용)
 */
export function resetHealthStats(): void {
  lastJobProcessedAt = null
  totalJobsProcessed = 0
  totalJobsFailed = 0
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Redis 연결 상태 체크
 */
async function checkRedis(): Promise<HealthCheck> {
  try {
    const start = Date.now()
    const result = await redisConnection.ping()
    const latencyMs = Date.now() - start

    if (result !== "PONG") {
      return { status: "fail", message: "Redis ping failed" }
    }

    // 레이턴시 100ms 초과 시 경고
    if (latencyMs > 100) {
      return {
        status: "warn",
        message: `Redis latency high: ${latencyMs}ms`,
        data: { latencyMs, connected: true },
      }
    }

    return {
      status: "pass",
      data: { latencyMs, connected: true },
    }
  } catch (error) {
    return {
      status: "fail",
      message: `Redis connection error: ${(error as Error).message}`,
      data: { connected: false },
    }
  }
}

/**
 * Worker 상태 체크
 */
function checkWorker(): HealthCheck {
  const status = getTestWorkerStatus()

  if (!status.running) {
    return {
      status: "fail",
      message: "Worker is not running",
      data: { running: false },
    }
  }

  // 5분 이상 Job 처리 없으면 경고 (Queue가 비어있지 않은 경우)
  const idleThresholdMs = 5 * 60 * 1000
  const idleTimeMs = lastJobProcessedAt ? Date.now() - lastJobProcessedAt.getTime() : null

  const data = {
    running: status.running,
    concurrency: status.concurrency,
    activeJobs: status.activeJobs,
    totalProcessed: totalJobsProcessed,
    totalFailed: totalJobsFailed,
    lastProcessedAt: lastJobProcessedAt?.toISOString() || null,
    idleTimeSeconds: idleTimeMs ? Math.floor(idleTimeMs / 1000) : null,
  }

  // 처리한 적이 있고 오래 Idle 상태면 경고
  if (lastJobProcessedAt && idleTimeMs && idleTimeMs > idleThresholdMs) {
    return {
      status: "warn",
      message: `Worker idle for ${Math.floor(idleTimeMs / 1000)}s`,
      data,
    }
  }

  return { status: "pass", data }
}

/**
 * Queue 상태 체크
 */
async function checkQueue(): Promise<HealthCheck> {
  try {
    const [waiting, active, failed, delayed] = await Promise.all([
      testQueue.getWaitingCount(),
      testQueue.getActiveCount(),
      testQueue.getFailedCount(),
      testQueue.getDelayedCount(),
    ])

    const isPaused = await testQueue.isPaused()
    const data = { waiting, active, failed, delayed, paused: isPaused }

    // Queue가 일시정지 상태
    if (isPaused) {
      return {
        status: "warn",
        message: "Queue is paused",
        data,
      }
    }

    // 실패 Job 100개 초과 시 경고
    if (failed > 100) {
      return {
        status: "warn",
        message: `High failed job count: ${failed}`,
        data,
      }
    }

    // 대기 Job 1000개 초과 시 경고 (백프레셔)
    if (waiting > 1000) {
      return {
        status: "warn",
        message: `Queue backpressure: ${waiting} waiting jobs`,
        data,
      }
    }

    return { status: "pass", data }
  } catch (error) {
    return {
      status: "fail",
      message: `Queue check error: ${(error as Error).message}`,
    }
  }
}

/**
 * 메모리 사용량 체크
 */
function checkMemory(): HealthCheck {
  const usage = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const systemUsedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100)

  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024)
  const rssMB = Math.round(usage.rss / 1024 / 1024)
  const externalMB = Math.round(usage.external / 1024 / 1024)

  const data = {
    heapUsedMB,
    heapTotalMB,
    rssMB,
    externalMB,
    systemUsedPercent,
    systemTotalMB: Math.round(totalMem / 1024 / 1024),
    systemFreeMB: Math.round(freeMem / 1024 / 1024),
  }

  // Heap 500MB 초과 시 경고
  if (heapUsedMB > 500) {
    return {
      status: "warn",
      message: `High heap usage: ${heapUsedMB}MB`,
      data,
    }
  }

  // 시스템 메모리 90% 초과 시 경고
  if (systemUsedPercent > 90) {
    return {
      status: "warn",
      message: `High system memory usage: ${systemUsedPercent}%`,
      data,
    }
  }

  return { status: "pass", data }
}

/**
 * 종합 Health Check 수행
 */
async function performHealthCheck(): Promise<HealthStatus> {
  const checks = {
    redis: await checkRedis(),
    worker: checkWorker(),
    queue: await checkQueue(),
    memory: checkMemory(),
  }

  // 전체 상태 결정
  const statuses = Object.values(checks).map((c) => c.status)
  let overallStatus: OverallStatus = "healthy"

  if (statuses.includes("fail")) {
    overallStatus = "unhealthy"
  } else if (statuses.includes("warn")) {
    overallStatus = "degraded"
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || "unknown",
    checks,
  }
}

/**
 * Queue 상세 메트릭 조회
 */
async function getQueueMetrics(): Promise<QueueMetrics> {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    testQueue.getWaitingCount(),
    testQueue.getActiveCount(),
    testQueue.getCompletedCount(),
    testQueue.getFailedCount(),
    testQueue.getDelayedCount(),
    testQueue.isPaused(),
  ])

  return {
    name: testQueue.name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  }
}

// ============================================================================
// HTTP Server
// ============================================================================

/**
 * Health Check Elysia 앱 생성 (타입 추론용 분리)
 */
function createHealthApp() {
  return (
    new Elysia({ name: "worker-health" })
      // ========================================
      // Kubernetes Probes
      // ========================================

      /**
       * Liveness Probe
       * 프로세스가 살아있는지만 확인 (빠른 응답)
       */
      .get("/healthz", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      }))

      /**
       * Readiness Probe
       * 트래픽을 받을 준비가 되었는지 확인
       */
      .get("/readyz", async ({ set }) => {
        const health = await performHealthCheck()

        if (health.status === "unhealthy") {
          set.status = 503
        }

        return {
          status: health.status,
          timestamp: health.timestamp,
          checks: {
            redis: health.checks.redis.status,
            worker: health.checks.worker.status,
            queue: health.checks.queue.status,
          },
        }
      })

      // ========================================
      // Detailed Health Endpoints
      // ========================================

      /**
       * 상세 Health Check
       */
      .get("/health", async ({ set }) => {
        const health = await performHealthCheck()

        if (health.status === "unhealthy") {
          set.status = 503
        }

        return health
      })

      /**
       * Queue 메트릭
       */
      .get("/metrics/queue", async () => {
        return getQueueMetrics()
      })

      /**
       * Worker 메트릭
       */
      .get("/metrics/worker", () => {
        const status = getTestWorkerStatus()
        const memory = process.memoryUsage()

        return {
          ...status,
          totalProcessed: totalJobsProcessed,
          totalFailed: totalJobsFailed,
          lastProcessedAt: lastJobProcessedAt?.toISOString() || null,
          uptime: Math.floor((Date.now() - startTime) / 1000),
          memory: {
            heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
            rssMB: Math.round(memory.rss / 1024 / 1024),
          },
        }
      })

      /**
       * 전체 메트릭 (Prometheus 형식 아님, JSON)
       */
      .get("/metrics", async () => {
        const queue = await getQueueMetrics()
        const workerStatus = getTestWorkerStatus()
        const memory = process.memoryUsage()

        return {
          queue,
          worker: {
            ...workerStatus,
            totalProcessed: totalJobsProcessed,
            totalFailed: totalJobsFailed,
            lastProcessedAt: lastJobProcessedAt?.toISOString() || null,
          },
          memory: {
            heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
            rssMB: Math.round(memory.rss / 1024 / 1024),
          },
          system: {
            platform: process.platform,
            nodeVersion: process.version,
            cpus: os.cpus().length,
            loadAvg: os.loadavg(),
          },
          uptime: Math.floor((Date.now() - startTime) / 1000),
          timestamp: new Date().toISOString(),
        }
      })
  )
}

/** Health Server 타입 */
type HealthServer = ReturnType<typeof createHealthApp>

let healthServer: HealthServer | null = null

/**
 * Health Check HTTP 서버 생성 및 시작
 */
export function startHealthServer(port: number = 3010): HealthServer {
  if (healthServer) {
    logger.warn("[HealthServer] Server already running")
    return healthServer
  }

  const server = createHealthApp()

  server.listen(port, () => {
    logger.info({ port }, "[HealthServer] Started")
  })

  healthServer = server
  return server
}

/**
 * Health Check 서버 중지
 */
export async function stopHealthServer(): Promise<void> {
  if (healthServer) {
    await healthServer.stop()
    healthServer = null
    logger.info("[HealthServer] Stopped")
  }
}

// ============================================================================
// Exports
// ============================================================================

export { healthServer }
