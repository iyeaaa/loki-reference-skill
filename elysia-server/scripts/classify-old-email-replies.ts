import { eq, isNull, or, sql } from "drizzle-orm"
import { db } from "../src/db"
import { emailReplies, emails } from "../src/db/schema"
import { getAIClassificationService } from "../src/services/ai-classification.service"

interface ClassificationResult {
  emailReplyId: string
  success: boolean
  intent?: string
  sentiment?: string
  error?: string
}

interface ScriptConfig {
  batchSize: number
  dryRun: boolean
  delayBetweenBatches: number // ms
}

/**
 * Script to classify old/unclassified email replies using AI
 *
 * Usage:
 *   bun run elysia-server/scripts/classify-old-email-replies.ts
 *
 * Options (via env vars):
 *   DRY_RUN=true - Preview what would be classified without making changes
 *   BATCH_SIZE=25 - Number of emails to process in parallel (default: 25)
 *   DELAY_MS=1000 - Delay between batches in milliseconds (default: 1000)
 */

async function getUnclassifiedEmailReplies() {
  console.log("📊 Querying unclassified email replies...\n")

  const results = await db
    .select({
      emailReplyId: emailReplies.id,
      replyEmailId: emailReplies.replyEmailId,
      subject: emails.subject,
      bodyText: emails.bodyText,
      bodyHtml: emails.bodyHtml,
      currentIntent: emailReplies.intent,
      currentSentiment: emailReplies.sentiment,
      createdAt: emails.createdAt,
    })
    .from(emailReplies)
    .innerJoin(emails, eq(emailReplies.replyEmailId, emails.id))
    .where(or(isNull(emailReplies.intent), isNull(emailReplies.sentiment)))
    .orderBy(sql`${emails.createdAt} ASC`) // Oldest first

  return results
}

async function classifyEmailReply(
  emailReplyId: string,
  subject: string,
  body: string,
  dryRun: boolean,
): Promise<ClassificationResult> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const aiService = getAIClassificationService()
      const classification = await aiService.classifyReply({ subject, body })

      if (dryRun) {
        return {
          emailReplyId,
          success: true,
          intent: classification.intent,
          sentiment: classification.sentiment,
        }
      }

      // Update the database
      await db
        .update(emailReplies)
        .set({
          intent: classification.intent,
          sentiment: classification.sentiment,
        })
        .where(eq(emailReplies.id, emailReplyId))

      return {
        emailReplyId,
        success: true,
        intent: classification.intent,
        sentiment: classification.sentiment,
      }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries

      if (isLastAttempt) {
        return {
          emailReplyId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 2 ** (attempt - 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return {
    emailReplyId,
    success: false,
    error: "Max retries exceeded",
  }
}

async function processBatch(
  batch: Array<{
    emailReplyId: string
    subject: string | null
    bodyText: string | null
    bodyHtml: string | null
  }>,
  batchNumber: number,
  totalBatches: number,
  dryRun: boolean,
): Promise<ClassificationResult[]> {
  console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)...`)

  const promises = batch.map(async (item) => {
    const body = item.bodyText || item.bodyHtml || ""
    const subject = item.subject || ""

    if (!body && !subject) {
      return {
        emailReplyId: item.emailReplyId,
        success: false,
        error: "No content to classify",
      }
    }

    return classifyEmailReply(item.emailReplyId, subject, body, dryRun)
  })

  const results = await Promise.all(promises)

  // Log batch summary
  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`   ✅ Success: ${succeeded}`)
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`)
  }

  return results
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

