/**
 * Gmail Compliance Utilities
 *
 * This module provides utilities for Gmail 2024 Bulk Sender Guidelines compliance.
 * Reference: https://support.google.com/a/answer/81126
 *
 * Required for sending 5,000+ emails/day to Gmail:
 * 1. SPF (Sender Policy Framework) - DNS TXT record
 * 2. DKIM (DomainKeys Identified Mail) - DNS TXT record
 * 3. DMARC (Domain-based Message Authentication) - DNS TXT record
 * 4. List-Unsubscribe header - Email header (one-click unsubscribe)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DNS CONFIGURATION GUIDE (Required before sending bulk emails)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. SPF Record Setup:
 *    Add DNS TXT record to your sending domain:
 *    ┌────────────────────────────────────────────────────────────────────┐
 *    │ Type: TXT                                                          │
 *    │ Host: @                                                            │
 *    │ Value: v=spf1 include:sendgrid.net include:_spf.google.com ~all   │
 *    └────────────────────────────────────────────────────────────────────┘
 *    Note: Modify based on your email providers
 *
 * 2. DKIM Record Setup:
 *    For SendGrid: Enable DKIM in SendGrid dashboard and add the provided DNS records
 *    For Google Workspace: Enable in Admin Console > Apps > Google Workspace > Gmail > DKIM
 *    ┌────────────────────────────────────────────────────────────────────┐
 *    │ Type: CNAME                                                        │
 *    │ Host: s1._domainkey (or as provided by SendGrid)                  │
 *    │ Value: s1.domainkey.u12345678.wl12345.sendgrid.net                │
 *    └────────────────────────────────────────────────────────────────────┘
 *
 * 3. DMARC Record Setup:
 *    Add DNS TXT record:
 *    ┌────────────────────────────────────────────────────────────────────┐
 *    │ Type: TXT                                                          │
 *    │ Host: _dmarc                                                       │
 *    │ Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com    │
 *    └────────────────────────────────────────────────────────────────────┘
 *    Policies: p=none (monitoring), p=quarantine (suspicious), p=reject (strict)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { config } from "../config"
import logger from "./logger"

/**
 * Unsubscribe link configuration
 */
export interface UnsubscribeConfig {
  /** Workspace ID for tracking */
  workspaceId: string
  /** Lead ID or email recipient identifier */
  leadId?: string
  /** Sequence ID if this is a sequence email */
  sequenceId?: string
  /** Email ID for tracking which email was unsubscribed from */
  emailId?: string
}

/**
 * List-Unsubscribe header data
 * RFC 8058 compliant for one-click unsubscribe
 */
export interface ListUnsubscribeHeaders {
  /** List-Unsubscribe header value (URL and/or mailto) */
  "List-Unsubscribe": string
  /** List-Unsubscribe-Post header for one-click unsubscribe (RFC 8058) */
  "List-Unsubscribe-Post": string
}

/**
 * Base URL for unsubscribe endpoint
 * This should be configured in environment variables
 */
const UNSUBSCRIBE_BASE_URL = config.app.baseUrl || "https://api.grinda.ai"

/**
 * Generate List-Unsubscribe headers for Gmail compliance
 *
 * Gmail requires both:
 * 1. List-Unsubscribe header with HTTPS URL
 * 2. List-Unsubscribe-Post header with "List-Unsubscribe=One-Click"
 *
 * Reference: RFC 8058 (One-Click Unsubscribe)
 *
 * @param cfg - Configuration for unsubscribe link generation
 * @returns Headers object to add to email
 *
 * @example
 * const headers = generateListUnsubscribeHeaders({
 *   workspaceId: "ws_123",
 *   leadId: "lead_456",
 *   sequenceId: "seq_789",
 *   emailId: "email_abc"
 * })
 * // Returns:
 * // {
 * //   "List-Unsubscribe": "<https://api.grinda.ai/unsubscribe?token=xxx>",
 * //   "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
 * // }
 */
