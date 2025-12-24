/**
 * Onboarding Progress Events via Redis PubSub
 *
 * Worker → Redis PubSub → API Server → SSE → Frontend
 */

import type Redis from "ioredis"
import logger from "../../utils/logger"
import { createRedisConnection } from "./connection"

// ============================================================================
// Constants
// ============================================================================

export const ONBOARDING_CHANNEL_PREFIX = "onboarding:progress:"

export function getOnboardingChannel(workspaceId: string): string {
  return `${ONBOARDING_CHANNEL_PREFIX}${workspaceId}`
}

// ============================================================================
// Types
// ============================================================================

export type OnboardingPhase =
  | "init"
  | "discovery"
  | "group"
  | "templates"
  | "sequence"
  | "previews"
  | "complete"
  | "error"

// Individual lead status for real-time display
export interface LeadProgressItem {
  leadId: string
  companyName: string
  country?: string
  status: "discovering" | "enriching" | "generating" | "done" | "error"
  email?: string
  emailCount?: number
  leadSource?: "b2b" | "apollo" | "fresh" | "revation" | "perplexity" | "hunterio-discover"
}

// Individual email for real-time display
export interface EmailProgressItem {
  emailId: string
  leadId: string
  companyName: string
  subject: string
  step: number
  status: "generating" | "done"
}

export interface OnboardingProgressEvent {
  workspaceId: string
  jobId: string
  phase: OnboardingPhase
  progressPercent: number
  details: {
    // Discovery phase
    leadsFound?: number
    leadsEnriched?: number
    currentBatch?: number
    totalBatches?: number
    // Templates phase
    templatesGenerated?: number
    totalTemplates?: number
    currentTemplate?: string
    // Previews phase
    previewsGenerated?: number
    totalPreviews?: number
    // Error info
    error?: string
    // NEW: Real-time lead/email tracking for 20-lead onboarding
    leads?: LeadProgressItem[]
    currentLead?: LeadProgressItem
    emails?: EmailProgressItem[]
    recentEmail?: EmailProgressItem
  }
  message: string
  messageKr: string
  timestamp: string
}

// ============================================================================
// Event Emitter (Worker side)
// ============================================================================

let publisherConnection: Redis | null = null

function getPublisher(): Redis {
  if (!publisherConnection) {
    publisherConnection = createRedisConnection()
    publisherConnection.on("error", (err) => {
      logger.warn({ err }, "[OnboardingEvents] Publisher connection error")
    })
  }
  return publisherConnection
}

/**
 * Emit onboarding progress event
 * Called from BullMQ worker to broadcast progress
 */
export async function emitOnboardingProgress(event: OnboardingProgressEvent): Promise<void> {
  try {
    const channel = getOnboardingChannel(event.workspaceId)
    const publisher = getPublisher()
    await publisher.publish(channel, JSON.stringify(event))
    logger.debug(
      { workspaceId: event.workspaceId, phase: event.phase, percent: event.progressPercent },
      "[OnboardingEvents] Progress emitted",
    )
  } catch (error) {
    logger.warn({ error, event }, "[OnboardingEvents] Failed to emit progress")
    // Don't throw - progress emission failure shouldn't stop the job
  }
}

// ============================================================================
// Event Subscriber (API Server side)
// ============================================================================

export interface OnboardingSubscriber {
  subscribe: (callback: (event: OnboardingProgressEvent) => void) => void
  unsubscribe: () => Promise<void>
}

/**
 * Create a subscriber for onboarding progress events
 * Used by SSE endpoint to stream events to frontend
 */
export function createOnboardingSubscriber(workspaceId: string): OnboardingSubscriber {
  const subscriberConnection = createRedisConnection()
  const channel = getOnboardingChannel(workspaceId)
  let messageCallback: ((event: OnboardingProgressEvent) => void) | null = null

  subscriberConnection.on("error", (err) => {
    logger.warn({ err, workspaceId }, "[OnboardingEvents] Subscriber connection error")
  })

  return {
    subscribe: (callback: (event: OnboardingProgressEvent) => void) => {
      messageCallback = callback

      subscriberConnection.subscribe(channel, (err) => {
        if (err) {
          logger.error({ err, workspaceId }, "[OnboardingEvents] Failed to subscribe")
        } else {
          logger.info({ workspaceId, channel }, "[OnboardingEvents] Subscribed to channel")
        }
      })

      subscriberConnection.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel && messageCallback) {
          try {
            const event = JSON.parse(message) as OnboardingProgressEvent
            messageCallback(event)
          } catch (error) {
            logger.warn({ error, message }, "[OnboardingEvents] Failed to parse event")
          }
        }
      })
    },

    unsubscribe: async () => {
      messageCallback = null
      try {
        await subscriberConnection.unsubscribe(channel)
        await subscriberConnection.quit()
        logger.info({ workspaceId, channel }, "[OnboardingEvents] Unsubscribed from channel")
      } catch (error) {
        logger.warn({ error, workspaceId }, "[OnboardingEvents] Failed to unsubscribe")
      }
    },
  }
}

