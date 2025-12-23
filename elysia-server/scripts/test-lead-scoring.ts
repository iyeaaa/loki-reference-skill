#!/usr/bin/env bun

/**
 * Test script for lead scoring service
 * Tests scoring with various query and lead combinations
 *
 * Usage: bun run scripts/test-lead-scoring.ts
 */

import {
  formatLeadForScoring,
  scoreLeadFit,
  scoreLeadsBatch,
} from "../src/services/lead-scoring.service"

console.log("🧪 Lead Scoring Service Test")
console.log("=".repeat(60))
console.log()

async function main() {
  // Test 1: Perfect match
  console.log("Test 1: Perfect Match")
  console.log("-".repeat(60))
  const query1 = "Software companies in United States"
  const lead1 = formatLeadForScoring({
    companyName: "Acme Software Corp",
    industry: "Software Development",
    country: "United States",
    employeeCount: "50",
    websiteUrl: "https://acme.com",
    description: "Leading B2B SaaS platform provider",
  })

  console.log(`Query: "${query1}"`)
  console.log(`Lead: ${lead1}`)
  console.log()

  const score1 = await scoreLeadFit(query1, lead1)
  console.log(`✅ Score: ${score1.score}/100`)
  console.log(`   Reasoning: ${score1.reasoning}`)
  console.log()

  // Test 2: Partial match (different country)
  console.log("Test 2: Partial Match (Different Country)")
  console.log("-".repeat(60))
  const query2 = "Technology startups in Japan"
  const lead2 = formatLeadForScoring({
    companyName: "TechStart Inc",
    industry: "Technology",
    country: "United States",
    employeeCount: "25",
    description: "Innovative tech startup",
  })

  console.log(`Query: "${query2}"`)
  console.log(`Lead: ${lead2}`)
  console.log()

  const score2 = await scoreLeadFit(query2, lead2)
  console.log(`✅ Score: ${score2.score}/100`)
  console.log(`   Reasoning: ${score2.reasoning}`)
  console.log()

  // Test 3: Poor match (completely different industry)
  console.log("Test 3: Poor Match (Wrong Industry)")
  console.log("-".repeat(60))
  const query3 = "Healthcare providers in Germany"
  const lead3 = formatLeadForScoring({
    companyName: "Auto Parts Ltd",
    industry: "Automotive Manufacturing",
    country: "Germany",
    employeeCount: "500",
    description: "Automotive parts manufacturer",
  })

  console.log(`Query: "${query3}"`)
  console.log(`Lead: ${lead3}`)
  console.log()

  const score3 = await scoreLeadFit(query3, lead3)
  console.log(`✅ Score: ${score3.score}/100`)
  console.log(`   Reasoning: ${score3.reasoning}`)
  console.log()

  // Test 4: Batch scoring
  console.log("Test 4: Batch Scoring")
  console.log("-".repeat(60))
  const batchQuery = "Manufacturing companies in United Kingdom"
  const batchLeads = [
    formatLeadForScoring({
      companyName: "British Manufacturing Co",
      industry: "Manufacturing",
      country: "United Kingdom",
      employeeCount: "200",
    }),
    formatLeadForScoring({
      companyName: "UK Tech Solutions",
      industry: "Software",
      country: "United Kingdom",
      employeeCount: "50",
    }),
    formatLeadForScoring({
      companyName: "French Textiles",
      industry: "Textile Manufacturing",
      country: "France",
      employeeCount: "150",
    }),
  ]

  console.log(`Query: "${batchQuery}"`)
  console.log(`Scoring ${batchLeads.length} leads...`)
  console.log()

  const batchScores = await scoreLeadsBatch(batchQuery, batchLeads, (completed, total) => {
    console.log(`   Progress: ${completed}/${total}`)
  })

  console.log()
  console.log("Batch Results:")
  batchScores.forEach((score, index) => {
    console.log(`   Lead ${index + 1}: ${score.score}/100 - ${score.reasoning}`)
  })
  console.log()

  // Summary
  console.log("=".repeat(60))
  console.log("✅ All tests completed successfully!")
  console.log()
  console.log("Summary:")
  console.log(`   Test 1 (Perfect match): ${score1.score}/100`)
  console.log(`   Test 2 (Partial match): ${score2.score}/100`)
  console.log(`   Test 3 (Poor match): ${score3.score}/100`)
  console.log(
    `   Batch average: ${Math.round(
      batchScores.reduce((sum, s) => sum + s.score, 0) / batchScores.length,
    )}/100`,
  )
  console.log()

  process.exit(0)
}

main().catch((error) => {
  console.error()
  console.error("❌ TEST FAILED")
  console.error("Error:", error)
  console.error()

  if (error instanceof Error) {
    console.error("Stack trace:")
    console.error(error.stack)
  }

  process.exit(1)
})
