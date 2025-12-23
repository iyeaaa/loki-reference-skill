/**
 * Onboarding Worker Service
 *
 * BullMQ worker service for auto-generate onboarding
 * Handles phase-based execution with BullMQ native job state
 * Emits real-time progress events via Redis PubSub → SSE
 */

import type { Job } from "bullmq"
import { and, count, eq, inArray, isNotNull } from "drizzle-orm"
import { z } from "zod"
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
import { createB2BCustomerIndustryAgent, generateB2BCustomerIndustryPrompt } from "../shared/mastra"
import { structuredExtractionAgent } from "../shared/mastra/shell/agents/structured-extraction-agent"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { searchBigQuery } from "./bigquery-search.service"
import { createCustomerGroup } from "./customer-group.service"
import { searchDomainWithHunter } from "./hunterio-domain-search.service"
import { searchLeadsWithHunter } from "./hunterio-lead-search.service"
import { generateHunterioQuery } from "./hunterio-query-generator.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "./lead-discovery/nodes/bigquery-executor"
import { upsertOnboardingProgressNotification } from "./notification.service"
import {
  COUNTRY_NAMES,
  completeStep1CompanyInfo,
  completeStep2LeadSearch,
  EMAIL_TYPES_3TOUCH,
  enrichLeadsForOnboarding,
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

const TARGET_LEADS = 30 // 30 leads for 3-touch sequence (90 emails total)
const ENRICHMENT_BATCH_SIZE = 30
const BIGQUERY_BATCH_SIZE = 100 // Reduced from 500 for faster onboarding
const MAX_SEARCH_ITERATIONS = 3 // Enough iterations to find 30 leads
const HUNTERIO_MAX_PER_PAGE = 100
const HUNTERIO_MAX_EMAIL_COUNT = 100 // Skip companies with too many emails (proxy for large companies)

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
// B2B AGENT HELPERS
// ====================================

/**
 * Get B2B customer industries using AI agent
 * Takes the seller's industry and country, returns 1-3 target customer industries
 */
async function getB2BCustomerIndustries(
  industryName: string,
  countryName: string,
): Promise<string[]> {
  try {
    console.log(
      `[B2BAgent] Analyzing target customer industries for: ${industryName} in ${countryName}`,
    )

    // Step 1: Generate analysis using B2B agent
    const agent = createB2BCustomerIndustryAgent()
    const prompt = generateB2BCustomerIndustryPrompt(industryName, countryName)
    const response = await agent.generate(prompt)

    console.log(`[B2BAgent] Agent response: ${response.text}`)

    // Step 2: Extract structured output using structured extraction agent
    const structured = await structuredExtractionAgent.generate(
      [
        {
          role: "user",
          content: `Extract the target industries from the following analysis. Return only the industry names as a JSON array.

Analysis:
${response.text}

Return format: { "targetIndustries": ["Industry1", "Industry2", "Industry3"] }`,
        },
      ],
      {
        output: z.object({
          targetIndustries: z
            .array(z.string())
            .min(1)
            .max(3)
            .describe("1-3 target customer industries"),
        }),
      },
    )

    const industries = structured.object.targetIndustries
    console.log(`[B2BAgent] Extracted target industries: ${industries.join(", ")}`)

    return industries
  } catch (error) {
    console.error("[B2BAgent] Agent failed, falling back to original industry", error)
    return [industryName] // Fallback to original behavior
  }
}

/**
 * Generate unique search queries to avoid fetching the same leads
 * Varies by: result count, employee range, specific keywords
 */
function generateUniqueQuery(
  industryName: string,
  countryName: string,
  batchSize: number,
  iteration: number,
  usedQueries: Set<string>,
): string | null {
  // Strategy variations to generate diverse queries
  const strategies = [
    // Base query with increasing limits
    () => `${industryName} companies in ${countryName} ${batchSize * iteration}개`,

    // Add employee size variations
    () =>
      `${industryName} companies in ${countryName} with 10-50 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 50-200 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 200+ employees ${batchSize * iteration}개`,

    // Add business type variations
    () => `${industryName} startups in ${countryName} ${batchSize * iteration}개`,
    () => `${industryName} enterprises in ${countryName} ${batchSize * iteration}개`,
    () => `${industryName} SMB companies in ${countryName} ${batchSize * iteration}개`,

    // Add keyword variations
    () => `${industryName} B2B companies in ${countryName} ${batchSize * iteration}개`,
    () => `${industryName} software companies in ${countryName} ${batchSize * iteration}개`,
    () => `${industryName} service companies in ${countryName} ${batchSize * iteration}개`,
  ]

  // Try each strategy
  for (const strategy of strategies) {
    const query = strategy()
    if (!usedQueries.has(query)) {
      usedQueries.add(query)
      return query
    }
  }

  // If all strategies exhausted, return null
  return null
}

// ====================================
// PHASE FUNCTIONS
// ====================================

/**
 * Hunter.io discovered lead interface
 */
interface HunterDiscoveredLead {
  companyName: string
  websiteUrl: string
  primaryEmail: string
  leadSource: "hunterio-discover"
}

/**
 * Discover leads using Hunter.io Discover API as fallback
 * Called when BigQuery doesn't return enough leads
 */
async function discoverLeadsWithHunterIO(
  context: JobContext,
  existingLeadCount: number,
  existingDomains: Set<string>,
): Promise<HunterDiscoveredLead[]> {
  console.log(
    `[HunterIO Discovery] Starting fallback discovery. Current leads: ${existingLeadCount}, Target: ${TARGET_LEADS}`,
  )

  const leads: HunterDiscoveredLead[] = []

  try {
    // 1. Generate Hunter.io params via LLM
    const baseParams = await generateHunterioQuery(context.surveyData)
    console.log("[HunterIO Discovery] Generated params:", baseParams)

    let offset = 0
    let hasMoreResults = true

    // 2. Paginate until target reached or no more results
    while (hasMoreResults && existingLeadCount + leads.length < TARGET_LEADS) {
      const params = { ...baseParams, limit: HUNTERIO_MAX_PER_PAGE, offset }
      console.log(`[HunterIO Discovery] Fetching page at offset ${offset}`)

      const companies = await searchLeadsWithHunter(params)

      if (companies.length === 0) {
        console.log("[HunterIO Discovery] No more results from Hunter.io")
        hasMoreResults = false
        break
      }

      console.log(`[HunterIO Discovery] Found ${companies.length} companies`)

      // 3. Process each company
      for (const company of companies) {
        // Skip if already processed
        if (existingDomains.has(company.domain.toLowerCase())) {
          console.log(`[HunterIO Discovery] Skipping duplicate domain: ${company.domain}`)
          continue
        }

        // Skip big companies based on emails count as proxy
        // If company has too many indexed emails, it's likely a large company
        if (company.emailsCount.total > HUNTERIO_MAX_EMAIL_COUNT) {
          console.log(
            `[HunterIO Discovery] Skipping large company (${company.emailsCount.total} emails): ${company.organization}`,
          )
          continue
        }

        // 4. Get emails via Domain Search API (rate-limited via PQueue)
        const emailResult = await searchDomainWithHunter({ domain: company.domain })

        if (emailResult.genericEmail) {
          leads.push({
            companyName: company.organization,
            websiteUrl: `https://${company.domain}`,
            primaryEmail: emailResult.genericEmail,
            leadSource: "hunterio-discover",
          })
          existingDomains.add(company.domain.toLowerCase())

          console.log(
            `[HunterIO Discovery] Added lead: ${company.organization} (${emailResult.genericEmail})`,
          )
        }

        // Check if target reached
        if (existingLeadCount + leads.length >= TARGET_LEADS) {
          console.log("[HunterIO Discovery] Target reached!")
          break
        }
      }

      offset += HUNTERIO_MAX_PER_PAGE

      // If fewer results than limit, no more pages
      if (companies.length < HUNTERIO_MAX_PER_PAGE) {
        hasMoreResults = false
      }
    }

    console.log(`[HunterIO Discovery] Complete. Found ${leads.length} new leads.`)
    return leads
  } catch (error) {
    console.error("[HunterIO Discovery] Error:", error)
    return leads // Return what we have so far
  }
}

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
  const jobId = job.id || "unknown"

  console.log(`[DiscoveryPhase] Starting for workspace ${workspaceId}`)

  // Emit SSE + Save to DB: Discovery started
  await emitAndSaveNotification(createDiscoveryStartEvent(workspaceId, jobId), userId)

  // Load checkpoint from BullMQ job data
  const _checkpoint = loadCheckpoint(job)

  try {
    // Base case: Check if we already have 300+ leads with emails
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

    // Get target customer industries from B2B agent (1-3 industries that would BUY from this industry)
    const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)
    console.log(`[DiscoveryPhase] Target customer industries: ${targetIndustries.join(", ")}`)

    // Update checkpoint in BullMQ job data
    await saveCheckpoint(job, {
      phase: "discovery",
    })

    // Report progress to keep job alive (extends lock)
    await job.updateProgress({
      phase: "discovery",
      progressPercent: 15, // 15%
    })

    // Track processed websites to avoid duplicates across iterations
    const processedWebsites = new Set<string>()

    // Track used queries to generate diverse searches
    const usedQueries = new Set<string>()

    // Iterative search until we reach target or exhaust options
    // Outer loop: iterations, Inner loop: target industries (1-3)
    let isFirstQuery = true
    let globalBatchNum = 0

    for (let iteration = 0; iteration < MAX_SEARCH_ITERATIONS; iteration++) {
      // Check current count before each iteration
      const currentLeadsCount = await countLeadsWithEmails(workspaceId)
      if (currentLeadsCount >= TARGET_LEADS) {
        console.log(
          `[DiscoveryPhase] Target ${TARGET_LEADS} reached with ${currentLeadsCount} leads, stopping iterations`,
        )
        break
      }

      console.log(
        `[DiscoveryPhase] Iteration ${iteration + 1}/${MAX_SEARCH_ITERATIONS}: Searching ${targetIndustries.length} target industries`,
      )

      // Emit SSE: Database searching (before first BigQuery call)
      if (isFirstQuery) {
        await emitAndSaveNotification(createDiscoverySearchingEvent(workspaceId, jobId), userId)
      }

      // Collect leads from all target industries in this iteration
      const allLeadsToEnrich: Array<{
        company: string
        website: string
        industry: string
        employees: string
        country: string
      }> = []

      // Loop over each target customer industry (1-3)
      for (const targetIndustry of targetIndustries) {
        // Generate unique query using dynamic strategies
        const query = generateUniqueQuery(
          targetIndustry,
          countryName,
          BIGQUERY_BATCH_SIZE,
          iteration + 1,
          usedQueries,
        )

        if (!query) {
          console.warn(
            `[DiscoveryPhase] No more unique queries for industry "${targetIndustry}", skipping`,
          )
          continue
        }

        console.log(`[DiscoveryPhase] Query for "${targetIndustry}": "${query}"`)
        isFirstQuery = false

        // Search BigQuery
        const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
          limitOverride: BIGQUERY_BATCH_SIZE,
        })

        if (!result.results.length) {
          console.log(`[DiscoveryPhase] No results from BigQuery for "${targetIndustry}"`)
          continue
        }

        console.log(
          `[DiscoveryPhase] Found ${result.results.length} results for "${targetIndustry}"`,
        )

        // Filter and add to combined leads list
        let newLeadsAdded = 0
        for (const row of result.results) {
          const website = row.website as string
          if (!website) continue
          // Skip already processed websites
          if (processedWebsites.has(website.toLowerCase())) continue
          processedWebsites.add(website.toLowerCase())

          allLeadsToEnrich.push({
            company: row.company as string,
            website,
            industry: row.industry as string,
            employees: row.employees?.toString() || "",
            country: row.country as string,
          })
          newLeadsAdded++
        }

        console.log(
          `[DiscoveryPhase] Added ${newLeadsAdded} new leads from "${targetIndustry}" ` +
            `(${result.results.length - newLeadsAdded} duplicates)`,
        )
      }

      console.log(
        `[DiscoveryPhase] Total new leads this iteration: ${allLeadsToEnrich.length}. ` +
          `Total unique websites: ${processedWebsites.size}`,
      )

      if (allLeadsToEnrich.length === 0) {
        console.log(`[DiscoveryPhase] No new leads to enrich in iteration ${iteration + 1}`)
        continue
      }

      // Process combined leads in batches
      const totalBatches = Math.ceil(allLeadsToEnrich.length / ENRICHMENT_BATCH_SIZE)
      let totalEnrichedCount = 0

      for (let i = 0; i < allLeadsToEnrich.length; i += ENRICHMENT_BATCH_SIZE) {
        const batch = allLeadsToEnrich.slice(i, i + ENRICHMENT_BATCH_SIZE)
        const batchNum = Math.floor(i / ENRICHMENT_BATCH_SIZE) + 1
        globalBatchNum++

        console.log(
          `[DiscoveryPhase] Enriching batch ${batchNum}/${totalBatches} (${batch.length} leads)`,
        )

        // Enrich this batch (reuse existing function)
        const enrichedBatch = await enrichLeadsForOnboarding(batch)

        const enrichedCount = enrichedBatch.filter((l) => l.primaryEmail).length
        totalEnrichedCount += enrichedCount
        console.log(
          `[DiscoveryPhase] Batch ${batchNum}: ${enrichedCount}/${enrichedBatch.length} have emails`,
        )

        // Emit SSE + Save to DB: Batch progress
        const currentCount = await countLeadsWithEmails(workspaceId)
        const progressPercent = Math.min(55, 15 + Math.floor((currentCount / TARGET_LEADS) * 40))
        await emitAndSaveNotification(
          createDiscoveryBatchEvent(
            workspaceId,
            jobId,
            globalBatchNum,
            MAX_SEARCH_ITERATIONS *
              targetIndustries.length *
              Math.ceil(BIGQUERY_BATCH_SIZE / ENRICHMENT_BATCH_SIZE),
            currentCount,
            totalEnrichedCount,
          ),
          userId,
        )

        // Update progress
        await job.updateProgress({
          phase: "discovery",
          progressPercent,
        })

        // Filter and save batch with emails
        const batchWithEmails = enrichedBatch.filter((lead) => {
          if (!lead.primaryEmail) return false
          const email = lead.primaryEmail.toLowerCase()
          // Filter out generic no-reply addresses
          if (email.includes("noreply")) return false
          if (email.startsWith("postmaster@")) return false
          if (email.startsWith("abuse@")) return false
          return true
        })

        // Save batch immediately if any leads have emails
        if (batchWithEmails.length > 0) {
          console.log(
            `[DiscoveryPhase] Saving batch ${batchNum}: ${batchWithEmails.length} leads with emails`,
          )

          const leadsToCreate = batchWithEmails.map((lead) => ({
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
            `[DiscoveryPhase] Batch ${batchNum} saved: ${stats.created} new leads (${stats.skipped} duplicates)`,
          )
        }

        // Check if we've reached target after this batch
        const afterSaveCount = await countLeadsWithEmails(workspaceId)
        console.log(`[DiscoveryPhase] Progress: ${afterSaveCount}/${TARGET_LEADS} leads`)

        if (afterSaveCount >= TARGET_LEADS) {
          console.log(
            `[DiscoveryPhase] Target reached! Stopping enrichment at iteration ${iteration + 1}, batch ${batchNum}/${totalBatches}`,
          )
          break
        }
      }

      // Check if target reached after this iteration
      const afterIterationCount = await countLeadsWithEmails(workspaceId)
      if (afterIterationCount >= TARGET_LEADS) {
        break
      }
    }

    // ============================================
    // STEP 2: Hunter.io Fallback (if < 150 leads)
    // ============================================
    const afterBigQueryCount = await countLeadsWithEmails(workspaceId)
    console.log(
      `[DiscoveryPhase] BigQuery complete. Lead count: ${afterBigQueryCount}/${TARGET_LEADS}`,
    )

    if (afterBigQueryCount < TARGET_LEADS) {
      console.log("[DiscoveryPhase] Starting Hunter.io fallback discovery")

      // Hunter.io fallback
      const hunterLeads = await discoverLeadsWithHunterIO(
        context,
        afterBigQueryCount,
        processedWebsites,
      )

      // Save Hunter.io leads to DB
      if (hunterLeads.length > 0) {
        console.log(`[DiscoveryPhase] Saving ${hunterLeads.length} leads from Hunter.io`)

        const leadsToCreate = hunterLeads.map((lead) => ({
          companyName: lead.companyName,
          foundCompanyName: lead.companyName,
          websiteUrl: lead.websiteUrl,
          primaryEmail: lead.primaryEmail,
          leadSource: "hunterio-discover" as const,
          leadStatus: "new" as const,
        }))

        const { stats } = await bulkCreateLeads({
          workspaceId,
          leads: leadsToCreate,
          createdBy: userId,
        })

        console.log(
          `[DiscoveryPhase] Hunter.io leads saved: ${stats.created} new (${stats.skipped} duplicates)`,
        )
      }
    }

    // Update checkpoint with final count
    const finalCount = await countLeadsWithEmails(workspaceId)
    await saveCheckpoint(job, {
      leadsWithEmailsCount: finalCount,
      lastIterationCompleted: true,
    })

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
  const { workspaceId, userId } = context
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
        status: "lead_search", // Keep at lead_search status
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
