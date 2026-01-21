/**
 * Bot Detection Utility
 *
 * 이메일 오픈/클릭 이벤트에서 봇/자동화 트래픽을 감지하는 공용 유틸리티
 * SendGrid, Unipile, Nylas 등 모든 웹훅 핸들러에서 사용
 *
 * 감지 대상:
 * - Google Image Proxy (Gmail 이미지 캐싱)
 * - Yahoo Mail Proxy
 * - Microsoft ATP/Defender (Safe Links)
 * - Slack Image Proxy
 * - 기타 이미지 프록시 및 보안 스캐너
 */

import logger from "./logger"

export interface EventData {
  ip?: string | null
  userAgent?: string | null
  sgMachineOpen?: boolean // SendGrid specific
}

/**
 * 봇/자동화 오픈 이벤트인지 감지
 *
 * @param event - 이벤트 데이터 (IP, User-Agent, sg_machine_open)
 * @returns true if bot/automated, false if likely human
 */
export function isAutomatedOpen(event: EventData): boolean {
  const { ip, userAgent, sgMachineOpen } = event

  // 1. SendGrid 봇 판단 (참고용 - 신뢰도 68%)
  if (sgMachineOpen === true) {
    return true
  }

  // 2. User-Agent 기반 봇 감지 (가장 정확)
  if (userAgent && isOpenBotUserAgent(userAgent)) {
    return true
  }

  // 3. IP 기반 봇 감지
  if (ip && isOpenBotIP(ip)) {
    return true
  }

  return false
}

/**
 * 봇/자동화 클릭 이벤트인지 감지
 *
 * @param event - 이벤트 데이터 (IP, User-Agent)
 * @returns true if bot/automated, false if likely human
 */
export function isAutomatedClick(event: EventData): boolean {
  const { ip, userAgent } = event

  // 1. User-Agent 기반 봇 감지
  if (userAgent && isClickBotUserAgent(userAgent)) {
    return true
  }

  // 2. IP 기반 봇 감지
  if (ip && isClickBotIP(ip)) {
    return true
  }

  return false
}

/**
 * 오픈 이벤트 봇 User-Agent 패턴
 *
 * 분석 기반:
 * - GoogleImageProxy: 12,101건 중 232건만 감지됨 (1.9%)
 * - Yahoo: 36건 중 2건만 감지됨 (6%)
 */
const OPEN_BOT_USER_AGENT_PATTERNS = [
  // Google Image Proxy (가장 많은 봇 트래픽)
  /GoogleImageProxy/i,
  /ggpht\.com/i,

  // Yahoo Mail Proxy
  /YahooMailProxy/i,
  /Yahoo.*Proxy/i,

  // Generic Image Proxies
  /imageproxy/i,
  /Slack-ImgProxy/i,
  /willnorris\/imageproxy/i,

  // NOTE: Chrome/130, Chrome/113 등 버전 패턴은 CLICK에만 사용!
  // Open 이벤트에서 Chrome 버전으로 봇 판별하면 실제 사용자도 봇으로 처리됨
  // Microsoft ATP/Safe Links는 링크를 미리 클릭할 때만 특정 Chrome 버전 사용

  // Explicit bots/crawlers
  /bot/i,
  /crawler/i,
  /spider/i,
  /python-requests/i,
  /aiohttp/i,
  /curl/i,
  /wget/i,
  /SCMGUARD/i,
]

/**
 * 클릭 이벤트 봇 User-Agent 패턴
 */
const CLICK_BOT_USER_AGENT_PATTERNS = [
  // Microsoft ATP / Safe Links (링크 스캔)
  /Chrome\/130\.0\.0\.0/,
  /Chrome\/113\.0\.0\.0/,

  // Security scanners
  /SCMGUARD/i,
  /python-requests/i,
  /aiohttp/i,
  /curl/i,
  /wget/i,

  // Explicit bots
  /bot/i,
  /crawler/i,
  /spider/i,
]

/**
 * 오픈 이벤트 봇 IP 패턴
 *
 * 분석 기반:
 * - 74.125.x.x (Google): 10,917건, 40개 고유 IP
 * - 66.249.x.x (Google): 1,755건, 77개 고유 IP
 * - Microsoft ATP: 3,341건
 */
const OPEN_BOT_IP_PATTERNS = [
  // Google Image Proxy (가장 많은 봇 트래픽)
  /^74\.125\./, // Google Image Proxy
  /^66\.249\./, // Google (Googlebot, Image Proxy)

  // Microsoft ATP / Defender
  /^4\.182\./, // Azure ATP / Safe Links
  /^57\.155\./, // Microsoft ATP
  /^72\.145\./, // Defender for Office 365
  /^48\.209\./, // Azure security services
  /^4\.204\./, // Azure
  /^40\.94\./, // Microsoft
  /^40\.107\./, // Microsoft

  // Yahoo Mail
  /^98\.137\./, // Yahoo
  /^67\.195\./, // Yahoo
  /^68\.180\./, // Yahoo

  // Apple Mail Privacy Protection - 제거됨
  // /^17\./ 패턴은 너무 광범위함 (Apple 전체 IP 대역)
  // Apple Privacy Protection 사용자도 실제 사용자이므로 봇으로 처리하면 안 됨
]

/**
 * 클릭 이벤트 봇 IP 패턴
 */
const CLICK_BOT_IP_PATTERNS = [
  // Microsoft ATP / Defender
  /^57\.155\./, // Azure ATP
  /^4\.182\./, // Azure Safe Links
  /^72\.145\./, // Defender for Office 365
  /^74\.240\./, // Microsoft security services
  /^40\.94\./, // Microsoft
  /^40\.107\./, // Microsoft
]

function isOpenBotUserAgent(userAgent: string): boolean {
  return OPEN_BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))
}

function isClickBotUserAgent(userAgent: string): boolean {
  return CLICK_BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))
}

function isOpenBotIP(ip: string): boolean {
  return OPEN_BOT_IP_PATTERNS.some((pattern) => pattern.test(ip))
}

function isClickBotIP(ip: string): boolean {
  return CLICK_BOT_IP_PATTERNS.some((pattern) => pattern.test(ip))
}

/**
 * 봇 감지 결과 로깅 (디버깅용)
 */
export function logBotDetection(
  source: "sendgrid" | "unipile" | "nylas",
  eventType: "open" | "click",
  event: EventData,
  isBot: boolean,
): void {
  if (isBot) {
    logger.debug(
      {
        source,
        eventType,
        ip: event.ip,
        userAgent: event.userAgent?.substring(0, 100),
        sgMachineOpen: event.sgMachineOpen,
        isBot,
      },
      `[BotDetection] ${source} ${eventType} event detected as bot`,
    )
  }
}
