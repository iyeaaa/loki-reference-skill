/**
 * Visitor Firewall Plugin
 *
 * 방문자 트래킹 API 보호를 위한 다층 방어 시스템
 *
 * 기능:
 * 1. 봇/스크래퍼 탐지 및 차단
 * 2. DDoS 방어 (빠른 요청 탐지)
 * 3. 악성 페이로드 차단
 * 4. 의심 점수 기반 Rate Limiting
 *
 * 처리 시간 목표: < 0.5ms
 */

import { Elysia } from "elysia"
import logger from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

interface SuspicionFactors {
  emptyUserAgent: boolean // UA가 비어있거나 너무 짧음
  missingBrowserHeaders: boolean // Accept, Accept-Language 등 브라우저 헤더 누락
  knownBotPattern: boolean // 알려진 봇 패턴 매칭
  tooFastRequests: boolean // 비정상적으로 빠른 요청
  suspiciousPayload: boolean // 의심스러운 페이로드 패턴
  invalidOrigin: boolean // Origin/Referer 없음 (브라우저가 아닐 가능성)
}

interface FirewallResult {
  allowed: boolean
  score: number
  factors: SuspicionFactors
  action: "allow" | "rate_limit" | "challenge" | "block"
  reason?: string
}

interface RequestRecord {
  timestamps: number[]
  blockedUntil?: number
  violationCount: number
}

// ============================================================================
// Constants
// ============================================================================

// 알려진 봇 User-Agent 패턴
const BOT_PATTERNS = [
  // 검색 엔진 봇 (일반적으로 허용하지만 트래킹 API에서는 차단)
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,

  // 일반 봇/크롤러
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /crawl/i,

  // CLI 도구
  /^curl\//i,
  /^wget\//i,
  /^python-requests/i,
  /^python-urllib/i,
  /^go-http-client/i,
  /^java\//i,
  /^okhttp/i,
  /^apache-httpclient/i,
  /^node-fetch/i,
  /^axios/i,
  /^got\//i,
  /^undici/i,

  // 헤드리스 브라우저
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /webdriver/i,

  // 보안 스캐너
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /nuclei/i,

  // 기타 자동화 도구
  /postman/i,
  /insomnia/i,
  /httpie/i,
]