export function generateListUnsubscribeHeaders(cfg: UnsubscribeConfig): ListUnsubscribeHeaders {
  // Generate a signed token for secure unsubscribe
  // Token contains: workspaceId, leadId, sequenceId, emailId, timestamp
  const tokenData = {
    w: cfg.workspaceId,
    l: cfg.leadId || "",
    s: cfg.sequenceId || "",
    e: cfg.emailId || "",
    t: Date.now(),
  }

  // Base64 encode the token (in production, use signed JWT or encrypted token)
  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64url")

  // Generate unsubscribe URL
  const unsubscribeUrl = `${UNSUBSCRIBE_BASE_URL}/api/v1/unsubscribe?token=${token}`

  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

/**
 * Generate unsubscribe link for email footer
 * This is in addition to the header-based one-click unsubscribe
 *
 * @param cfg - Configuration for unsubscribe link
 * @returns HTML string for email footer
 */
export function generateUnsubscribeFooter(cfg: UnsubscribeConfig): string {
  const tokenData = {
    w: cfg.workspaceId,
    l: cfg.leadId || "",
    s: cfg.sequenceId || "",
    e: cfg.emailId || "",
    t: Date.now(),
  }

  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64url")
  const unsubscribeUrl = `${UNSUBSCRIBE_BASE_URL}/api/v1/unsubscribe?token=${token}`

  return `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #666;">
      <p style="margin: 0;">
        이 이메일 수신을 원하지 않으시면 <a href="${unsubscribeUrl}" style="color: #0066cc;">여기</a>를 클릭하여 수신 거부하실 수 있습니다.
        <br/>
        If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #0066cc;">unsubscribe here</a>.
      </p>
    </div>
  `.trim()
}

/**
 * Decode and validate unsubscribe token
 *
 * @param token - Base64url encoded token
 * @returns Decoded token data or null if invalid
 */
export function decodeUnsubscribeToken(token: string): UnsubscribeConfig | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const data = JSON.parse(decoded) as {
      w?: string
      l?: string
      s?: string
      e?: string
      t?: number
    }

    // Validate required fields
    if (!data.w) {
      logger.warn({ token }, "Invalid unsubscribe token: missing workspace ID")
      return null
    }

    // Check token age (max 90 days)
    const maxAge = 90 * 24 * 60 * 60 * 1000 // 90 days in milliseconds
    if (data.t && Date.now() - data.t > maxAge) {
      logger.warn({ token, age: Date.now() - data.t }, "Expired unsubscribe token")
      return null
    }

    return {
      workspaceId: data.w,
      leadId: data.l || undefined,
      sequenceId: data.s || undefined,
      emailId: data.e || undefined,
    }
  } catch (error) {
    logger.error({ error, token }, "Failed to decode unsubscribe token")
    return null
  }
}

/**
 * Email Authentication Status
 */
export interface EmailAuthenticationStatus {
  spf: "pass" | "fail" | "softfail" | "neutral" | "none" | "unknown"
  dkim: "pass" | "fail" | "none" | "unknown"
  dmarc: "pass" | "fail" | "none" | "unknown"
  overallPass: boolean
}

/**
 * Check email authentication headers (for incoming emails)
 * Parses Authentication-Results header to determine SPF, DKIM, DMARC status
 *
 * @param authenticationResults - Value of Authentication-Results header
 * @returns Parsed authentication status
 */
export function parseAuthenticationResults(
  authenticationResults: string,
): EmailAuthenticationStatus {
  const result: EmailAuthenticationStatus = {
    spf: "unknown",
    dkim: "unknown",
    dmarc: "unknown",
    overallPass: false,
  }

  if (!authenticationResults) {
    return result
  }

  const lowerAuth = authenticationResults.toLowerCase()

  // Parse SPF result
  const spfMatch = lowerAuth.match(/spf=(pass|fail|softfail|neutral|none)/)
  if (spfMatch?.[1]) {
    result.spf = spfMatch[1] as EmailAuthenticationStatus["spf"]
  }

  // Parse DKIM result
  const dkimMatch = lowerAuth.match(/dkim=(pass|fail|none)/)
  if (dkimMatch?.[1]) {
    result.dkim = dkimMatch[1] as EmailAuthenticationStatus["dkim"]
  }

  // Parse DMARC result
  const dmarcMatch = lowerAuth.match(/dmarc=(pass|fail|none)/)
  if (dmarcMatch?.[1]) {
    result.dmarc = dmarcMatch[1] as EmailAuthenticationStatus["dmarc"]
  }

  // Overall pass requires at least SPF or DKIM to pass, and DMARC to pass
  result.overallPass =
    (result.spf === "pass" || result.dkim === "pass") &&
    (result.dmarc === "pass" || result.dmarc === "unknown" || result.dmarc === "none")

  return result
}

/**
 * Gmail Compliance Check Result
 */
export interface GmailComplianceCheck {
  hasListUnsubscribe: boolean
  hasListUnsubscribePost: boolean
  hasValidFrom: boolean
  hasValidReplyTo: boolean
  isCompliant: boolean
  issues: string[]
}

/**
 * Check if email headers are Gmail bulk sender compliant
 *
 * @param headers - Email headers object
 * @returns Compliance check result
 */
export function checkGmailCompliance(headers: Record<string, string>): GmailComplianceCheck {
  const issues: string[] = []

  // Check List-Unsubscribe header
  const hasListUnsubscribe = Boolean(headers["List-Unsubscribe"] || headers["list-unsubscribe"])
  if (!hasListUnsubscribe) {
    issues.push("Missing List-Unsubscribe header (required for bulk senders)")
  }

  // Check List-Unsubscribe-Post header (required for one-click unsubscribe)
  const hasListUnsubscribePost = Boolean(
    headers["List-Unsubscribe-Post"] || headers["list-unsubscribe-post"],
  )
  if (!hasListUnsubscribePost) {
    issues.push("Missing List-Unsubscribe-Post header (required for one-click unsubscribe)")
  }

  // Check From header
  const fromHeader = headers.From || headers.from || ""
  const hasValidFrom = Boolean(fromHeader && fromHeader.includes("@"))
  if (!hasValidFrom) {
    issues.push("Invalid or missing From header")
  }

  // Check Reply-To if different from From (should match domain or be valid)
  const replyTo = headers["Reply-To"] || headers["reply-to"] || ""
  const hasValidReplyTo = !replyTo || replyTo.includes("@")

  return {
    hasListUnsubscribe,
    hasListUnsubscribePost,
    hasValidFrom,
    hasValidReplyTo,
    isCompliant: hasListUnsubscribe && hasListUnsubscribePost && hasValidFrom && hasValidReplyTo,
    issues,
  }
}

