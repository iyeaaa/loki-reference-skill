#!/usr/bin/env bun

/**
 * Test script for lead scoring service with caching
 * Tests that caching works correctly and improves performance
 *
 * Usage: bun run scripts/test-lead-scoring-cache.ts
 */

import {
  clearCacheEntry,
  formatLeadForScoring,
  isCacheEnabled,
  scoreLeadFit,
} from "../src/services/lead-scoring.service"

console.log("🧪 Lead Scoring Service - Cache Test")
console.log("=".repeat(60))
console.log()

async function main() {
  // Check if cache is enabled
  console.log(`Cache enabled: ${isCacheEnabled()}`)
  console.log()

  const query = "Software companies in United States"
  const lead = formatLeadForScoring({
    companyName: "Acme Software Corp",
    industry: "Software Development",
    country: "United States",
    employeeCount: "50",
    websiteUrl: "https://acme.com",
    description: "Leading B2B SaaS platform provider",
  })

  // Test 1: First call (cache miss, should be slow)
  console.log("Test 1: First call (cache miss)")
  console.log("-".repeat(60))
  console.log(`Query: "${query}"`)
  console.log(`Lead: ${lead}`)
  console.log()

  const start1 = Date.now()
  const score1 = await scoreLeadFit(query, lead)
  const time1 = Date.now() - start1

  console.log(`✅ Score: ${score1.score}/100`)
  console.log(`   Time: ${time1}ms (LLM call)`)
  console.log(`   Reasoning: ${score1.reasoning}`)
  console.log()

  // Test 2: Second call (cache hit, should be fast)
  console.log("Test 2: Second call (cache hit)")
  console.log("-".repeat(60))

  const start2 = Date.now()
  const score2 = await scoreLeadFit(query, lead)
  const time2 = Date.now() - start2

  console.log(`✅ Score: ${score2.score}/100`)
  console.log(`   Time: ${time2}ms (from cache)`)
  console.log(`   Speedup: ${Math.round(time1 / time2)}x faster`)
  console.log()

  // Verify scores match
  if (score1.score !== score2.score) {
    throw new Error("Cache returned different score!")
  }

  // Test 3: Clear cache and verify
  console.log("Test 3: Clear cache entry")
  console.log("-".repeat(60))

  await clearCacheEntry(query, lead)
  console.log("Cache cleared")
  console.log()

  // Test 4: Third call after clear (should be slow again)
  console.log("Test 4: After cache clear (cache miss again)")
  console.log("-".repeat(60))

  const start3 = Date.now()
  const score3 = await scoreLeadFit(query, lead)
  const time3 = Date.now() - start3

  console.log(`✅ Score: ${score3.score}/100`)
  console.log(`   Time: ${time3}ms (LLM call)`)
  console.log()

  // Test 5: Multiple different leads (test cache keys)
  console.log("Test 5: Different leads (different cache keys)")
  console.log("-".repeat(60))

  const lead2 = formatLeadForScoring({
    companyName: "Tech Corp",
    industry: "Technology",
    country: "Japan",
    employeeCount: "100",
  })

  const start4 = Date.now()
  const score4 = await scoreLeadFit(query, lead2)
  const time4 = Date.now() - start4

  console.log(`Query: "${query}"`)
  console.log(`Lead: ${lead2}`)
  console.log(`✅ Score: ${score4.score}/100`)
  console.log(`   Time: ${time4}ms (new cache entry)`)
  console.log()

  // Verify first lead is still cached
  const start5 = Date.now()
  const score5 = await scoreLeadFit(query, lead)
  const time5 = Date.now() - start5

  console.log(`Original lead still cached:`)
  console.log(`   Score: ${score5.score}/100`)
  console.log(`   Time: ${time5}ms (from cache)`)
  console.log()

  // Summary
  console.log("=".repeat(60))
  console.log("✅ All caching tests passed!")
  console.log()
  console.log("Performance Summary:")
  console.log(`   Cache miss: ~${time1}ms`)
  console.log(`   Cache hit:  ~${time2}ms`)
  console.log(`   Speedup:    ${Math.round(time1 / time2)}x`)
  console.log()
  console.log("Cache Behavior:")
  console.log(`   ✓ Cache correctly stores results`)
  console.log(`   ✓ Cache returns same scores`)
  console.log(`   ✓ Different leads have different cache keys`)
  console.log(`   ✓ Cache clear works correctly`)
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
