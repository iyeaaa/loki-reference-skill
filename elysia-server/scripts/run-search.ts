import "dotenv/config"
import { writeFileSync } from "fs"
import { searchAndEnrichLeads } from "../src/services/lead-search-enrichment.service"

/**
 * Script to run searchAndEnrichLeads and save results to file
 *
 * Usage: bun run scripts/run-search.ts
 */

async function main() {
  console.log("Starting lead search...")
  console.log("Query: manufacturing companies in southeast asia")
  console.log("Minimum match score: 70")
  console.log("Target: 150 leads")
  console.log("")

  try {
    const result = await searchAndEnrichLeads(
      150, // targetLeadCount
      "manufacturing companies in southeast asia",
      70, // minimumMatchScore
      async (progress) => {
        console.log(
          `[Progress] ${progress.phase}: ${progress.message} (${progress.currentCount}/${progress.targetCount})`,
        )
      },
    )

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `search-results-${timestamp}.json`
    const filepath = `./output/${filename}`

    // Create output directory if it doesn't exist
    const { mkdirSync } = await import("fs")
    try {
      mkdirSync("./output", { recursive: true })
    } catch (err) {
      // Directory might already exist
    }

    // Save the full result
    writeFileSync(filepath, JSON.stringify(result, null, 2))

    console.log("\n" + "=".repeat(60))
    console.log("Search completed!")
    console.log(`Results saved to: ${filepath}`)
    console.log("\nSummary:")
    console.log(`- Total qualifying leads: ${result.leads.length}`)
    console.log(`- BigQuery leads: ${result.stats.fromBigQuery}`)
    console.log(`- Hunter.io leads: ${result.stats.fromHunterIO}`)
    console.log(`- Leads with emails: ${result.stats.withEmails}`)
    console.log(`- Skipped duplicates: ${result.stats.skippedDuplicates}`)
    console.log(`- Skipped large companies: ${result.stats.skippedLargeCompanies}`)
    console.log(`- Skipped low scoring: ${result.stats.skippedLowScoring}`)
    console.log("=".repeat(60))

    // Also save a summary file
    const summaryFilename = `search-summary-${timestamp}.txt`
    const summaryFilepath = `./output/${summaryFilename}`

    const summaryContent = `
Lead Search Results Summary
===========================================================
Query: manufacturing companies in southeast asia
Minimum Match Score: 70
Timestamp: ${new Date().toISOString()}

Results:
- Total qualifying leads: ${result.leads.length}
- BigQuery leads: ${result.stats.fromBigQuery}
- Hunter.io leads: ${result.stats.fromHunterIO}
- Leads with emails: ${result.stats.withEmails}
- Skipped duplicates: ${result.stats.skippedDuplicates}
- Skipped large companies: ${result.stats.skippedLargeCompanies}
- Skipped low scoring: ${result.stats.skippedLowScoring}

Sample Leads (first 5):
${result.leads
  .slice(0, 5)
  .map(
    (lead, idx) => `
${idx + 1}. ${lead.companyName}
   Website: ${lead.websiteUrl}
   Email: ${lead.primaryEmail || "N/A"}
   Source: ${lead.leadSource}
`,
  )
  .join("")}

Full results saved to: ${filename}
===========================================================
`

    writeFileSync(summaryFilepath, summaryContent)
    console.log(`Summary saved to: ${summaryFilepath}`)
  } catch (error) {
    console.error("Error during search:", error)
    process.exit(1)
  }
}

main()
