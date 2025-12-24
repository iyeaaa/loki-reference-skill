/**
 * Test script to call BigQuery search service and save output to a file
 * Run with: bun run scripts/test-bigquery-search.ts
 */

import { writeFileSync } from "node:fs"
import { InvalidQueryError, searchBigQuery } from "../src/services/bigquery-search.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "../src/services/lead-discovery/nodes/bigquery-executor"

async function main() {
  console.log("=".repeat(60))
  console.log("BigQuery Search Service Test")
  console.log("=".repeat(60))

  // Test query - you can modify this
  const testQuery = "software companies in United States 50개"

  console.log(`\nQuery: "${testQuery}"`)
  console.log(`Table: ${APOLLO_LEADS_DATA_DICTIONARY.tableName}`)
  console.log("\nExecuting search...")

  try {
    const startTime = Date.now()
    const result = await searchBigQuery(testQuery, APOLLO_LEADS_DATA_DICTIONARY)
    const elapsed = Date.now() - startTime

    console.log(`\n${"=".repeat(60)}`)
    console.log("RESULTS")
    console.log("=".repeat(60))
    console.log(`Time elapsed: ${elapsed}ms`)
    console.log(`SQL: ${result.sql}`)
    console.log(`Explanation: ${result.explanation}`)
    console.log(`Total count: ${result.totalCount}`)
    console.log(`Results returned: ${result.results.length}`)

    // Save results to file
    const output = {
      query: testQuery,
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed,
      sql: result.sql,
      explanation: result.explanation,
      totalCount: result.totalCount,
      resultsCount: result.results.length,
      results: result.results,
    }

    const outputPath = "./scripts/bigquery-search-output.json"
    writeFileSync(outputPath, JSON.stringify(output, null, 2))
    console.log(`\nOutput saved to: ${outputPath}`)

    // Print first 5 results as preview
    if (result.results.length > 0) {
      console.log("\nFirst 5 results preview:")
      console.log("-".repeat(60))
      result.results.slice(0, 5).forEach((row, i) => {
        console.log(`${i + 1}. ${JSON.stringify(row)}`)
      })
    }
  } catch (error) {
    if (error instanceof InvalidQueryError) {
      console.error(`\nInvalid Query Error: ${error.message}`)
    } else {
      console.error("\nError:", error)
    }
    process.exit(1)
  }
}

main()
