/**
 * Onboarding Worker Service
 *
 * BullMQ worker service for auto-generate onboarding
 * Handles phase-based execution with BullMQ native job state
 * Emits real-time progress events via Redis PubSub → SSE
 */

import type { Job } from "bullmq"
import { and, count, eq, inArray, isNotNull } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { subscriptions } from "../db/schema/billing"
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads as leadsTable } from "../db/schema/leads"
import { onboardingProgress } from "../db/schema/onboarding"
import { sequenceSteps, sequences } from "../db/schema/sequences"
import { workspaces } from "../db/schema/workspaces"
import type { OnboardingAutoGenerateJob, OnboardingAutoGenerateResult } from "../lib/queue/types"
import {
  createCompleteEventWithSummary,
  createDiscoverySearchingEvent,
  createDiscoveryStartEvent,
  createErrorEvent,
  createGroupCompleteEvent,
  createGroupStartEvent,
  createPreviewsStartEvent,
  createSequenceCompleteEvent,
  createSequenceStartEvent,
  createTemplateProgressEvent,
  createTemplatesCompleteEvent,
  createTemplatesStartEvent,
  createTemplatesWritingEvent,
  type EmailProgressItem,
  emitOnboardingProgress,
  type LeadProgressItem,
  type OnboardingProgressEvent,
} from "../lib/redis/onboarding-events"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { type ProgressEvent as BuyerSearchProgress, searchBuyers } from "./buyer-search"
import { PHASE_PROGRESS_RANGES } from "./buyer-search/constants"
import { buyersToLeadDataArray, toBuyerSearchInput } from "./buyer-search/utils/onboarding-adapter"
import { createCustomerGroup } from "./customer-group.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { isLoopsConfigured, sendOnboardingCompleteEmail } from "./loops.service"
import { upsertOnboardingProgressNotification } from "./notification.service"
import {
  completeStep1CompanyInfo,
  completeStep2LeadSearch,
  EMAIL_TYPES_3TOUCH,
  generatePreviewEmailsForSequence,
  KST_OFFSET_MS,
} from "./onboarding.service"
import {
  generateIntelligenceSummary,
  generateOnboardingSummary,
  generateScoringSummary,
  generateSearchSummary,
} from "./onboarding-summary.service"
import { createSequence, createSequenceStep } from "./sequence.service"
import { getUser } from "./user.service"
import * as workspaceServiceImport from "./workspace.service"

// ====================================
// CONSTANTS
// ====================================

const TARGET_LEADS = 30 // 30 leads for optimized search

// ====================================
// SSE + DB NOTIFICATION WRAPPER
// ====================================

/**
 * Emit SSE event and optionally save notification to DB
 *
 * NEW: 최적화된 알림 전략
 * - 모든 이벤트: Redis PubSub → SSE (실시간) + Redis 캐시 (재접속)
 * - 완료/에러 이벤트만: DB 저장 (히스토리/영속성)
 *
 * 이유:
 * - 진행 중 이벤트는 실시간 SSE로 충분 (DB 저장 불필요)
 * - 완료/에러만 DB에 저장하면 알림 스팸 방지 + DB 부하 감소
 * - Redis 캐시로 페이지 새로고침 시에도 상태 복원 가능
 */
async function emitAndSaveNotification(
  event: OnboardingProgressEvent,
  userId: string,
): Promise<void> {
  console.log(
    `[OnboardingWorker] emitAndSaveNotification - phase: ${event.phase}, percent: ${event.progressPercent}%, workspaceId: ${event.workspaceId}`,
  )

  // 1. Always emit SSE event for real-time updates (also caches in Redis)
  await emitOnboardingProgress(event)

  // 2. Only save to DB on complete/error phases (for notification history)
  const shouldSaveToDb = event.phase === "complete" || event.phase === "error"

  if (shouldSaveToDb) {
    try {
      const notification = await upsertOnboardingProgressNotification(userId, event)
      console.log(
        `[OnboardingWorker] Notification saved to DB - id: ${notification.id}, type: ${notification.type}, phase: ${event.phase}`,
      )
    } catch (error) {
      console.error("[OnboardingWorker] Failed to save notification to DB:", error)
      console.error("[OnboardingWorker] Event data:", JSON.stringify(event, null, 2))
    }
  }
}

// ====================================
// TYPES
// ====================================

export interface CheckpointState {
  phase: "init" | "discovery" | "group" | "templates" | "sequence" | "previews" | "complete"
  leadsWithEmailsCount: number
  lastIterationCompleted: boolean
  customerGroupId?: string
  sequenceId?: string
  // Templates phase state (for idempotency)
  generatedTemplates?: Array<{
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string
  }>
  // NEW: Buyer personas for summary generation
  buyerPersonas?: Array<{
    type: string
    typeKo?: string
    description?: string
  }>
  errors: Array<{
    phase: string
    message: string
    timestamp: string
  }>
}

export interface JobContext {
  workspaceId: string
  userId: string
  surveyData: {
    industry: string
    target: string
    country: string
    experience: string
    lang?: string
  }
}

// ====================================
// CHECKPOINT MANAGEMENT (BullMQ Native)
// ====================================

/**
 * Load checkpoint state from job data
 */
export function loadCheckpoint(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
): CheckpointState {
  const defaultState: CheckpointState = {
    phase: "init",
    leadsWithEmailsCount: 0,
    lastIterationCompleted: false,
    errors: [],
  }

  // BullMQ stores checkpoint in job.data.checkpoint
  const checkpoint = job.data.checkpoint as Partial<CheckpointState> | undefined

  if (!checkpoint) {
    return defaultState
  }

  return {
    ...defaultState,
    ...checkpoint,
  }
}

/**
 * Save checkpoint state to job data using BullMQ's updateData()
 */
export async function saveCheckpoint(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  checkpoint: Partial<CheckpointState>,
): Promise<void> {
  // Load existing checkpoint
  const existing = loadCheckpoint(job)

  // Merge with new checkpoint
  const updated = {
    ...existing,
    ...checkpoint,
  }

  // Persist to Redis via BullMQ's updateData()
  await job.updateData({
    ...job.data,
    checkpoint: updated,
  })
}

/**
 * Count leads with emails in workspace (base case check)
 */
export async function countLeadsWithEmails(workspaceId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(leadsTable)
    .innerJoin(leadContacts, eq(leadsTable.id, leadContacts.leadId))
    .where(
      and(
        eq(leadsTable.workspaceId, workspaceId),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true),
        isNotNull(leadContacts.contactValue),
      ),
    )

  return result[0]?.value ?? 0
}

