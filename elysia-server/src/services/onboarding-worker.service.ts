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
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads as leadsTable } from "../db/schema/leads"
import { onboardingProgress } from "../db/schema/onboarding"
import { sequenceSteps, sequences } from "../db/schema/sequences"
import type { OnboardingAutoGenerateJob, OnboardingAutoGenerateResult } from "../lib/queue/types"
import {
  createCompleteEvent,
  createDiscoveryBatchEvent,
  createDiscoveryCompleteEvent,
  createDiscoverySearchingEvent,
  createDiscoveryStartEvent,
  createErrorEvent,
  createGroupCompleteEvent,
  createGroupStartEvent,
  createPreviewProgressEvent,
  createPreviewsCompleteEvent,
  createPreviewsStartEvent,
  createSequenceCompleteEvent,
  createSequenceStartEvent,
  createTemplateProgressEvent,
  createTemplatesCompleteEvent,
  createTemplatesStartEvent,
  emitOnboardingProgress,
  type OnboardingProgressEvent,
} from "../lib/redis/onboarding-events"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { createCustomerGroup } from "./customer-group.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { searchAndEnrichLeads } from "./lead-search-enrichment.service"
import { isLoopsConfigured, sendOnboardingCompleteEmail } from "./loops.service"
import { upsertOnboardingProgressNotification } from "./notification.service"
import {
  COUNTRY_NAMES,
  completeStep1CompanyInfo,
  completeStep2LeadSearch,
  EMAIL_TYPES_3TOUCH,
  generatePreviewEmailsForSequence,
  INDUSTRY_NAMES,
  KST_OFFSET_MS,
} from "./onboarding.service"
import { createSequence, createSequenceStep } from "./sequence.service"
import { getUser } from "./user.service"
import * as workspaceServiceImport from "./workspace.service"

// ====================================
// CONSTANTS
// ====================================

const TARGET_LEADS = 150 // 150 leads for 3-touch sequence (450 emails total)

// ====================================
// SSE + DB NOTIFICATION WRAPPER
// ====================================

/**
 * Emit SSE event and save notification to DB
 * This ensures real-time updates (SSE) and persistence (DB) for notifications
 */