async function main() {
  const startTime = Date.now()

  // Parse configuration from environment variables
  const config: ScriptConfig = {
    batchSize: parseInt(process.env.BATCH_SIZE || "25", 10),
    dryRun: process.env.DRY_RUN === "true",
    delayBetweenBatches: parseInt(process.env.DELAY_MS || "1000", 10),
  }

  console.log("🚀 Email Reply Classification Script")
  console.log("=====================================\n")
  console.log("Configuration:")
  console.log(`  • Mode: ${config.dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  console.log(`  • Batch size: ${config.batchSize}`)
  console.log(`  • Delay between batches: ${config.delayBetweenBatches}ms\n`)

  try {
    // Fetch unclassified email replies
    const unclassifiedReplies = await getUnclassifiedEmailReplies()

    if (unclassifiedReplies.length === 0) {
      console.log("✨ No unclassified email replies found. All done!\n")
      process.exit(0)
    }

    console.log(`Found ${unclassifiedReplies.length} unclassified email replies\n`)
    console.log("Breakdown:")
    console.log(
      `  • Missing intent only: ${unclassifiedReplies.filter((r) => !r.currentIntent && r.currentSentiment).length}`,
    )
    console.log(
      `  • Missing sentiment only: ${unclassifiedReplies.filter((r) => r.currentIntent && !r.currentSentiment).length}`,
    )
    console.log(
      `  • Missing both: ${unclassifiedReplies.filter((r) => !r.currentIntent && !r.currentSentiment).length}\n`,
    )

    if (config.dryRun) {
      console.log("⚠️  DRY RUN MODE - No database changes will be made\n")
    }

    // Split into batches
    const batches: (typeof unclassifiedReplies)[] = []
    for (let i = 0; i < unclassifiedReplies.length; i += config.batchSize) {
      batches.push(unclassifiedReplies.slice(i, i + config.batchSize))
    }

    const totalBatches = batches.length
    const allResults: ClassificationResult[] = []

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchData = batch?.map((item) => ({
        emailReplyId: item.emailReplyId,
        subject: item.subject,
        bodyText: item.bodyText,
        bodyHtml: item.bodyHtml,
      }))

      const results = await processBatch(batchData || [], i + 1, totalBatches, config.dryRun)
      allResults.push(...results)

      // Progress indicator
      const processed = allResults.length
      const percentComplete = ((processed / unclassifiedReplies.length) * 100).toFixed(1)
      const elapsed = Date.now() - startTime
      const avgTimePerEmail = elapsed / processed
      const remaining = unclassifiedReplies.length - processed
      const eta = remaining * avgTimePerEmail

      console.log(`\n📈 Progress: ${processed}/${unclassifiedReplies.length} (${percentComplete}%)`)
      console.log(`   ⏱️  Elapsed: ${formatDuration(elapsed)} | ETA: ${formatDuration(eta)}`)

      // Delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        console.log(`   ⏳ Waiting ${config.delayBetweenBatches}ms before next batch...`)
        await sleep(config.delayBetweenBatches)
      }
    }

    // Final summary
    const totalDuration = Date.now() - startTime
    const succeeded = allResults.filter((r) => r.success).length
    const failed = allResults.filter((r) => !r.success).length

    console.log("\n\n=====================================")
    console.log("📊 FINAL SUMMARY")
    console.log("=====================================\n")
    console.log(`Total processed: ${allResults.length}`)
    console.log(`✅ Successfully classified: ${succeeded}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏱️  Total duration: ${formatDuration(totalDuration)}\n`)

    if (succeeded > 0) {
      // Intent breakdown
      const intentCounts = new Map<string, number>()
      const sentimentCounts = new Map<string, number>()

      allResults.forEach((result) => {
        if (result.success && result.intent) {
          intentCounts.set(result.intent, (intentCounts.get(result.intent) || 0) + 1)
        }
        if (result.success && result.sentiment) {
          sentimentCounts.set(result.sentiment, (sentimentCounts.get(result.sentiment) || 0) + 1)
        }
      })

      console.log("Intent Distribution:")
      Array.from(intentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([intent, count]) => {
          const percentage = ((count / succeeded) * 100).toFixed(1)
          console.log(`  • ${intent}: ${count} (${percentage}%)`)
        })

      console.log("\nSentiment Distribution:")
      Array.from(sentimentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([sentiment, count]) => {
          const percentage = ((count / succeeded) * 100).toFixed(1)
          console.log(`  • ${sentiment}: ${count} (${percentage}%)`)
        })
    }

    if (failed > 0) {
      console.log("\n⚠️  Failed Classifications:")
      allResults
        .filter((r) => !r.success)
        .slice(0, 10) // Show first 10 failures
        .forEach((result) => {
          console.log(`  • ${result.emailReplyId}: ${result.error}`)
        })

      if (failed > 10) {
        console.log(`  ... and ${failed - 10} more`)
      }
    }

    if (config.dryRun) {
      console.log("\n⚠️  DRY RUN MODE - No changes were made to the database")
      console.log("Run without DRY_RUN=true to apply classifications")
    }

    console.log("\n✨ Script completed successfully!\n")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Script failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run the script
main()
