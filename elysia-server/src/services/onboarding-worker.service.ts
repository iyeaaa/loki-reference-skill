/**
 * Onboarding Worker Service
 *
 * BullMQ worker service for auto-generate onboarding
 * Handles phase-based execution with BullMQ native job state
 */

import type { Job } from "bullmq"
import { and, count, eq, inArray, isNotNull } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads as leadsTable } from "../db/schema/leads"
import { onboardingProgress } from "../db/schema/onboarding"
import { sequenceSteps, sequences } from "../db/schema/sequences"
import type { OnboardingAutoGenerateJob, OnboardingAutoGenerateResult } from "../lib/queue/types"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { searchBigQuery } from "./bigquery-search.service"
import { createCustomerGroup } from "./customer-group.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "./lead-discovery/nodes/bigquery-executor"
import {
  COUNTRY_NAMES,
  completeStep1CompanyInfo,
  completeStep2LeadSearch,
  completeStep3EmailGeneration,
  EMAIL_TYPES_2TOUCH,
  enrichLeadsForOnboarding,
  generatePreviewEmailsForSequence,
  INDUSTRY_NAMES,
  KST_OFFSET_MS,
} from "./onboarding.service"
import { createSequence, createSequenceStep } from "./sequence.service"
import { getUser } from "./user.service"
import * as workspaceServiceImport from "./workspace.service"

// ====================================
// TYPES
// ====================================

export interface CheckpointState {
  phase: "init" | "discovery" | "group" | "templates" | "sequence" | "previews" | "complete"
  iteration: number
  leadsWithEmailsCount: number
  lastIterationCompleted: boolean
  customerGroupId?: string
  sequenceId?: string
  // Discovery phase state (for idempotency)
  processedWebsites?: string[] // Websites already enriched and saved
  usedQueries?: string[] // Search queries already executed
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
    iteration: 0,
    leadsWithEmailsCount: 0,
    lastIterationCompleted: false,
    errors: [],
  }

  // BullMQ stores checkpoint in job.data.checkpoint
  const checkpoint = (job.data as any).checkpoint as Partial<CheckpointState> | undefined

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
 * Discovers leads via BigQuery, enriches them, and saves to DB incrementally
 */
