import { and, eq, inArray, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import { leadContacts, leadSocialMedia } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import logger from "../utils/logger"
import { enrichLead } from "./lead-enrichment.service"

// Types
export interface EmailStatusResult {
  total: number
  withEmail: number
  withoutEmail: number
  leads: Array<{
    id: string
    companyName: string | null
    websiteUrl: string | null
    hasEmail: boolean
    primaryEmail: string | null
  }>
}

export interface EnrichmentProgress {
  type: "init" | "progress" | "complete" | "error"
  processed: number
  total: number
  percentage: number
  currentLead?: {
    id: string
    companyName: string | null
  }
  completedLeadId?: string
  result?: SingleEnrichmentResult
  stats?: {
    success: number
    failed: number
    skipped: number
  }
  error?: string
}

export interface SingleEnrichmentResult {
  leadId: string
  companyName: string | null
  success: boolean
  emails: Array<{ value: string; type: string; confidence?: number }>
  socialLinks?: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  companyInfo?: {
    description?: string
    industry?: string
  }
  error?: string
}

export interface EnrichmentBatchResult {
  total: number
  success: number
  failed: number
  skipped: number
  results: SingleEnrichmentResult[]
}

export interface ApplyResultsResponse {
  applied: number
  skipped: number
  errors: Array<{ leadId: string; error: string }>
}

/**
 * Check email status for multiple leads
 */
export async function checkLeadsEmailStatus(leadIds: string[]): Promise<EmailStatusResult> {
  if (leadIds.length === 0) {
    return {
      total: 0,
      withEmail: 0,
      withoutEmail: 0,
      leads: [],
    }
  }

  const result = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      primaryEmail: sql<string | null>`(
        SELECT contact_value FROM ${leadContacts}
        WHERE ${leadContacts.leadId} = ${leads.id}
        AND ${leadContacts.contactType} = 'email'
        AND ${leadContacts.isPrimary} = true
        LIMIT 1
      )`.as("primaryEmail"),
    })
    .from(leads)
    .where(inArray(leads.id, leadIds))

  const leadsWithStatus = result.map((lead) => ({
    id: lead.id,
    companyName: lead.companyName,
    websiteUrl: lead.websiteUrl,
    hasEmail: !!lead.primaryEmail,
    primaryEmail: lead.primaryEmail,
  }))

  const withEmail = leadsWithStatus.filter((l) => l.hasEmail).length
  const withoutEmail = leadsWithStatus.filter((l) => !l.hasEmail).length

  return {
    total: leadsWithStatus.length,
    withEmail,
    withoutEmail,
    leads: leadsWithStatus,
  }
}

/**
 * Get leads without email from a list of lead IDs
 */
export async function getLeadsWithoutEmail(
  leadIds: string[],
): Promise<Array<{ id: string; companyName: string | null; websiteUrl: string | null }>> {
  if (leadIds.length === 0) {
    return []
  }

  const result = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      hasEmail: sql<boolean>`EXISTS (
        SELECT 1 FROM ${leadContacts}
        WHERE ${leadContacts.leadId} = ${leads.id}
        AND ${leadContacts.contactType} = 'email'
        AND ${leadContacts.isPrimary} = true
      )`.as("hasEmail"),
    })
    .from(leads)
    .where(inArray(leads.id, leadIds))

  return result
    .filter((lead) => !lead.hasEmail)
    .map((lead) => ({
      id: lead.id,
      companyName: lead.companyName,
      websiteUrl: lead.websiteUrl,
    }))
}

/**
 * Enrich a single lead and return the result
 */
async function enrichSingleLead(lead: {
  id: string
  companyName: string | null
  websiteUrl: string | null
}): Promise<SingleEnrichmentResult> {
  const result: SingleEnrichmentResult = {
    leadId: lead.id,
    companyName: lead.companyName,
    success: false,
    emails: [],
  }

  // Skip if no website URL
  if (!lead.websiteUrl) {
    result.error = "웹사이트 주소가 없습니다"
    return result
  }

  try {
    const enrichmentResult = await enrichLead(lead.websiteUrl, lead.companyName || "", {
      hunterApiKey: config.hunter.apiKey,
      geminiApiKey: config.gemini.apiKey,
      skipHunter: false,
      skipJina: false,
    })

    result.emails = enrichmentResult.emails
    result.socialLinks = enrichmentResult.socialLinks
    result.companyInfo = {
      description: enrichmentResult.companyInfo.description,
      industry: enrichmentResult.companyInfo.industry,
    }
    result.success = enrichmentResult.emails.length > 0

    if (!result.success) {
      result.error = "이메일을 찾지 못했습니다"
    }

    return result
  } catch (error) {
    logger.error({ leadId: lead.id, error }, "[contact-enrichment] Failed to enrich lead")
    result.error = error instanceof Error ? error.message : "알 수 없는 오류"
    return result
  }
}

/**
 * Enrich multiple leads in batch with progress callback
 */
