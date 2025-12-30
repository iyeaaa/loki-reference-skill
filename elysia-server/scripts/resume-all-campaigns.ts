import { and, eq, inArray, sql } from "drizzle-orm"
import { config } from "../src/config"
import { db } from "../src/db"
import { emails } from "../src/db/schema/emails"
import { leadContacts } from "../src/db/schema/lead-details"
import { leads } from "../src/db/schema/leads"
import { sequenceEnrollments, sequences, sequenceStepExecutions } from "../src/db/schema"
import { users } from "../src/db/schema/users"
import { workspaces } from "../src/db/schema/workspaces"
import { searchDomainAllEmails } from "../src/services/hunterio-domain-search.service"
import { verifyEmail } from "../src/services/hunterio-email-verifier.service"
import {
  extractWebsiteContent,
  summarizeCompanyInfo,
} from "../src/services/lead-enrichment.service"

/**
 * Script to resume all paused campaigns/sequences with rescheduled emails
 *
 * When resuming, pending step executions are rescheduled:
 * - Day offset from creation is preserved (e.g., 2 days after enrollment stays 2 days)
 * - Time of day (hours:minutes) is preserved from original schedule
 * - New scheduledAt = today + original_day_offset, same time
 *
 * Usage:
 *   bun run elysia-server/scripts/resume-all-campaigns.ts
 *
 * Options (via env vars):
 *   DRY_RUN=true - Preview what would be resumed without making changes
 *   WORKSPACE_ID=uuid - Only resume campaigns in a specific workspace (optional)
 */

interface ScriptConfig {
  dryRun: boolean
  workspaceId?: string
}

interface PausedCampaign {
  id: string
  name: string
  workspaceId: string
}

interface PendingExecution {
  id: string
  enrollmentId: string
  scheduledAt: Date
  createdAt: Date
  sequenceId: string
  sequenceName: string
}

interface LeadWithEmail {
  leadId: string
  contactId: string
  email: string
  companyName: string | null
  websiteUrl: string | null
  description: string | null
  businessType: string | null
}

interface VerificationStats {
  totalLeads: number
  verified: number
  replaced: number
  deleted: number
  error: number
}

// ==================== HELPER FUNCTIONS ====================

function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null
  }
}

async function deleteLeadAndCleanup(leadId: string): Promise<void> {
  // 1. Remove from sequences.selectedLeadIds
  const sequencesWithLead = await db
    .select({ id: sequences.id, selectedLeadIds: sequences.selectedLeadIds })
    .from(sequences)
    .where(sql`${sequences.selectedLeadIds}::jsonb @> ${JSON.stringify([leadId])}::jsonb`)

  for (const seq of sequencesWithLead) {
    const leadIds = JSON.parse(seq.selectedLeadIds || "[]") as string[]
    const updated = leadIds.filter((id) => id !== leadId)
    await db
      .update(sequences)
      .set({ selectedLeadIds: JSON.stringify(updated), updatedAt: new Date() })
      .where(eq(sequences.id, seq.id))
  }

  // 2. Delete enrollment (cascade handles step_executions)
  await db.delete(sequenceEnrollments).where(eq(sequenceEnrollments.leadId, leadId))

  // 3. Nullify leadId in emails table
  await db.update(emails).set({ leadId: null }).where(eq(emails.leadId, leadId))

  // 4. Delete lead (cascade handles lead_contacts)
  await db.delete(leads).where(eq(leads.id, leadId))
}

// ==================== VERIFICATION FUNCTIONS ====================

async function getLeadsForCampaigns(sequenceIds: string[]): Promise<LeadWithEmail[]> {
  if (sequenceIds.length === 0) return []

  const results = await db
    .select({
      leadId: leads.id,
      contactId: leadContacts.id,
      email: leadContacts.contactValue,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      description: leads.description,
      businessType: leads.businessType,
    })
    .from(sequenceEnrollments)
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(
      and(
        inArray(sequenceEnrollments.sequenceId, sequenceIds),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true),
      ),
    )

  return results
}