/**
 * Calculate spam score based on email content
 * Higher score = more likely to be flagged as spam
 *
 * @param subject - Email subject
 * @param body - Email body (plain text)
 * @returns Spam score (0-100) and issues
 */
export function calculateSpamScore(
  subject: string,
  body: string,
): {
  score: number
  issues: string[]
} {
  const issues: string[] = []
  let score = 0

  const textToCheck = `${subject} ${body}`.toLowerCase()

  // Spam trigger words and phrases
  const spamTriggers: Array<{ pattern: RegExp; points: number; message: string }> = [
    { pattern: /free\s+(?:gift|money|offer)/gi, points: 15, message: "Contains 'free' spam trigger" },
    { pattern: /act\s+now/gi, points: 10, message: "Contains urgency trigger 'act now'" },
    {
      pattern: /limited\s+time\s+(?:offer|only)/gi,
      points: 10,
      message: "Contains scarcity trigger",
    },
    { pattern: /don't\s+miss\s+(?:out|this)/gi, points: 8, message: "Contains FOMO trigger" },
    { pattern: /click\s+here/gi, points: 5, message: "Contains 'click here' phrase" },
    { pattern: /!!+/g, points: 5, message: "Excessive exclamation marks" },
    { pattern: /\$\$\$+/g, points: 10, message: "Multiple dollar signs" },
    { pattern: /100%\s+(?:free|guaranteed)/gi, points: 8, message: "Contains guarantee spam trigger" },
    { pattern: /winner|won|congratulations/gi, points: 10, message: "Contains winner/prize language" },
    { pattern: /urgent|immediate\s+action/gi, points: 8, message: "Contains urgency language" },
  ]

  for (const trigger of spamTriggers) {
    if (trigger.pattern.test(textToCheck)) {
      score += trigger.points
      issues.push(trigger.message)
    }
  }

  // Check subject line specific issues
  if (subject.toUpperCase() === subject && subject.length > 10) {
    score += 15
    issues.push("Subject line is all caps")
  }

  if ((subject.match(/!/g) || []).length > 2) {
    score += 10
    issues.push("Subject has too many exclamation marks")
  }

  // Check for missing personalization
  if (!body.includes("{{") && body.length > 200) {
    const genericPhrases = ["dear customer", "dear sir", "dear madam", "to whom it may concern"]
    for (const phrase of genericPhrases) {
      if (textToCheck.includes(phrase)) {
        score += 5
        issues.push("Contains generic salutation")
        break
      }
    }
  }

  // Cap score at 100
  return {
    score: Math.min(100, score),
    issues,
  }
}

/**
 * Generate Gmail compliance report for an email
 *
 * @param params - Email parameters
 * @returns Compliance report
 */
export function generateComplianceReport(params: {
  subject: string
  body: string
  headers: Record<string, string>
  hasUnsubscribeLink: boolean
}): {
  isCompliant: boolean
  headerCompliance: GmailComplianceCheck
  spamScore: { score: number; issues: string[] }
  recommendations: string[]
} {
  const headerCompliance = checkGmailCompliance(params.headers)
  const spamScore = calculateSpamScore(params.subject, params.body)

  const recommendations: string[] = []

  // Add recommendations based on issues
  if (!headerCompliance.hasListUnsubscribe) {
    recommendations.push("Add List-Unsubscribe header with HTTPS unsubscribe URL")
  }

  if (!headerCompliance.hasListUnsubscribePost) {
    recommendations.push("Add List-Unsubscribe-Post header with value 'List-Unsubscribe=One-Click'")
  }

  if (!params.hasUnsubscribeLink) {
    recommendations.push("Add visible unsubscribe link in email footer")
  }

  if (spamScore.score > 30) {
    recommendations.push("Review and reduce spam trigger words in subject and body")
  }

  if (spamScore.score > 50) {
    recommendations.push("Consider rewriting email content to reduce spam score")
  }

  const isCompliant =
    headerCompliance.isCompliant && params.hasUnsubscribeLink && spamScore.score < 50

  return {
    isCompliant,
    headerCompliance,
    spamScore,
    recommendations,
  }
}

export default {
  generateListUnsubscribeHeaders,
  generateUnsubscribeFooter,
  decodeUnsubscribeToken,
  parseAuthenticationResults,
  checkGmailCompliance,
  calculateSpamScore,
  generateComplianceReport,
}
