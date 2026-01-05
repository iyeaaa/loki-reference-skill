import { eq, inArray, sql } from "drizzle-orm"
import { db } from "../src/db"
import { sequences } from "../src/db/schema"

/**
 * Script to pause all active campaigns/sequences
 *
 * Usage:
 *   bun run elysia-server/scripts/pause-all-campaigns.ts
 *
 * Options (via env vars):
 *   DRY_RUN=true - Preview what would be paused without making changes
 *   WORKSPACE_ID=uuid - Only pause campaigns in a specific workspace (optional)
 */

interface ScriptConfig {
  dryRun: boolean
  workspaceId?: string
}

async function getActiveCampaigns(workspaceId?: string) {
  console.log("📊 Querying active campaigns...\n")

  const conditions = [eq(sequences.status, "active")]

  if (workspaceId) {
    conditions.push(eq(sequences.workspaceId, workspaceId))
  }

  const results = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      workspaceId: sequences.workspaceId,
      status: sequences.status,
      createdAt: sequences.createdAt,
    })
    .from(sequences)
    .where(conditions.length > 1 ? sql`${conditions[0]} AND ${conditions[1]}` : conditions[0])
    .orderBy(sequences.createdAt)

  return results
}

async function pauseCampaigns(
  campaigns: Array<{ id: string; name: string }>,
  dryRun: boolean,
): Promise<{ success: number; failed: number }> {
  if (campaigns.length === 0) {
    return { success: 0, failed: 0 }
  }

  if (dryRun) {
    console.log("🔍 DRY RUN - Would pause the following campaigns:\n")
    campaigns.forEach((campaign, index) => {
      console.log(`  ${index + 1}. ${campaign.name} (${campaign.id})`)
    })
    return { success: campaigns.length, failed: 0 }
  }

  try {
    const campaignIds = campaigns.map((c) => c.id)

    await db
      .update(sequences)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(inArray(sequences.id, campaignIds))

    console.log("✅ Successfully paused campaigns:\n")
    campaigns.forEach((campaign, index) => {
      console.log(`  ${index + 1}. ${campaign.name} (${campaign.id})`)
    })

    return { success: campaigns.length, failed: 0 }
  } catch (error) {
    console.error("❌ Failed to pause campaigns:", error)
    return { success: 0, failed: campaigns.length }
  }
}

async function main() {
  const startTime = Date.now()

  // Parse configuration from environment variables
  const config: ScriptConfig = {
    dryRun: process.env.DRY_RUN === "true",
    workspaceId: process.env.WORKSPACE_ID || undefined,
  }

  console.log("🚀 Pause All Campaigns Script")
  console.log("=====================================\n")
  console.log("Configuration:")
  console.log(`  • Mode: ${config.dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  if (config.workspaceId) {
    console.log(`  • Workspace ID: ${config.workspaceId}`)
  } else {
    console.log(`  • Scope: All workspaces`)
  }
  console.log("")

  try {
    // Fetch active campaigns
    const activeCampaigns = await getActiveCampaigns(config.workspaceId)

    if (activeCampaigns.length === 0) {
      console.log("✨ No active campaigns found. Nothing to pause!\n")
      process.exit(0)
    }

    console.log(`Found ${activeCampaigns.length} active campaign(s)\n`)

    // Pause the campaigns
    const { success, failed } = await pauseCampaigns(activeCampaigns, config.dryRun)

    // Final summary
    const totalDuration = Date.now() - startTime

    console.log("\n=====================================")
    console.log("📊 SUMMARY")
    console.log("=====================================\n")
    console.log(`Total campaigns: ${activeCampaigns.length}`)
    console.log(`✅ Paused: ${success}`)
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`)
    }
    console.log(`⏱️  Duration: ${totalDuration}ms\n`)

    if (config.dryRun) {
      console.log("⚠️  DRY RUN MODE - No changes were made to the database")
      console.log("Run without DRY_RUN=true to actually pause campaigns\n")
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
