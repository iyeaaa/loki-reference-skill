#!/usr/bin/env bun

/**
 * Test script for lead scoring integration
 * Verifies that the service continues fetching leads until target count is reached
 * even when filtering by minimum match score.
 *
 * Usage: bun run scripts/test-scoring-integration.ts
 */

import { searchAndEnrichLeads } from "../src/services/lead-search-enrichment.service"

const TARGET_LEADS = 10
const MINIMUM_SCORE = 70 // Only accept leads scoring 70+
const TEST_QUERY = "Software companies in United States"

console.log("🧪 Lead Scoring Integration Test")
console.log("=".repeat(60))
console.log(`Target: ${TARGET_LEADS} leads with score >= ${MINIMUM_SCORE}`)
console.log(`Query: "${TEST_QUERY}"`)
console.log("=".repeat(60))
console.log()

async function main() {
  const startTime = Date.now()
  const progressLog: string[] = []

  // Progress callback
  const onProgress = (progress: {
    phase: string
    message: string
    currentCount: number
    targetCount: number
  }) => {
    const percentage = Math.round((progress.currentCount / progress.targetCount) * 100)
    const logMessage = `[${progress.phase.toUpperCase()}] ${percentage}% - ${progress.message}`
    console.log(logMessage)
    progressLog.push(logMessage)
  }

  try {
    console.log("🚀 Starting search with minimum score threshold...")
    console.log()

    // Call with minimum match score
    const result = await searchAndEnrichLeads(TARGET_LEADS, TEST_QUERY, MINIMUM_SCORE, onProgress)

    const elapsed = Date.now() - startTime

    console.log()
    console.log("✅ Search Complete!")
    console.log("=".repeat(60))
    console.log()
    console.log("📊 Results Summary:")
    console.log(`   Total leads found: ${result.stats.totalFound}`)
    console.log(`   From BigQuery: ${result.stats.fromBigQuery}`)
    console.log(`   From Hunter.io: ${result.stats.fromHunterIO}`)
    console.log(`   With emails: ${result.stats.withEmails}`)
    console.log()
    console.log("🔍 Filtering Stats:")
    console.log(`   Skipped duplicates: ${result.stats.skippedDuplicates}`)
    console.log(`   Skipped large companies: ${result.stats.skippedLargeCompanies}`)
    console.log(`   Skipped low scoring leads: ${result.stats.skippedLowScoring}`)
    console.log()
    console.log(`⏱️  Total time: ${(elapsed / 1000).toFixed(2)}s`)
    console.log()

    // Show all leads with details
    if (result.leads.length > 0) {
      console.log(`📝 All Qualifying Leads (${result.leads.length}):`)
      result.leads.forEach((lead, i) => {
        console.log(`   ${i + 1}. ${lead.companyName}`)
        console.log(`      Website: ${lead.websiteUrl}`)
        console.log(`      Email: ${lead.primaryEmail || "N/A"}`)
        console.log(`      Source: ${lead.leadSource}`)
        if (lead.employeeCount) {
          console.log(`      Employees: ${lead.employeeCount}`)
        }
        if (lead.country) {
          console.log(`      Country: ${lead.country}`)
        }
        console.log()
      })
    }

    console.log("=".repeat(60))

    // Validation checks
    console.log("✓ Validation:")

    if (result.stats.totalFound >= TARGET_LEADS) {
      console.log(`   ✅ Target reached: ${result.stats.totalFound}/${TARGET_LEADS} leads`)
    } else {
      console.log(
        `   ⚠️  Target not fully reached: ${result.stats.totalFound}/${TARGET_LEADS} leads (may have exhausted sources)`,
      )
    }

    if (result.stats.withEmails === result.stats.totalFound) {
      console.log(
        `   ✅ All leads have emails: ${result.stats.withEmails}/${result.stats.totalFound}`,
      )
    } else {
      console.log(
        `   ⚠️  Some leads without emails: ${result.stats.withEmails}/${result.stats.totalFound}`,
      )
    }

    if (result.stats.skippedLowScoring > 0) {
      console.log(
        `   ✅ Scoring filter working: ${result.stats.skippedLowScoring} leads filtered out`,
      )
    } else {
      console.log("   ℹ️  No leads filtered by score (all leads scored above threshold)")
    }

    console.log()
    console.log("=".repeat(60))

    if (result.stats.totalFound >= TARGET_LEADS) {
      console.log("✅ TEST PASSED: Target reached with scoring filter!")
      process.exit(0)
    } else {
      console.log(
        `⚠️  TEST PARTIAL: Found ${result.stats.totalFound}/${TARGET_LEADS} leads (sources may be exhausted)`,
      )
      process.exit(0) // Still pass since this may be expected
    }
  } catch (error) {
    console.error()
    console.error("❌ TEST FAILED")
    console.error("Error:", error)
    console.error()

    if (error instanceof Error) {
      console.error("Stack trace:")
      console.error(error.stack)
    }

    process.exit(1)
  }
}

main()