async function verifyAndFixLead(
  lead: LeadWithEmail,
  dryRun: boolean,
): Promise<"verified" | "replaced" | "deleted" | "error"> {
  try {
    // 1. Verify the email
    const verificationResult = await verifyEmail(lead.email)

    if (verificationResult?.result !== "undeliverable") {
      return "verified"
    }

    console.log(`  [FAIL] ${lead.email} is undeliverable, searching for replacement...`)

    let newEmail: string | null = null
    const domain = extractDomain(lead.websiteUrl)
    let geminiEnrichmentData: {
      description: string
      industry?: string
      products?: string
      attachedEmailValue?: string
    } | null = null

    // 2. Try Gemini enrichment first
    if (lead.websiteUrl) {
      try {
        const websiteContent = await extractWebsiteContent(lead.websiteUrl)
        if (websiteContent.content) {
          geminiEnrichmentData = await summarizeCompanyInfo(
            websiteContent.content,
            lead.companyName || domain || "",
            config.gemini.apiKey,
          )
          if (
            geminiEnrichmentData.attachedEmailValue &&
            geminiEnrichmentData.attachedEmailValue !== "example@example.com"
          ) {
            const geminiVerification = await verifyEmail(geminiEnrichmentData.attachedEmailValue)
            if (geminiVerification?.result !== "undeliverable") {
              newEmail = geminiEnrichmentData.attachedEmailValue
              console.log(`    |-- Found valid email via Gemini: ${newEmail}`)
            }
          }
        }
      } catch {
        // Gemini failed, continue to Hunter
      }
    }

    // 3. Fallback to Hunter.io domain search
    if (!newEmail && domain) {
      try {
        const hunterResult = await searchDomainAllEmails(domain, 5)
        for (const hunterEmail of hunterResult.emails) {
          const hunterVerification = await verifyEmail(hunterEmail.value)
          if (hunterVerification?.result !== "undeliverable") {
            newEmail = hunterEmail.value
            console.log(`    |-- Found valid email via Hunter.io: ${newEmail}`)
            break
          }
        }
      } catch {
        // Hunter failed
      }
    }

    // 4. Update or delete
    if (newEmail) {
      if (!dryRun) {
        // Update lead contact with new email
        await db
          .update(leadContacts)
          .set({ contactValue: newEmail, isVerified: true })
          .where(eq(leadContacts.id, lead.contactId))

        // Update lead table with enrichment data from Gemini
        if (geminiEnrichmentData) {
          const leadUpdates: Record<string, unknown> = {}
          if (geminiEnrichmentData.description && !lead.description) {
            leadUpdates.description = geminiEnrichmentData.description
          }
          if (geminiEnrichmentData.industry && !lead.businessType) {
            leadUpdates.businessType = geminiEnrichmentData.industry
          }
          if (Object.keys(leadUpdates).length > 0) {
            leadUpdates.updatedAt = new Date()
            await db.update(leads).set(leadUpdates).where(eq(leads.id, lead.leadId))
          }
        }
      }
      console.log(`    [OK] Replaced with: ${newEmail}`)
      return "replaced"
    } else {
      // No valid email found - delete lead
      if (!dryRun) {
        await deleteLeadAndCleanup(lead.leadId)
      }
      console.log(`    [DELETED] No valid email found, lead deleted`)
      return "deleted"
    }
  } catch (error) {
    console.error(`    [ERROR] Error verifying ${lead.email}:`, error)
    return "error"
  }
}

async function verifyLeadsInCampaigns(
  sequenceIds: string[],
  dryRun: boolean,
): Promise<VerificationStats> {
  const stats: VerificationStats = {
    totalLeads: 0,
    verified: 0,
    replaced: 0,
    deleted: 0,
    error: 0,
  }

  console.log("[EMAIL] Verifying lead emails before resuming...\n")

  const leadsToVerify = await getLeadsForCampaigns(sequenceIds)
  stats.totalLeads = leadsToVerify.length

  if (leadsToVerify.length === 0) {
    console.log("  No leads to verify\n")
    return stats
  }

  console.log(`  Found ${leadsToVerify.length} lead(s) to verify\n`)

  for (const lead of leadsToVerify) {
    const result = await verifyAndFixLead(lead, dryRun)
    stats[result]++
  }

  console.log("\n[STATS] Verification Summary:")
  console.log(`  [OK] Verified: ${stats.verified}`)
  console.log(`  [REPLACED] Replaced: ${stats.replaced}`)
  console.log(`  [DELETED] Deleted: ${stats.deleted}`)
  if (stats.error > 0) {
    console.log(`  [ERROR] Errors: ${stats.error}`)
  }
  console.log("")

  return stats
}

// ==================== CAMPAIGN FUNCTIONS ====================

