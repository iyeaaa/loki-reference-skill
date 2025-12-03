import { relations } from "drizzle-orm"
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Chat conversations table - stores user chat sessions
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull().default("새 채팅"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    isDeleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => ({
    userIdIdx: index("chat_conversations_user_id_idx").on(table.userId),
    workspaceIdIdx: index("chat_conversations_workspace_id_idx").on(table.workspaceId),
    createdAtIdx: index("chat_conversations_created_at_idx").on(table.createdAt),
    isDeletedIdx: index("chat_conversations_is_deleted_idx").on(table.isDeleted),
  }),
)

// Chat messages table - stores individual messages in a conversation
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    metadata: jsonb("metadata"), // SQL, insights, visualization, attachment 등
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index("chat_messages_conversation_id_idx").on(table.conversationId),
    createdAtIdx: index("chat_messages_created_at_idx").on(table.createdAt),
  }),
)

// Relations
export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [chatConversations.workspaceId],
    references: [workspaces.id],
  }),
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}))

// Type exports
export type ChatConversation = typeof chatConversations.$inferSelect
export type NewChatConversation = typeof chatConversations.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
