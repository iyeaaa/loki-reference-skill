import { Elysia, t } from "elysia"
import * as workspaceService from "../services/workspace.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import { createSSEResponse } from "../utils/sse-helper"

const workspaceSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  ownerId: t.String({ format: "uuid" }),
  isActive: t.Optional(t.Boolean()),
  companyName: t.Optional(t.String({ maxLength: 255 })),
  companyWebsite: t.Optional(t.String({ maxLength: 500 })),
  companyPhone: t.Optional(t.String({ maxLength: 50 })),
  industry: t.Optional(t.String({ maxLength: 100 })),
  companySize: t.Optional(t.String({ maxLength: 50 })),
  companyAddress: t.Optional(t.String()),
  companyDescription: t.Optional(t.String()),
})

const updateWorkspaceSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  ownerId: t.Optional(t.String({ format: "uuid" })),
  isActive: t.Boolean(),
  companyName: t.Optional(t.String({ maxLength: 255 })),
  companyWebsite: t.Optional(t.String({ maxLength: 500 })),
  companyPhone: t.Optional(t.String({ maxLength: 50 })),
  industry: t.Optional(t.String({ maxLength: 100 })),
  companySize: t.Optional(t.String({ maxLength: 50 })),
  companyAddress: t.Optional(t.String()),
  companyDescription: t.Optional(t.String()),
})

// Partial update schema for PATCH requests
const partialUpdateWorkspaceSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String()),
  ownerId: t.Optional(t.String({ format: "uuid" })),
  isActive: t.Optional(t.Boolean()),
  companyName: t.Optional(t.String({ maxLength: 255 })),
  companyWebsite: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  companyPhone: t.Optional(t.String({ maxLength: 50 })),
  industry: t.Optional(t.String({ maxLength: 100 })),
  companySize: t.Optional(t.String({ maxLength: 50 })),
  companyAddress: t.Optional(t.String()),
  companyDescription: t.Optional(t.String()),
})

const _workspaceMemberSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
  role: t.Optional(
    t.Union([t.Literal("owner"), t.Literal("admin"), t.Literal("member"), t.Literal("viewer")]),
  ),
  invitedBy: t.Optional(t.String({ format: "uuid" })),
  status: t.Optional(
    t.Union([
      t.Literal("invited"),
      t.Literal("active"),
      t.Literal("inactive"),
      t.Literal("removed"),
    ]),
  ),
})

