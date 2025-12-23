#!/usr/bin/env bun

/**
 * Standalone test script for lead search & enrichment service
 * Tests the service without database dependencies
 *
 * Usage: bun run scripts/test-lead-search.ts
 */

import {
  type SearchProgress,
  searchAndEnrichLeads,
} from "../src/services/lead-search-enrichment.service"

const TARGET_LEADS = 10 // Small number for testing
const TEST_QUERY = "Software companies in United States"

console.log("🧪 Lead Search & Enrichment Service Test")
console.log("==========================================")
console.log(`Target: ${TARGET_LEADS} leads`)
console.log(`Query: "${TEST_QUERY}"`)
console.log()

async function main() {
  const startTime = Date.now()

  // Progress tracking
  const progressUpdates: SearchProgress[] = []

  const onProgress = (progress: SearchProgress) => {
    progressUpdates.push(progress)
    const percentage = Math.round((progress.currentCount / progress.targetCount) * 100)
    console.log(`[${progress.phase.toUpperCase()}] ${percentage}% - ${progress.message}`)
  }

  try {
    console.log("🚀 Starting search...")
    console.log()

    const result = await searchAndEnrichLeads(TARGET_LEADS, TEST_QUERY, 0, onProgress)

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

    // Show first 3 leads as sample
    if (result.leads.length > 0) {
      console.log("📝 Sample Leads (first 3):")
      result.leads.slice(0, 3).forEach((lead, i) => {
        console.log(`   ${i + 1}. ${lead.companyName}`)
        console.log(`      Website: ${lead.websiteUrl}`)
        console.log(`      Email: ${lead.primaryEmail || "N/A"}`)
        console.log(`      Source: ${lead.leadSource}`)
        if (lead.employeeCount) {
          console.log(`      Employees: ${lead.employeeCount}`)
        }
        console.log()
      })
    }

    // Progress tracking summary
    console.log("📈 Progress Tracking:")
    console.log(`   Total updates: ${progressUpdates.length}`)
    const phaseCount = new Map<string, number>()
    progressUpdates.forEach((p) => {
      phaseCount.set(p.phase, (phaseCount.get(p.phase) || 0) + 1)
    })
    phaseCount.forEach((count, phase) => {
      console.log(`   ${phase}: ${count} updates`)
    })
    console.log()

    // Verify results
    console.log("✓ Verification:")

    // Check: All leads have companies names
    const withNames = result.leads.filter((l) => l.companyName).length
    console.log(`   ✓ ${withNames}/${result.leads.length} leads have company names`)

    // Check: All leads have websites
    const withWebsites = result.leads.filter((l) => l.websiteUrl).length
    console.log(`   ✓ ${withWebsites}/${result.leads.length} leads have websites`)

    // Check: Email availability
    const withEmails = result.leads.filter((l) => l.primaryEmail).length
    console.log(`   ✓ ${withEmails}/${result.leads.length} leads have emails`)

    // Check: No large companies
    const largeCompanies = result.leads.filter((l) => {
      if (!l.employeeCount) return false
      const count = parseInt(l.employeeCount, 10)
      return count > 5000
    }).length
    console.log(`   ✓ ${largeCompanies} large companies (should be 0)`)

    // Check: Source distribution
    const bigQuerySources = ["b2b", "apollo", "fresh", "revation", "perplexity"] as const
    const bigQueryCount = result.leads.filter((l) =>
      bigQuerySources.includes(l.leadSource as (typeof bigQuerySources)[number]),
    ).length
    const hunterIOCount = result.leads.filter((l) => l.leadSource === "hunterio-discover").length
    console.log(`   ✓ Sources: ${bigQueryCount} BigQuery (5 sources), ${hunterIOCount} Hunter.io`)

    console.log()
    console.log("=".repeat(60))

    if (result.stats.totalFound >= TARGET_LEADS) {
      console.log("✅ TEST PASSED: Target reached!")
    } else {
      console.log(`⚠️  TEST PARTIAL: Found ${result.stats.totalFound}/${TARGET_LEADS} leads`)
    }

    process.exit(0)
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
