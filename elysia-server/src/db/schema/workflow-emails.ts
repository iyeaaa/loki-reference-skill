import { relations } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { leads } from './leads'
import { sequences } from './sequences'

// Enums
export const emailStatusEnum = pgEnum('workflow_email_status_enum', [
  'pending',
  'generating',
  'generated',
  'edited',
  'failed',
])

export const generationModeEnum = pgEnum('generation_mode_enum', [
  'ai',
  'manual',
  'template',
])

// workflow_generated_emails table
export const workflowGeneratedEmails = pgTable(
  'workflow_generated_emails',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 255 }).notNull(), // React Flow 노드 ID
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),

    // 생성된 이메일 내용
    subject: text('subject').notNull(),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),

    // 생성 정보
    status: emailStatusEnum('status').notNull().default('pending'),
    generationMode: generationModeEnum('generation_mode').notNull().default('manual'),

    aiPrompt: text('ai_prompt'), // AI 생성 시 사용된 프롬프트
    aiModel: varchar('ai_model', { length: 100 }), // 사용된 AI 모델
    generationError: text('generation_error'), // 에러 메시지

    // 컨텍스트 스냅샷 (생성 당시 고객 정보)
    contextSnapshot: jsonb('context_snapshot').$type<{
      companyName?: string
      industry?: string
      contactName?: string
      contactEmail?: string
      [key: string]: unknown
    }>(),

    // 타임스탬프
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sequenceNodeIdx: index('workflow_emails_sequence_node_idx').on(
      table.sequenceId,
      table.nodeId,
    ),
    statusIdx: index('workflow_emails_status_idx').on(table.status),
    leadIdx: index('workflow_emails_lead_idx').on(table.leadId),
    // 유니크 제약: 같은 시퀀스, 같은 노드, 같은 lead에는 하나의 이메일만
    // uniqueConstraint은 여기서 사용하지 않고 migration에서 직접 추가
  }),
)

// Relations
export const workflowGeneratedEmailsRelations = relations(workflowGeneratedEmails, ({ one }) => ({
  sequence: one(sequences, {
    fields: [workflowGeneratedEmails.sequenceId],
    references: [sequences.id],
  }),
  lead: one(leads, {
    fields: [workflowGeneratedEmails.leadId],
    references: [leads.id],
  }),
}))

// Type exports
export type WorkflowGeneratedEmail = typeof workflowGeneratedEmails.$inferSelect
export type NewWorkflowGeneratedEmail = typeof workflowGeneratedEmails.$inferInsert
