import { Elysia, t } from "elysia"
import { verifyToken } from "../services/auth.service"
import * as s3Service from "../services/s3.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

export const uploadRoutes = new Elysia({ prefix: "/upload" })
  // 프로필 이미지 업로드
  .post(
    "/profile-image",
    async ({ body, headers, set }) => {
      // JWT 인증
      const authHeader = headers.authorization
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const token = authHeader.replace("Bearer ", "")
      let payload: { userId: string; email: string; userRole: string }
      try {
        payload = await verifyToken(token)
      } catch {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      if (!payload.userId) {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      // S3 설정 확인
      if (!s3Service.isS3Configured()) {
        set.status = 500
        return errorResponse("S3가 설정되지 않았습니다.", ResponseCode.INTERNAL_ERROR)
      }

      const { file } = body

      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        set.status = 400
        return errorResponse("이미지 파일만 업로드할 수 있습니다.", ResponseCode.BAD_REQUEST)
      }

      // 파일 크기 검증 (2MB)
      if (file.size > 2 * 1024 * 1024) {
        set.status = 400
        return errorResponse("파일 크기는 2MB를 초과할 수 없습니다.", ResponseCode.BAD_REQUEST)
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const imageUrl = await s3Service.uploadProfileImage(payload.userId, buffer, file.type)

        logger.info({ userId: payload.userId, imageUrl }, "Profile image uploaded")

        return successResponse({ url: imageUrl }, "이미지가 업로드되었습니다.")
      } catch (error) {
        logger.error({ error, userId: payload.userId }, "Failed to upload profile image")
        set.status = 500
        return errorResponse("이미지 업로드에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: "2m",
          type: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        }),
      }),
    },
  )

  // 워크스페이스 로고 업로드
  .post(
    "/workspace-logo",
    async ({ body, headers, set }) => {
      // JWT 인증
      const authHeader = headers.authorization
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const token = authHeader.replace("Bearer ", "")
      let payload: { userId: string; email: string; userRole: string }
      try {
        payload = await verifyToken(token)
      } catch {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      if (!payload.userId) {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      // S3 설정 확인
      if (!s3Service.isS3Configured()) {
        set.status = 500
        return errorResponse("S3가 설정되지 않았습니다.", ResponseCode.INTERNAL_ERROR)
      }

      const { file, workspaceId } = body

      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        set.status = 400
        return errorResponse("이미지 파일만 업로드할 수 있습니다.", ResponseCode.BAD_REQUEST)
      }

      // 파일 크기 검증 (2MB)
      if (file.size > 2 * 1024 * 1024) {
        set.status = 400
        return errorResponse("파일 크기는 2MB를 초과할 수 없습니다.", ResponseCode.BAD_REQUEST)
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const imageUrl = await s3Service.uploadWorkspaceLogo(workspaceId, buffer, file.type)

        logger.info({ userId: payload.userId, workspaceId, imageUrl }, "Workspace logo uploaded")

        return successResponse({ url: imageUrl }, "로고가 업로드되었습니다.")
      } catch (error) {
        logger.error(
          { error, userId: payload.userId, workspaceId },
          "Failed to upload workspace logo",
        )
        set.status = 500
        return errorResponse("이미지 업로드에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: "2m",
          type: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        }),
        workspaceId: t.String({ minLength: 1 }),
      }),
    },
  )

  // 이미지 삭제 (관리자용)
  .delete(
    "/image",
    async ({ body, headers, set }) => {
      // JWT 인증
      const authHeader = headers.authorization
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const token = authHeader.replace("Bearer ", "")
      let payload: { userId: string; email: string; userRole: string }
      try {
        payload = await verifyToken(token)
      } catch {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      if (!payload.userId) {
        set.status = 401
        return errorResponse("유효하지 않은 토큰입니다.", ResponseCode.UNAUTHORIZED)
      }

      const { imageUrl } = body

      try {
        await s3Service.deleteImage(imageUrl)
        logger.info({ userId: payload.userId, imageUrl }, "Image deleted")
        return successResponse(null, "이미지가 삭제되었습니다.")
      } catch (error) {
        logger.error({ error, userId: payload.userId, imageUrl }, "Failed to delete image")
        set.status = 500
        return errorResponse("이미지 삭제에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        imageUrl: t.String({ minLength: 1 }),
      }),
    },
  )