export const workspaceRoutes = new Elysia({ prefix: "/api/v1/workspaces" })
  // Search workspaces with filters (must be before /:id route)
  // 인증된 사용자가 관리자인지 확인 후
  // 관리자가 아니면 해당 사용자가 속한 워크스페이스만 반환
  .get(
    "/search",
    async ({ query, headers }) => {
      const userId = await getUserIdFromToken(headers.authorization)

      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Parse ownerIds from comma-separated string
      const ownerIds = query.ownerIds ? query.ownerIds.split(",").filter(Boolean) : undefined

      // 사용자 권한 체크: userId가 있으면 관리자 여부 확인
      let userWorkspaceIds: string[] | undefined
      if (userId) {
        const isAdmin = await workspaceService.isUserAdmin(userId)
        if (!isAdmin) {
          // 관리자가 아니면 사용자가 속한 워크스페이스 ID만 조회
          userWorkspaceIds = await workspaceService.getUserWorkspaceIds(userId)
        }
      }

      const filters = {
        isActive: query.isActive ? query.isActive === "true" : undefined,
        search: query.search,
        ownerIds,
        workspaceIds: userWorkspaceIds, // 관리자가 아니면 제한된 워크스페이스만
      }

      const workspaces = await workspaceService.listWorkspacesWithFilters(limit, offset, filters)
      const total = await workspaceService.countWorkspacesWithFilters(filters)

      return {
        data: workspaces,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String()),
        ownerIds: t.Optional(t.String()),
      }),
    },
  )

  // Get workspace by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const workspace = await workspaceService.getWorkspace(id)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return workspace
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Check if user can create workspace (trial limit validation)
  .get("/can-create/:ownerId", async ({ params: { ownerId }, set }) => {
    try {
      const trialCount = await workspaceService.countTrialWorkspaces(ownerId)
      const canCreate = trialCount < 1

      return {
        canCreate,
        trialWorkspaceCount: trialCount,
        message: canCreate
          ? "Can create workspace"
          : "Trial users can only create 1 workspace. Please upgrade your subscription to create more workspaces.",
      }
    } catch (error: unknown) {
      set.status = 500
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check workspace limit"
      return errorResponse(errorMessage, ResponseCode.INTERNAL_ERROR)
    }
  })

  // Create new workspace
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const workspace = await workspaceService.createWorkspace(body)
        return workspace
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : ""
        if (errorMessage.includes("TRIAL_WORKSPACE_LIMIT_EXCEEDED")) {
          set.status = 403
          return errorResponse(
            errorMessage.replace("TRIAL_WORKSPACE_LIMIT_EXCEEDED: ", ""),
            ResponseCode.FORBIDDEN,
          )
        }
        throw error
      }
    },
    {
      body: workspaceSchema,
    },
  )

  // Update workspace
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const workspace = await workspaceService.updateWorkspace(id, body)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return workspace
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateWorkspaceSchema,
    },
  )

  // Partial update workspace (PATCH)
  .patch(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const workspace = await workspaceService.partialUpdateWorkspace(id, body)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return workspace
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: partialUpdateWorkspaceSchema,
    },
  )

  // Trigger onboarding enrichment for a workspace
  .post(
    "/:id/enrich",
    async ({ params: { id }, body, set }) => {
      const { websiteUrl } = body

      // Validate workspace exists
      const workspace = await workspaceService.getWorkspaceOnlyById(id)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // Ensure URL has protocol
      const normalizedUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`

      // Start enrichment (fire-and-forget)
      workspaceService.onboardingEnrichment({
        workspaceId: id,
        websiteUrl: normalizedUrl,
      })

      return successResponse({ started: true }, "Enrichment started")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        websiteUrl: t.String(),
      }),
    },
  )

  // Trigger onboarding enrichment with streaming progress and strategy generation
  .post(
    "/:id/enrichAndStrategize",
    async ({ params: { id }, body, set }) => {
      const { websiteUrl } = body

      // Validate workspace exists
      const workspace = await workspaceService.getWorkspaceOnlyById(id)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // Ensure URL has protocol
      const normalizedUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`

      // Return SSE stream with progress updates
      return createSSEResponse(
        async (session) => {
          try {
            await workspaceService.onboardingEnrichmentStreaming({
              workspaceId: id,
              websiteUrl: normalizedUrl,
              onProgress: (step, message) => {
                session.push({
                  event: "progress",
                  data: { step, message },
                })
              },
              onStrategies: (strategies) => {
                session.push({
                  event: "strategies",
                  data: { strategies },
                })
              },
              onDone: (result) => {
                session.push({
                  event: "done",
                  data: result,
                })
              },
              onError: (error) => {
                session.push({
                  event: "error",
                  data: { message: error },
                })
              },
            })
          } catch (error) {
            session.push({
              event: "error",
              data: {
                message: error instanceof Error ? error.message : "Unknown error occurred",
              },
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 15000,
        },
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        websiteUrl: t.String(),
      }),
    },
  )

  // Delete workspace
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      try {
        await workspaceService.deleteWorkspace(id)
        return { success: true, message: "워크스페이스가 삭제되었습니다." }
      } catch (error) {
        set.status = 400
        return errorResponse(
          error instanceof Error ? error.message : "워크스페이스 삭제에 실패했습니다.",
          ResponseCode.BAD_REQUEST,
        )
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // List workspaces with pagination
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const workspaces = await workspaceService.listWorkspaces(limit, offset)
      const total = await workspaceService.countWorkspaces()

      return {
        data: workspaces,
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

  // Get workspaces by owner
  .get(
    "/owner/:ownerId",
    async ({ params: { ownerId } }) => {
      const workspaces = await workspaceService.getWorkspacesByOwner(ownerId)
      return workspaces
    },
    {
      params: t.Object({
        ownerId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get workspace members
  .get(
    "/:id/members",
    async ({ params: { id } }) => {
      const members = await workspaceService.getWorkspaceMembers(id)
      return members
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Add workspace member
  .post(
    "/:id/members",
    async ({ params: { id }, body }) => {
      const member = await workspaceService.addWorkspaceMember({
        ...body,
        workspaceId: id,
      })
      return member
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        userId: t.String({ format: "uuid" }),
        role: t.Optional(
          t.Union([
            t.Literal("owner"),
            t.Literal("admin"),
            t.Literal("member"),
            t.Literal("viewer"),
          ]),
        ),
        invitedBy: t.Optional(t.String({ format: "uuid" })),
        status: t.Optional(
          t.Union([t.Literal("active"), t.Literal("inactive"), t.Literal("removed")]),
        ),
      }),
    },
  )

  // Update member role
  .patch(
    "/:id/members/:memberId/role",
    async ({ params: { memberId }, body, set }) => {
      const member = await workspaceService.updateWorkspaceMemberRole(memberId, body.role)
      if (!member) {
        set.status = 404
        return errorResponse("멤버를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return member
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        memberId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        role: t.Union([
          t.Literal("owner"),
          t.Literal("admin"),
          t.Literal("member"),
          t.Literal("viewer"),
        ]),
      }),
    },
  )

  // Update member status
  .patch(
    "/:id/members/:memberId/status",
    async ({ params: { memberId }, body, set }) => {
      const member = await workspaceService.updateWorkspaceMemberStatus(memberId, body.status)
      if (!member) {
        set.status = 404
        return errorResponse("멤버를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return member
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        memberId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        status: t.Union([t.Literal("active"), t.Literal("inactive"), t.Literal("removed")]),
      }),
    },
  )

  // Remove workspace member
  .delete(
    "/:id/members/:memberId",
    async ({ params: { memberId } }) => {
      await workspaceService.removeWorkspaceMember(memberId)
      return { success: true, message: "멤버가 제거되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        memberId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get user's workspaces (owned or member) - userId extracted from auth token
  .get("/user", async ({ headers, set }) => {
    const userId = await getUserIdFromToken(headers.authorization)
    if (!userId) {
      set.status = 401
      return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
    }

    console.log("[Workspaces API] GET /user called:", { userId })
    const workspaces = await workspaceService.getAllUserRelatedWorkspaces(userId)
    console.log("[Workspaces API] Found workspaces:", {
      count: workspaces.length,
      workspaceIds: workspaces.map((w) => w.id),
    })
    return workspaces
  })

// Admin bulk update routes
export const adminWorkspaceRoutes = new Elysia({
  prefix: "/api/v1/admin/workspaces",
})
  // Bulk update status
  .put(
    "/bulk/status",
    async ({ body }) => {
      const updatedCount = await workspaceService.bulkUpdateStatus(body.workspaceIds, body.isActive)
      return { updatedCount }
    },
    {
      body: t.Object({
        workspaceIds: t.Array(t.String({ format: "uuid" })),
        isActive: t.Boolean(),
      }),
    },
  )

  // Transfer ownership
  .put(
    "/:id/transfer",
    async ({ params: { id }, body, set }) => {
      const workspace = await workspaceService.transferOwnership(id, body.newOwnerId)
      if (!workspace) {
        set.status = 404
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return workspace
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        newOwnerId: t.String({ format: "uuid" }),
      }),
    },
  )

  // ====================================
  // WORKSPACE PRODUCTS ROUTES
  // ====================================

  // Get all products for a workspace
  .get(
    "/:id/products",
    async ({ params }) => {
      const products = await workspaceService.listWorkspaceProducts(params.id)
      return products
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get single workspace product
  .get(
    "/:id/products/:productId",
    async ({ params }) => {
      const product = await workspaceService.getWorkspaceProduct(params.productId)
      if (!product) {
        return errorResponse("제품을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return product
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        productId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create workspace product
  .post(
    "/:id/products",
    async ({ params, body }) => {
      const product = await workspaceService.createWorkspaceProduct({
        workspaceId: params.id,
        ...body,
      })
      return product
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        features: t.Optional(t.Array(t.String())),
        priceRange: t.Optional(t.String()),
        targetAudience: t.Optional(t.String()),
        imageUrl: t.Optional(t.String()),
      }),
    },
  )

  // Update workspace product
  .put(
    "/:id/products/:productId",
    async ({ params, body }) => {
      const product = await workspaceService.updateWorkspaceProduct(params.productId, body)
      if (!product) {
        return errorResponse("제품을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return product
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        productId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        features: t.Optional(t.Array(t.String())),
        priceRange: t.Optional(t.String()),
        targetAudience: t.Optional(t.String()),
        imageUrl: t.Optional(t.String()),
      }),
    },
  )

  // Delete workspace product
  .delete(
    "/:id/products/:productId",
    async ({ params }) => {
      const product = await workspaceService.deleteWorkspaceProduct(params.productId)
      if (!product) {
        return errorResponse("제품을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return { message: "제품이 삭제되었습니다.", product }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        productId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get workspace with products (optional include)
  .get(
    "/:id/with-products",
    async ({ params }) => {
      const workspace = await workspaceService.getWorkspaceWithProducts(params.id)
      if (!workspace) {
        return errorResponse("워크스페이스를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return workspace
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )
