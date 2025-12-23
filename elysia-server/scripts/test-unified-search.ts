#!/usr/bin/env bun

/**
 * Test script for unified lead search & enrichment service
 * Tests with real query: "Toy manufacturing companies in Japan"
 * Target: 150 leads
 *
 * Usage: bun run scripts/test-unified-search.ts
 */

import { writeFileSync } from "node:fs"
import { searchAndEnrichLeads } from "../src/services/lead-search-enrichment.service"

const TARGET_LEADS = 150
const SEARCH_QUERY = "Toy manufacturing companies in Japan"

console.log("🧪 Unified Lead Search & Enrichment Test")
console.log("=".repeat(60))
console.log(`Target: ${TARGET_LEADS} leads`)
console.log(`Query: "${SEARCH_QUERY}"`)
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
    console.log("🚀 Starting search...")
    console.log()

    const result = await searchAndEnrichLeads(TARGET_LEADS, SEARCH_QUERY, 0, onProgress)

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

    // Show first 10 leads as sample
    if (result.leads.length > 0) {
      console.log("📝 Sample Leads (first 10):")
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

    // Prepare detailed results for file output
    const detailedResults = {
      metadata: {
        query: SEARCH_QUERY,
        targetLeads: TARGET_LEADS,
        executionTime: `${(elapsed / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
      },
      statistics: {
        totalFound: result.stats.totalFound,
        fromBigQuery: result.stats.fromBigQuery,
        fromHunterIO: result.stats.fromHunterIO,
        withEmails: result.stats.withEmails,
        skippedDuplicates: result.stats.skippedDuplicates,
        skippedLargeCompanies: result.stats.skippedLargeCompanies,
      },
      progressLog,
      leads: result.leads.map((lead, index) => ({
        index: index + 1,
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        primaryEmail: lead.primaryEmail,
        businessType: lead.businessType,
        country: lead.country,
        employeeCount: lead.employeeCount,
        description: lead.description,
        leadSource: lead.leadSource,
      })),
    }

    // Save results to JSON file
    const outputFile = `test-results-toy-manufacturing-japan-${Date.now()}.json`
    writeFileSync(outputFile, JSON.stringify(detailedResults, null, 2), "utf-8")
    console.log(`💾 Results saved to: ${outputFile}`)
    console.log()

    // Save CSV format for easy viewing
    const csvLines = [
      "Index,Company Name,Website,Email,Business Type,Country,Employees,Lead Source",
      ...result.leads.map((lead, i) => {
        return [
          i + 1,
          `"${(lead.companyName || "").replace(/"/g, '""')}"`,
          `"${(lead.websiteUrl || "").replace(/"/g, '""')}"`,
          `"${(lead.primaryEmail || "").replace(/"/g, '""')}"`,
          `"${(lead.businessType || "").replace(/"/g, '""')}"`,
          `"${(lead.country || "").replace(/"/g, '""')}"`,
          `"${(lead.employeeCount || "").replace(/"/g, '""')}"`,
          lead.leadSource,
        ].join(",")
      }),
    ]
    const csvFile = `test-results-toy-manufacturing-japan-${Date.now()}.csv`
    writeFileSync(csvFile, csvLines.join("\n"), "utf-8")
    console.log(`📊 CSV saved to: ${csvFile}`)
    console.log()

    // Source breakdown
    console.log("📈 Lead Source Breakdown:")
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
    console.log("📧 Email Availability:")
    console.log(
      `   With email: ${withEmail} (${((withEmail / result.leads.length) * 100).toFixed(1)}%)`,
    )
    console.log(`   Without email: ${result.leads.length - withEmail}`)
    console.log()

    // Country distribution
    const countryMap = new Map<string, number>()
    result.leads.forEach((lead) => {
      const country = lead.country || "Unknown"
      countryMap.set(country, (countryMap.get(country) || 0) + 1)
    })
    console.log("🌏 Country Distribution:")
    Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([country, count]) => {
        console.log(
          `   ${country}: ${count} (${((count / result.leads.length) * 100).toFixed(1)}%)`,
        )
      })
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
