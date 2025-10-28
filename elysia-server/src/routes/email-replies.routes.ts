import { Elysia, t } from "elysia"
import * as emailRepliesService from "../services/email-replies.service"
import { errorResponse, ResponseCode } from "../types/response.types"

export const emailRepliesRoutes = new Elysia({ prefix: "/api/v1/email-replies" })
  // List email replies with pagination and filters
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        workspaceId: query.workspaceId,
        isRead: query.isRead ? query.isRead === "true" : undefined,
        sentiment: query.sentiment,
        search: query.search,
        emailAccountId: query.emailAccountId,
      }

      const replies = await emailRepliesService.listEmailReplies(limit, offset, filters)
      const total = await emailRepliesService.countEmailReplies(filters)

      return {
        data: replies,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        isRead: t.Optional(t.String()),
        sentiment: t.Optional(t.String()),
        search: t.Optional(t.String()),
        emailAccountId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Get email reply by ID with full details
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const reply = await emailRepliesService.getEmailReplyById(id)
      if (!reply) {
        set.status = 404
        return errorResponse("답장을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return reply
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Mark reply as read
  .patch(
    "/:id/read",
    async ({ params: { id }, set }) => {
      const reply = await emailRepliesService.markAsRead(id)
      if (!reply) {
        set.status = 404
        return errorResponse("답장을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return reply
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Mark reply as unread
  .patch(
    "/:id/unread",
    async ({ params: { id }, set }) => {
      const reply = await emailRepliesService.markAsUnread(id)
      if (!reply) {
        set.status = 404
        return errorResponse("답장을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return reply
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Bulk mark as read
  .put(
    "/bulk/read",
    async ({ body }) => {
      const updatedCount = await emailRepliesService.bulkMarkAsRead(body.replyIds)
      return { updatedCount }
    },
    {
      body: t.Object({
        replyIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk mark as unread
  .put(
    "/bulk/unread",
    async ({ body }) => {
      const updatedCount = await emailRepliesService.bulkMarkAsUnread(body.replyIds)
      return { updatedCount }
    },
    {
      body: t.Object({
        replyIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )

  // Bulk delete (must come before /:id route)
  // Accepts email_replies IDs (UUID), email IDs (UUID), or threadIds (string)
  .delete(
    "/bulk",
    async ({ body }) => {
      const deletedCount = await emailRepliesService.bulkDeleteEmailReplies(body.replyIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        replyIds: t.Array(t.String()),
      }),
    },
  )

  // Delete email reply
  // Accepts email_reply ID (UUID), email ID (UUID), or threadId (string)
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await emailRepliesService.deleteEmailReply(id)
      return { success: true, message: "답장이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