// ============================================================================
// Helper Functions for Creating Events
// ============================================================================

interface CreateEventParams {
  workspaceId: string
  jobId: string
  phase: OnboardingPhase
  progressPercent: number
  message: string
  messageKr: string
  details?: OnboardingProgressEvent["details"]
}

export function createProgressEvent(params: CreateEventParams): OnboardingProgressEvent {
  return {
    workspaceId: params.workspaceId,
    jobId: params.jobId,
    phase: params.phase,
    progressPercent: params.progressPercent,
    message: params.message,
    messageKr: params.messageKr,
    details: params.details || {},
    timestamp: new Date().toISOString(),
  }
}

// Discovery phase helpers
export function createDiscoveryStartEvent(
  workspaceId: string,
  jobId: string,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent: 5,
    message: "Starting buyer search...",
    messageKr: "바이어 찾기 시작",
  })
}

export function createDiscoverySearchingEvent(
  workspaceId: string,
  jobId: string,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent: 10,
    message: "Searching database...",
    messageKr: "데이터베이스 검색 중",
  })
}

// Must match TARGET_LEADS in onboarding-worker.service.ts
const TARGET_LEADS_FOR_PROGRESS = 30

export function createDiscoveryBatchEvent(
  workspaceId: string,
  jobId: string,
  _currentBatch: number,
  _totalBatches: number,
  leadsFound: number,
  leadsEnriched: number,
): OnboardingProgressEvent {
  // 30개 목표 기준 실제 퍼센트 표시 (0% ~ 100% 범위)
  const progressPercent = Math.min(Math.round((leadsFound / TARGET_LEADS_FOR_PROGRESS) * 100), 100)

  // 진행 상황에 따른 자연스러운 메시지
  let messageKr: string
  if (leadsFound === 0) {
    messageKr = "바이어 찾고 있어요"
  } else if (leadsFound < 15) {
    messageKr = `${leadsFound}명 찾았어요`
  } else {
    messageKr = `벌써 ${leadsFound}명이에요`
  }

  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent,
    message: `Found ${leadsFound} buyers`,
    messageKr,
    details: {
      leadsFound,
      leadsEnriched,
    },
  })
}

export function createDiscoveryCompleteEvent(
  workspaceId: string,
  jobId: string,
  leadsFound: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent: 30,
    message: `Found ${leadsFound} buyers`,
    messageKr: `${leadsFound}명 다 찾았어요 ✓`,
    details: {
      leadsFound,
      leadsEnriched: leadsFound,
    },
  })
}

// Group phase helpers
export function createGroupStartEvent(workspaceId: string, jobId: string): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "group",
    progressPercent: 35,
    message: "Organizing buyer list...",
    messageKr: "리스트 정리하는 중",
  })
}

export function createGroupCompleteEvent(
  workspaceId: string,
  jobId: string,
  leadCount: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "group",
    progressPercent: 40,
    message: `${leadCount} buyers organized`,
    messageKr: `${leadCount}명 리스트 완료 ✓`,
  })
}

// Templates phase helpers
export function createTemplatesStartEvent(
  workspaceId: string,
  jobId: string,
  totalTemplates: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "templates",
    progressPercent: 45,
    message: "Writing emails...",
    messageKr: "이메일 쓰는 중",
    details: {
      templatesGenerated: 0,
      totalTemplates,
    },
  })
}

