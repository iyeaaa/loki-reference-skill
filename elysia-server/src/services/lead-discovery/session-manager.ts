/**
 * Session Manager for Lead Discovery
 * 세션 생성 시간 및 만료 시간을 추적하여 TTL 검증 지원
 *
 * LangGraph MemorySaver는 TTL을 직접 지원하지 않으므로,
 * 별도의 세션 메타데이터 저장소로 만료 관리
 */

import logger from "../../utils/logger"

// 세션 TTL (30분)
export const SESSION_TTL_MS = 30 * 60 * 1000

// 세션 경고 시간 (25분 - 만료 5분 전)
export const SESSION_WARNING_MS = 25 * 60 * 1000

// 세션 메타데이터 인터페이스
export interface SessionMetadata {
  sessionId: string
  createdAt: number // timestamp
  expiresAt: number // timestamp
  workspaceId?: string
  lastAccessedAt?: number // 마지막 접근 시간
}

// 세션 메타데이터 저장소 (메모리)
// 프로덕션에서는 Redis 등 외부 저장소 사용 권장
const sessionMetadataStore = new Map<string, SessionMetadata>()

// 정리 간격 (5분)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/**
 * 세션 메타데이터 생성 및 저장
 */
export function createSession(sessionId: string, workspaceId?: string): SessionMetadata {
  const now = Date.now()
  const metadata: SessionMetadata = {
    sessionId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    workspaceId,
    lastAccessedAt: now,
  }

  sessionMetadataStore.set(sessionId, metadata)

  logger.info(
    { sessionId, expiresAt: new Date(metadata.expiresAt).toISOString() },
    "[SessionManager] Session created",
  )

  return metadata
}

/**
 * 세션 메타데이터 조회
 */
export function getSessionMetadata(sessionId: string): SessionMetadata | undefined {
  return sessionMetadataStore.get(sessionId)
}

/**
 * 세션이 만료되었는지 확인
 */
export function isSessionExpired(sessionId: string): boolean {
  const metadata = sessionMetadataStore.get(sessionId)

  // 메타데이터가 없으면 만료로 간주 (이전 버전 호환성)
  if (!metadata) {
    return false // 메타데이터가 없으면 만료 검증 건너뛰기 (기존 동작 유지)
  }

  return Date.now() > metadata.expiresAt
}

/**
 * 세션이 곧 만료될 예정인지 확인 (5분 이내)
 */
export function isSessionExpiringSoon(sessionId: string): boolean {
  const metadata = sessionMetadataStore.get(sessionId)

  if (!metadata) {
    return false
  }

  const now = Date.now()
  const elapsed = now - metadata.createdAt
  return elapsed > SESSION_WARNING_MS && elapsed <= SESSION_TTL_MS
}

/**
 * 세션 남은 시간 계산 (밀리초)
 */
export function getSessionRemainingTime(sessionId: string): number {
  const metadata = sessionMetadataStore.get(sessionId)

  if (!metadata) {
    return SESSION_TTL_MS // 메타데이터가 없으면 기본 TTL 반환
  }

  return Math.max(0, metadata.expiresAt - Date.now())
}

/**
 * 세션 연장 (TTL 리셋)
 */
export function extendSession(sessionId: string): SessionMetadata | null {
  const metadata = sessionMetadataStore.get(sessionId)

  if (!metadata) {
    logger.warn({ sessionId }, "[SessionManager] Cannot extend - session not found")
    return null
  }

  // 이미 만료된 세션은 연장 불가
  if (Date.now() > metadata.expiresAt) {
    logger.warn({ sessionId }, "[SessionManager] Cannot extend - session already expired")
    return null
  }

  const now = Date.now()
  const updatedMetadata: SessionMetadata = {
    ...metadata,
    expiresAt: now + SESSION_TTL_MS,
    lastAccessedAt: now,
  }

  sessionMetadataStore.set(sessionId, updatedMetadata)

  logger.info(
    { sessionId, newExpiresAt: new Date(updatedMetadata.expiresAt).toISOString() },
    "[SessionManager] Session extended",
  )

  return updatedMetadata
}

/**
 * 세션 마지막 접근 시간 업데이트
 */
export function touchSession(sessionId: string): void {
  const metadata = sessionMetadataStore.get(sessionId)

  if (metadata) {
    metadata.lastAccessedAt = Date.now()
    sessionMetadataStore.set(sessionId, metadata)
  }
}

/**
 * 세션 삭제
 */
export function deleteSession(sessionId: string): boolean {
  const deleted = sessionMetadataStore.delete(sessionId)

  if (deleted) {
    logger.info({ sessionId }, "[SessionManager] Session deleted")
  }

  return deleted
}

/**
 * 만료된 세션 정리
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now()
  let cleanedCount = 0

  for (const [sessionId, metadata] of sessionMetadataStore.entries()) {
    if (now > metadata.expiresAt) {
      sessionMetadataStore.delete(sessionId)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    logger.info({ cleanedCount }, "[SessionManager] Cleaned up expired sessions")
  }

  return cleanedCount
}

/**
 * 모든 세션 삭제
 */
export function clearAllSessions(): void {
  const count = sessionMetadataStore.size
  sessionMetadataStore.clear()
  logger.info({ count }, "[SessionManager] Cleared all sessions")
}

/**
 * 세션 통계 조회
 */
export function getSessionStats(): {
  total: number
  active: number
  expiringSoon: number
  expired: number
} {
  const now = Date.now()
  let active = 0
  let expiringSoon = 0
  let expired = 0

  for (const metadata of sessionMetadataStore.values()) {
    if (now > metadata.expiresAt) {
      expired++
    } else if (now - metadata.createdAt > SESSION_WARNING_MS) {
      expiringSoon++
    } else {
      active++
    }
  }

  return {
    total: sessionMetadataStore.size,
    active,
    expiringSoon,
    expired,
  }
}

/**
 * 세션 검증 결과 인터페이스
 */
export interface SessionValidationResult {
  valid: boolean
  expired: boolean
  expiringSoon: boolean
  remainingMs: number
  metadata?: SessionMetadata
  error?: string
}

/**
 * 세션 검증 (통합)
 */
export function validateSession(sessionId: string): SessionValidationResult {
  const metadata = getSessionMetadata(sessionId)

  // 메타데이터가 없는 경우 (이전 버전 호환성)
  if (!metadata) {
    return {
      valid: true, // 메타데이터가 없으면 일단 유효하다고 처리 (기존 동작 유지)
      expired: false,
      expiringSoon: false,
      remainingMs: SESSION_TTL_MS,
    }
  }

  const now = Date.now()
  const expired = now > metadata.expiresAt
  const remainingMs = Math.max(0, metadata.expiresAt - now)
  const expiringSoon = !expired && now - metadata.createdAt > SESSION_WARNING_MS

  return {
    valid: !expired,
    expired,
    expiringSoon,
    remainingMs,
    metadata,
    error: expired ? "세션이 만료되었습니다" : undefined,
  }
}

// 주기적으로 만료된 세션 정리 (5분마다)
let cleanupInterval: ReturnType<typeof setInterval> | null = null

export function startCleanupInterval(): void {
  if (cleanupInterval) {
    return
  }

  cleanupInterval = setInterval(() => {
    cleanupExpiredSessions()
  }, CLEANUP_INTERVAL_MS)

  logger.info("[SessionManager] Started cleanup interval")
}

export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    logger.info("[SessionManager] Stopped cleanup interval")
  }
}

// 모듈 로드 시 자동으로 정리 인터벌 시작
startCleanupInterval()