/**
 * Add error to checkpoint
 */
export async function addCheckpointError(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  phase: string,
  message: string,
): Promise<void> {
  const checkpoint = loadCheckpoint(job)
  checkpoint.errors.push({
    phase,
    message,
    timestamp: new Date().toISOString(),
  })
  await saveCheckpoint(job, { errors: checkpoint.errors })
}

// ====================================
// PHASE FUNCTIONS
// ====================================

/**
 * Phase 1: Discovery + Enrichment (combined)
 * Discovers leads using the new buyer-search service
 * Uses AI-powered multi-source search (Perplexity, Apollo, Serper, etc.)
 */
export async function runDiscoveryPhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
): Promise<{
  leadIds: string[]
  count: number
}> {
  const { workspaceId, userId, surveyData } = context
  const jobId = job.id || "unknown"

  console.log(`[DiscoveryPhase] Starting for workspace ${workspaceId}`)

  // Emit SSE + Save to DB: Discovery started
  await emitAndSaveNotification(createDiscoveryStartEvent(workspaceId, jobId), userId)

  try {
    // Base case: Check if we already have TARGET_LEADS+ leads with emails
    const currentLeadsCount = await countLeadsWithEmails(workspaceId)
    if (currentLeadsCount >= TARGET_LEADS) {
      console.log(
        `[DiscoveryPhase] Base case: Already have ${currentLeadsCount} leads with emails, exiting early`,
      )

      // Get lead IDs for group assignment
      const existingLeads = await db
        .select({
          id: leadsTable.id,
        })
        .from(leadsTable)
        .innerJoin(leadContacts, eq(leadsTable.id, leadContacts.leadId))
        .where(
          and(
            eq(leadsTable.workspaceId, workspaceId),
            eq(leadContacts.contactType, "email"),
            eq(leadContacts.isPrimary, true),
            isNotNull(leadContacts.contactValue),
          ),
        )
        .limit(TARGET_LEADS)

      const leadIds = existingLeads.map((l) => l.id)

      // Update checkpoint
      await saveCheckpoint(job, {
        leadsWithEmailsCount: currentLeadsCount,
        lastIterationCompleted: true,
      })

      return {
        leadIds,
        count: currentLeadsCount,
      }
    }

    // 🆕 Fetch workspace to get companyDescription for targeted search
    const workspace = await workspaceServiceImport.getWorkspace(workspaceId)
    const companyName = workspace?.companyName || workspace?.name || "My Company"
    const companyNameEn = workspace?.companyNameEn || undefined
    const companyDescription =
      workspace?.companyDescription && workspace.companyDescription !== "기본 워크스페이스"
        ? workspace.companyDescription
        : workspace?.description && workspace.description !== "기본 워크스페이스"
          ? workspace.description
          : undefined

    console.log(
      `[DiscoveryPhase] Company: "${companyName}", Description: "${companyDescription?.slice(0, 50) || "N/A"}..."`,
    )

    // Update checkpoint in BullMQ job data
    await saveCheckpoint(job, {
      phase: "discovery",
    })

    // Report progress to keep job alive (extends lock)
    await job.updateProgress({
      phase: "discovery",
      progressPercent: PHASE_PROGRESS_RANGES.intelligence.start,
    })

    // Emit SSE: Database searching
    await emitAndSaveNotification(createDiscoverySearchingEvent(workspaceId, jobId), userId)

    // 🆕 Convert survey data to buyer-search input format
    const buyerSearchInput = toBuyerSearchInput(surveyData, {
      companyName,
      companyNameEn,
      companyDescription,
    })

    console.log(`[DiscoveryPhase] BuyerSearch input:`, JSON.stringify(buyerSearchInput, null, 2))

    // 🆕 실시간 리드 업데이트를 위한 임시 저장소
    const scoredLeadsMap = new Map<string, LeadProgressItem>()
    let scoredLeadIndex = 0

    // 🆕 Use the new buyer-search service with progress callback
    const searchResult = await searchBuyers(
      buyerSearchInput,
      async (progress: BuyerSearchProgress) => {
        console.log(`[DiscoveryPhase] Progress: ${progress.phase} - ${progress.message}`)

        // Map buyer-search progress to discovery percent
        const discoveryPercent = progress.progress

        await job.updateProgress({
          phase: "discovery",
          progressPercent: discoveryPercent,
        })

        const isKorean = surveyData.lang === "ko"

        // 🆕 스코어링된 회사 실시간 업데이트
        if (progress.scoredCompany) {
          const scored = progress.scoredCompany
          scoredLeadIndex++

          // 스코어링된 리드 정보 저장
          const hasExistingLead = scoredLeadsMap.has(scored.companyName)
          if (!hasExistingLead && scoredLeadsMap.size >= TARGET_LEADS) {
            // Limit SSE lead updates to final target count
            // Continue to emit general progress below without lead details
          } else {
            const leadProgress: LeadProgressItem = {
              leadId: `scoring-${scoredLeadIndex}`,
              companyName: scored.companyName,
              country: scored.country,
              status: "done" as const,
              email: scored.email,
              leadSource: "perplexity" as const,
              score: scored.score,
              description: scored.description,
            }
            scoredLeadsMap.set(scored.companyName, leadProgress)

            // 스코어링된 리드 즉시 emit (실시간 UI 업데이트)
            const allScoredLeads = Array.from(scoredLeadsMap.values())
            await emitAndSaveNotification(
              {
                workspaceId,
                jobId,
                phase: "discovery",
                progressPercent: discoveryPercent,
                message: isKorean
                  ? `${scored.companyName} 평가 완료 (${scored.score}점)`
                  : `Scored ${scored.companyName} (${scored.score})`,
                messageKr: `${scored.companyName} 평가 완료 (${scored.score}점)`,
                details: {
                  leadsFound: allScoredLeads.length,
                  currentLead: leadProgress,
                  leads: allScoredLeads,
                },
                parallelProgress: {
                  discovery: { percent: discoveryPercent, done: discoveryPercent >= 100 },
                  templates: { percent: 50, done: false },
                },
                reasoning: progress.reasoning,
                timestamp: new Date().toISOString(),
              },
              userId,
            )
            return
          }
        }

        // Emit SSE event with reasoning from buyer-search
        await emitAndSaveNotification(
          {
            workspaceId,
            jobId,
            phase: "discovery",
            progressPercent: discoveryPercent,
            message: isKorean ? progress.messageKr || progress.message : progress.message,
            messageKr: progress.messageKr || progress.message,
            details: {},
            // 병렬 실행 정보: Discovery 진행 중, Templates는 병렬로 실행 중
            parallelProgress: {
              discovery: { percent: discoveryPercent, done: discoveryPercent >= 100 },
              templates: { percent: 50, done: false }, // 병렬 실행 중이므로 50%로 표시
            },
            // AI reasoning 정보 전달
            reasoning: progress.reasoning,
            timestamp: new Date().toISOString(),
          },
          userId,
        )
      },
    )

    console.log(`[DiscoveryPhase] Search complete. Found ${searchResult.buyers.length} buyers`)
    console.log(`[DiscoveryPhase]   - Total searched: ${searchResult.metadata.totalSearched}`)
    console.log(`[DiscoveryPhase]   - With emails: ${searchResult.metadata.totalWithEmail}`)
    console.log(`[DiscoveryPhase]   - Sources: ${searchResult.metadata.sources.join(", ")}`)
    console.log(`[DiscoveryPhase]   - Search time: ${searchResult.metadata.searchTimeSeconds}s`)

    // 🆕 Generate Phase 1 (Intelligence) summary if personas were generated
    if (searchResult.buyerPersonas.length > 0) {
      try {
        console.log(
          `[DiscoveryPhase] Generating intelligence summary for ${searchResult.buyerPersonas.length} personas`,
        )
        const intelligenceSummary = await generateIntelligenceSummary({
          companyName,
          companyDescription,
          buyerPersonas: searchResult.buyerPersonas,
          locale: surveyData.lang === "en" ? "en" : "ko",
        })

        // Emit intelligence summary as a phase summary
        await emitAndSaveNotification(
          {
            workspaceId,
            jobId,
            phase: "discovery",
            progressPercent: PHASE_PROGRESS_RANGES.intelligence.end,
            message: "Buyer persona analysis complete",
            messageKr: "바이어 페르소나 분석 완료",
            details: {},
            reasoning: {
              step: "Generated buyer personas",
              stepKr: "바이어 페르소나를 생성했어요",
            },
            phaseSummary: {
              phase: "intelligence",
              summary: intelligenceSummary,
              metadata: {
                personaCount: searchResult.buyerPersonas.length,
              },
            },
            timestamp: new Date().toISOString(),
          },
          userId,
        )
        console.log(`[DiscoveryPhase] Intelligence summary emitted`)
      } catch (error) {
        console.error(`[DiscoveryPhase] Failed to generate intelligence summary:`, error)
        // Continue without summary - non-critical
      }
    }

    // 🆕 Generate Phase 2 (Search) summary
    if (searchResult.buyers.length > 0) {
      try {
        // Build country distribution from search results
        const countryDistribution: Record<string, number> = {}
        const industryDistribution: Record<string, number> = {}
        for (const buyer of searchResult.buyers) {
          if (buyer.country) {
            countryDistribution[buyer.country] = (countryDistribution[buyer.country] || 0) + 1
          }
          if (buyer.industry) {
            industryDistribution[buyer.industry] = (industryDistribution[buyer.industry] || 0) + 1
          }
        }

        const searchSummary = await generateSearchSummary({
          companyName,
          totalFound: searchResult.buyers.length,
          countryDistribution,
          industryDistribution,
          locale: surveyData.lang === "en" ? "en" : "ko",
        })

        // Emit search summary as a phase summary
        await emitAndSaveNotification(
          {
            workspaceId,
            jobId,
            phase: "discovery",
            progressPercent: PHASE_PROGRESS_RANGES.search_perplexity.end,
            message: `Found ${searchResult.buyers.length} buyers`,
            messageKr: `${searchResult.buyers.length}명의 바이어를 찾았어요`,
            details: {
              leadsFound: searchResult.buyers.length,
            },
            reasoning: {
              step: `Found ${searchResult.buyers.length} buyers`,
              stepKr: `${searchResult.buyers.length}명의 바이어를 찾았어요`,
            },
            phaseSummary: {
              phase: "search",
              summary: searchSummary,
              metadata: {
                buyerCount: searchResult.buyers.length,
                countryDistribution,
              },
            },
            timestamp: new Date().toISOString(),
          },
          userId,
        )
        console.log(`[DiscoveryPhase] Search summary emitted`)
      } catch (error) {
        console.error(`[DiscoveryPhase] Failed to generate search summary:`, error)
        // Continue without summary - non-critical
      }
    }

    // 🆕 Generate Phase 4 (Scoring) summary
    if (searchResult.buyers.length > 0) {
      try {
        // Prepare scored buyers data
        const scoredBuyers = searchResult.buyers
          .filter((b) => b.score !== undefined)
          .slice(0, 10)
          .map((b) => ({
            companyName: b.companyName,
            score: b.score || 0,
            reason: b.description || "",
          }))

        // Calculate average score
        const scores = searchResult.buyers
          .map((b) => b.score)
          .filter((s): s is number => s !== undefined)
        const averageScore =
          scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

        if (scoredBuyers.length > 0) {
          const scoringSummary = await generateScoringSummary({
            companyName,
            scoredBuyers,
            averageScore,
            locale: surveyData.lang === "en" ? "en" : "ko",
          })

          // Emit scoring summary as a phase summary
          await emitAndSaveNotification(
            {
              workspaceId,
              jobId,
              phase: "discovery",
              progressPercent: PHASE_PROGRESS_RANGES.scoring.end,
              message: `Evaluated ${scoredBuyers.length} buyers`,
              messageKr: `${scoredBuyers.length}명의 바이어를 평가했어요`,
              details: {
                leadsFound: searchResult.buyers.length,
              },
              reasoning: {
                step: `Evaluated ${scoredBuyers.length} buyers`,
                stepKr: `${scoredBuyers.length}명의 바이어를 평가했어요`,
              },
              phaseSummary: {
                phase: "scoring",
                summary: scoringSummary,
                metadata: {
                  buyerCount: scoredBuyers.length,
                  averageScore,
                },
              },
              timestamp: new Date().toISOString(),
            },
            userId,
          )
          console.log(`[DiscoveryPhase] Scoring summary emitted`)
        }
      } catch (error) {
        console.error(`[DiscoveryPhase] Failed to generate scoring summary:`, error)
        // Continue without summary - non-critical
      }
    }

    // 🆕 Convert buyers to lead format using adapter
    const leadsToCreate = buyersToLeadDataArray(searchResult.buyers)

    // 🆕 Emit found buyers immediately (before DB save) for real-time UI update
    const preliminaryLeads: LeadProgressItem[] = searchResult.buyers
      .slice(0, TARGET_LEADS)
      .map((buyer, index) => ({
        leadId: `pending-${index}`,
        companyName: buyer.companyName,
        country: buyer.country,
        status: "done" as const,
        email: buyer.email,
        leadSource: "perplexity" as const,
        score: buyer.score, // LLM 평가 점수 (0-100)
        description: buyer.description, // 회사 설명
      }))

    console.log(
      `[DiscoveryPhase] 🆕 Emitting ${preliminaryLeads.length} leads via SSE:`,
      JSON.stringify(preliminaryLeads.slice(0, 3), null, 2),
    )

    await emitAndSaveNotification(
      {
        workspaceId,
        jobId,
        phase: "discovery",
        progressPercent: 28,
        message: `Found ${preliminaryLeads.length} buyers`,
        messageKr: `${preliminaryLeads.length}명의 바이어를 찾았어요`,
        details: {
          leadsFound: preliminaryLeads.length,
          leads: preliminaryLeads,
        },
        timestamp: new Date().toISOString(),
      },
      userId,
    )

    console.log(`[DiscoveryPhase] Saving ${leadsToCreate.length} leads to database`)

    const { stats, createdLeads } = await bulkCreateLeads({
      workspaceId,
      leads: leadsToCreate,
      createdBy: userId,
    })

    console.log(`[DiscoveryPhase] Saved ${stats.created} new leads (${stats.skipped} duplicates)`)

    // 🆕 Emit saved leads with real IDs for UI update
    // Map createdLeads to find corresponding buyer data for email
    const savedLeadsProgress: LeadProgressItem[] = createdLeads
      .slice(0, TARGET_LEADS)
      .map((lead) => {
        // Find matching buyer from original search results by company name
        const matchingBuyer = searchResult.buyers.find(
          (b) => b.companyName === lead.companyName || b.website === lead.websiteUrl,
        )
        return {
          leadId: lead.id,
          companyName: lead.companyName || "Unknown",
          country: lead.country || undefined,
          status: "done" as const,
          email: matchingBuyer?.email || undefined,
          leadSource: "perplexity" as const,
          score: matchingBuyer?.score, // LLM 평가 점수 (0-100)
          description: matchingBuyer?.description, // 회사 설명
        }
      })

    // Extract lead IDs from created leads
    const leadIds = createdLeads.map((lead) => lead.id)

    // 🆕 Use AI-generated buyer personas from searchResult
    const buyerPersonas = searchResult.buyerPersonas.map((p) => ({
      type: p.type,
      typeKo: p.typeKo,
      description: p.description,
    }))

    // Update checkpoint with final count and personas
    const finalCount = await countLeadsWithEmails(workspaceId)
    await saveCheckpoint(job, {
      leadsWithEmailsCount: finalCount,
      lastIterationCompleted: true,
      buyerPersonas, // 🆕 Store personas for summary generation
    })

    console.log(
      `[DiscoveryPhase] Complete: ${finalCount} leads with emails, returning ${leadIds.length} IDs`,
    )

    // Emit SSE + Save to DB: Discovery complete (with leads array for UI)
    await emitAndSaveNotification(
      {
        workspaceId,
        jobId,
        phase: "discovery",
        progressPercent: 30,
        message: `${finalCount} buyers saved`,
        messageKr: `${finalCount}명 다 찾았어요 ✓`,
        details: {
          leadsFound: finalCount,
          leadsEnriched: finalCount,
          leads: savedLeadsProgress,
        },
        timestamp: new Date().toISOString(),
      },
      userId,
    )

    return {
      leadIds,
      count: finalCount,
    }
  } catch (error) {
    console.error("[DiscoveryPhase] Error:", error)
    await addCheckpointError(job, "discovery", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "discovery"),
      userId,
    )
    throw error
  }
}