export function createTemplateProgressEvent(
  workspaceId: string,
  jobId: string,
  current: number,
  total: number,
  templateName: string,
): OnboardingProgressEvent {
  const templateProgress = (current / total) * 20 // 45% to 65%
  const templateNameKr = templateName === "introduction" ? "첫 번째" : "두 번째"
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "templates",
    progressPercent: Math.round(45 + templateProgress),
    message: `Writing email ${current} of ${total}...`,
    messageKr: `${templateNameKr} 이메일 완료`,
    details: {
      templatesGenerated: current,
      totalTemplates: total,
      currentTemplate: templateName,
    },
  })
}

export function createTemplatesCompleteEvent(
  workspaceId: string,
  jobId: string,
  totalTemplates: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "templates",
    progressPercent: 65,
    message: "Email templates ready",
    messageKr: "템플릿 준비 완료 ✓",
    details: {
      templatesGenerated: totalTemplates,
      totalTemplates,
    },
  })
}

// Sequence phase helpers
export function createSequenceStartEvent(
  workspaceId: string,
  jobId: string,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "sequence",
    progressPercent: 70,
    message: "Setting up campaign...",
    messageKr: "발송 일정 설정 중",
  })
}

export function createSequenceCompleteEvent(
  workspaceId: string,
  jobId: string,
  stepsCount: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "sequence",
    progressPercent: 75,
    message: `${stepsCount}-step campaign ready`,
    messageKr: `${stepsCount}단계 캠페인 완료 ✓`,
  })
}

// Previews phase helpers
export function createPreviewsStartEvent(
  workspaceId: string,
  jobId: string,
  totalPreviews: number,
  _leadCount?: number,
  _stepCount?: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "previews",
    progressPercent: 78,
    message: `Writing ${totalPreviews} emails...`,
    messageKr: "이메일 쓰는 중",
    details: {
      previewsGenerated: 0,
      totalPreviews,
    },
  })
}

export function createPreviewProgressEvent(
  workspaceId: string,
  jobId: string,
  generated: number,
  total: number,
  _currentStep?: number,
  _totalSteps?: number,
): OnboardingProgressEvent {
  const previewProgress = (generated / total) * 17 // 78% to 95%
  const remaining = total - generated
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "previews",
    progressPercent: Math.round(78 + previewProgress),
    message: `${generated} of ${total} emails done`,
    messageKr: `${generated}개 완료, ${remaining}개 남았어요`,
    details: {
      previewsGenerated: generated,
      totalPreviews: total,
    },
  })
}

export function createPreviewsCompleteEvent(
  workspaceId: string,
  jobId: string,
  totalPreviews: number,
  _leadCount?: number,
  _stepCount?: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "previews",
    progressPercent: 95,
    message: `${totalPreviews} emails ready`,
    messageKr: `${totalPreviews}개 이메일 완료 ✓`,
    details: {
      previewsGenerated: totalPreviews,
      totalPreviews,
    },
  })
}

// ============================================================================
// NEW: Real-time Lead/Email Progress Helpers (for 20-lead onboarding UI)
// ============================================================================

/**
 * Create event with individual lead progress for real-time UI updates
 * Used to show each lead card as it's being discovered/enriched
 */
export function createLeadDiscoveredEvent(
  workspaceId: string,
  jobId: string,
  lead: LeadProgressItem,
  allLeads: LeadProgressItem[],
  totalTarget: number,
): OnboardingProgressEvent {
  const progressPercent = Math.min(30, 5 + Math.floor((allLeads.length / totalTarget) * 25))
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent,
    message: `Found ${lead.companyName}`,
    messageKr: `${lead.companyName} 발견`,
    details: {
      leadsFound: allLeads.length,
      currentLead: lead,
      leads: allLeads,
    },
  })
}

/**
 * Create event when a lead is being enriched (email lookup)
 */
export function createLeadEnrichingEvent(
  workspaceId: string,
  jobId: string,
  lead: LeadProgressItem,
  allLeads: LeadProgressItem[],
  enrichedCount: number,
  totalTarget: number,
): OnboardingProgressEvent {
  const progressPercent = Math.min(50, 30 + Math.floor((enrichedCount / totalTarget) * 20))
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent,
    message: `Finding contact for ${lead.companyName}...`,
    messageKr: `${lead.companyName} 담당자 찾는 중`,
    details: {
      leadsFound: allLeads.length,
      leadsEnriched: enrichedCount,
      currentLead: lead,
      leads: allLeads,
    },
  })
}

/**
 * Create event when a lead enrichment is complete (has email)
 */