export async function enrichLeadsBatch(
  leadIds: string[],
  onProgress?: (progress: EnrichmentProgress) => void,
): Promise<EnrichmentBatchResult> {
  const stats = {
    total: leadIds.length,
    success: 0,
    failed: 0,
    skipped: 0,
  }
  const results: SingleEnrichmentResult[] = []

  // Get lead details
  const leadsData = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
    })
    .from(leads)
    .where(inArray(leads.id, leadIds))

  // Send init progress
  onProgress?.({
    type: "init",
    processed: 0,
    total: stats.total,
    percentage: 0,
  })

  // Process each lead sequentially (to respect API rate limits)
  for (let i = 0; i < leadsData.length; i++) {
    const lead = leadsData[i]
    if (!lead) {
      continue
    }

    // Send progress update for current lead
    onProgress?.({
      type: "progress",
      processed: i,
      total: stats.total,
      percentage: Math.round((i / stats.total) * 100),
      currentLead: {
        id: lead.id,
        companyName: lead.companyName,
      },
    })

    // Skip if no website URL
    if (!lead.websiteUrl) {
      stats.skipped++
      const result: SingleEnrichmentResult = {
        leadId: lead.id,
        companyName: lead.companyName,
        success: false,
        emails: [],
        error: "웹사이트 주소가 없습니다",
      }
      results.push(result)

      onProgress?.({
        type: "progress",
        processed: i + 1,
        total: stats.total,
        percentage: Math.round(((i + 1) / stats.total) * 100),
        completedLeadId: lead.id,
        result,
      })
      continue
    }

    // Enrich the lead
    const result = await enrichSingleLead(lead)
    results.push(result)

    if (result.success) {
      stats.success++
      // Auto-save successful results to DB
      await saveEnrichmentResult(result)
    } else if (result.error === "웹사이트 주소가 없습니다") {
      stats.skipped++
    } else {
      stats.failed++
    }

    // Send progress update for completed lead
    onProgress?.({
      type: "progress",
      processed: i + 1,
      total: stats.total,
      percentage: Math.round(((i + 1) / stats.total) * 100),
      completedLeadId: lead.id,
      result,
    })

    // Small delay between requests to respect rate limits
    if (i < leadsData.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // Send complete progress
  onProgress?.({
    type: "complete",
    processed: stats.total,
    total: stats.total,
    percentage: 100,
    stats: {
      success: stats.success,
      failed: stats.failed,
      skipped: stats.skipped,
    },
  })

  return {
    ...stats,
    results,
  }
}

/**
 * Save a single enrichment result to the database
 */
async function saveEnrichmentResult(result: SingleEnrichmentResult): Promise<void> {
  try {
    // Save primary email
    if (result.emails.length > 0) {
      const primaryEmail = result.emails[0]
      if (!primaryEmail) {
        return
      }

      // Check if email already exists for this lead
      const existingEmail = await db
        .select({ id: leadContacts.id })
        .from(leadContacts)
        .where(
          and(
            eq(leadContacts.leadId, result.leadId),
            eq(leadContacts.contactType, "email"),
            eq(leadContacts.contactValue, primaryEmail.value),
          ),
        )
        .limit(1)

      if (existingEmail.length === 0) {
        // First, set all existing emails for this lead to non-primary
        await db
          .update(leadContacts)
          .set({ isPrimary: false })
          .where(and(eq(leadContacts.leadId, result.leadId), eq(leadContacts.contactType, "email")))

        // Insert new primary email
        await db.insert(leadContacts).values({
          leadId: result.leadId,
          contactType: "email",
          contactValue: primaryEmail.value,
          label: primaryEmail.type || "generic",
          isPrimary: true,
          isVerified: false,
        })

        logger.info(
          { leadId: result.leadId, email: primaryEmail.value },
          "[contact-enrichment] Saved primary email",
        )
      }

      // Save additional emails (non-primary)
      for (let i = 1; i < result.emails.length; i++) {
        const email = result.emails[i]
        if (!email) {
          continue
        }

        const existing = await db
          .select({ id: leadContacts.id })
          .from(leadContacts)
          .where(
            and(
              eq(leadContacts.leadId, result.leadId),
              eq(leadContacts.contactType, "email"),
              eq(leadContacts.contactValue, email.value),
            ),
          )
          .limit(1)

        if (existing.length === 0) {
          await db.insert(leadContacts).values({
            leadId: result.leadId,
            contactType: "email",
            contactValue: email.value,
            label: email.type || "generic",
            isPrimary: false,
            isVerified: false,
          })
        }
      }
    }

    // Save social media links
    if (result.socialLinks) {
      const socialPlatforms: Array<{
        platform: "linkedin" | "twitter" | "facebook"
        url: string | undefined
      }> = [
        { platform: "linkedin", url: result.socialLinks.linkedin },
        { platform: "twitter", url: result.socialLinks.twitter },
        { platform: "facebook", url: result.socialLinks.facebook },
      ]

      for (const { platform, url } of socialPlatforms) {
        if (url) {
          const existing = await db
            .select({ id: leadSocialMedia.id })
            .from(leadSocialMedia)
            .where(
              and(
                eq(leadSocialMedia.leadId, result.leadId),
                eq(leadSocialMedia.platform, platform),
              ),
            )
            .limit(1)

          if (existing.length === 0) {
            await db.insert(leadSocialMedia).values({
              leadId: result.leadId,
              platform,
              url,
              isVerified: false,
            })

            logger.info(
              { leadId: result.leadId, platform, url },
              "[contact-enrichment] Saved social media link",
            )
          }
        }
      }
    }

    // Update lead description if available
    if (result.companyInfo?.description) {
      await db
        .update(leads)
        .set({
          description: result.companyInfo.description,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, result.leadId))
    }
  } catch (error) {
    logger.error(
      { leadId: result.leadId, error },
      "[contact-enrichment] Failed to save enrichment result",
    )
  }
}

/**
 * Apply enrichment results to database (manual application)
 */
export async function applyEnrichmentResults(
  results: SingleEnrichmentResult[],
): Promise<ApplyResultsResponse> {
  const response: ApplyResultsResponse = {
    applied: 0,
    skipped: 0,
    errors: [],
  }

  for (const result of results) {
    if (!result.success || result.emails.length === 0) {
      response.skipped++
      continue
    }

    try {
      await saveEnrichmentResult(result)
      response.applied++
    } catch (error) {
      response.errors.push({
        leadId: result.leadId,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      })
    }
  }

  return response
}