/**
 * Phase 2: Customer Group Creation
 */
export async function runGroupPhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
  leadIds: string[],
): Promise<string> {
  const { workspaceId, userId, surveyData } = context
  const jobId = job.id || "unknown"
  const isKorean = surveyData.lang === "ko"
  const leadCount = leadIds.length

  console.log(`[GroupPhase] Creating customer group for ${leadCount} leads`)

  // Emit SSE + Save to DB: Group started
  await emitAndSaveNotification(createGroupStartEvent(workspaceId, jobId), userId)

  try {
    await saveCheckpoint(job, { phase: "group" })

    // Check if customer group already exists (idempotency)
    const checkpoint = loadCheckpoint(job)
    if (checkpoint.customerGroupId) {
      console.log(
        `[GroupPhase] Customer group already exists: ${checkpoint.customerGroupId}, verifying...`,
      )

      // Verify the group exists in DB
      const existingGroup = await db
        .select({ id: customerGroups.id })
        .from(customerGroups)
        .where(eq(customerGroups.id, checkpoint.customerGroupId))
        .limit(1)

      if (existingGroup.length > 0) {
        console.log(`[GroupPhase] Reusing existing customer group ${checkpoint.customerGroupId}`)
        return checkpoint.customerGroupId
      } else {
        console.log(
          `[GroupPhase] Customer group ${checkpoint.customerGroupId} not found in DB, clearing invalid ID and creating new one`,
        )
        // Clear invalid ID from checkpoint before creating new one
        await saveCheckpoint(job, { customerGroupId: undefined })
      }
    }

    const customerGroup = await createCustomerGroup({
      workspaceId,
      name: isKorean ? "데모 리드 그룹" : "Demo Lead Group",
      description:
        leadCount > 0
          ? isKorean
            ? `트라이얼 가입 시 자동 생성된 리드 그룹 (${leadCount}개 리드 포함)`
            : `Lead group auto-generated during trial signup (${leadCount} leads included)`
          : isKorean
            ? "트라이얼 가입 시 자동 생성된 리드 그룹. 리드 탐색에서 리드를 추가하세요."
            : "Lead group auto-generated during trial signup. Add leads from Lead Discovery.",
      createdBy: userId,
    })

    if (!customerGroup) {
      throw new Error("Failed to create customer group")
    }

    console.log(`[GroupPhase] Created customer group ${customerGroup.id}`)

    // Save checkpoint immediately after creation
    await saveCheckpoint(job, { customerGroupId: customerGroup.id })

    // Add leads to group
    if (leadIds.length > 0) {
      await bulkAddLeadsToCustomerGroup(leadIds, customerGroup.id, userId)
      console.log(`[GroupPhase] Added ${leadIds.length} leads to group`)
    }

    // Emit SSE + Save to DB: Group complete
    await emitAndSaveNotification(
      createGroupCompleteEvent(workspaceId, jobId, leadIds.length),
      userId,
    )

    return customerGroup.id
  } catch (error) {
    console.error("[GroupPhase] Error:", error)
    await addCheckpointError(job, "group", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "group"),
      userId,
    )
    throw error
  }
}

