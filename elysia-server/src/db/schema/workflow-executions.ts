import { relations } from "drizzle-orm"
import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { userEmailAccounts } from "./email-accounts"
import { leads } from "./leads"
import { sequences } from "./sequences"

/**
 * Workflow Enrollments
 * 워크플로우에 등록된 lead들을 추적
 * sequence_enrollments와 별개로 워크플로우 전용
 */
export const workflowEnrollments = pgTable("workflow_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  userEmailAccountId: uuid("user_email_account_id")
    .notNull()
    .references(() => userEmailAccounts.id),

  // 상태
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, paused, completed, stopped, bounced, unsubscribed

  // 현재 실행 중인 노드
  currentNodeId: varchar("current_node_id", { length: 100 }),

  // 타임스탬프
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  enrolledBy: uuid("enrolled_by"), // 등록한 사용자
  firstEmailSentAt: timestamp("first_email_sent_at"),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"),
  stoppedAt: timestamp("stopped_at"),
  stoppedReason: text("stopped_reason"), // 중단 사유 (예: 답장 받음, 수동 중단)

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

/**
 * Workflow Execution Logs
 * 워크플로우의 각 노드 실행 기록
 */
export const workflowExecutionLogs = pgTable("workflow_execution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => workflowEnrollments.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),

  // 노드 정보
  nodeId: varchar("node_id", { length: 100 }).notNull(), // workflow_data의 node.id
  nodeType: varchar("node_type", { length: 50 }).notNull(), // start, emailDraft, timer
  nodeData: text("node_data"), // 노드 실행 시점의 데이터 스냅샷 (JSON)

  // 실행 상태
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, executing, completed, failed, skipped

  // 실행 결과
  result: text("result"), // 실행 결과 데이터 (JSON)
  errorMessage: text("error_message"),

  // 이메일 발송 관련 (emailDraft 노드인 경우)
  generatedEmailId: uuid("generated_email_id"), // workflow_generated_emails 참조
  emailId: uuid("email_id"), // 실제 발송된 emails 테이블 참조
  sentAt: timestamp("sent_at"),

  // 타이머 관련 (timer 노드인 경우)
  scheduledFor: timestamp("scheduled_for"), // 다음 노드 실행 예정 시각
  delayDays: integer("delay_days"),
  waitStartedAt: timestamp("wait_started_at"),
  waitCompletedAt: timestamp("wait_completed_at"),
  repliedDuringWait: timestamp("replied_during_wait"), // 대기 중 답장 받은 시각

  // 타임스탬프
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Relations
export const workflowEnrollmentsRelations = relations(workflowEnrollments, ({ one, many }) => ({
  sequence: one(sequences, {
    fields: [workflowEnrollments.sequenceId],
    references: [sequences.id],
  }),
  lead: one(leads, {
    fields: [workflowEnrollments.leadId],
    references: [leads.id],
  }),
  userEmailAccount: one(userEmailAccounts, {
    fields: [workflowEnrollments.userEmailAccountId],
    references: [userEmailAccounts.id],
  }),
  executionLogs: many(workflowExecutionLogs),
}))

export const workflowExecutionLogsRelations = relations(workflowExecutionLogs, ({ one }) => ({
  enrollment: one(workflowEnrollments, {
    fields: [workflowExecutionLogs.enrollmentId],
    references: [workflowEnrollments.id],
  }),
  sequence: one(sequences, {
    fields: [workflowExecutionLogs.sequenceId],
    references: [sequences.id],
  }),
  lead: one(leads, {
    fields: [workflowExecutionLogs.leadId],
    references: [leads.id],
  }),
}))
