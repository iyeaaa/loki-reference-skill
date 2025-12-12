/**
 * IAM Authentication & Authorization Plugin
 *
 * Elysia 플러그인으로 인증 및 권한 체크를 제공합니다.
 */

import { Elysia } from "elysia"
import * as iamService from "../services/iam.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"

export interface IamContext {
  userId: string | null
  memberId: string | null
  workspaceId: string | null
}

/**
 * IAM 인증/권한 플러그인
 * - Authorization 헤더에서 userId 추출
 * - workspaceId 파라미터/바디에서 워크스페이스 ID 추출
 * - 멤버십 확인 및 memberId 제공
 */
export const iamAuth = new Elysia({ name: "iam-auth" }).derive(
  async ({ headers, params, body, query }) => {
    // 1. 토큰에서 userId 추출
    const authorization = headers.authorization
    const userId = await getUserIdFromToken(authorization)

    // 2. workspaceId 추출 (params > body > query 순서)
    const workspaceId =
      (params as Record<string, string>)?.workspaceId ||
      (params as Record<string, string>)?.id || // /workspaces/:id 형태
      (body as Record<string, string>)?.workspaceId ||
      (query as Record<string, string>)?.workspaceId ||
      null

    // 3. memberId 조회
    let memberId: string | null = null
    if (userId && workspaceId) {
      memberId = await iamService.getMemberIdByUserAndWorkspace(userId, workspaceId)
    }

    return {
      iam: {
        userId,
        memberId,
        workspaceId,
      } as IamContext,
    }
  },
)

/**
 * 인증 필수 가드
 * - 로그인 여부만 확인
 */
export function requireAuth() {
  return async ({ iam, set }: { iam: IamContext; set: { status: number } }) => {
    if (!iam.userId) {
      set.status = 401
      return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
    }
  }
}

/**
 * 권한 체크 가드 생성 함수
 * @param resource - 리소스 (예: "leads", "sequences")
 * @param action - 액션 (예: "read", "create", "update", "delete")
 */
export function requirePermission(resource: string, action: string) {
  return async ({ iam, set }: { iam: IamContext; set: { status: number } }) => {
    // 인증 필수
    if (!iam.userId) {
      set.status = 401
      return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
    }

    // 워크스페이스 미선택 (전체 보기 등)은 일단 허용
    // 개별 리소스 접근 시에만 권한 체크
    if (!iam.workspaceId) {
      return // 계속 진행
    }

    // 멤버십 확인
    if (!iam.memberId) {
      set.status = 403
      return errorResponse("해당 워크스페이스에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
    }

    // 권한 체크
    const hasPermission = await iamService.checkPermission(iam.memberId, resource, action)

    if (!hasPermission) {
      set.status = 403
      return errorResponse(
        `이 작업을 수행할 권한이 없습니다. (${resource}:${action})`,
        ResponseCode.FORBIDDEN,
      )
    }
  }
}

/**
 * 워크스페이스 Admin 전용 권한 체크 (역할이 Owner 또는 Admin인지)
 */
export function requireWorkspaceAdmin() {
  return async ({ iam, set }: { iam: IamContext; set: { status: number } }) => {
    if (!iam.userId) {
      set.status = 401
      return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
    }

    if (!iam.workspaceId || !iam.memberId) {
      set.status = 403
      return errorResponse("워크스페이스 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
    }

    // owner 또는 admin 역할 확인
    const isAdmin = await iamService.isMemberAdmin(iam.memberId)

    if (!isAdmin) {
      set.status = 403
      return errorResponse("관리자 권한이 필요합니다.", ResponseCode.FORBIDDEN)
    }
  }
}