export async function runDiscoveryPhase(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
): Promise<{
  leadIds: string[]
  count: number
}> {
  const { workspaceId, userId, surveyData } = context
  const TARGET_LEADS = 300
  const MAX_ITERATIONS = 5
  const BATCH_SIZE = 200

  console.log(`[DiscoveryPhase] Starting for workspace ${workspaceId}`)

  // Load checkpoint from BullMQ job data
  const checkpoint = loadCheckpoint(job)
  let iteration = checkpoint.iteration || 0

  // Map codes to actual Apollo BigQuery values
  const countryName = COUNTRY_NAMES[surveyData.country] || surveyData.country
  const industryName = INDUSTRY_NAMES[surveyData.industry] || surveyData.industry

  // Restore state from checkpoint (for idempotency on restart)
  const usedQueries = new Set<string>(checkpoint.usedQueries || [])
  const processedWebsites = new Set<string>(checkpoint.processedWebsites || [])

  try {
    // Update checkpoint in BullMQ job data
    await saveCheckpoint(job, {
      phase: "discovery",
      iteration,
    })

    // Iterative discovery loop
    while (iteration < MAX_ITERATIONS) {
      iteration++
      console.log(`[DiscoveryPhase] Iteration ${iteration}/${MAX_ITERATIONS}`)

      // Report progress to keep job alive (extends lock)
      await job.updateProgress({
        phase: "discovery",
        iteration,
        progressPercent: 10 + (iteration / MAX_ITERATIONS) * 20, // 10-30%
      })

      // BASE CASE: Check DB for leads with emails BEFORE starting this iteration
      const dbLeadsCount = await countLeadsWithEmails(workspaceId)
      console.log(`[DiscoveryPhase] Current DB leads with emails: ${dbLeadsCount}/${TARGET_LEADS}`)

      if (dbLeadsCount >= TARGET_LEADS) {
        console.log(`[DiscoveryPhase] Target reached: ${dbLeadsCount} leads`)
        await saveCheckpoint(job, {
          iteration, // Save current iteration number where target was reached
          leadsWithEmailsCount: dbLeadsCount,
          lastIterationCompleted: true,
        })
        break
      }

      // Generate unique search query
      const query = generateUniqueQuery(
        industryName,
        countryName,
        BATCH_SIZE,
        iteration,
        usedQueries,
      )

      if (!query) {
        console.warn("[DiscoveryPhase] No more unique queries")
        break
      }

      console.log(`[DiscoveryPhase] Query: "${query}"`)

      // Search BigQuery
      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY)

      if (!result.results.length) {
        console.log("[DiscoveryPhase] No results from BigQuery")
        continue
      }

      console.log(`[DiscoveryPhase] Found ${result.results.length} results from BigQuery`)

      // Filter out already processed leads and prepare for enrichment
      const newLeadsToEnrich = result.results
        .filter((row) => {
          const website = row.website as string
          if (!website) return false
          if (processedWebsites.has(website)) {
            console.log(`[DiscoveryPhase] Skipping already processed website: ${website}`)
            return false
          }
          return true
        })
        .map((row) => ({
          company: row.company as string,
          website: row.website as string,
          industry: row.industry as string,
          employees: row.employees?.toString() || "",
          country: row.country as string,
        }))

      console.log(
        `[DiscoveryPhase] Found ${newLeadsToEnrich.length} new leads to process (${result.results.length - newLeadsToEnrich.length} already processed)`,
      )

      // Enrich new leads
      if (newLeadsToEnrich.length > 0) {
        console.log(`[DiscoveryPhase] Enriching ${newLeadsToEnrich.length} leads...`)
        const enrichedLeads = await enrichLeadsForOnboarding(newLeadsToEnrich)

        const enrichedCount = enrichedLeads.filter((l) => l.primaryEmail).length
        console.log(
          `[DiscoveryPhase] Enrichment complete: ${enrichedCount}/${enrichedLeads.length} have emails`,
        )

        // Save enriched leads with emails to DB (incremental save)
        const enrichedLeadsWithEmails = enrichedLeads.filter((lead) => {
          if (!lead.primaryEmail) return false
          const email = lead.primaryEmail.toLowerCase()
          // Filter out generic no-reply addresses
          if (email.includes("noreply")) return false
          if (email.startsWith("postmaster@")) return false
          if (email.startsWith("abuse@")) return false
          return true
        })

        if (enrichedLeadsWithEmails.length > 0) {
          console.log(
            `[DiscoveryPhase] Saving ${enrichedLeadsWithEmails.length} enriched leads to DB...`,
          )

          const leadsToCreate = enrichedLeadsWithEmails.map((lead) => ({
            companyName: lead.companyName,
            foundCompanyName: lead.companyName,
            websiteUrl: lead.websiteUrl,
            businessType: lead.businessType,
            country: lead.country,
            employeeCount: lead.employeeCount,
            description: lead.description,
            primaryEmail: lead.primaryEmail,
            leadSource: "bigquery-auto" as const,
            leadStatus: "new" as const,
          }))

          const { stats } = await bulkCreateLeads({
            workspaceId,
            leads: leadsToCreate,
            createdBy: userId,
          })

          console.log(
            `[DiscoveryPhase] Saved ${stats.created} new leads (${stats.skipped} duplicates skipped)`,
          )
        }

        // Mark ALL enriched websites as processed (even those without emails)
        // to prevent re-enrichment of websites that don't yield results
        for (const lead of newLeadsToEnrich) {
          if (lead.website) {
            processedWebsites.add(lead.website)
          }
        }
      }

      // Update checkpoint after iteration
      await saveCheckpoint(job, {
        iteration,
        leadsWithEmailsCount: await countLeadsWithEmails(workspaceId),
        lastIterationCompleted: true,
        processedWebsites: Array.from(processedWebsites),
        usedQueries: Array.from(usedQueries),
      })
    }

    // Get all lead IDs with emails from DB
    const finalLeads = await db
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

    const leadIds = finalLeads.map((l) => l.id)
    const finalCount = leadIds.length

    console.log(`[DiscoveryPhase] Complete: ${finalCount} leads with emails`)

    return {
      leadIds,
      count: finalCount,
    }
  } catch (error) {
    console.error("[DiscoveryPhase] Error:", error)
    await addCheckpointError(job, "discovery", String(error))
    throw error
  }
}

