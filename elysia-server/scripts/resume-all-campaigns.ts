import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "../src/db"
import { sequenceEnrollments, sequences, sequenceStepExecutions } from "../src/db/schema"

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

async function getPausedCampaigns(workspaceId?: string): Promise<PausedCampaign[]> {
  console.log("📊 Querying paused campaigns...\n")

  const conditions = [eq(sequences.status, "paused")]

  if (workspaceId) {
    conditions.push(eq(sequences.workspaceId, workspaceId))
  }

  const results = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      workspaceId: sequences.workspaceId,
    })
    .from(sequences)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
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
    console.log("🔍 DRY RUN - Would resume the following campaigns:\n")
    campaigns.forEach((campaign, index) => {
      const executions = executionsBySequence.get(campaign.id) || []
      console.log(`  ${index + 1}. ${campaign.name} (${campaign.id})`)
      console.log(`     └─ ${executions.length} pending email(s) to reschedule`)

      // Show sample reschedules (first 3)
      executions.slice(0, 3).forEach((exec) => {
        const newScheduledAt = calculateNewScheduledAt(exec.scheduledAt, exec.createdAt)
        console.log(
          `        • ${exec.scheduledAt.toISOString()} → ${newScheduledAt.toISOString()}`,
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

    console.log(`✅ Resumed ${campaigns.length} campaign(s)\n`)

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

    console.log(`✅ Rescheduled ${rescheduledCount} pending email(s)\n`)

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
      console.log(`✅ Reactivated ${reactivatedEnrollments.length} paused enrollment(s)\n`)
    }

    // Log details
    console.log("📋 Resumed campaigns:")
    campaigns.forEach((campaign, index) => {
      const executions = executionsBySequence.get(campaign.id) || []
      console.log(`  ${index + 1}. ${campaign.name}`)
      console.log(`     └─ ${executions.length} email(s) rescheduled`)
    })

    return { campaignsResumed: campaigns.length, executionsRescheduled: rescheduledCount, failed: 0 }
  } catch (error) {
    console.error("❌ Failed to resume campaigns:", error)
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

  console.log("🚀 Resume All Campaigns Script")
  console.log("=====================================\n")
  console.log("Configuration:")
  console.log(`  • Mode: ${config.dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  if (config.workspaceId) {
    console.log(`  • Workspace ID: ${config.workspaceId}`)
  } else {
    console.log(`  • Scope: All workspaces`)
  }
  console.log("")
  console.log("Reschedule Logic:")
  console.log("  • Day offset from creation is preserved")
  console.log("  • Time of day (hours:minutes) is preserved")
  console.log("  • Example: email scheduled 2 days after creation")
  console.log("    → will be 2 days from NOW, same time")
  console.log("")

  try {
    // Fetch paused campaigns
    const pausedCampaigns = await getPausedCampaigns(config.workspaceId)

    if (pausedCampaigns.length === 0) {
      console.log("✨ No paused campaigns found. Nothing to resume!\n")
      process.exit(0)
    }

    console.log(`Found ${pausedCampaigns.length} paused campaign(s)\n`)

    // Fetch pending step executions for these campaigns
    const sequenceIds = pausedCampaigns.map((c) => c.id)
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
    console.log("📊 SUMMARY")
    console.log("=====================================\n")
    console.log(`Total campaigns: ${pausedCampaigns.length}`)
    console.log(`✅ Resumed: ${campaignsResumed}`)
    console.log(`📧 Emails rescheduled: ${executionsRescheduled}`)
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`)
    }
    console.log(`⏱️  Duration: ${totalDuration}ms\n`)

    if (config.dryRun) {
      console.log("⚠️  DRY RUN MODE - No changes were made to the database")
      console.log("Run without DRY_RUN=true to actually resume campaigns\n")
    }

    console.log("✨ Script completed successfully!\n")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Script failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run the script
main()