/**
 * Phase 3: Email Template Generation
 */
export async function runTemplatesPhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
): Promise<
  Array<{
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string
  }>
> {
  const { workspaceId, userId, surveyData } = context
  const jobId = job.id || "unknown"
  const isKorean = surveyData.lang === "ko"

  console.log("[TemplatesPhase] Generating email templates")

  // Emit SSE + Save to DB: Templates started
  const templatesNeeded = EMAIL_TYPES_3TOUCH.length
  await emitAndSaveNotification(
    createTemplatesStartEvent(workspaceId, jobId, templatesNeeded),
    userId,
  )

  // 🆕 Emit Templates reasoning event (AI 스타일 진행 표시)
  await emitAndSaveNotification(createTemplatesWritingEvent(workspaceId, jobId), userId)

  try {
    await saveCheckpoint(job, { phase: "templates" })

    // Check if templates already exist in checkpoint (idempotency)
    const checkpoint = loadCheckpoint(job)
    if (checkpoint.generatedTemplates && checkpoint.generatedTemplates.length > 0) {
      console.log(
        `[TemplatesPhase] Reusing ${checkpoint.generatedTemplates.length} cached templates from checkpoint`,
      )
      return checkpoint.generatedTemplates
    }

    // Get workspace info
    const workspace = await workspaceServiceImport.getWorkspace(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const templatesNeeded = EMAIL_TYPES_3TOUCH.length
    console.log(`[TemplatesPhase] Generating ${templatesNeeded} templates (3-touch sequence)`)

    const aiService = getAITemplateGenerationService()
    const totalTemplates = templatesNeeded

    // Use companyName and companyDescription if available, fallback to workspace name/description
    // Filter out default values like "기본 워크스페이스" that don't provide useful context
    const effectiveDescription =
      workspace.companyDescription && workspace.companyDescription !== "기본 워크스페이스"
        ? workspace.companyDescription
        : workspace.description && workspace.description !== "기본 워크스페이스"
          ? workspace.description
          : undefined

    // 🆕 Batch generation: 모든 이메일을 병렬로 생성 (순차 대비 3배 빠름)
    const industryContext = isKorean
      ? `${surveyData.industry} 산업의 ${surveyData.target} 고객을 대상으로`
      : `for ${surveyData.target} customers in the ${surveyData.industry} industry`

    const emailConfigs = EMAIL_TYPES_3TOUCH.map((emailType, i) => {
      const prompt = isKorean ? emailType.promptKr : emailType.promptEn
      return {
        userPrompt: `${prompt} ${industryContext}`,
        stepNumber: i + 1,
        totalSteps: templatesNeeded,
        stepType: emailType.type as "introduction" | "follow_up_1" | "follow_up_2",
      }
    })

    // Report progress to keep job alive
    await job.updateProgress({
      phase: "templates",
      templatesGenerated: 0,
      progressPercent: 65,
    })

    const generatedTemplates = await aiService.generateEmailTemplatesBatch({
      workspaceName: workspace.companyName || workspace.name,
      workspaceNameEn: workspace.companyNameEn || undefined,
      workspaceDescription: effectiveDescription,
      country: surveyData.country,
      emailConfigs,
    })

    // Map generated templates to expected format and emit progress
    const templates = generatedTemplates.map((template, i) => {
      const emailType = EMAIL_TYPES_3TOUCH[i]
      if (!emailType) throw new Error(`Missing email type at index ${i}`)

      console.log(
        `[TemplatesPhase] Generated template ${i + 1}/${templatesNeeded}: ${emailType.type}`,
      )

      // Emit SSE + Save to DB: Template progress (async, don't block)
      emitAndSaveNotification(
        createTemplateProgressEvent(workspaceId, jobId, i + 1, totalTemplates, emailType.type),
        userId,
      ).catch((err) => console.error(`[TemplatesPhase] Failed to emit progress event:`, err))

      return {
        stepOrder: i + 1,
        delayDays: emailType.delayDays,
        emailSubject: template.subject,
        emailBodyText: template.bodyText,
        emailBodyHtml: template.bodyHtml,
      }
    })

    // Save checkpoint with all templates
    await saveCheckpoint(job, { generatedTemplates: templates })

    if (templates.length === 0) {
      throw new Error("No templates generated")
    }

    console.log(`[TemplatesPhase] Generated ${templates.length} templates`)

    // 🆕 SSE용 steps 데이터 (임시 ID 포함)
    const sseSteps = templates.map((t, i) => ({
      id: `temp-step-${i + 1}`, // 임시 ID (sequence 생성 전)
      stepOrder: t.stepOrder,
      delayDays: t.delayDays,
      emailSubject: t.emailSubject,
      emailBodyText: t.emailBodyText,
      emailBodyHtml: t.emailBodyHtml,
    }))

    // Emit SSE + Save to DB: Templates complete (with steps data for immediate display)
    await emitAndSaveNotification(
      createTemplatesCompleteEvent(workspaceId, jobId, templates.length, sseSteps),
      userId,
    )

    // 🆕 Emit Templates complete reasoning event (activePhase 전환)
    // await emitAndSaveNotification(
    //   createTemplatesCompleteReasoningEvent(workspaceId, jobId, templates.length),
    //   userId,
    // )

    // Save final templates to checkpoint
    await saveCheckpoint(job, { generatedTemplates: templates })

    return templates
  } catch (error) {
    console.error("[TemplatesPhase] Error:", error)
    await addCheckpointError(job, "templates", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "templates"),
      userId,
    )
    throw error
  }
}