export function createLeadEnrichedEvent(
  workspaceId: string,
  jobId: string,
  lead: LeadProgressItem,
  allLeads: LeadProgressItem[],
  enrichedCount: number,
  totalTarget: number,
): OnboardingProgressEvent {
  const progressPercent = Math.min(55, 30 + Math.floor((enrichedCount / totalTarget) * 25))
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "discovery",
    progressPercent,
    message: `Found contact for ${lead.companyName}`,
    messageKr: `${lead.companyName} 담당자 찾았어요`,
    details: {
      leadsFound: allLeads.length,
      leadsEnriched: enrichedCount,
      currentLead: lead,
      leads: allLeads,
    },
  })
}

/**
 * Create event when email is being generated for a specific lead
 */
export function createEmailGeneratingEvent(
  workspaceId: string,
  jobId: string,
  lead: LeadProgressItem,
  allLeads: LeadProgressItem[],
  emailsGenerated: number,
  totalEmails: number,
): OnboardingProgressEvent {
  const progressPercent = Math.min(95, 55 + Math.floor((emailsGenerated / totalEmails) * 40))
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "previews",
    progressPercent,
    message: `Writing email for ${lead.companyName}...`,
    messageKr: `${lead.companyName} 이메일 쓰는 중`,
    details: {
      previewsGenerated: emailsGenerated,
      totalPreviews: totalEmails,
      currentLead: { ...lead, status: "generating" },
      leads: allLeads,
    },
  })
}

/**
 * Create event when email is generated for a specific lead
 */
export function createEmailGeneratedEvent(
  workspaceId: string,
  jobId: string,
  lead: LeadProgressItem,
  email: EmailProgressItem,
  allLeads: LeadProgressItem[],
  allEmails: EmailProgressItem[],
  totalEmails: number,
): OnboardingProgressEvent {
  const progressPercent = Math.min(95, 55 + Math.floor((allEmails.length / totalEmails) * 40))
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "previews",
    progressPercent,
    message: `Email ready for ${lead.companyName}`,
    messageKr: `${lead.companyName} 이메일 완료 ✓`,
    details: {
      previewsGenerated: allEmails.length,
      totalPreviews: totalEmails,
      currentLead: { ...lead, status: "done", emailCount: (lead.emailCount || 0) + 1 },
      recentEmail: email,
      leads: allLeads,
      emails: allEmails.slice(-10), // Keep last 10 emails for UI
    },
  })
}

/**
 * Create complete event with all leads and emails summary
 */
export function createCompleteWithDetailsEvent(
  workspaceId: string,
  jobId: string,
  leads: LeadProgressItem[],
  emails: EmailProgressItem[],
): OnboardingProgressEvent {
  const leadsWithEmail = leads.filter((l) => l.status === "done").length
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "complete",
    progressPercent: 100,
    message: `Done! ${leadsWithEmail} buyers, ${emails.length} emails`,
    messageKr: `다 됐어요! 바이어 ${leadsWithEmail}명, 이메일 ${emails.length}개 준비 완료`,
    details: {
      leadsFound: leadsWithEmail,
      previewsGenerated: emails.length,
      totalPreviews: emails.length,
      leads: leads,
      emails: emails.slice(-20), // Last 20 for reference
    },
  })
}

// Complete phase helpers
export function createCompleteEvent(
  workspaceId: string,
  jobId: string,
  leadsCount: number,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "complete",
    progressPercent: 100,
    message: `Done! ${leadsCount} buyers ready`,
    messageKr: `다 됐어요! 바이어 ${leadsCount}명 준비 완료`,
    details: {
      leadsFound: leadsCount,
    },
  })
}

// Error helper
export function createErrorEvent(
  workspaceId: string,
  jobId: string,
  error: string,
  _phase: OnboardingPhase,
): OnboardingProgressEvent {
  return createProgressEvent({
    workspaceId,
    jobId,
    phase: "error",
    progressPercent: -1,
    message: "Something went wrong. Please try again.",
    messageKr: "잠깐 문제가 생겼어요. 다시 시도해 주세요",
    details: {
      error,
    },
  })
}

// ============================================================================
// Cleanup
// ============================================================================

export async function closePublisher(): Promise<void> {
  if (publisherConnection) {
    await publisherConnection.quit()
    publisherConnection = null
    logger.info("[OnboardingEvents] Publisher connection closed")
  }
}