async function getPausedCampaigns(workspaceId?: string): Promise<PausedCampaign[]> {
  console.log("[QUERY] Querying paused campaigns (user role only)...\n")

  const results = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      workspaceId: sequences.workspaceId,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(
      and(
        eq(sequences.status, "paused"),
        eq(users.userRole, "user"), // Only workspaces owned by "user" role
        workspaceId ? eq(sequences.workspaceId, workspaceId) : undefined,
      ),
    )
    .orderBy(sequences.createdAt)

  return results
}

async function getPendingExecutions(sequenceIds: string[]): Promise<PendingExecution[]> {
  if (sequenceIds.length === 0) return []

  const results = await db
    .select({
      id: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      createdAt: sequenceStepExecutions.createdAt,
      sequenceId: sequences.id,
      sequenceName: sequences.name,
    })
    .from(sequenceStepExecutions)
    .innerJoin(sequenceEnrollments, eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id))
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .where(
      and(
        eq(sequenceStepExecutions.status, "pending"),
        inArray(sequences.id, sequenceIds),
      ),
    )

  return results
}

/**
 * Calculate new scheduled time:
 * - Preserve the day offset from creation (scheduledAt - createdAt in days)
 * - Apply that offset to NOW
 * - Keep the original time of day (hours, minutes, seconds)
 */
function calculateNewScheduledAt(originalScheduledAt: Date, createdAt: Date): Date {
  const now = new Date()

  // Calculate the day offset (how many days after creation it was scheduled)
  const msPerDay = 24 * 60 * 60 * 1000
  const dayOffset = Math.round(
    (originalScheduledAt.getTime() - createdAt.getTime()) / msPerDay,
  )

  // Create new date: today + dayOffset, with original time
  const newScheduledAt = new Date(now)
  newScheduledAt.setDate(newScheduledAt.getDate() + dayOffset)

  // Preserve original time of day (hours, minutes, seconds)
  newScheduledAt.setHours(
    originalScheduledAt.getHours(),
    originalScheduledAt.getMinutes(),
    originalScheduledAt.getSeconds(),
    originalScheduledAt.getMilliseconds(),
  )

  return newScheduledAt
}

async function resumeCampaignsAndReschedule(
  campaigns: PausedCampaign[],
  pendingExecutions: PendingExecution[],
  dryRun: boolean,
): Promise<{ campaignsResumed: number; executionsRescheduled: number; failed: number }> {
  if (campaigns.length === 0) {
    return { campaignsResumed: 0, executionsRescheduled: 0, failed: 0 }
  }

  // Group executions by sequence for reporting
  const executionsBySequence = new Map<string, PendingExecution[]>()
  for (const exec of pendingExecutions) {
    const existing = executionsBySequence.get(exec.sequenceId) || []
    existing.push(exec)
    executionsBySequence.set(exec.sequenceId, existing)
  }

  if (dryRun) {
    console.log("[DRY RUN] Would resume the following campaigns:\n")
    campaigns.forEach((campaign, index) => {
      const executions = executionsBySequence.get(campaign.id) || []
      console.log(`  ${index + 1}. ${campaign.name} (${campaign.id})`)
      console.log(`     |-- ${executions.length} pending email(s) to reschedule`)

      // Show sample reschedules (first 3)
      executions.slice(0, 3).forEach((exec) => {
        const newScheduledAt = calculateNewScheduledAt(exec.scheduledAt, exec.createdAt)
        console.log(
          `        - ${exec.scheduledAt.toISOString()} -> ${newScheduledAt.toISOString()}`,
        )
      })
      if (executions.length > 3) {
        console.log(`        ... and ${executions.length - 3} more`)
      }
    })
    return { campaignsResumed: campaigns.length, executionsRescheduled: pendingExecutions.length, failed: 0 }
  }

  try {
    const campaignIds = campaigns.map((c) => c.id)

    // 1. Update sequences status to "active"
    await db
      .update(sequences)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(inArray(sequences.id, campaignIds))

    console.log(`[OK] Resumed ${campaigns.length} campaign(s)\n`)

    // 2. Reschedule pending step executions
    let rescheduledCount = 0
    for (const exec of pendingExecutions) {
      const newScheduledAt = calculateNewScheduledAt(exec.scheduledAt, exec.createdAt)

      await db
        .update(sequenceStepExecutions)
        .set({
          scheduledAt: newScheduledAt,
        })
        .where(eq(sequenceStepExecutions.id, exec.id))

      rescheduledCount++
    }

    console.log(`[OK] Rescheduled ${rescheduledCount} pending email(s)\n`)

    // 3. Reactivate paused enrollments for these sequences
    const reactivatedEnrollments = await db
      .update(sequenceEnrollments)
      .set({
        status: "active",
      })
      .where(
        and(
          eq(sequenceEnrollments.status, "paused"),
          inArray(sequenceEnrollments.sequenceId, campaignIds),
        ),
      )
      .returning({ id: sequenceEnrollments.id })

    if (reactivatedEnrollments.length > 0) {
      console.log(`[OK] Reactivated ${reactivatedEnrollments.length} paused enrollment(s)\n`)
    }

    // Log details
    console.log("[LIST] Resumed campaigns:")
    campaigns.forEach((campaign, index) => {
      const executions = executionsBySequence.get(campaign.id) || []
      console.log(`  ${index + 1}. ${campaign.name}`)
      console.log(`     |-- ${executions.length} email(s) rescheduled`)
    })

    return { campaignsResumed: campaigns.length, executionsRescheduled: rescheduledCount, failed: 0 }
  } catch (error) {
    console.error("[ERROR] Failed to resume campaigns:", error)
    return { campaignsResumed: 0, executionsRescheduled: 0, failed: campaigns.length }
  }
}