/**
 * Phase 4: Sequence Creation
 */
export async function runSequencePhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
  customerGroupId: string,
  leadIds: string[],
  templates: Array<{
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string
  }>,
): Promise<{
  sequenceId: string
  steps: Array<{
    stepId: string
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string | null
  }>
}> {
  const { workspaceId, userId, surveyData } = context
  const jobId = job.id || "unknown"
  const isKorean = surveyData.lang === "ko"

  console.log("[SequencePhase] Creating sequence and steps")

  // Emit SSE + Save to DB: Sequence started
  await emitAndSaveNotification(createSequenceStartEvent(workspaceId, jobId), userId)

  try {
    await saveCheckpoint(job, { phase: "sequence" })

    // Check if sequence already exists (idempotency)
    const checkpoint = loadCheckpoint(job)
    if (checkpoint.sequenceId) {
      console.log(`[SequencePhase] Sequence already exists: ${checkpoint.sequenceId}, verifying...`)

      // Verify the sequence exists in DB
      const existingSequence = await db
        .select({ id: sequences.id })
        .from(sequences)
        .where(eq(sequences.id, checkpoint.sequenceId))
        .limit(1)

      if (existingSequence.length > 0) {
        console.log(`[SequencePhase] Reusing existing sequence ${checkpoint.sequenceId}`)

        // Fetch existing steps
        const existingSteps = await db
          .select()
          .from(sequenceSteps)
          .where(eq(sequenceSteps.sequenceId, checkpoint.sequenceId))
          .orderBy(sequenceSteps.stepOrder)

        const steps = existingSteps.map((s) => ({
          stepId: s.id,
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          emailSubject: s.emailSubject || "",
          emailBodyText: s.emailBodyText || "",
          emailBodyHtml: s.emailBodyHtml,
        }))

        console.log(`[SequencePhase] Found ${steps.length} existing steps`)

        return {
          sequenceId: checkpoint.sequenceId,
          steps,
        }
      } else {
        console.log(
          `[SequencePhase] Sequence ${checkpoint.sequenceId} not found in DB, clearing invalid ID and creating new one`,
        )
        // Clear invalid ID from checkpoint before creating new one
        await saveCheckpoint(job, { sequenceId: undefined })
      }
    }

    // Create sequence
    const sequence = await createSequence({
      workspaceId,
      name: isKorean ? "데모 이메일 시퀀스" : "Demo Email Sequence",
      description:
        leadIds.length > 0
          ? isKorean
            ? `트라이얼 가입 시 자동 생성된 데모 시퀀스 (${leadIds.length}개 리드 포함)`
            : `Demo sequence auto-generated during trial signup (${leadIds.length} leads included)`
          : isKorean
            ? "트라이얼 가입 시 자동 생성된 데모 시퀀스. 리드를 추가한 후 실행하세요."
            : "Demo sequence auto-generated during trial signup. Add leads before running.",
      status: leadIds.length > 0 ? "ready" : "draft",
      customerGroupId,
      createdBy: userId,
      selectedLeadIds: leadIds.length > 0 ? leadIds : undefined,
    })

    if (!sequence) {
      throw new Error("Failed to create sequence")
    }

    console.log(`[SequencePhase] Created sequence ${sequence.id}`)

    // Save checkpoint immediately after sequence creation
    await saveCheckpoint(job, { sequenceId: sequence.id })

    // Create sequence steps
    const now = new Date()
    const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
    const scheduledHour = kstNow.getUTCHours()
    const scheduledMinute = Math.min(59, kstNow.getUTCMinutes() + 2)

    const createdSteps: Array<{
      stepId: string
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string | null
    }> = []

    for (const template of templates) {
      const step = await createSequenceStep({
        sequenceId: sequence.id,
        stepOrder: template.stepOrder,
        delayDays: template.delayDays,
        scheduledHour,
        scheduledMinute,
        emailSubject: template.emailSubject,
        emailBodyText: template.emailBodyText,
        emailBodyHtml: template.emailBodyHtml,
        generationSource: "ai",
      })

      if (step) {
        createdSteps.push({
          stepId: step.id,
          stepOrder: step.stepOrder,
          delayDays: template.delayDays,
          emailSubject: template.emailSubject,
          emailBodyText: template.emailBodyText,
          emailBodyHtml: template.emailBodyHtml,
        })
      }

      console.log(
        `[SequencePhase] Created step ${template.stepOrder} (delay: ${template.delayDays} days)`,
      )
    }

    console.log(`[SequencePhase] Created ${createdSteps.length} steps`)

    // Emit SSE + Save to DB: Sequence complete
    await emitAndSaveNotification(
      createSequenceCompleteEvent(workspaceId, jobId, createdSteps.length),
      userId,
    )

    return {
      sequenceId: sequence.id,
      steps: createdSteps,
    }
  } catch (error) {
    console.error("[SequencePhase] Error:", error)
    await addCheckpointError(job, "sequence", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "sequence"),
      userId,
    )
    throw error
  }
}

