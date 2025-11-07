/**
 * OpenAI API Keys Management Routes
 * Workspace별 API 키 관리
 */

import { Elysia, t } from "elysia"
import {
  createApiKey,
  deleteApiKey,
  getApiKeys,
  reorderApiKeys,
  updateApiKey,
} from "../services/openai-api-key.service"
import logger from "../utils/logger"

export const openaiApiKeysRoutes = new Elysia({ prefix: "/api/v1/admin/openai-api-keys" })
  /**
   * GET /api/v1/admin/openai-api-keys/:workspaceId
   * Workspace의 모든 API 키 조회
   */
  .get(
    "/:workspaceId",
    async ({ params }) => {
      const { workspaceId } = params

      const keys = await getApiKeys(workspaceId)

      return {
        success: true,
        data: keys,
      }
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
    },
  )

  /**
   * POST /api/v1/admin/openai-api-keys
   * API 키 생성
   */
  .post(
    "/",
    async ({ body, set }) => {
      const { workspaceId, name, apiKey, orderIndex } = body

      try {
        const newKey = await createApiKey({
          workspaceId,
          name,
          apiKey,
          orderIndex,
        })

        return {
          success: true,
          data: newKey,
          message: "API 키가 추가되었습니다",
        }
      } catch (error) {
        logger.error({ error, workspaceId }, "Failed to create API key")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        apiKey: t.String(),
        orderIndex: t.Optional(t.Number()),
      }),
    },
  )

  /**
   * PUT /api/v1/admin/openai-api-keys/:id
   * API 키 수정
   */
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params
      const { workspaceId, name, apiKey, orderIndex, isActive } = body

      try {
        const updatedKey = await updateApiKey(id, workspaceId, {
          name,
          apiKey,
          orderIndex,
          isActive,
        })

        return {
          success: true,
          data: updatedKey,
          message: "API 키가 수정되었습니다",
        }
      } catch (error) {
        logger.error({ error, id, workspaceId }, "Failed to update API key")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        workspaceId: t.String(),
        name: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        orderIndex: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  /**
   * DELETE /api/v1/admin/openai-api-keys/:id
   * API 키 삭제
   */
  .delete(
    "/:id",
    async ({ params, query, set }) => {
      const { id } = params
      const { workspaceId } = query

      if (!workspaceId) {
        set.status = 400
        return {
          success: false,
          error: "workspaceId is required",
        }
      }

      try {
        await deleteApiKey(id, workspaceId)

        return {
          success: true,
          message: "API 키가 삭제되었습니다",
        }
      } catch (error) {
        logger.error({ error, id, workspaceId }, "Failed to delete API key")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
    },
  )

  /**
   * POST /api/v1/admin/openai-api-keys/reorder
   * API 키 순서 재정렬
   */
  .post(
    "/reorder",
    async ({ body, set }) => {
      const { workspaceId, keyOrder } = body

      try {
        await reorderApiKeys(workspaceId, keyOrder)

        return {
          success: true,
          message: "API 키 순서가 변경되었습니다",
        }
      } catch (error) {
        logger.error({ error, workspaceId }, "Failed to reorder API keys")
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        keyOrder: t.Array(
          t.Object({
            id: t.String(),
            orderIndex: t.Number(),
          }),
        ),
      }),
    },
  )