async function main() {
  const startTime = Date.now()

  // Parse configuration from environment variables
  const config: ScriptConfig = {
    dryRun: process.env.DRY_RUN === "true",
    workspaceId: process.env.WORKSPACE_ID || undefined,
  }

  console.log("[START] Resume All Campaigns Script")
  console.log("=====================================\n")
  console.log("Configuration:")
  console.log(`  - Mode: ${config.dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  if (config.workspaceId) {
    console.log(`  - Workspace ID: ${config.workspaceId}`)
  } else {
    console.log(`  - Scope: All workspaces`)
  }
  console.log("")
  console.log("Reschedule Logic:")
  console.log("  - Day offset from creation is preserved")
  console.log("  - Time of day (hours:minutes) is preserved")
  console.log("  - Example: email scheduled 2 days after creation")
  console.log("    -> will be 2 days from NOW, same time")
  console.log("")

  try {
    // Fetch paused campaigns
    const pausedCampaigns = await getPausedCampaigns(config.workspaceId)

    if (pausedCampaigns.length === 0) {
      console.log("[DONE] No paused campaigns found. Nothing to resume!\n")
      process.exit(0)
    }

    console.log(`Found ${pausedCampaigns.length} paused campaign(s)\n`)

    // Fetch pending step executions for these campaigns
    const sequenceIds = pausedCampaigns.map((c) => c.id)

    // Verify all lead emails before resuming
    const verificationStats = await verifyLeadsInCampaigns(sequenceIds, config.dryRun)

    const pendingExecutions = await getPendingExecutions(sequenceIds)

    console.log(`Found ${pendingExecutions.length} pending email(s) to reschedule\n`)

    // Resume the campaigns and reschedule
    const { campaignsResumed, executionsRescheduled, failed } = await resumeCampaignsAndReschedule(
      pausedCampaigns,
      pendingExecutions,
      config.dryRun,
    )

    // Final summary
    const totalDuration = Date.now() - startTime

    console.log("\n=====================================")
    console.log("[SUMMARY]")
    console.log("=====================================\n")
    console.log("Email Verification:")
    console.log(`  - Total leads: ${verificationStats.totalLeads}`)
    console.log(`  - Verified: ${verificationStats.verified}`)
    console.log(`  - Replaced: ${verificationStats.replaced}`)
    console.log(`  - Deleted: ${verificationStats.deleted}`)
    if (verificationStats.error > 0) {
      console.log(`  - Errors: ${verificationStats.error}`)
    }
    console.log("")
    console.log("Campaign Resume:")
    console.log(`  - Total campaigns: ${pausedCampaigns.length}`)
    console.log(`  - Resumed: ${campaignsResumed}`)
    console.log(`  - Emails rescheduled: ${executionsRescheduled}`)
    if (failed > 0) {
      console.log(`  - Failed: ${failed}`)
    }
    console.log(`\n[TIME] Duration: ${totalDuration}ms\n`)

    if (config.dryRun) {
      console.log("[WARN] DRY RUN MODE - No changes were made to the database")
      console.log("Run without DRY_RUN=true to actually resume campaigns\n")
    }

    console.log("[DONE] Script completed successfully!\n")
    process.exit(0)
  } catch (error) {
    console.error("\n[ERROR] Script failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run the script
main()