/**
 * Phase 5: Preview Email Generation
 */
export async function runPreviewsPhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
  sequenceId: string,
  steps: Array<{
    stepId: string
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string | null
  }>,
  leadIds: string[],
): Promise<number> {
  const { workspaceId, userId } = context
  const jobId = job.id || "unknown"

  console.log(`[PreviewsPhase] Generating preview emails for ${leadIds.length} leads`)

  if (leadIds.length === 0 || steps.length === 0) {
    console.log("[PreviewsPhase] No leads or steps, skipping")
    return 0
  }

  const totalPreviews = leadIds.length * steps.length
  const leadCount = leadIds.length
  const stepCount = steps.length

  // Emit SSE + Save to DB: Previews started
  await emitAndSaveNotification(
    createPreviewsStartEvent(workspaceId, jobId, totalPreviews, leadCount, stepCount),
    userId,
  )

  try {
    await saveCheckpoint(job, { phase: "previews" })

    // Check if preview emails already exist (idempotency)
    const existingPreviews = await db
      .select({ count: count() })
      .from(emails)
      .where(
        and(
          eq(emails.workspaceId, workspaceId),
          eq(emails.sequenceId, sequenceId),
          eq(emails.status, "draft"),
        ),
      )

    const existingCount = existingPreviews[0]?.count || 0
    const expectedCount = leadIds.length * steps.length

    if (existingCount > 0) {
      console.log(
        `[PreviewsPhase] Found ${existingCount} existing preview emails (expected: ${expectedCount})`,
      )

      if (existingCount >= expectedCount) {
        console.log("[PreviewsPhase] All preview emails already exist, skipping generation")
        return existingCount
      } else {
        console.log(
          `[PreviewsPhase] Some preview emails exist (${existingCount}/${expectedCount}), continuing generation`,
        )
        // Note: We'll let generatePreviewEmailsForSequence handle duplicates
        // It should ideally be updated to skip existing (leadId, stepId) pairs
        // For now, we proceed and rely on the fact that preview generation is relatively safe
      }
    }

    // Get user for email address
    const user = await getUser(userId)
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }
    const userEmail = user.email

    // Fetch lead details
    const leadDetails = await db
      .select({
        id: leadsTable.id,
        companyName: leadsTable.companyName,
        contactName: leadsTable.contactName,
        websiteUrl: leadsTable.websiteUrl,
        country: leadsTable.country,
        businessType: leadsTable.businessType,
      })
      .from(leadsTable)
      .where(inArray(leadsTable.id, leadIds))

    // Fetch contact emails
    const leadEmails = await db
      .select({
        leadId: leadContacts.leadId,
        email: leadContacts.contactValue,
      })
      .from(leadContacts)
      .where(
        and(
          inArray(leadContacts.leadId, leadIds),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )

    const emailMap = new Map(leadEmails.map((e) => [e.leadId, e.email]))
    const leadDetailsWithEmail = leadDetails.map((lead) => ({
      ...lead,
      contactEmail: emailMap.get(lead.id) || null,
    }))

    console.log(
      `[PreviewsPhase] Found ${leadEmails.length} contact emails for ${leadDetails.length} leads`,
    )

    // 🆕 Prepare leads progress array for SSE events
    const leadsProgress: LeadProgressItem[] = leadDetailsWithEmail.map((lead) => ({
      leadId: lead.id,
      companyName: lead.companyName || "Unknown",
      country: lead.country || undefined,
      status: "done" as const,
      email: lead.contactEmail || undefined,
    }))

    // 🆕 Accumulator for emails progress
    const emailsProgress: EmailProgressItem[] = []

    // Get or create email account
    let emailAccountId: string
    const [existingAccount] = await db
      .select({ id: userEmailAccounts.id })
      .from(userEmailAccounts)
      .where(
        and(eq(userEmailAccounts.userId, userId), eq(userEmailAccounts.workspaceId, workspaceId)),
      )
      .limit(1)

    if (existingAccount) {
      emailAccountId = existingAccount.id
      console.log(`[PreviewsPhase] Using existing email account: ${emailAccountId}`)
    } else {
      const [newAccount] = await db
        .insert(userEmailAccounts)
        .values({
          userId,
          workspaceId,
          emailAddress: userEmail,
          apiKey: "TRIAL_PREVIEW",
          isVerified: false,
          isDefault: true,
          status: "inactive",
        })
        .returning({ id: userEmailAccounts.id })

      if (!newAccount) {
        throw new Error("Failed to create email account")
      }
      emailAccountId = newAccount.id
      console.log(`[PreviewsPhase] Created trial email account: ${emailAccountId}`)
    }

    // Generate preview emails with progress callback
    const previewCount = await generatePreviewEmailsForSequence(
      workspaceId,
      emailAccountId,
      userEmail,
      sequenceId,
      steps,
      leadDetailsWithEmail,
      // 🆕 Enhanced progress callback with email data
      async (
        generated: number,
        total: number,
        emailData?: {
          leadId: string
          companyName: string
          subject: string
          step: number
        },
      ) => {
        // 🆕 Accumulate email data if provided
        if (emailData) {
          emailsProgress.push({
            emailId: `${emailData.leadId}-step${emailData.step}`,
            leadId: emailData.leadId,
            companyName: emailData.companyName,
            subject: emailData.subject,
            step: emailData.step,
            status: "done" as const,
          })
        }

        // Emit every 5% or at least every 10 previews for real-time updates
        const interval = Math.max(1, Math.floor(total / 20))
        if (generated % interval === 0 || generated === total) {
          // 🆕 Emit with leads and emails arrays for real-time UI
          await emitAndSaveNotification(
            {
              workspaceId,
              jobId,
              phase: "previews",
              progressPercent: Math.round(78 + (generated / total) * 17),
              message: `${generated} of ${total} emails done`,
              messageKr: `${generated}/${total}개 이메일 완료`,
              details: {
                previewsGenerated: generated,
                totalPreviews: total,
                leads: leadsProgress,
                emails: emailsProgress.slice(-30), // Last 30 emails for memory efficiency
              },
              timestamp: new Date().toISOString(),
            },
            userId,
          )
        }
      },
    )

    console.log(
      `[PreviewsPhase] Generated ${previewCount} preview emails (${leadDetails.length} leads × ${steps.length} steps)`,
    )

    // Emit SSE + Save to DB: Previews complete (with leads and emails for UI)
    await emitAndSaveNotification(
      {
        workspaceId,
        jobId,
        phase: "previews",
        progressPercent: 95,
        message: `${previewCount} emails ready`,
        messageKr: `${previewCount}개 이메일 완료 ✓`,
        details: {
          previewsGenerated: previewCount,
          totalPreviews: previewCount,
          leads: leadsProgress,
          emails: emailsProgress.slice(-30),
        },
        timestamp: new Date().toISOString(),
      },
      userId,
    )

    return previewCount
  } catch (error) {
    console.error("[PreviewsPhase] Error:", error)
    await addCheckpointError(job, "previews", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "previews"),
      userId,
    )
    throw error
  }
}

