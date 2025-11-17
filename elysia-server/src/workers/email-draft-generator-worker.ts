/**
 * Email Draft Generator Worker
 *
 * This worker runs in the background to asynchronously generate personalized email drafts
 * for each enrollment when a new sequence is activated or when leads are enrolled.
 *
 * Features:
 * - Generates drafts for all steps upfront
 * - Stores drafts with personalized content
 * - Handles AI-powered generation if configured
 * - Processes in batches to avoid overwhelming the system
 */

import { and, eq } from "drizzle-orm"
// import { config } from "../config"
import { db } from "../db/index"
import { leadContacts, leadIndustryTypes } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import { sequenceEnrollments, sequenceSteps } from "../db/schema/sequences"
import { workflowGeneratedEmails } from "../db/schema/workflow-emails"
import * as workflowEmailService from "../services/workflow-email.service"
import { mastra } from "../shared/mastra"
import logger from "../utils/logger"

interface LeadContext {
  companyName?: string
  contactName?: string
  contactEmail?: string
  industry?: string
  businessType?: string
  website?: string
  description?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: string
  employeeCount?: string
  leadSource?: string
  leadStatus?: string
  leadScore?: string
  [key: string]: string | undefined
}

/**
 * Generate email drafts for a single enrollment across all steps
 */
