/**
 * BullMQ Job Logs Schema
 *
 * BullMQ Worker의 모든 Job 실행 기록을 PostgreSQL에 영구 저장
 * Redis의 휘발성 문제를 해결하고 감사/디버깅/분석 지원
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// ============================================================================
// Enums
// ============================================================================

/**
 * Job 상태
 * - waiting: 대기열에서 대기 중
 * - active: 현재 처리 중
 * - completed: 성공적으로 완료
 * - failed: 실패 (재시도 소진 또는 치명적 오류)
 * - delayed: 지연 실행 대기 중
 * - stalled: Worker 응답 없음 (좀비 상태)
 */
export const jobStatusEnum = pgEnum("job_status_enum", [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "stalled",
])

// ============================================================================
// Tables
// ============================================================================

/**
 * Job Logs Table
 * BullMQ Job의 전체 라이프사이클을 기록
 */
export const jobLogs = pgTable(
  "job_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // ========================================
    // Job 식별 정보
    // ========================================
    /** BullMQ에서 할당한 Job ID */
    jobId: varchar("job_id", { length: 255 }).notNull(),
    /** Queue 이름 (test-queue, campaign-email 등) */
    queueName: varchar("queue_name", { length: 100 }).notNull(),
    /** Job 이름/타입 (add 시 지정한 name) */
    jobName: varchar("job_name", { length: 255 }),

    // ========================================
    // 실행 상태
    // ========================================
    /** 현재 Job 상태 */
    status: jobStatusEnum("status").notNull().default("waiting"),
    /** 현재까지 시도한 횟수 */
    attemptsMade: integer("attempts_made").notNull().default(0),
    /** 최대 재시도 횟수 */
    maxAttempts: integer("max_attempts").notNull().default(3),
    /** Job 우선순위 (낮을수록 높은 우선순위) */
    priority: integer("priority").default(0),

    // ========================================
    // 타이밍 정보
    // ========================================
    /** Job이 Queue에 추가된 시각 */
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    /** Worker가 Job 처리를 시작한 시각 */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Job이 성공적으로 완료된 시각 */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Job이 최종 실패한 시각 */
    failedAt: timestamp("failed_at", { withTimezone: true }),
    /** 처리 소요 시간 (밀리초) */
    durationMs: integer("duration_ms"),
    /** 지연 실행 예정 시각 (delayed job인 경우) */
    delayedUntil: timestamp("delayed_until", { withTimezone: true }),

    // ========================================
    // 데이터
    // ========================================
    /** Job 입력 데이터 (Queue.add 시 전달된 데이터) */
    inputData: jsonb("input_data"),
    /** Job 처리 결과 (processor 반환값) */
    outputData: jsonb("output_data"),
    /** 에러 메시지 (실패 시) */
    errorMessage: text("error_message"),
    /** 스택 트레이스 (실패 시) */
    stackTrace: text("stack_trace"),
    /** 에러 코드/타입 (분류용) */
    errorCode: varchar("error_code", { length: 100 }),

    // ========================================
    // 메타데이터
    // ========================================
    /** 처리한 Worker 이름/ID */
    workerName: varchar("worker_name", { length: 100 }),
    /** 처리한 서버/인스턴스 식별자 */
    processedBy: varchar("processed_by", { length: 255 }),
    /** BullMQ Job 옵션 스냅샷 */
    jobOptions: jsonb("job_options"),

    // ========================================
    // 타임스탬프
    // ========================================
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 복합 인덱스: 가장 자주 사용되는 쿼리 패턴
    queueStatusIdx: index("job_logs_queue_status_idx").on(table.queueName, table.status),

    // 단일 인덱스
    jobIdIdx: index("job_logs_job_id_idx").on(table.jobId),
    queueNameIdx: index("job_logs_queue_name_idx").on(table.queueName),
    statusIdx: index("job_logs_status_idx").on(table.status),
    addedAtIdx: index("job_logs_added_at_idx").on(table.addedAt),
    completedAtIdx: index("job_logs_completed_at_idx").on(table.completedAt),
    failedAtIdx: index("job_logs_failed_at_idx").on(table.failedAt),

    // 에러 분석용 인덱스
    errorCodeIdx: index("job_logs_error_code_idx").on(table.errorCode),
  }),
)

// ============================================================================
// Type Exports
// ============================================================================

export type JobLog = typeof jobLogs.$inferSelect
export type NewJobLog = typeof jobLogs.$inferInsert
export type JobStatus = (typeof jobStatusEnum.enumValues)[number]