/**
 * Complete Phase: Update onboarding progress
 * Sets currentStep to 2 so user can directly proceed to email linking (Step 4)
 * Skips Step 3 (email confirmation) for faster onboarding flow
 */
export async function completeOnboarding(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
  customerGroupId: string,
  sequenceId: string,
  leadIds: string[],
): Promise<void> {
  const { workspaceId, userId, surveyData } = context
  const jobId = job.id || "unknown"

  console.log("[CompletePhase] Updating onboarding progress")

  try {
    // Get current progress to check what's already completed (idempotency)
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.workspaceId, workspaceId))
      .limit(1)

    // Complete step 1 (company info) if not already done
    if (!progress?.companyInfoCompleted) {
      await completeStep1CompanyInfo(workspaceId, userId)
      console.log("[CompletePhase] Completed step 1 (company info)")
    } else {
      console.log("[CompletePhase] Step 1 already completed, skipping")
    }

    // Complete step 2 (lead search) if leads were found and not already done
    if (leadIds.length > 0 && !progress?.leadSearchCompleted) {
      await completeStep2LeadSearch(workspaceId, leadIds, customerGroupId, userId)
      console.log("[CompletePhase] Completed step 2 (lead search)")
    } else if (leadIds.length > 0) {
      console.log("[CompletePhase] Step 2 already completed, skipping")
    }

    // Skip Step 3 (email generation confirmation) - user can proceed directly to Step 4 (email linking)
    // Just save the sequenceId to onboarding progress without marking step 3 as complete
    await db
      .update(onboardingProgress)
      .set({
        generatedSequenceId: sequenceId,
        currentStep: 2, // Set to step 2 so user proceeds to email linking
        status: "completed", // Mark as completed so dashboard shows campaign restart callout
        completedAt: new Date(), // Required for shouldShowPopup to return true
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.workspaceId, workspaceId))
    console.log(
      "[CompletePhase] Saved sequenceId and set currentStep to 2 (skipping step 3 confirmation)",
    )

    // Mark as complete in checkpoint
    await saveCheckpoint(job, { phase: "complete" })

    // 🆕 Generate LLM completion summary
    let completionSummary: { ko: string; en: string } | null = null
    try {
      // Get checkpoint data for personas
      const checkpoint = loadCheckpoint(job)

      // Get workspace info
      const [workspace] = await db
        .select({
          companyName: workspaces.companyName,
          companyDescription: workspaces.companyDescription,
        })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1)

      // Get email steps from sequence
      const emailSteps = await db
        .select({
          stepOrder: sequenceSteps.stepOrder,
          delayDays: sequenceSteps.delayDays,
          emailSubject: sequenceSteps.emailSubject,
        })
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, sequenceId))
        .orderBy(sequenceSteps.stepOrder)

      // Get leads info
      const leadsInfo = await db
        .select({
          companyName: leadsTable.companyName,
          country: leadsTable.country,
          businessType: leadsTable.businessType,
          leadScore: leadsTable.leadScore,
          employeeCount: leadsTable.employeeCount,
        })
        .from(leadsTable)
        .where(inArray(leadsTable.id, leadIds))

      // Generate summary
      completionSummary = await generateOnboardingSummary({
        workspaceName: workspace?.companyName || "Company",
        companyDescription: workspace?.companyDescription || undefined,
        buyerPersonas: checkpoint.buyerPersonas || [],
        buyers: leadsInfo.map((l) => ({
          companyName: l.companyName || "Unknown",
          industry: l.businessType || undefined,
          country: l.country || undefined,
          score: l.leadScore || undefined,
          size: l.employeeCount || undefined,
        })),
        emailSteps: emailSteps.map((s) => ({
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          emailSubject: s.emailSubject,
        })),
        locale: surveyData.lang === "en" ? "en" : "ko",
      })

      console.log("[CompletePhase] Generated LLM completion summary")
    } catch (summaryError) {
      console.warn("[CompletePhase] Failed to generate completion summary:", summaryError)
      // Continue without summary - fallback will be used on frontend
    }

    // Emit SSE + Save to DB: Complete (with summary if available)
    const emailCount = leadIds.length * EMAIL_TYPES_3TOUCH.length
    await emitAndSaveNotification(
      createCompleteEventWithSummary(
        workspaceId,
        jobId,
        leadIds.length,
        emailCount,
        completionSummary,
      ),
      userId,
    )

    // 🆕 Send completion email via Loops.so (helps reduce drop-off during long onboarding)
    // Optimized with 2025 best practices: dynamic subject line, progress bar, social proof
    if (isLoopsConfigured()) {
      try {
        const user = await getUser(userId)
        if (user?.email) {
          const emailCount = leadIds.length * 3 // 3-touch sequence
          const lang = surveyData.lang === "en" ? "en" : "ko"

          // 1. Calculate trial days remaining
          let trialDaysRemaining: number | undefined
          try {
            const subscription = await db
              .select({ trialEnd: subscriptions.trialEnd })
              .from(subscriptions)
              .where(eq(subscriptions.workspaceId, workspaceId))
              .limit(1)

            if (subscription[0]?.trialEnd) {
              trialDaysRemaining = Math.max(
                0,
                Math.ceil(
                  (new Date(subscription[0].trialEnd).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            }
          } catch (e) {
            console.warn("[CompletePhase] Failed to get trial days:", e)
          }

          // 2. Get workspace info for personalization
          let companyName: string | undefined
          try {
            const [workspace] = await db
              .select({ companyName: workspaces.companyName })
              .from(workspaces)
              .where(eq(workspaces.id, workspaceId))
              .limit(1)
            companyName = workspace?.companyName || undefined
          } catch (e) {
            console.warn("[CompletePhase] Failed to get workspace info:", e)
          }

          // 3. Map industry to display label
          const industryLabels: Record<string, { ko: string; en: string }> = {
            beauty: { ko: "뷰티/화장품", en: "Beauty" },
            fashion: { ko: "패션/의류", en: "Fashion" },
            food: { ko: "식품", en: "Food" },
            it_saas: { ko: "IT/SaaS", en: "IT/SaaS" },
            manufacturing: { ko: "제조", en: "Manufacturing" },
            living: { ko: "리빙/홈데코", en: "Living" },
            other: { ko: "비즈니스", en: "Business" },
          }
          const industry = surveyData.industry
            ? industryLabels[surveyData.industry]?.[lang]
            : undefined

          // 4. Send optimized email with extended data
          await sendOnboardingCompleteEmail({
            email: user.email,
            firstName: user.username || undefined,
            companyName,
            leadCount: leadIds.length,
            emailCount,
            dashboardUrl: `${config.frontendUrl}/company?step=4`,
            language: lang,
            trialDaysRemaining,
            industry,
          })

          console.log(`[CompletePhase] Sent completion email to ${user.email}`)
        }
      } catch (emailError) {
        // Don't fail onboarding if email fails
        console.error("[CompletePhase] Failed to send completion email:", emailError)
      }
    }

    console.log(
      "[CompletePhase] Onboarding auto-generation complete - user can now link email and start campaign",
    )
  } catch (error) {
    console.error("[CompletePhase] Error:", error)
    await addCheckpointError(job, "complete", String(error))
    // Emit SSE + Save to DB: Error
    await emitAndSaveNotification(
      createErrorEvent(workspaceId, jobId, String(error), "complete"),
      userId,
    )
    throw error
  }
}
