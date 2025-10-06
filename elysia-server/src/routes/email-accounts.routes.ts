import { Elysia, t } from "elysia"
import * as emailAccountService from "../services/email-account.service"
import { errorResponse, ResponseCode } from "../types/response.types"

const emailAccountSchema = t.Object({
  userId: t.String({ format: "uuid" }),
  workspaceId: t.String({ format: "uuid" }),
  emailAddress: t.String({ format: "email", maxLength: 255 }),
  displayName: t.Optional(t.String({ maxLength: 255 })),
  apiKey: t.String({ minLength: 1 }),
  sendgridVerifiedSenderId: t.Optional(t.String({ maxLength: 255 })),
  isVerified: t.Optional(t.Boolean()),
  isDefault: t.Optional(t.Boolean()),
  dailyLimit: t.Optional(t.Number()),
  monthlyLimit: t.Optional(t.Number()),
  status: t.Optional(
    t.Union([
      t.Literal("active"),
      t.Literal("inactive"),
      t.Literal("error"),
      t.Literal("rate_limited"),
      t.Literal("suspended"),
    ]),
  ),
})

const updateEmailAccountSchema = t.Object({
  emailAddress: t.String({ format: "email", maxLength: 255 }),
  displayName: t.Optional(t.String({ maxLength: 255 })),
  apiKey: t.String({ minLength: 1 }),
  sendgridVerifiedSenderId: t.Optional(t.String({ maxLength: 255 })),
  isVerified: t.Boolean(),
  isDefault: t.Boolean(),
  dailyLimit: t.Optional(t.Number()),
  monthlyLimit: t.Optional(t.Number()),
  status: t.Union([
    t.Literal("active"),
    t.Literal("inactive"),
    t.Literal("error"),
    t.Literal("rate_limited"),
    t.Literal("suspended"),
  ]),
})

export const emailAccountRoutes = new Elysia({ prefix: "/api/v1/email-accounts" })
  // Search email accounts with filters (must be before /:id route)
  .get(
    "/search",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Parse userIds and workspaceIds from comma-separated string
      const userIds = query.userIds ? query.userIds.split(",").filter(Boolean) : undefined
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(",").filter(Boolean)
        : undefined

      const filters = {
        status: query.status as
          | "active"
          | "inactive"
          | "error"
          | "rate_limited"
          | "suspended"
          | undefined,
        isVerified: query.isVerified ? query.isVerified === "true" : undefined,
        isDefault: query.isDefault ? query.isDefault === "true" : undefined,
        search: query.search,
        userIds,
        workspaceIds,
      }

      const accounts = await emailAccountService.listEmailAccountsWithFilters(
        limit,
        offset,
        filters,
      )
      const total = await emailAccountService.countEmailAccountsWithFilters(filters)

      return {
        data: accounts,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        isVerified: t.Optional(t.String()),
        isDefault: t.Optional(t.String()),
        search: t.Optional(t.String()),
        userIds: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
      }),
    },
  )

  // Get email account by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const account = await emailAccountService.getEmailAccount(id)
      if (!account) {
        set.status = 404
        return errorResponse("이메일 계정을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return account
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create new email account
  .post(
    "/",
    async ({ body }) => {
      const account = await emailAccountService.createEmailAccount(body)
      return account
    },
    {
      body: emailAccountSchema,
    },
  )

  // Update email account
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const account = await emailAccountService.updateEmailAccount(id, body)
      if (!account) {
        set.status = 404
        return errorResponse("이메일 계정을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return account
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateEmailAccountSchema,
    },
  )

  // Delete email account
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await emailAccountService.deleteEmailAccount(id)
      return { success: true, message: "이메일 계정이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List email accounts with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const accounts = await emailAccountService.listEmailAccounts(limit, offset)
      const total = await emailAccountService.countEmailAccounts()

      return {
        data: accounts,
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

  // Get email account by workspace and user (MUST be before /workspace/:workspaceId)
  .get(
    "/workspace/:workspaceId/user/:userId",
    async ({ params: { workspaceId, userId }, set }) => {
      const account = await emailAccountService.getEmailAccountByWorkspaceAndUser(
        workspaceId,
        userId,
      )
      if (!account) {
        set.status = 404
        return errorResponse(
          "해당 워크스페이스와 사용자에 대한 활성화된 이메일 계정을 찾을 수 없습니다.",
          ResponseCode.NOT_FOUND,
        )
      }
      return account
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        userId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get active email accounts for workspace (MUST be before /workspace/:workspaceId)
  .get(
    "/workspace/:workspaceId/active",
    async ({ params: { workspaceId } }) => {
      const accounts = await emailAccountService.getActiveEmailAccounts(workspaceId)
      return accounts
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get email accounts by workspace
  .get(
    "/workspace/:workspaceId",
    async ({ params: { workspaceId } }) => {
      const accounts = await emailAccountService.getEmailAccountsByWorkspace(workspaceId)
      return accounts
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get email accounts by user
  .get(
    "/user/:userId",
    async ({ params: { userId } }) => {
      const accounts = await emailAccountService.getEmailAccountsByUser(userId)
      return accounts
    },
    {
      params: t.Object({
        userId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Set as default
  .patch(
    "/:id/set-default",
    async ({ params: { id }, body, set }) => {
      const account = await emailAccountService.setAsDefault(id, body.userId, body.workspaceId)
      if (!account) {
        set.status = 404
        return errorResponse("이메일 계정을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return account
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        userId: t.String({ format: "uuid" }),
        workspaceId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Update sent count
  .patch(
    "/:id/sent-count",
    async ({ params: { id }, set }) => {
      const account = await emailAccountService.updateSentCount(id)
      if (!account) {
        set.status = 404
        return errorResponse("이메일 계정을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return account
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Reset daily sent count
  .patch(
    "/:id/reset-daily",
    async ({ params: { id } }) => {
      await emailAccountService.resetDailySentCount(id)
      return { success: true, message: "일일 발송 카운트가 리셋되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Reset monthly sent count
  .patch(
    "/:id/reset-monthly",
    async ({ params: { id } }) => {
      await emailAccountService.resetMonthlySentCount(id)
      return { success: true, message: "월간 발송 카운트가 리셋되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Update last error
  .patch(
    "/:id/error",
    async ({ params: { id }, body }) => {
      await emailAccountService.updateLastError(id, body.errorMessage)
      return { success: true, message: "에러 정보가 업데이트되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        errorMessage: t.String(),
      }),
    },
  )

  // Update last sync
  .patch(
    "/:id/sync",
    async ({ params: { id } }) => {
      await emailAccountService.updateLastSync(id)
      return { success: true, message: "동기화 시간이 업데이트되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// Admin bulk update routes
export const adminEmailAccountRoutes = new Elysia({ prefix: "/api/v1/admin/email-accounts" })
  // Bulk update status
  .put(
    "/bulk/status",
    async ({ body }) => {
      const updatedCount = await emailAccountService.bulkUpdateStatus(body.accountIds, body.status)
      return { updatedCount }
    },
    {
      body: t.Object({
        accountIds: t.Array(t.String({ format: "uuid" })),
        status: t.Union([
          t.Literal("active"),
          t.Literal("inactive"),
          t.Literal("error"),
          t.Literal("rate_limited"),
          t.Literal("suspended"),
        ]),
      }),
    },
  )
