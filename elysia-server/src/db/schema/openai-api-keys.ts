import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

/**
 * OpenAI API Keys table
 * Workspace별로 여러 개의 API 키를 관리하고 round-robin 방식으로 사용
 */
export const openaiApiKeys = pgTable(
  "openai_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // API 키 식별 이름 (예: "Main Key", "Backup Key 1")
    apiKey: text("api_key").notNull(), // 암호화된 API 키
    orderIndex: integer("order_index").notNull().default(0), // 사용 순서 (0, 1, 2, ...)
    isActive: boolean("is_active").notNull().default(true), // 활성화 여부
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }), // 마지막 사용 시간
    usageCount: integer("usage_count").notNull().default(0), // 사용 횟수
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("openai_api_keys_workspace_id_idx").on(table.workspaceId),
    activeIdx: index("openai_api_keys_is_active_idx").on(table.isActive),
    orderIdx: index("openai_api_keys_order_index_idx").on(table.orderIndex),
  }),
)

export const openaiApiKeysRelations = relations(openaiApiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [openaiApiKeys.workspaceId],
    references: [workspaces.id],
  }),
}))

export type OpenaiApiKey = typeof openaiApiKeys.$inferSelect
export type InsertOpenaiApiKey = typeof openaiApiKeys.$inferInsert
