/**
 * Loops.so Service
 *
 * Transactional email service using Loops.so API
 * https://loops.so/docs/api-reference/transactional
 */

import { config } from "../config"
import logger from "../utils/logger"

// ====================================
// TYPES
// ====================================

interface LoopsTransactionalEmailResponse {
  success: boolean
  id?: string
  error?: string
}

interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
}

// ====================================
// LOOPS API
// ====================================

const LOOPS_API_BASE = "https://app.loops.so/api/v1"

/**
 * Send transactional email via Loops.so
 */
async function sendTransactionalEmail(
  transactionalId: string,
  email: string,
  dataVariables: Record<string, string | number>,
): Promise<LoopsTransactionalEmailResponse> {
  const apiKey = config.loops.apiKey

  if (!apiKey) {
    logger.warn("[Loops] API key not configured, skipping email")
    return { success: false, error: "API key not configured" }
  }

  try {
    const response = await fetch(`${LOOPS_API_BASE}/transactional`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionalId,
        email,
        dataVariables,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Loops] API error ${response.status}: ${errorText}`)
      return { success: false, error: `API error: ${response.status}` }
    }

    const result = (await response.json()) as { success: boolean; id?: string }
    logger.info(`[Loops] Transactional email sent successfully: ${result.id}`)

    return { success: true, id: result.id }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`[Loops] Failed to send email: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ====================================
// PUBLIC FUNCTIONS
// ====================================

/**
 * Send onboarding complete notification email
 *
 * Sent when lead discovery + email generation is finished
 * Helps reduce user drop-off during long onboarding process
 */
export async function sendOnboardingCompleteEmail(
  data: OnboardingCompleteEmailData,
): Promise<boolean> {
  const transactionalId = config.loops.transactionalIds.onboardingComplete

  if (!transactionalId) {
    logger.warn("[Loops] Onboarding complete transactional ID not configured")
    return false
  }

  logger.info(`[Loops] Sending onboarding complete email to ${data.email}`)

  const result = await sendTransactionalEmail(transactionalId, data.email, {
    firstName: data.firstName || "고객",
    leadCount: data.leadCount,
    emailCount: data.emailCount,
    dashboardUrl: data.dashboardUrl,
  })

  return result.success
}

/**
 * Check if Loops.so is configured
 */
export function isLoopsConfigured(): boolean {
  return !!config.loops.apiKey && !!config.loops.transactionalIds.onboardingComplete
}