// 위험한 페이로드 패턴
const DANGEROUS_PATTERNS = [
  // SQL Injection
  /['";]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\s/i,
  /\b(?:UNION\s+SELECT|SELECT\s+\*|DROP\s+TABLE)\b/i,

  // XSS
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,

  // Path Traversal
  /\.\.[/\\]/,

  // Command Injection
  /[;&|`$]\s*(?:cat|ls|rm|wget|curl|bash|sh|nc)\s/i,
]

// 점수 가중치
const SCORE_WEIGHTS = {
  emptyUserAgent: 40,
  missingBrowserHeaders: 20,
  knownBotPattern: 60,
  tooFastRequests: 50,
  suspiciousPayload: 100, // 즉시 차단
  invalidOrigin: 15,
}

// 차단 임계값
const THRESHOLDS = {
  block: 70, // 70점 이상: 즉시 차단
  rateLimit: 40, // 40-69점: 강화 Rate Limit
  challenge: 25, // 25-39점: 의심 (로깅)
}

// 시간 윈도우 (ms)
const TIME_WINDOWS = {
  fastRequest: 1000, // 1초 내 반복 요청 감지
  rateLimit: 60000, // 1분 Rate Limit 윈도우
  blockDuration: 600000, // 10분 차단
}

// Rate Limit 설정
const RATE_LIMITS = {
  normal: { max: 30, window: 60000 }, // 일반: 30 req/min
  strict: { max: 5, window: 60000 }, // 의심: 5 req/min
}

// ============================================================================
// In-Memory Storage (프로덕션에서는 Redis 사용 권장)
// ============================================================================

const requestRecords = new Map<string, RequestRecord>()

// 주기적으로 오래된 기록 정리 (5분마다)
setInterval(
  () => {
    const now = Date.now()
    const expireTime = 10 * 60 * 1000 // 10분 이상 된 기록 삭제

    for (const [key, record] of requestRecords.entries()) {
      const lastRequest = record.timestamps[record.timestamps.length - 1] || 0
      if (now - lastRequest > expireTime) {
        requestRecords.delete(key)
      }
    }

    logger.debug({ remainingRecords: requestRecords.size }, "[Firewall] Cleanup completed")
  },
  5 * 60 * 1000,
)

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * User-Agent 검증
 */
function checkUserAgent(ua: string | null): { empty: boolean; isBot: boolean } {
  if (!ua || ua.length < 10) {
    return { empty: true, isBot: false }
  }

  const isBot = BOT_PATTERNS.some((pattern) => pattern.test(ua))
  return { empty: false, isBot }
}

/**
 * 브라우저 헤더 검증
 * 실제 브라우저는 Accept, Accept-Language, Accept-Encoding 등을 보냄
 */
function checkBrowserHeaders(headers: Record<string, string | null>): boolean {
  const requiredHeaders = ["accept", "accept-language"]

  for (const header of requiredHeaders) {
    if (!headers[header]) {
      return false
    }
  }

  // Accept 헤더가 비정상적으로 단순하면 의심
  const accept = headers.accept
  if (accept && !accept.includes("/")) {
    return false
  }

  return true
}

/**
 * 빠른 요청 감지 (1초 내 3회 이상)
 */
function checkFastRequests(ip: string): boolean {
  const now = Date.now()
  const record = requestRecords.get(ip)

  if (!record) {
    requestRecords.set(ip, {
      timestamps: [now],
      violationCount: 0,
    })
    return false
  }

  // 1초 내 요청만 필터링
  const recentTimestamps = record.timestamps.filter((t) => now - t < TIME_WINDOWS.fastRequest)
  recentTimestamps.push(now)

  // 최근 20개만 유지
  record.timestamps = recentTimestamps.slice(-20)

  // 1초 내 3회 이상 = 의심
  return recentTimestamps.length >= 3
}

/**
 * 차단 상태 확인
 */
function isBlocked(ip: string): boolean {
  const record = requestRecords.get(ip)
  if (!record?.blockedUntil) return false

  if (Date.now() < record.blockedUntil) {
    return true
  }

  // 차단 해제
  record.blockedUntil = undefined
  return false
}

/**
 * IP 차단
 */
function blockIp(ip: string, durationMs: number = TIME_WINDOWS.blockDuration): void {
  const record = requestRecords.get(ip) || {
    timestamps: [],
    violationCount: 0,
  }

  record.blockedUntil = Date.now() + durationMs
  record.violationCount++

  requestRecords.set(ip, record)

  logger.warn(
    {
      ip,
      durationMs,
      violationCount: record.violationCount,
    },
    "[Firewall] IP blocked",
  )
}

/**
 * 페이로드 검증 (JSON 파싱 전 빠른 검사)
 */
function checkPayload(body: unknown): { valid: boolean; suspicious: boolean } {
  // body가 이미 파싱된 객체인 경우
  if (typeof body === "object" && body !== null) {
    const jsonStr = JSON.stringify(body)

    // 크기 제한 (2KB)
    if (jsonStr.length > 2048) {
      return { valid: false, suspicious: true }
    }

    // 위험 패턴 검사
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(jsonStr)) {
        return { valid: false, suspicious: true }
      }
    }

    // workspaceId 필드 존재 확인
    if (!("workspaceId" in body)) {
      return { valid: false, suspicious: false }
    }

    return { valid: true, suspicious: false }
  }

  return { valid: false, suspicious: false }
}

/**
 * Origin/Referer 검증
 * 브라우저에서 호출 시 일반적으로 포함됨
 */
function checkOrigin(headers: Record<string, string | null>): boolean {
  // Origin 또는 Referer가 있으면 OK
  return !!(headers.origin || headers.referer)
}

/**
 * Rate Limit 체크
 */
function checkRateLimit(ip: string, isStrict: boolean): { allowed: boolean; remaining: number } {
  const config = isStrict ? RATE_LIMITS.strict : RATE_LIMITS.normal
  const now = Date.now()
  const record = requestRecords.get(ip)

  if (!record) {
    return { allowed: true, remaining: config.max - 1 }
  }

  // 윈도우 내 요청 수 계산
  const windowStart = now - config.window
  const requestsInWindow = record.timestamps.filter((t) => t > windowStart).length

  return {
    allowed: requestsInWindow < config.max,
    remaining: Math.max(0, config.max - requestsInWindow),
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * 요청 분석 및 의심 점수 계산
 */
function analyzeRequest(
  ip: string,
  headers: Record<string, string | null>,
  body: unknown,
): FirewallResult {
  // 이미 차단된 IP인지 확인
  if (isBlocked(ip)) {
    return {
      allowed: false,
      score: 100,
      factors: {} as SuspicionFactors,
      action: "block",
      reason: "IP is temporarily blocked",
    }
  }

  // 각 요소 분석
  const uaCheck = checkUserAgent(headers["user-agent"] ?? null)
  const hasBrowserHeaders = checkBrowserHeaders(headers)
  const isFastRequest = checkFastRequests(ip)
  const payloadCheck = checkPayload(body)
  const hasValidOrigin = checkOrigin(headers)

  // 의심 요소 집계
  const factors: SuspicionFactors = {
    emptyUserAgent: uaCheck.empty,
    missingBrowserHeaders: !hasBrowserHeaders,
    knownBotPattern: uaCheck.isBot,
    tooFastRequests: isFastRequest,
    suspiciousPayload: payloadCheck.suspicious,
    invalidOrigin: !hasValidOrigin,
  }

  // 점수 계산
  let score = 0
  if (factors.emptyUserAgent) score += SCORE_WEIGHTS.emptyUserAgent
  if (factors.missingBrowserHeaders) score += SCORE_WEIGHTS.missingBrowserHeaders
  if (factors.knownBotPattern) score += SCORE_WEIGHTS.knownBotPattern
  if (factors.tooFastRequests) score += SCORE_WEIGHTS.tooFastRequests
  if (factors.suspiciousPayload) score += SCORE_WEIGHTS.suspiciousPayload
  if (factors.invalidOrigin) score += SCORE_WEIGHTS.invalidOrigin

  score = Math.min(score, 100)

  // 액션 결정
  let action: FirewallResult["action"] = "allow"
  let reason: string | undefined

  if (score >= THRESHOLDS.block) {
    action = "block"
    reason = getBlockReason(factors)
    blockIp(ip) // IP 차단
  } else if (score >= THRESHOLDS.rateLimit) {
    // 강화된 Rate Limit 적용
    const rateLimitResult = checkRateLimit(ip, true)
    if (!rateLimitResult.allowed) {
      action = "rate_limit"
      reason = "Rate limit exceeded (strict mode)"
    }
  } else if (score >= THRESHOLDS.challenge) {
    action = "challenge"
    reason = "Suspicious request pattern detected"
  }

  return {
    allowed: action === "allow" || action === "challenge",
    score,
    factors,
    action,
    reason,
  }
}

/**
 * 차단 사유 생성
 */
function getBlockReason(factors: SuspicionFactors): string {
  const reasons: string[] = []

  if (factors.suspiciousPayload) reasons.push("malicious payload")
  if (factors.knownBotPattern) reasons.push("bot detected")
  if (factors.tooFastRequests) reasons.push("too many requests")
  if (factors.emptyUserAgent) reasons.push("invalid user agent")

  return reasons.join(", ") || "suspicious activity"
}

// ============================================================================
// Elysia Plugin
// ============================================================================

/**
 * 방문자 트래킹 API 전용 Firewall Plugin
 *
 * 사용법:
 * ```typescript
 * import { visitorFirewall } from "./plugins/visitor-firewall.plugin"
 *
 * const app = new Elysia()
 *   .use(visitorFirewall)
 *   .post("/api/v1/visitors/track", handler)
 * ```
 */
export const visitorFirewall = new Elysia({ name: "visitor-firewall" }).onBeforeHandle(
  ({ body, set, headers }) => {
    const startTime = performance.now()

    // IP 추출 (Cloudflare → X-Forwarded-For → X-Real-IP)
    const ip =
      headers["cf-connecting-ip"] ||
      (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      headers["x-real-ip"] ||
      "unknown"

    // 요청 분석
    const result = analyzeRequest(ip as string, headers as Record<string, string | null>, body)

    // 처리 시간 측정
    const processingTime = performance.now() - startTime

    // 로깅 (차단 또는 의심 요청만)
    if (result.action !== "allow") {
      logger.info(
        {
          ip,
          score: result.score,
          action: result.action,
          reason: result.reason,
          factors: result.factors,
          processingTimeMs: processingTime.toFixed(2),
          userAgent: headers["user-agent"]?.substring(0, 100),
        },
        `[Firewall] ${result.action.toUpperCase()}: ${result.reason}`,
      )
    }

    // Rate Limit 헤더 추가
    const rateLimitResult = checkRateLimit(ip as string, result.score >= THRESHOLDS.rateLimit)
    set.headers["X-RateLimit-Remaining"] = rateLimitResult.remaining.toString()
    set.headers["X-Firewall-Score"] = result.score.toString()

    // 차단된 요청
    if (!result.allowed) {
      set.status = result.action === "rate_limit" ? 429 : 403
      set.headers["X-Block-Reason"] = result.reason || "Blocked"

      if (result.action === "rate_limit") {
        set.headers["Retry-After"] = "60"
      }

      return {
        success: false,
        message: result.action === "rate_limit" ? "Too many requests" : "Request blocked",
        code: result.action === "rate_limit" ? "RATE_LIMITED" : "BLOCKED",
      }
    }

    // Challenge (허용하지만 로깅)
    if (result.action === "challenge") {
      set.headers["X-Firewall-Challenge"] = "true"
    }
  },
)

// ============================================================================
// Exports
// ============================================================================

export {
  analyzeRequest,
  checkRateLimit,
  isBlocked,
  blockIp,
  requestRecords,
  THRESHOLDS,
  RATE_LIMITS,
}
