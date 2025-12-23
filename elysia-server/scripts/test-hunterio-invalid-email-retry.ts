#!/usr/bin/env bun

/**
 * Test script for Hunter.io invalid email retry functionality
 * Tests that the service retries with larger limit when first email is invalid
 *
 * Usage: bun run scripts/test-hunterio-invalid-email-retry.ts
 */

import { searchDomainWithHunter } from "../src/services/hunterio-domain-search.service"

console.log("🧪 Hunter.io Invalid Email Retry Test")
console.log("=".repeat(60))
console.log()

async function main() {
  // Test 1: Domain that typically has noreply as first email
  console.log("Test 1: Testing with a domain that may have invalid emails")
  console.log("-".repeat(60))

  const testDomain = "example.com" // Replace with actual test domain if needed

  console.log(`Searching domain: ${testDomain}`)
  console.log()

  const result = await searchDomainWithHunter({ domain: testDomain })

  console.log()
  console.log("Result:")
  console.log(`  Domain: ${result.domain}`)
  console.log(`  Organization: ${result.organization}`)
  console.log(`  Generic Email: ${result.genericEmail}`)
  console.log(`  Pattern: ${result.pattern}`)
  console.log()

  if (result.emails && result.emails.length > 0) {
    console.log("All generic emails found:")
    result.emails
      .filter((e) => e.type === "generic")
      .forEach((email, i) => {
        console.log(`  ${i + 1}. ${email.value} (confidence: ${email.confidence})`)
      })
    console.log()
  }

  // Check if the selected email is valid
  if (result.genericEmail) {
    const emailLower = result.genericEmail.toLowerCase()
    const isInvalid =
      emailLower.startsWith("noreply@") ||
      emailLower.startsWith("no-reply@") ||
      emailLower.startsWith("postmaster@") ||
      emailLower.startsWith("abuse@") ||
      emailLower.startsWith("webmaster@")

    if (isInvalid) {
      console.log("❌ TEST FAILED: Selected email is invalid!")
      console.log(`   Email: ${result.genericEmail}`)
      process.exit(1)
    } else {
      console.log("✅ TEST PASSED: Selected email is valid")
      console.log(`   Email: ${result.genericEmail}`)
    }
  } else {
    console.log("ℹ️  No generic email found (this is acceptable)")
  }

  console.log()
  console.log("=".repeat(60))
  console.log("✅ Test completed successfully")

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