async function generateDraftsForEnrollment(enrollmentId: string): Promise<{
  success: boolean
  draftsGenerated: number
  error?: string
}> {
  try {
    logger.info({ enrollmentId }, "🎨 [DRAFT-WORKER] Starting draft generation for enrollment")

    // 1. Get enrollment details
    const [enrollment] = await db
      .select({
        id: sequenceEnrollments.id,
        sequenceId: sequenceEnrollments.sequenceId,
        leadId: sequenceEnrollments.leadId,
        userEmailAccountId: sequenceEnrollments.userEmailAccountId,
        status: sequenceEnrollments.status,
      })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .limit(1)

    if (!enrollment) {
      logger.error({ enrollmentId }, "❌ [DRAFT-WORKER] Enrollment not found")
      return { success: false, draftsGenerated: 0, error: "Enrollment not found" }
    }

    // Skip if enrollment is not active
    if (enrollment.status !== "active") {
      logger.info(
        { enrollmentId, status: enrollment.status },
        "⏭️ [DRAFT-WORKER] Skipping inactive enrollment",
      )
      return { success: true, draftsGenerated: 0 }
    }

    // 2. Get sequence steps
    const steps = await db
      .select({
        id: sequenceSteps.id,
        stepOrder: sequenceSteps.stepOrder,
        emailSubject: sequenceSteps.emailSubject,
        emailBodyText: sequenceSteps.emailBodyText,
        emailBodyHtml: sequenceSteps.emailBodyHtml,
        generationSource: sequenceSteps.generationSource,
      })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, enrollment.sequenceId))
      .orderBy(sequenceSteps.stepOrder)

    if (steps.length === 0) {
      logger.warn({ enrollmentId }, "⚠️ [DRAFT-WORKER] No steps found for sequence")
      return { success: true, draftsGenerated: 0 }
    }

    logger.info(
      { enrollmentId, stepsCount: steps.length },
      "📋 [DRAFT-WORKER] Found sequence steps",
    )

    // 3. Get lead context for personalization
    const leadContext = await fetchLeadContext(enrollment.leadId)
    if (!leadContext) {
      logger.error({ enrollmentId, leadId: enrollment.leadId }, "❌ [DRAFT-WORKER] Lead not found")
      return { success: false, draftsGenerated: 0, error: "Lead not found" }
    }

    logger.debug(
      {
        enrollmentId,
        leadContext: {
          companyName: leadContext.companyName,
          contactName: leadContext.contactName,
          industry: leadContext.industry,
        },
      },
      "✅ [DRAFT-WORKER] Fetched lead context",
    )

    // 4. Generate drafts for each step
    let draftsGenerated = 0
    for (const step of steps) {
      try {
        // Replace template variables with lead context
        const personalizedSubject = workflowEmailService.replaceTemplateVariables(
          step.emailSubject,
          leadContext,
        )
        const personalizedBodyText = step.emailBodyText
          ? workflowEmailService.replaceTemplateVariables(step.emailBodyText, leadContext)
          : null
        const personalizedBodyHtml = step.emailBodyHtml
          ? workflowEmailService.replaceTemplateVariables(step.emailBodyHtml, leadContext)
          : null

        logger.debug(
          {
            enrollmentId,
            stepOrder: step.stepOrder,
            originalSubject: step.emailSubject,
            personalizedSubject,
          },
          "🔄 [DRAFT-WORKER] Personalized email content",
        )

        // Store draft in workflow_generated_emails table
        const [insertedDraft] = await db
          .insert(workflowGeneratedEmails)
          .values({
            sequenceId: enrollment.sequenceId,
            nodeId: step.id, // nodeId = stepId (we use stepId as nodeId for step-based sequences)
            leadId: enrollment.leadId,
            subject: personalizedSubject,
            bodyText: personalizedBodyText,
            bodyHtml: personalizedBodyHtml,
            status: "generated",
            generationMode: "template",
            contextSnapshot: leadContext,
            generatedAt: new Date(),
          })
          .returning({ id: workflowGeneratedEmails.id })

        if (!insertedDraft) {
          logger.error(
            { enrollmentId, stepOrder: step.stepOrder },
            "❌ [DRAFT-WORKER] Failed to store generated draft",
          )
          continue
        }

        logger.info(
          {
            enrollmentId,
            stepOrder: step.stepOrder,
            draftId: insertedDraft.id,
            draftPreview: {
              subject: personalizedSubject.substring(0, 50),
              bodyLength: personalizedBodyText?.length || 0,
            },
          },
          "✅ [DRAFT-WORKER] Generated and stored draft",
        )

        draftsGenerated++
      } catch (stepError) {
        logger.error(
          {
            err: stepError,
            enrollmentId,
            stepId: step.id,
            stepOrder: step.stepOrder,
          },
          "❌ [DRAFT-WORKER] Failed to generate draft for step",
        )
        // Continue with other steps even if one fails
      }
    }

    logger.info(
      { enrollmentId, draftsGenerated, totalSteps: steps.length },
      "🎉 [DRAFT-WORKER] Completed draft generation for enrollment",
    )

    return { success: true, draftsGenerated }
  } catch (error: unknown) {
    logger.error({ err: error, enrollmentId }, "💥 [DRAFT-WORKER] Error generating drafts")
    return {
      success: false,
      draftsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Generate AI-powered drafts (optional, more advanced)
 */
async function generateAIDraftsForEnrollment(
  enrollmentId: string,
  aiPrompt?: string,
): Promise<{
  success: boolean
  draftsGenerated: number
  error?: string
}> {
  try {
    logger.info({ enrollmentId }, "🤖 [DRAFT-WORKER-AI] Starting AI draft generation")

    // 1. Get enrollment and lead details
    const [enrollment] = await db
      .select({
        id: sequenceEnrollments.id,
        sequenceId: sequenceEnrollments.sequenceId,
        leadId: sequenceEnrollments.leadId,
      })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .limit(1)

    if (!enrollment) {
      return { success: false, draftsGenerated: 0, error: "Enrollment not found" }
    }

    // 2. Get lead info
    const [lead] = await db
      .select({
        companyName: leads.companyName,
        businessType: leads.businessType,
        websiteUrl: leads.websiteUrl,
      })
      .from(leads)
      .where(eq(leads.id, enrollment.leadId))
      .limit(1)

    if (!lead) {
      return { success: false, draftsGenerated: 0, error: "Lead not found" }
    }

    // 3. Get steps
    const steps = await db
      .select({
        id: sequenceSteps.id,
        stepOrder: sequenceSteps.stepOrder,
      })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, enrollment.sequenceId))
      .orderBy(sequenceSteps.stepOrder)

    if (steps.length === 0) {
      return { success: true, draftsGenerated: 0 }
    }

    // 4. Generate AI drafts for each step using Mastra workflow
    let draftsGenerated = 0

    for (const step of steps) {
      try {
        // Get lead context for snapshot
        const leadContext = await fetchLeadContext(enrollment.leadId)

        // Use Mastra workflow for email generation
        const sequenceEmailWorkflow = mastra.getWorkflow("sequenceEmailGenerationWorkflow")
        const emailRun = await sequenceEmailWorkflow.createRunAsync()
        const emailResult = await emailRun.start({
          inputData: {
            context: {
              companyName: lead.companyName || "",
              industry: lead.businessType || undefined,
              website: lead.websiteUrl || undefined,
              additionalContext: aiPrompt || `Generate email for step ${step.stepOrder}`,
            },
          },
        })

        if (emailResult.status === "failed") {
          logger.warn(
            {
              enrollmentId,
              stepOrder: step.stepOrder,
              error: emailResult.error.message,
            },
            "⚠️ [DRAFT-WORKER-AI] AI generation failed for step",
          )
          continue
        }

        const emailStepResult = emailResult.steps["generate-sequence-email"]
        if (!emailStepResult || emailStepResult.status !== "success") {
          logger.warn(
            {
              enrollmentId,
              stepOrder: step.stepOrder,
              error: "Step execution failed",
            },
            "⚠️ [DRAFT-WORKER-AI] AI generation failed for step",
          )
          continue
        }

        const result = emailStepResult.output as {
          success: boolean
          subject?: string
          bodyText?: string
          error?: string
        }

        if (result.success && result.subject && result.bodyText) {
          // Store AI-generated draft in workflow_generated_emails table
          const [insertedDraft] = await db
            .insert(workflowGeneratedEmails)
            .values({
              sequenceId: enrollment.sequenceId,
              nodeId: step.id, // nodeId = stepId (we use stepId as nodeId for step-based sequences)
              leadId: enrollment.leadId,
              subject: result.subject,
              bodyText: result.bodyText,
              bodyHtml: undefined,
              status: "generated",
              generationMode: "ai",
              aiPrompt: aiPrompt || `Generate email for step ${step.stepOrder}`,
              aiModel: "gpt-4-turbo-preview",
              contextSnapshot: leadContext || {
                companyName: lead.companyName || "",
                businessType: lead.businessType || undefined,
                website: lead.websiteUrl,
              },
              generatedAt: new Date(),
            })
            .returning({ id: workflowGeneratedEmails.id })

          if (!insertedDraft) {
            logger.error(
              { enrollmentId, stepOrder: step.stepOrder },
              "❌ [DRAFT-WORKER-AI] Failed to store AI draft",
            )
            continue
          }

          logger.info(
            {
              enrollmentId,
              stepOrder: step.stepOrder,
              draftId: insertedDraft.id,
            },
            "✅ [DRAFT-WORKER-AI] Generated and stored AI draft",
          )
          draftsGenerated++
        } else {
          logger.warn(
            {
              enrollmentId,
              stepOrder: step.stepOrder,
              error: result.error,
            },
            "⚠️ [DRAFT-WORKER-AI] AI generation failed for step",
          )
        }
      } catch (stepError) {
        logger.error(
          { err: stepError, enrollmentId, stepOrder: step.stepOrder },
          "❌ [DRAFT-WORKER-AI] Error generating AI draft",
        )
      }
    }

    logger.info(
      { enrollmentId, draftsGenerated, totalSteps: steps.length },
      "🎉 [DRAFT-WORKER-AI] Completed AI draft generation",
    )

    return { success: true, draftsGenerated }
  } catch (error: unknown) {
    logger.error({ err: error, enrollmentId }, "💥 [DRAFT-WORKER-AI] Error in AI generation")
    return {
      success: false,
      draftsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Fetch complete lead context for personalization
 */
async function fetchLeadContext(leadId: string): Promise<LeadContext | null> {
  try {
    // Get lead's primary email and contact name
    const [leadContact] = await db
      .select({
        email: leadContacts.contactValue,
        contactName: leadContacts.contactName,
      })
      .from(leadContacts)
      .where(
        and(
          eq(leadContacts.leadId, leadId),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )
      .limit(1)

    if (!leadContact) {
      return null
    }

    // Get full lead information
    const [lead] = await db
      .select({
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        businessType: leads.businessType,
        description: leads.description,
        address: leads.address,
        country: leads.country,
        city: leads.city,
        state: leads.state,
        foundedYear: leads.foundedYear,
        employeeCount: leads.employeeCount,
        leadSource: leads.leadSource,
        leadStatus: leads.leadStatus,
        leadScore: leads.leadScore,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)

    if (!lead) {
      return null
    }

    // Get industry types
    const industries = await db
      .select({
        industryName: leadIndustryTypes.industryName,
      })
      .from(leadIndustryTypes)
      .where(eq(leadIndustryTypes.leadId, leadId))

    const industryString = industries.map((i) => i.industryName).join(", ")

    return {
      companyName: lead.companyName || "",
      contactName: leadContact.contactName || "",
      contactEmail: leadContact.email || "",
      industry: industryString || "",
      businessType: lead.businessType || "",
      website: lead.websiteUrl || "",
      description: lead.description || "",
      address: lead.address || "",
      country: lead.country || "",
      city: lead.city || "",
      state: lead.state || "",
      foundedYear: lead.foundedYear?.toString() || "",
      employeeCount: lead.employeeCount || "",
      leadSource: lead.leadSource || "",
      leadStatus: lead.leadStatus || "",
      leadScore: lead.leadScore?.toString() || "",
    }
  } catch (error) {
    logger.error({ err: error, leadId }, "Failed to fetch lead context")
    return null
  }
}

/**
 * Process pending enrollments that need draft generation
 */
async function processPendingDraftGeneration(_limit: number = 50): Promise<void> {
  try {
    logger.debug("🔍 [DRAFT-WORKER] Checking for pending draft generation")

    // TODO: Query enrollments that need drafts generated
    // For now, this is a placeholder
    // We would need a flag in enrollments table like "drafts_generated: boolean"

    // Get recent active enrollments without drafts
    // const pendingEnrollments = await db
    //   .select({ id: sequenceEnrollments.id })
    //   .from(sequenceEnrollments)
    //   .where(
    //     and(
    //       eq(sequenceEnrollments.status, "active"),
    //       eq(sequenceEnrollments.draftsGenerated, false)
    //     )
    //   )
    //   .limit(limit)

    // For demonstration, we'll just log
    logger.trace("⏳ [DRAFT-WORKER] No pending enrollments for draft generation")
  } catch (error) {
    logger.error({ err: error }, "💥 [DRAFT-WORKER] Error checking pending drafts")
  }
}

/**
 * DUMMY FUNCTION - Bulk generate drafts for multiple enrollments
 * This serves as a placeholder for the batch processing system
 */
export async function bulkGenerateDraftsForEnrollments(
  enrollmentIds: string[],
  options?: {
    useAI?: boolean
    aiPrompt?: string
    batchSize?: number
  },
): Promise<{
  totalProcessed: number
  successful: number
  failed: number
  totalDrafts: number
}> {
  const batchSize = options?.batchSize || 10
  let totalProcessed = 0
  let successful = 0
  let failed = 0
  let totalDrafts = 0

  logger.info(
    {
      enrollmentCount: enrollmentIds.length,
      useAI: options?.useAI || false,
      batchSize,
    },
    "🎨 [DRAFT-WORKER] Starting bulk draft generation",
  )

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < enrollmentIds.length; i += batchSize) {
    const batch = enrollmentIds.slice(i, i + batchSize)

    logger.debug(
      {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
      },
      "📦 [DRAFT-WORKER] Processing batch",
    )

    // Process batch in parallel
    const results = await Promise.all(
      batch.map((enrollmentId) =>
        options?.useAI
          ? generateAIDraftsForEnrollment(enrollmentId, options.aiPrompt)
          : generateDraftsForEnrollment(enrollmentId),
      ),
    )

    // Aggregate results
    for (const result of results) {
      totalProcessed++
      if (result.success) {
        successful++
        totalDrafts += result.draftsGenerated
      } else {
        failed++
      }
    }

    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < enrollmentIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  logger.info(
    {
      totalProcessed,
      successful,
      failed,
      totalDrafts,
    },
    "🎉 [DRAFT-WORKER] Completed bulk draft generation",
  )

  return { totalProcessed, successful, failed, totalDrafts }
}

/**
 * Start the draft generator worker (runs periodically)
 */
export function startEmailDraftGeneratorWorker(): () => void {
  logger.info("✅ [DRAFT-WORKER] Email draft generator worker started")

  // Run immediately
  processPendingDraftGeneration()

  // Then run every 5 minutes
  const intervalId = setInterval(processPendingDraftGeneration, 5 * 60 * 1000)

  // Return function to stop worker
  return () => {
    logger.info("🛑 [DRAFT-WORKER] Stopping email draft generator worker")
    clearInterval(intervalId)
  }
}

// Export for testing and manual triggering
export {
  generateDraftsForEnrollment,
  generateAIDraftsForEnrollment,
  fetchLeadContext,
  processPendingDraftGeneration,
}
export type { LeadContext }
