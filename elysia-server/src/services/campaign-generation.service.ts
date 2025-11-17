/**
 * Campaign Generation Service
 *
 * Generates AI-powered email campaigns with 6-step template
 * Creates personalized drafts for each lead in workflow_generated_emails table
 */

import { eq, inArray } from "drizzle-orm"
import { db } from "../db/index"
import {
  leadBusinessSectors,
  leadContacts,
  leadIndustryTypes,
  leadProductCategories,
  leadProducts,
  leadSocialMedia,
} from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import {
  // sequenceEnrollments,
  // sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { workflowGeneratedEmails } from "../db/schema/workflow-emails"
import { workspaces } from "../db/schema/workspaces"
import { mastra } from "../shared/mastra"
import { model } from "../shared/mastra/shell/agents/sequence-email-agent/constants"
import type { CampaignStepsResponse } from "../shared/mastra/shell/workflows/steps-generation/types"
import logger from "../utils/logger"

// import { calculateScheduledTime } from "../utils/timezone"

// 6-Step Campaign Template (from user requirements)
const CAMPAIGN_STEPS = [
  {
    stepOrder: 1,
    emailType: "Cold Introduction",
    delayDays: 0, // Day 1
    scheduledHour: 9, // 9 AM
    scheduledMinute: 0,
    timezone: "UTC",
  },
  {
    stepOrder: 2,
    emailType: "Value Follow-Up",
    delayDays: 3, // +3 days
    scheduledHour: 10,
    scheduledMinute: 0,
    timezone: "UTC",
  },
  {
    stepOrder: 3,
    emailType: "Problem-Solution Nudge",
    delayDays: 5, // +5 days
    scheduledHour: 11,
    scheduledMinute: 0,
    timezone: "UTC",
  },
  {
    stepOrder: 4,
    emailType: "Soft Bump",
    delayDays: 4, // +4 days
    scheduledHour: 14,
    scheduledMinute: 0,
    timezone: "UTC",
  },
  {
    stepOrder: 5,
    emailType: "Meeting Request",
    delayDays: 5, // +5 days
    scheduledHour: 10,
    scheduledMinute: 30,
    timezone: "UTC",
  },
  {
    stepOrder: 6,
    emailType: "Breakup / Last Touch",
    delayDays: 7, // +6-7 days
    scheduledHour: 15,
    scheduledMinute: 0,
    timezone: "UTC",
  },
]

interface LeadInfo {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  industry: string
  businessType?: string
  websiteUrl?: string
  description?: string
  // Enriched context
  contacts: Array<{
    contactName?: string
    email: string
    type: string
    label?: string
    isPrimary: boolean
  }>
  socialMedia: Array<{
    platform: string
    url: string
    username?: string
    followerCount?: string
  }>
  products: Array<{
    productName: string
    description?: string
  }>
  businessSectors: string[]
  productCategories: string[]
  industryTypes: string[]
}

/**
 * Generate AI-powered campaign for a sequence
 */
export async function generateAICampaign(data: {
  sequenceId: string
  workspaceId: string
  customerGroupId: string
  userEmailAccountId?: string // Optional - not needed for draft generation only
}): Promise<{
  success: boolean
  totalLeads: number
  totalDrafts: number
  stepsCreated: number
  enrollmentsCreated: number
  executionsCreated: number
  aiGenerated: boolean
  error?: string
}> {
  try {
    logger.info(
      {
        sequenceId: data.sequenceId,
        workspaceId: data.workspaceId,
        customerGroupId: data.customerGroupId,
      },
      "🚀 [CAMPAIGN-GEN] Starting AI campaign generation",
    )
    db.update(sequences)
      .set({ status: "generating" })
      .where(eq(sequences.id, data.sequenceId))
      .returning()

    // 1. Get workspace information
    const [workspace] = await db
      .select({
        name: workspaces.name,
        companyName: workspaces.companyName,
        companyWebsite: workspaces.companyWebsite,
        industry: workspaces.industry,
        companyDescription: workspaces.companyDescription,
        companySize: workspaces.companySize,
      })
      .from(workspaces)
      .where(eq(workspaces.id, data.workspaceId))
      .limit(1)

    if (!workspace) {
      throw new Error("Workspace not found")
    }

    logger.info(
      {
        workspaceName: workspace.name,
        companyName: workspace.companyName,
      },
      "✅ [CAMPAIGN-GEN] Found workspace info",
    )

    // 2. Get all leads from customer group
    const { getCustomerGroupLeads } = await import("./customer-group.service")
    const groupLeads = await getCustomerGroupLeads(data.customerGroupId)

    if (groupLeads.length === 0) {
      throw new Error("No leads found in customer group")
    }

    logger.info({ leadCount: groupLeads.length }, "✅ [CAMPAIGN-GEN] Found leads in customer group")

    // 3. Fetch full lead details with contacts (optimized with batch queries)
    const leadIds = groupLeads.map((l: { id: string }) => l.id)
    const leadsInfo: LeadInfo[] = []

    logger.info(
      { leadIds: leadIds.length },
      "🔍 [CAMPAIGN-GEN] Fetching lead details in batch queries",
    )

    // Batch fetch all leads at once
    const allLeads = await db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        businessType: leads.businessType,
        websiteUrl: leads.websiteUrl,
        description: leads.description,
      })
      .from(leads)
      .where(inArray(leads.id, leadIds))

    logger.info({ fetchedLeads: allLeads.length }, "✅ [CAMPAIGN-GEN] Fetched all leads")

    // Batch fetch all contacts at once (not just primary)
    const allContacts = await db
      .select({
        leadId: leadContacts.leadId,
        contactName: leadContacts.contactName,
        email: leadContacts.contactValue,
        contactType: leadContacts.contactType,
        label: leadContacts.label,
        isPrimary: leadContacts.isPrimary,
      })
      .from(leadContacts)
      .where(inArray(leadContacts.leadId, leadIds))

    logger.info(
      { fetchedContacts: allContacts.length },
      "✅ [CAMPAIGN-GEN] Fetched all primary contacts",
    )

    // Batch fetch all industries at once
    const allIndustries = await db
      .select({
        leadId: leadIndustryTypes.leadId,
        industryName: leadIndustryTypes.industryName,
      })
      .from(leadIndustryTypes)
      .where(inArray(leadIndustryTypes.leadId, leadIds))

    logger.info(
      { fetchedIndustries: allIndustries.length },
      "✅ [CAMPAIGN-GEN] Fetched all industries",
    )

    // Batch fetch all social media at once
    const allSocialMedia = await db
      .select({
        leadId: leadSocialMedia.leadId,
        platform: leadSocialMedia.platform,
        url: leadSocialMedia.url,
        username: leadSocialMedia.username,
        followerCount: leadSocialMedia.followerCount,
      })
      .from(leadSocialMedia)
      .where(inArray(leadSocialMedia.leadId, leadIds))

    logger.info(
      { fetchedSocialMedia: allSocialMedia.length },
      "✅ [CAMPAIGN-GEN] Fetched all social media profiles",
    )

    // Batch fetch all products at once
    const allProducts = await db
      .select({
        leadId: leadProducts.leadId,
        productName: leadProducts.productName,
        description: leadProducts.description,
      })
      .from(leadProducts)
      .where(inArray(leadProducts.leadId, leadIds))

    logger.info({ fetchedProducts: allProducts.length }, "✅ [CAMPAIGN-GEN] Fetched all products")

    // Batch fetch all business sectors at once
    const allBusinessSectors = await db
      .select({
        leadId: leadBusinessSectors.leadId,
        sectorName: leadBusinessSectors.sectorName,
      })
      .from(leadBusinessSectors)
      .where(inArray(leadBusinessSectors.leadId, leadIds))

    logger.info(
      { fetchedBusinessSectors: allBusinessSectors.length },
      "✅ [CAMPAIGN-GEN] Fetched all business sectors",
    )

    // Batch fetch all product categories at once
    const allProductCategories = await db
      .select({
        leadId: leadProductCategories.leadId,
        categoryName: leadProductCategories.categoryName,
      })
      .from(leadProductCategories)
      .where(inArray(leadProductCategories.leadId, leadIds))

    logger.info(
      { fetchedProductCategories: allProductCategories.length },
      "✅ [CAMPAIGN-GEN] Fetched all product categories",
    )

    // Create lookup maps for efficient combining
    const contactsByLeadId = allContacts.reduce(
      (acc, c) => {
        if (!acc.has(c.leadId)) {
          acc.set(c.leadId, [])
        }
        acc.get(c.leadId)?.push({
          contactName: c.contactName || undefined,
          email: c.email,
          type: c.contactType,
          label: c.label || undefined,
          isPrimary: c.isPrimary,
        })
        return acc
      },
      new Map<
        string,
        Array<{
          contactName?: string
          email: string
          type: string
          label?: string
          isPrimary: boolean
        }>
      >(),
    )

    const socialMediaByLeadId = allSocialMedia.reduce((acc, s) => {
      if (!acc.has(s.leadId)) {
        acc.set(s.leadId, [])
      }
      acc.get(s.leadId)?.push({
        platform: s.platform,
        url: s.url,
        username: s.username || undefined,
        followerCount: s.followerCount || undefined,
      })
      return acc
    }, new Map<
      string,
      Array<{ platform: string; url: string; username?: string; followerCount?: string }>
    >())

    const productsByLeadId = allProducts.reduce((acc, p) => {
      if (!acc.has(p.leadId)) {
        acc.set(p.leadId, [])
      }
      acc.get(p.leadId)?.push({
        productName: p.productName,
        description: p.description || undefined,
      })
      return acc
    }, new Map<string, Array<{ productName: string; description?: string }>>())

    const businessSectorsByLeadId = allBusinessSectors.reduce((acc, s) => {
      if (!acc.has(s.leadId)) {
        acc.set(s.leadId, [])
      }
      acc.get(s.leadId)?.push(s.sectorName)
      return acc
    }, new Map<string, string[]>())

    const productCategoriesByLeadId = allProductCategories.reduce((acc, c) => {
      if (!acc.has(c.leadId)) {
        acc.set(c.leadId, [])
      }
      acc.get(c.leadId)?.push(c.categoryName)
      return acc
    }, new Map<string, string[]>())

    const industriesByLeadId = allIndustries.reduce((acc, i) => {
      if (!acc.has(i.leadId)) {
        acc.set(i.leadId, [])
      }
      acc.get(i.leadId)?.push(i.industryName)
      return acc
    }, new Map<string, string[]>())

    // Combine data in memory
    for (const lead of allLeads) {
      const contacts = contactsByLeadId.get(lead.id) || []
      // Find primary email contact, or first contact with email
      const primaryContact = contacts.find((c) => c.isPrimary && c.type === "email") || contacts[0]
      if (!primaryContact) continue // Skip leads without any contact

      const industries = industriesByLeadId.get(lead.id) || []
      const socialMedia = socialMediaByLeadId.get(lead.id) || []
      const products = productsByLeadId.get(lead.id) || []
      const businessSectors = businessSectorsByLeadId.get(lead.id) || []
      const productCategories = productCategoriesByLeadId.get(lead.id) || []

      leadsInfo.push({
        id: lead.id,
        companyName: lead.companyName || "",
        contactName: primaryContact.contactName || "",
        contactEmail: primaryContact.email,
        industry: industries.join(", "),
        businessType: lead.businessType || undefined,
        websiteUrl: lead.websiteUrl || undefined,
        description: lead.description || undefined,
        // Enriched context
        contacts,
        socialMedia,
        products,
        businessSectors,
        productCategories,
        industryTypes: industries,
      })
    }

    logger.info(
      { totalLeadsWithEmail: leadsInfo.length },
      "✅ [CAMPAIGN-GEN] Combined lead details with contacts",
    )

    // 4. Generate AI campaign steps (with fallback to hardcoded template)
    let stepsToUse: typeof CAMPAIGN_STEPS
    let aiGenerated = false
    let createdSteps: Array<{
      id: string
      stepOrder: number
      emailType: string
      delayDays: number
      scheduledHour: number | null
      scheduledMinute: number | null
      timezone: string | null
      purpose: string
      emailSubject: string
    }> = []

    logger.info("🤖 [CAMPAIGN-GEN] Attempting AI step generation")

    try {
      const aiStepsResult = await generateAICampaignSteps({
        sequenceId: data.sequenceId,
        workspaceId: data.workspaceId,
        customerGroupId: data.customerGroupId,
      })

      if (aiStepsResult.success && aiStepsResult.steps && aiStepsResult.steps.length > 0) {
        // Map AI-generated steps to template format
        stepsToUse = aiStepsResult.steps.map((s) => ({
          stepOrder: s.stepOrder,
          emailType: s.emailType,
          delayDays: s.delayDays,
          scheduledHour: s.scheduledHour ?? 9,
          scheduledMinute: s.scheduledMinute ?? 0,
          timezone: s.timezone ?? "UTC",
        }))
        aiGenerated = true
        createdSteps = aiStepsResult.steps
        logger.info(
          { stepsCount: stepsToUse.length, reasoning: aiStepsResult.reasoning },
          "✅ [CAMPAIGN-GEN] Using AI-generated steps",
        )
      } else {
        throw new Error("AI generation returned no steps")
      }
    } catch (aiError) {
      logger.warn(
        { err: aiError },
        "⚠️ [CAMPAIGN-GEN] AI step generation failed, using hardcoded 6-step template",
      )
      stepsToUse = CAMPAIGN_STEPS
      aiGenerated = false
    }

    // 5. If AI generation failed, create steps in database from hardcoded template
    if (!aiGenerated && createdSteps.length === 0) {
      logger.info("📝 [CAMPAIGN-GEN] Creating hardcoded steps in database")
      for (const stepTemplate of stepsToUse) {
        const [dbStep] = await db
          .insert(sequenceSteps)
          .values({
            sequenceId: data.sequenceId,
            stepOrder: stepTemplate.stepOrder,
            delayDays: stepTemplate.delayDays,
            scheduledHour: stepTemplate.scheduledHour,
            scheduledMinute: stepTemplate.scheduledMinute,
            timezone: stepTemplate.timezone,
            emailSubject: stepTemplate.emailType,
            emailBodyText: `[${stepTemplate.emailType}] ${stepTemplate.emailType}`,
            emailBodyHtml: null,
            generationSource: "ai",
          })
          .returning({
            id: sequenceSteps.id,
            stepOrder: sequenceSteps.stepOrder,
            delayDays: sequenceSteps.delayDays,
            scheduledHour: sequenceSteps.scheduledHour,
            scheduledMinute: sequenceSteps.scheduledMinute,
            timezone: sequenceSteps.timezone,
            emailSubject: sequenceSteps.emailSubject,
          })

        if (dbStep) {
          createdSteps.push({
            ...dbStep,
            emailType: stepTemplate.emailType,
            purpose: getStepPurpose(stepTemplate.stepOrder),
          })
        }
      }
      logger.info(
        { stepsCreated: createdSteps.length },
        "✅ [CAMPAIGN-GEN] Created hardcoded steps in database",
      )
    }

    // 6. Create all enrollments for all leads upfront
    const totalEnrollments = 0
    const totalExecutions = 0
    let totalDrafts = 0

    const currentTime = new Date()
    // const enrollmentsByLeadId = new Map<string, string>() // leadId -> enrollmentId

    // COMMENTED OUT: Enrollment creation - not needed for AI draft generation
    // logger.info(
    //   { totalLeads: leadsInfo.length },
    //   "📝 [CAMPAIGN-GEN] Creating enrollments for all leads",
    // )

    // for (const leadInfo of leadsInfo) {
    //   const [enrollment] = await db
    //     .insert(sequenceEnrollments)
    //     .values({
    //       sequenceId: data.sequenceId,
    //       leadId: leadInfo.id,
    //       userEmailAccountId: data.userEmailAccountId,
    //       status: "active",
    //       currentStepOrder: 1,
    //       enrolledAt: currentTime,
    //     })
    //     .returning({
    //       id: sequenceEnrollments.id,
    //     })

    //   if (enrollment) {
    //     enrollmentsByLeadId.set(leadInfo.id, enrollment.id)
    //     totalEnrollments++
    //   }
    // }

    logger.info(
      { totalLeads: leadsInfo.length },
      "📝 [CAMPAIGN-GEN] Starting email draft generation (enrollments disabled)",
    )

    // 7. Process step-by-step: for each step, process all leads
    for (const step of createdSteps) {
      // Use stepsToUse array which contains either AI-generated or hardcoded template steps
      const stepTemplate = stepsToUse[step.stepOrder - 1]
      if (!stepTemplate) {
        logger.warn(
          { stepOrder: step.stepOrder, stepId: step.id },
          "⚠️ [CAMPAIGN-GEN] Step template not found for step order, skipping",
        )
        continue
      }

      logger.info(
        {
          stepOrder: step.stepOrder,
          emailType: stepTemplate.emailType,
          totalLeads: leadsInfo.length,
        },
        `📧 [CAMPAIGN-GEN] Processing step ${step.stepOrder}: ${stepTemplate.emailType} for all leads`,
      )

      // Process all leads for this step
      for (const leadInfo of leadsInfo) {
        // COMMENTED OUT: Enrollment and execution creation - not needed for AI draft generation
        // const enrollmentId = enrollmentsByLeadId.get(leadInfo.id)
        // if (!enrollmentId) {
        //   logger.warn(
        //     { leadId: leadInfo.id, stepOrder: step.stepOrder },
        //     "⚠️ [CAMPAIGN-GEN] No enrollment found for lead, skipping",
        //   )
        //   continue
        // }

        // // Calculate scheduled time
        // const scheduledAt = calculateScheduledTime(
        //   new Date(),
        //   stepTemplate.delayDays,
        //   stepTemplate.scheduledHour,
        //   stepTemplate.scheduledMinute,
        //   stepTemplate.timezone,
        // )

        // // Create step execution
        // const [execution] = await db
        //   .insert(sequenceStepExecutions)
        //   .values({
        //     enrollmentId,
        //     stepId: step.id,
        //     stepOrder: step.stepOrder,
        //     status: "pending",
        //     scheduledAt,
        //   })
        //   .returning({
        //     id: sequenceStepExecutions.id,
        //   })

        // if (!execution) continue

        // totalExecutions++

        // Generate AI email draft with personalized generation (judge + parse)
        try {
          logger.info(
            {
              leadId: leadInfo.id,
              leadCompany: leadInfo.companyName,
              stepOrder: step.stepOrder,
              emailType: stepTemplate.emailType,
            },
            "🔄 [CAMPAIGN-GEN] Starting AI draft generation",
          )

          // Build additional context with workspace and step metadata
          const additionalContext = `Workspace Information:
- Company: ${workspace.companyName || workspace.name}
- Industry: ${workspace.industry || "N/A"}
- Website: ${workspace.companyWebsite || "N/A"}
- Description: ${workspace.companyDescription || "N/A"}

Email Requirements:
- Step ${step.stepOrder} of ${createdSteps.length}: ${stepTemplate.emailType}
- Purpose: ${getStepPurpose(step.stepOrder)}
- Length: Under 125 words for first two emails, concise for all
- Tone: Professional, personalized, value-focused
- Must include: Clear value proposition and specific CTA
- Personalization: Use the recipient company details, products, and social media presence to create highly personalized content

Current Time: ${currentTime.toISOString()}`

          // Use Mastra sequence email generation workflow
          const emailWorkflow = mastra.getWorkflow("sequenceEmailGenerationWorkflow")
          const emailRun = await emailWorkflow.createRunAsync()
          const emailResult = await emailRun.start({
            inputData: {
              context: {
                companyName: leadInfo.companyName,
                contactName: leadInfo.contactName,
                industry: leadInfo.industry,
                website: leadInfo.websiteUrl,
                // Enriched context arrays
                contacts: leadInfo.contacts,
                socialMedia: leadInfo.socialMedia,
                products: leadInfo.products,
                businessSectors: leadInfo.businessSectors,
                productCategories: leadInfo.productCategories,
                industryTypes: leadInfo.industryTypes,
                // Additional context (customPrompt is built internally in workflow)
                additionalContext,
              },
            },
          })

          if (emailResult.status === "failed") {
            throw new Error(`Email generation workflow failed: ${emailResult.error.message}`)
          }

          const emailStepResult = emailResult.steps["generate-sequence-email"]
          if (!emailStepResult || emailStepResult.status !== "success") {
            throw new Error("Email generation step failed")
          }

          const result = emailStepResult.output as {
            success: boolean
            subject?: string
            bodyText?: string
            error?: string
          }

          if (result.success && result.subject && result.bodyText) {
            // Store draft in workflow_generated_emails
            console.log("sequenceId", data.sequenceId)
            console.log("STEP", step)
            console.log("result.subject", result.subject)
            console.log("result.bodyText", result.bodyText)

            await db.insert(workflowGeneratedEmails).values({
              sequenceId: data.sequenceId,
              nodeId: step.id, // nodeId = stepId (we use stepId as nodeId for step-based sequences)
              leadId: leadInfo.id,
              subject: result.subject,
              bodyText: result.bodyText,
              bodyHtml: null,
              status: "generated",
              generationMode: "ai",
              aiPrompt: additionalContext,
              aiModel: model,
              contextSnapshot: {
                companyName: leadInfo.companyName,
                contactName: leadInfo.contactName,
                industry: leadInfo.industry,
                businessType: leadInfo.businessType,
                websiteUrl: leadInfo.websiteUrl,
                description: leadInfo.description,
                workspaceCompany: workspace.companyName,
                workspaceIndustry: workspace.industry,
                // Enriched context
                contacts: leadInfo.contacts,
                socialMedia: leadInfo.socialMedia,
                products: leadInfo.products,
                businessSectors: leadInfo.businessSectors,
                productCategories: leadInfo.productCategories,
                industryTypes: leadInfo.industryTypes,
              },
              generatedAt: currentTime,
            })

            totalDrafts++

            logger.info(
              {
                leadId: leadInfo.id,
                stepOrder: step.stepOrder,
                emailType: stepTemplate.emailType,
                subject: result.subject,
              },
              "✅ [CAMPAIGN-GEN] Generated AI draft with sequence email workflow",
            )
          } else {
            logger.error(
              {
                leadId: leadInfo.id,
                leadCompany: leadInfo.companyName,
                stepOrder: step.stepOrder,
                emailType: stepTemplate.emailType,
                error: result.error,
              },
              "❌ [CAMPAIGN-GEN] AI generation failed - NO DRAFT CREATED",
            )
            console.error("❌ AI GENERATION FAILED:", {
              leadId: leadInfo.id,
              leadCompany: leadInfo.companyName,
              stepOrder: step.stepOrder,
              error: result.error,
            })
          }
        } catch (aiError) {
          logger.error(
            {
              err: aiError,
              leadId: leadInfo.id,
              leadCompany: leadInfo.companyName,
              stepOrder: step.stepOrder,
              emailType: stepTemplate.emailType,
              errorMessage: aiError instanceof Error ? aiError.message : String(aiError),
              errorStack: aiError instanceof Error ? aiError.stack : undefined,
            },
            "❌ [CAMPAIGN-GEN] Exception during AI draft generation - NO DRAFT CREATED",
          )
          console.error("❌ AI GENERATION EXCEPTION:", {
            leadId: leadInfo.id,
            error: aiError instanceof Error ? aiError.message : String(aiError),
          })
        }

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Log completion of this step for all leads
      logger.info(
        {
          stepOrder: step.stepOrder,
          emailType: stepTemplate.emailType,
          totalLeadsProcessed: leadsInfo.length,
        },
        `✅ [CAMPAIGN-GEN] Completed step ${step.stepOrder} for all leads`,
      )
    }

    logger.info(
      {
        sequenceId: data.sequenceId,
        totalLeads: leadsInfo.length,
        totalEnrollments,
        totalExecutions,
        totalDrafts,
      },
      "🎉 [CAMPAIGN-GEN] AI campaign generation completed",
    )

    db.update(sequences)
      .set({ status: "draft" })
      .where(eq(sequences.id, data.sequenceId))
      .returning()

    return {
      success: true,
      totalLeads: leadsInfo.length,
      totalDrafts,
      stepsCreated: createdSteps.length,
      enrollmentsCreated: totalEnrollments,
      executionsCreated: totalExecutions,
      aiGenerated,
    }
  } catch (error: unknown) {
    logger.error({ err: error, sequenceId: data.sequenceId }, "💥 [CAMPAIGN-GEN] Error")
    return {
      success: false,
      totalLeads: 0,
      totalDrafts: 0,
      stepsCreated: 0,
      enrollmentsCreated: 0,
      executionsCreated: 0,
      aiGenerated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get step purpose based on step order
 */
function getStepPurpose(stepOrder: number): string {
  const purposes = [
    "Initial outreach — concise, personalized hook",
    "Reinforce value proposition & social proof",
    "Present tailored insight or data-driven value",
    "Light reminder, low-pressure follow-up",
    "Clear meeting CTA with value summary",
    "Final nudge before archiving lead",
  ]
  return purposes[stepOrder - 1] || ""
}

/**
 * Generate AI-powered campaign steps intelligently
 * Uses AI to determine optimal step count, timing, and strategy
 */
export async function generateAICampaignSteps(data: {
  sequenceId: string
  workspaceId: string
  customerGroupId: string
}): Promise<{
  success: boolean
  steps: Array<{
    id: string
    stepOrder: number
    emailType: string
    delayDays: number
    scheduledHour: number | null
    scheduledMinute: number | null
    timezone: string | null
    purpose: string
    emailSubject: string
  }>
  reasoning?: string
  error?: string
}> {
  try {
    logger.info(
      {
        sequenceId: data.sequenceId,
        workspaceId: data.workspaceId,
        customerGroupId: data.customerGroupId,
      },
      "🤖 [CAMPAIGN-STEPS] Starting AI campaign steps generation",
    )

    // 0. Get campaign details
    const { getSequence } = await import("./sequence.service")
    const campaign = await getSequence(data.sequenceId)
    if (!campaign) {
      throw new Error("Campaign not found")
    }

    // 1. Get workspace information
    const [workspace] = await db
      .select({
        name: workspaces.name,
        companyName: workspaces.companyName,
        companyWebsite: workspaces.companyWebsite,
        industry: workspaces.industry,
        companyDescription: workspaces.companyDescription,
        companySize: workspaces.companySize,
      })
      .from(workspaces)
      .where(eq(workspaces.id, data.workspaceId))
      .limit(1)

    if (!workspace) {
      throw new Error("Workspace not found")
    }

    logger.info({ workspaceName: workspace.name }, "✅ [CAMPAIGN-STEPS] Found workspace info")

    // 2. Get leads from customer group
    const { getCustomerGroupLeads, getCustomerGroup } = await import("./customer-group.service")
    const customerGroup = await getCustomerGroup(data.customerGroupId)

    if (!customerGroup) {
      throw new Error("Customer group not found")
    }

    const groupLeads = await getCustomerGroupLeads(data.customerGroupId)

    if (groupLeads.length === 0) {
      throw new Error("No leads found in customer group")
    }

    logger.info(
      { leadCount: groupLeads.length },
      "✅ [CAMPAIGN-STEPS] Found leads in customer group",
    )

    // 3. Analyze leads for industry patterns (optimized with batch query)
    const leadIds = groupLeads.map((l: { id: string }) => l.id)
    const sampleLeadIds = leadIds.slice(0, 10) // Sample first 10 leads

    logger.info(
      { sampleSize: sampleLeadIds.length },
      "🔍 [CAMPAIGN-STEPS] Fetching industries for sample leads",
    )

    // Batch fetch industries for sampled leads
    const leadIndustries = await db
      .select({ industryName: leadIndustryTypes.industryName })
      .from(leadIndustryTypes)
      .where(inArray(leadIndustryTypes.leadId, sampleLeadIds))

    const industries = leadIndustries.map((i) => i.industryName)

    logger.info(
      { industriesFound: industries.length },
      "✅ [CAMPAIGN-STEPS] Fetched industries for sample leads",
    )

    // Find most common industry
    const industryCounts = industries.reduce((acc: Record<string, number>, industry: string) => {
      acc[industry] = (acc[industry] || 0) + 1
      return acc
    }, {})

    const averageIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

    const leadsDescription = `${groupLeads.length} leads${
      averageIndustry ? ` primarily in ${averageIndustry}` : ""
    }`

    logger.info(
      { averageIndustry, totalLeads: groupLeads.length },
      "✅ [CAMPAIGN-STEPS] Analyzed lead patterns",
    )

    // 4. Generate steps using Mastra workflow
    logger.info("📦 [CAMPAIGN-STEPS] Getting workflow from Mastra")
    const workflow = mastra.getWorkflow("campaignStepsGenerationWorkflow")

    if (!workflow) {
      logger.error("❌ [CAMPAIGN-STEPS] Campaign steps generation workflow not found in Mastra")
      throw new Error("Campaign steps generation workflow not found")
    }

    logger.info("✅ [CAMPAIGN-STEPS] Workflow found, creating run instance")

    // Create a run instance
    const run = await workflow.createRunAsync()
    logger.info("✅ [CAMPAIGN-STEPS] Workflow run instance created")

    // Prepare input data
    const workflowInput = {
      context: {
        workspaceName: workspace.name,
        companyName: workspace.companyName || workspace.name,
        companyWebsite: workspace.companyWebsite || undefined,
        industry: workspace.industry || undefined,
        companyDescription: workspace.companyDescription || undefined,
        companySize: workspace.companySize || undefined,
        totalLeads: groupLeads.length,
        averageIndustry,
        leadsDescription,
        campaignName: campaign.name,
        campaignDescription: campaign.description,
        groupName: customerGroup.name,
        groupDescription: customerGroup.description,
      },
      maxRetries: 3,
    }

    logger.info(
      {
        campaignName: campaign.name,
        totalLeads: groupLeads.length,
        averageIndustry,
        companyName: workspace.companyName,
        maxRetries: 3,
      },
      "📝 [CAMPAIGN-STEPS] Prepared workflow input data",
    )

    // Execute the workflow
    logger.info("🚀 [CAMPAIGN-STEPS] Starting workflow execution")
    const workflowResult = await run.start({
      inputData: workflowInput,
    })

    logger.info(
      {
        status: workflowResult.status,
        stepCount: Object.keys(workflowResult.steps).length,
      },
      "📊 [CAMPAIGN-STEPS] Workflow execution completed",
    )

    // Handle workflow failure
    if (workflowResult.status === "failed") {
      logger.error(
        {
          error: workflowResult.error.message,
          errorDetails: workflowResult.error,
        },
        "❌ [CAMPAIGN-STEPS] Workflow execution failed",
      )
      throw new Error(`Workflow failed: ${workflowResult.error.message}`)
    }

    // Get the step result
    logger.info("📊 [CAMPAIGN-STEPS] Extracting step result from workflow output")
    const stepResult = workflowResult.steps["generate-campaign-steps"]

    if (!stepResult) {
      logger.error(
        { availableSteps: Object.keys(workflowResult.steps) },
        "❌ [CAMPAIGN-STEPS] Step 'generate-campaign-steps' not found in workflow result",
      )
      throw new Error("Campaign steps generation step not found in workflow result")
    }

    logger.info(
      {
        stepId: "generate-campaign-steps",
        status: stepResult.status,
      },
      "📊 [CAMPAIGN-STEPS] Step result extracted",
    )

    if (stepResult.status !== "success") {
      logger.error({ status: stepResult.status }, "❌ [CAMPAIGN-STEPS] Step execution failed")
      throw new Error("Campaign steps generation step failed")
    }

    const result = stepResult.output as CampaignStepsResponse

    logger.info(
      {
        success: result.success,
        stepsCount: result.steps?.length || 0,
        hasReasoning: !!result.reasoning,
        hasError: !!result.error,
        attempts: result.attempts,
      },
      "📊 [CAMPAIGN-STEPS] Parsed workflow output",
    )

    if (!result.success || !result.steps) {
      logger.error(
        { error: result.error, attempts: result.attempts },
        "❌ [CAMPAIGN-STEPS] Workflow returned unsuccessful result",
      )
      throw new Error(result.error || "Failed to generate campaign steps")
    }

    logger.info(
      {
        stepsCount: result.steps.length,
        attempts: result.attempts,
        reasoning: `${result.reasoning?.substring(0, 200)}...`,
        steps: result.steps.map((s) => ({
          order: s.stepOrder,
          type: s.emailType,
          delay: s.delayDays,
          time: `${s.scheduledHour}:${s.scheduledMinute}`,
        })),
      },
      "🎉 [CAMPAIGN-STEPS] AI generated campaign steps via workflow",
    )

    // 5. Store steps in database
    logger.info(
      { stepsToStore: result.steps.length },
      "💾 [CAMPAIGN-STEPS] Starting database storage of steps",
    )
    const createdSteps: Array<{
      id: string
      stepOrder: number
      emailType: string
      delayDays: number
      scheduledHour: number | null
      scheduledMinute: number | null
      timezone: string | null
      purpose: string
      emailSubject: string
    }> = []
    for (const step of result.steps) {
      logger.info(
        {
          stepOrder: step.stepOrder,
          emailType: step.emailType,
          delayDays: step.delayDays,
          scheduledTime: `${step.scheduledHour}:${step.scheduledMinute}`,
        },
        `💾 [CAMPAIGN-STEPS] Storing step ${step.stepOrder}`,
      )

      const [dbStep] = await db
        .insert(sequenceSteps)
        .values({
          sequenceId: data.sequenceId,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          scheduledHour: step.scheduledHour,
          scheduledMinute: step.scheduledMinute,
          timezone: "UTC", // TODO: make it dynamic from frontend currently it is either UTC or Asia/Seoul
          emailSubject: step.emailType,
          emailBodyText: `[${step.emailType}] ${step.emailType}`,
          emailBodyHtml: null,
          generationSource: "ai",
        })
        .returning({
          id: sequenceSteps.id,
          stepOrder: sequenceSteps.stepOrder,
          delayDays: sequenceSteps.delayDays,
          scheduledHour: sequenceSteps.scheduledHour,
          scheduledMinute: sequenceSteps.scheduledMinute,
          timezone: sequenceSteps.timezone,
          emailSubject: sequenceSteps.emailSubject,
        })

      if (dbStep) {
        logger.info(
          { stepId: dbStep.id, stepOrder: dbStep.stepOrder },
          `✅ [CAMPAIGN-STEPS] Stored step ${step.stepOrder} with ID: ${dbStep.id}`,
        )
        createdSteps.push({
          ...dbStep,
          emailType: step.emailType,
          purpose: step.emailType,
        })
      } else {
        logger.error(
          { stepOrder: step.stepOrder },
          `❌ [CAMPAIGN-STEPS] Failed to store step ${step.stepOrder}`,
        )
      }
    }

    logger.info(
      {
        stepsStored: createdSteps.length,
        totalSteps: result.steps.length,
        allStepsStored: createdSteps.length === result.steps.length,
      },
      "✅ [CAMPAIGN-STEPS] Stored steps in database",
    )

    return {
      success: true,
      steps: createdSteps,
      reasoning: result.reasoning,
    }
  } catch (error: unknown) {
    logger.error({ err: error, sequenceId: data.sequenceId }, "💥 [CAMPAIGN-STEPS] Error")
    return {
      success: false,
      steps: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
