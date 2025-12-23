#!/usr/bin/env bun

/**
 * Test script for searchAndEnrichLeads
 * Tests with direct industry/country inputs (skips AI parsing)
 *
 * Usage:
 *   bun run scripts/test-search-enrichment.ts
 *   bun run scripts/test-search-enrichment.ts "beauty cosmetics" "Japan"
 *   bun run scripts/test-search-enrichment.ts "software" "United States"
 */

import { writeFileSync } from "node:fs"
import { searchAndEnrichLeads } from "../src/services/lead-search-enrichment.service"

const TARGET_LEADS = 150
const industryName = process.argv[2] || "beauty cosmetics skincare"
const countryName = process.argv[3] || "Japan"

console.log("Lead Search & Enrichment Test")
console.log("=".repeat(60))
console.log(`Industry: ${industryName}`)
console.log(`Country: ${countryName}`)
console.log(`Target: ${TARGET_LEADS} leads`)
console.log(`Minimum Match Score: 0`)
console.log("=".repeat(60))
console.log()

async function main() {
  const startTime = Date.now()

  try {
    console.log("Starting search...")
    console.log()

    // No onProgress, use options to skip AI parsing
    const result = await searchAndEnrichLeads(
      TARGET_LEADS,
      "", // query not used when options provided
      0, // minimumMatchScore
      undefined, // no onProgress
      { industry: industryName, country: countryName },
    )

    const elapsed = Date.now() - startTime

    console.log()
    console.log("Search Complete!")
    console.log("=".repeat(60))
    console.log()
    console.log("Results Summary:")
    console.log(`   Total leads found: ${result.stats.totalFound}`)
    console.log(`   From BigQuery: ${result.stats.fromBigQuery}`)
    console.log(`   From Hunter.io: ${result.stats.fromHunterIO}`)
    console.log(`   With emails: ${result.stats.withEmails}`)
    console.log()
    console.log("Filtering Stats:")
    console.log(`   Skipped duplicates: ${result.stats.skippedDuplicates}`)
    console.log(`   Skipped large companies: ${result.stats.skippedLargeCompanies}`)
    console.log(`   Skipped low scoring leads: ${result.stats.skippedLowScoring}`)
    console.log()
    console.log(`Total time: ${(elapsed / 1000).toFixed(2)}s`)
    console.log()

    // Show first 10 leads as sample
    if (result.leads.length > 0) {
      console.log("Sample Leads (first 10):")
      result.leads.slice(0, 10).forEach((lead, i) => {
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

    // Source breakdown
    console.log("Lead Source Breakdown:")
    const bigQuerySources = ["b2b", "apollo", "fresh", "revation", "perplexity"] as const
    const bigQueryCount = result.leads.filter((l) =>
      bigQuerySources.includes(l.leadSource as (typeof bigQuerySources)[number]),
    ).length
    const hunterIOCount = result.leads.filter((l) => l.leadSource === "hunterio-discover").length
    console.log(
      `   BigQuery (5 sources): ${bigQueryCount} (${((bigQueryCount / result.leads.length) * 100).toFixed(1)}%)`,
    )
    console.log(
      `   Hunter.io: ${hunterIOCount} (${((hunterIOCount / result.leads.length) * 100).toFixed(1)}%)`,
    )
    console.log()

    // Email availability
    const withEmail = result.leads.filter((l) => l.primaryEmail).length
    console.log("Email Availability:")
    console.log(
      `   With email: ${withEmail} (${((withEmail / result.leads.length) * 100).toFixed(1)}%)`,
    )
    console.log(`   Without email: ${result.leads.length - withEmail}`)
    console.log()

    // Save results to JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outputFile = `test-results-${timestamp}.json`
    writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf-8")
    console.log(`Results saved to: ${outputFile}`)
    console.log()

    console.log("=".repeat(60))
    if (result.stats.totalFound >= TARGET_LEADS) {
      console.log("TEST PASSED: Target reached!")
    } else {
      console.log(`TEST PARTIAL: Found ${result.stats.totalFound}/${TARGET_LEADS} leads`)
    }

    process.exit(0)
  } catch (error) {
    console.error()
    console.error("TEST FAILED")
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