/**
 * Generate unique search queries to avoid fetching the same leads
 */
function generateUniqueQuery(
  industryName: string,
  countryName: string,
  batchSize: number,
  iteration: number,
  usedQueries: Set<string>,
): string | null {
  const strategies = [
    () => `${industryName} companies in ${countryName} ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 10-50 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 50-200 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 200+ employees ${batchSize * iteration}개`,
    () => `${industryName} businesses in ${countryName} ${batchSize * iteration}개`,
  ]

  for (const strategy of strategies) {
    const query = strategy()
    if (!usedQueries.has(query)) {
      usedQueries.add(query)
      return query
    }
  }

  return null
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
  const isKorean = surveyData.lang === "ko"
  const leadCount = leadIds.length

  console.log(`[GroupPhase] Creating customer group for ${leadCount} leads`)

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

    return customerGroup.id
  } catch (error) {
    console.error("[GroupPhase] Error:", error)
    await addCheckpointError(job, "group", String(error))
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
  const { workspaceId, surveyData } = context
  const isKorean = surveyData.lang === "ko"

  console.log("[TemplatesPhase] Generating email templates")

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

    const templatesNeeded = EMAIL_TYPES_2TOUCH.length
    console.log(`[TemplatesPhase] Generating ${templatesNeeded} templates (2-touch sequence)`)

    const aiService = getAITemplateGenerationService()
    const templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []

    for (let i = 0; i < templatesNeeded; i++) {
      const emailType = EMAIL_TYPES_2TOUCH[i]
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
        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.name,
          workspaceDescription: workspace.description || undefined,
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

    // Save final templates to checkpoint
    await saveCheckpoint(job, { generatedTemplates: templates })

    return templates
  } catch (error) {
    console.error("[TemplatesPhase] Error:", error)
    await addCheckpointError(job, "templates", String(error))
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
  const isKorean = surveyData.lang === "ko"

  console.log("[SequencePhase] Creating sequence and steps")

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

    return {
      sequenceId: sequence.id,
      steps: createdSteps,
    }
  } catch (error) {
    console.error("[SequencePhase] Error:", error)
    await addCheckpointError(job, "sequence", String(error))
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

  console.log(`[PreviewsPhase] Generating preview emails for ${leadIds.length} leads`)

  if (leadIds.length === 0 || steps.length === 0) {
    console.log("[PreviewsPhase] No leads or steps, skipping")
    return 0
  }

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

    // Generate preview emails
    const previewCount = await generatePreviewEmailsForSequence(
      workspaceId,
      emailAccountId,
      userEmail,
      sequenceId,
      steps,
      leadDetailsWithEmail,
    )

    console.log(
      `[PreviewsPhase] Generated ${previewCount} preview emails (${leadDetails.length} leads × ${steps.length} steps)`,
    )

    return previewCount
  } catch (error) {
    console.error("[PreviewsPhase] Error:", error)
    await addCheckpointError(job, "previews", String(error))
    throw error
  }
}

/**
 * Complete Phase: Update onboarding progress
 */
export async function completeOnboarding(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  context: JobContext,
  customerGroupId: string,
  sequenceId: string,
  leadIds: string[],
): Promise<void> {
  const { workspaceId, userId } = context

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

    // Complete step 3 (email generation) if not already done
    if (!progress?.emailGenerationCompleted) {
      await completeStep3EmailGeneration(workspaceId, sequenceId, userId)
      console.log("[CompletePhase] Completed step 3 (email generation)")
    } else {
      console.log("[CompletePhase] Step 3 already completed, skipping")
    }

    // Mark as complete in checkpoint
    await saveCheckpoint(job, { phase: "complete" })

    console.log("[CompletePhase] Onboarding complete")
  } catch (error) {
    console.error("[CompletePhase] Error:", error)
    await addCheckpointError(job, "complete", String(error))
    throw error
  }
}