async function emitAndSaveNotification(
  event: OnboardingProgressEvent,
  userId: string,
): Promise<void> {
  console.log(
    `[OnboardingWorker] emitAndSaveNotification called - phase: ${event.phase}, userId: ${userId}, workspaceId: ${event.workspaceId}`,
  )

  // Emit SSE event for real-time updates
  await emitOnboardingProgress(event)

  // Save to DB for persistence (async, don't block on this)
  try {
    const notification = await upsertOnboardingProgressNotification(userId, event)
    console.log(
      `[OnboardingWorker] Notification saved to DB - id: ${notification.id}, type: ${notification.type}, title: ${notification.title}`,
    )
  } catch (error) {
    // Log error details for debugging
    console.error("[OnboardingWorker] Failed to save notification to DB:", error)
    console.error("[OnboardingWorker] Event data:", JSON.stringify(event, null, 2))
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
 * Discovers leads via BigQuery, enriches them, and saves to DB
 * Now uses the unified searchAndEnrichLeads service
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

    // Map codes to actual Apollo BigQuery values
    const countryName = COUNTRY_NAMES[surveyData.country] || surveyData.country
    const industryName = INDUSTRY_NAMES[surveyData.industry] || surveyData.industry
    const experience = surveyData.experience
    const target = surveyData.target
    const lang = surveyData.lang

    // 🆕 Fetch workspace to get companyDescription for targeted search
    const workspace = await workspaceServiceImport.getWorkspace(workspaceId)
    const companyDescription =
      workspace?.companyDescription && workspace.companyDescription !== "기본 워크스페이스"
        ? workspace.companyDescription
        : undefined

    console.log(
      `[DiscoveryPhase] Company description for search: "${companyDescription?.slice(0, 50) || "N/A"}..."`,
    )

    // Update checkpoint in BullMQ job data
    await saveCheckpoint(job, {
      phase: "discovery",
    })

    // Report progress to keep job alive (extends lock)
    await job.updateProgress({
      phase: "discovery",
      progressPercent: 15, // 15%
    })

    // Emit SSE: Database searching
    await emitAndSaveNotification(createDiscoverySearchingEvent(workspaceId, jobId), userId)

    // Build natural language query for the lead search service
    // 🆕 Include companyDescription in query if available
    const naturalLanguageQuery = companyDescription
      ? `${companyDescription} ${industryName} companies in ${countryName}`
      : `${industryName} companies in ${countryName}`
    console.log(`[DiscoveryPhase] Natural language query: "${naturalLanguageQuery}"`)

    // Use the unified lead search and enrichment service
    // TODO: minimumMatchScore를 0으로 임시 변경 (디버깅용) - 원래는 60
    const searchResult = await searchAndEnrichLeads(
      TARGET_LEADS,
      naturalLanguageQuery,
      0, // minimumMatchScore: 0 = 필터링 없음 (디버깅용, 원래는 60)
      // Progress callback for SSE updates
      async (progress) => {
        console.log(`[DiscoveryPhase] Progress: ${progress.phase} - ${progress.message}`)

        // Update job progress
        let progressPercent = 15
        if (progress.phase === "bigquery") {
          progressPercent = 15 + Math.floor((progress.currentCount / progress.targetCount) * 20)
        } else if (progress.phase === "enrichment") {
          progressPercent = 35 + Math.floor((progress.currentCount / progress.targetCount) * 15)
        } else if (progress.phase === "hunterio") {
          progressPercent = 50 + Math.floor((progress.currentCount / progress.targetCount) * 5)
        } else if (progress.phase === "scoring") {
          progressPercent = 55 + Math.floor((progress.currentCount / progress.targetCount) * 5)
        }

        await job.updateProgress({
          phase: "discovery",
          progressPercent: Math.min(60, progressPercent),
        })

        // Emit SSE batch event (approximating batch number based on progress)
        if (progress.phase === "enrichment" || progress.phase === "hunterio") {
          const batchNum = Math.floor(progress.currentCount / 30) || 1
          await emitAndSaveNotification(
            createDiscoveryBatchEvent(
              workspaceId,
              jobId,
              batchNum,
              Math.ceil(TARGET_LEADS / 30),
              progress.currentCount,
              progress.currentCount,
            ),
            userId,
          )
        }
      },
      {
        country: countryName,
        industry: industryName,
        target,
        experience,
        lang,
        // 🆕 본인 회사 설명 → ICP 기반 고객사 검색에 사용
        myCompanyDescription: companyDescription,
      },
    )

    console.log(`[DiscoveryPhase] Search complete. Found ${searchResult.stats.totalFound} leads`)
    console.log(`[DiscoveryPhase]   - From BigQuery: ${searchResult.stats.fromBigQuery}`)
    console.log(`[DiscoveryPhase]   - From Hunter.io: ${searchResult.stats.fromHunterIO}`)
    console.log(`[DiscoveryPhase]   - With emails: ${searchResult.stats.withEmails}`)
    console.log(`[DiscoveryPhase]   - Skipped duplicates: ${searchResult.stats.skippedDuplicates}`)
    console.log(`[DiscoveryPhase]   - Skipped low scoring: ${searchResult.stats.skippedLowScoring}`)
    console.log(
      `[DiscoveryPhase]   - Skipped large companies: ${searchResult.stats.skippedLargeCompanies}`,
    )

    // Save all found leads to database
    const leadsToCreate = searchResult.leads.map((lead) => ({
      companyName: lead.companyName,
      foundCompanyName: lead.companyName,
      websiteUrl: lead.websiteUrl || undefined,
      businessType: lead.businessType || undefined,
      country: lead.country || undefined,
      employeeCount: lead.employeeCount || undefined,
      description: lead.description || undefined,
      primaryEmail: lead.primaryEmail || undefined,
      leadSource: lead.leadSource,
      leadStatus: "new" as const,
    }))

    console.log(`[DiscoveryPhase] Saving ${leadsToCreate.length} leads to database`)

    const { stats, createdLeads } = await bulkCreateLeads({
      workspaceId,
      leads: leadsToCreate,
      createdBy: userId,
    })

    console.log(`[DiscoveryPhase] Saved ${stats.created} new leads (${stats.skipped} duplicates)`)

    // Extract lead IDs from created leads
    const leadIds = createdLeads.map((lead) => lead.id)

    // Update checkpoint with final count
    const finalCount = await countLeadsWithEmails(workspaceId)
    await saveCheckpoint(job, {
      leadsWithEmailsCount: finalCount,
      lastIterationCompleted: true,
    })

    console.log(
      `[DiscoveryPhase] Complete: ${finalCount} leads with emails, returning ${leadIds.length} IDs`,
    )

    // Emit SSE + Save to DB: Discovery complete
    await emitAndSaveNotification(
      createDiscoveryCompleteEvent(workspaceId, jobId, finalCount),
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
    const templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []
    const totalTemplates = templatesNeeded

    for (let i = 0; i < templatesNeeded; i++) {
      const emailType = EMAIL_TYPES_3TOUCH[i]
      if (!emailType) continue

      // Report progress to keep job alive (extends lock)
      await job.updateProgress({
        phase: "templates",
        templatesGenerated: i,
        progressPercent: 65 + ((i + 1) / templatesNeeded) * 15, // 65-80%
      })

      const prompt = isKorean ? emailType.promptKr : emailType.promptEn
      const industryContext = isKorean
        ? `${surveyData.industry} 산업의 ${surveyData.target} 고객을 대상으로`
        : `for ${surveyData.target} customers in the ${surveyData.industry} industry`

      try {
        // Use companyName and companyDescription if available, fallback to workspace name/description
        // Filter out default values like "기본 워크스페이스" that don't provide useful context
        const effectiveDescription =
          workspace.companyDescription && workspace.companyDescription !== "기본 워크스페이스"
            ? workspace.companyDescription
            : workspace.description && workspace.description !== "기본 워크스페이스"
              ? workspace.description
              : undefined

        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.companyName || workspace.name,
          workspaceDescription: effectiveDescription,
          country: surveyData.country,
          userPrompt: `${prompt} ${industryContext}`,
        })

        templates.push({
          stepOrder: i + 1,
          delayDays: emailType.delayDays,
          emailSubject: template.subject,
          emailBodyText: template.bodyText,
          emailBodyHtml: template.bodyHtml,
        })

        console.log(
          `[TemplatesPhase] Generated template ${i + 1}/${templatesNeeded}: ${emailType.type}`,
        )

        // Emit SSE + Save to DB: Template progress
        await emitAndSaveNotification(
          createTemplateProgressEvent(workspaceId, jobId, i + 1, totalTemplates, emailType.type),
          userId,
        )

        // Save checkpoint after each template (incremental save)
        await saveCheckpoint(job, { generatedTemplates: templates })
      } catch (error) {
        console.error(`[TemplatesPhase] Failed to generate template ${i + 1}:`, error)
        // Continue with remaining templates
      }
    }

    if (templates.length === 0) {
      throw new Error("No templates generated")
    }

    console.log(`[TemplatesPhase] Generated ${templates.length} templates`)

    // Emit SSE + Save to DB: Templates complete
    await emitAndSaveNotification(
      createTemplatesCompleteEvent(workspaceId, jobId, templates.length),
      userId,
    )

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
      // Progress callback for SSE + DB updates
      async (generated: number, total: number) => {
        // Emit every 5% or at least every 10 previews for real-time updates
        const interval = Math.max(1, Math.floor(total / 20))
        if (generated % interval === 0 || generated === total) {
          // Calculate which step we're on
          const currentStep = Math.ceil(generated / leadCount) || 1
          await emitAndSaveNotification(
            createPreviewProgressEvent(
              workspaceId,
              jobId,
              generated,
              total,
              currentStep,
              stepCount,
            ),
            userId,
          )
        }
      },
    )

    console.log(
      `[PreviewsPhase] Generated ${previewCount} preview emails (${leadDetails.length} leads × ${steps.length} steps)`,
    )

    // Emit SSE + Save to DB: Previews complete
    await emitAndSaveNotification(
      createPreviewsCompleteEvent(workspaceId, jobId, previewCount, leadCount, stepCount),
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

    // Emit SSE + Save to DB: Complete
    await emitAndSaveNotification(createCompleteEvent(workspaceId, jobId, leadIds.length), userId)

    // 🆕 Send completion email via Loops.so (helps reduce drop-off during long onboarding)
    if (isLoopsConfigured()) {
      try {
        const user = await getUser(userId)
        if (user?.email) {
          const emailCount = leadIds.length * 3 // 3-touch sequence

          await sendOnboardingCompleteEmail({
            email: user.email,
            firstName: user.username || undefined,
            leadCount: leadIds.length,
            emailCount,
            dashboardUrl: `${config.frontendUrl}/app/sequences/${sequenceId}`,
            language: surveyData.lang === "en" ? "en" : "ko",
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
