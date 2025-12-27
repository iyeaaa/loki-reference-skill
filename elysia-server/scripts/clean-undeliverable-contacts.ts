import { eq, sql } from "drizzle-orm"
import { config } from "../src/config"
import { db } from "../src/db"
import {
  emails,
  leadContacts,
  leads,
  sequenceEnrollments,
  sequences,
} from "../src/db/schema"
import {
  type DomainEmailWithRole,
  searchDomainAllEmails,
} from "../src/services/hunterio-domain-search.service"
import { verifyEmail } from "../src/services/hunterio-email-verifier.service"
import { summarizeCompanyInfo, extractWebsiteContent } from "../src/services/lead-enrichment.service"

/**
 * Script to clean undeliverable email contacts
 *
 * Flow:
 * 1. Query all email contacts
 * 2. Verify each email using Hunter.io Email Verifier
 * 3. If result === "undeliverable":
 *    - Delete the contact
 *    - Search Hunter.io for replacement emails
 *    - Sort by priority: generic > executive > management > finance > sales > senior > other
 *    - Create new contact with highest priority email
 *    - If no Hunter.io emails, try Gemini enrichment
 *    - If Gemini email also undeliverable, delete entire lead + cleanup
 *
 * Usage:
 *   bun run elysia-server/scripts/clean-undeliverable-contacts.ts
 *
 * Options (via env vars):
 *   DRY_RUN=true - Preview what would be done without making changes
 *   BATCH_SIZE=50 - Number of contacts to process per batch
 *   CONCURRENCY=5 - Number of parallel verifications
 */

interface ScriptConfig {
  dryRun: boolean
  batchSize: number
  concurrency: number
}

interface ProcessingStats {
  totalContacts: number
  deliverable: number
  undeliverable: number
  replacedWithHunter: number
  replacedWithGemini: number
  leadsDeleted: number
  contactsDeleted: number
  contactsCreated: number
  sequencesUpdated: number
  enrollmentsDeleted: number
  errors: number
}

// ==================== EMAIL PRIORITY SORTING ====================

/**
 * Get priority score for an email (lower = higher priority)
 */
function getEmailPriority(email: DomainEmailWithRole): number {
  // Priority 0: Generic emails (organization emails like contact@, info@)
  if (email.type === "generic") return 0

  // Priority 1: Executive seniority
  if (email.seniority === "executive") return 1

  // Priority 2: Executive or management department
  if (email.department === "executive" || email.department === "management") return 2

  // Priority 3: Finance department (money people)
  if (email.department === "finance") return 3

  // Priority 4: Sales department (money people)
  if (email.department === "sales") return 4

  // Priority 5: Senior seniority (non-executive)
  if (email.seniority === "senior") return 5

  // Priority 6: Everything else
  return 6
}

/**
 * Sort emails by priority (generic first, then executives, then others)
 */
function sortEmailsByPriority(emails: DomainEmailWithRole[]): DomainEmailWithRole[] {
  return [...emails].sort((a, b) => {
    const priorityA = getEmailPriority(a)
    const priorityB = getEmailPriority(b)

    // Sort by priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // Tie-breaker: higher confidence wins
    return b.confidence - a.confidence
  })
}

// ==================== DOMAIN EXTRACTION ====================

/**
 * Extract domain from URL
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null

  try {
    // Add protocol if missing
    const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    // If URL parsing fails, try simple extraction
    const domain = url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
    return domain || null
  }
}

// ==================== LEAD CLEANUP ====================

/**
 * Delete a lead and clean up all related records
 */
async function deleteLeadAndCleanup(
  leadId: string,
  dryRun: boolean,
): Promise<{ sequencesUpdated: number; enrollmentsDeleted: number }> {
  let sequencesUpdated = 0
  let enrollmentsDeleted = 0

  // 1. Remove from sequences.selectedLeadIds
  const sequencesWithLead = await db
    .select({ id: sequences.id, selectedLeadIds: sequences.selectedLeadIds })
    .from(sequences)
    .where(sql`${sequences.selectedLeadIds}::jsonb @> ${JSON.stringify([leadId])}::jsonb`)

  for (const seq of sequencesWithLead) {
    if (!dryRun) {
      const leadIds = JSON.parse(seq.selectedLeadIds || "[]") as string[]
      const updated = leadIds.filter((id) => id !== leadId)
      await db
        .update(sequences)
        .set({ selectedLeadIds: JSON.stringify(updated), updatedAt: new Date() })
        .where(eq(sequences.id, seq.id))
    }
    sequencesUpdated++
  }

  // 2. Count and delete enrollments (cascade handles step_executions)
  const enrollments = await db
    .select({ id: sequenceEnrollments.id })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.leadId, leadId))

  enrollmentsDeleted = enrollments.length

  if (!dryRun && enrollmentsDeleted > 0) {
    await db.delete(sequenceEnrollments).where(eq(sequenceEnrollments.leadId, leadId))
  }

  // 3. Nullify leadId in emails (FK already handles this, but explicit for clarity)
  if (!dryRun) {
    await db.update(emails).set({ leadId: null }).where(eq(emails.leadId, leadId))
  }

  // 4. Delete lead (cascade handles lead_contacts, lead_social_media, etc.)
  if (!dryRun) {
    await db.delete(leads).where(eq(leads.id, leadId))
  }

  return { sequencesUpdated, enrollmentsDeleted }
}

// ==================== CONTACT PROCESSING ====================

/**
 * Process a single contact - verify and replace if undeliverable
 */
async function processContact(
  contact: {
    id: string
    leadId: string
    contactValue: string
    lead: {
      id: string
      companyName: string | null
      websiteUrl: string | null
      finalUrl: string | null
    }
  },
  scriptConfig: ScriptConfig,
  stats: ProcessingStats,
): Promise<void> {
  const { dryRun } = scriptConfig

  try {
    // 1. Verify the email
    console.log(`  Verifying: ${contact.contactValue}`)
    const verificationResult = await verifyEmail(contact.contactValue)

    if (!verificationResult) {
      console.log(`    ⚠️ Verification failed (API error), skipping`)
      stats.errors++
      return
    }

    // 2. Check if deliverable using the result field
    if (verificationResult.result !== "undeliverable") {
      console.log(`    ✓ ${verificationResult.result || verificationResult.status}`)
      stats.deliverable++
      return
    }

    // 3. Email is undeliverable - need to replace
    console.log(`    ✗ undeliverable - searching for replacement...`)
    stats.undeliverable++

    // Delete the undeliverable contact
    if (!dryRun) {
      await db.delete(leadContacts).where(eq(leadContacts.id, contact.id))
    }
    stats.contactsDeleted++

    // 4. Get domain from lead
    const domain = extractDomain(contact.lead.finalUrl || contact.lead.websiteUrl)

    if (!domain) {
      console.log(`    ⚠️ No domain found for lead, trying Gemini enrichment...`)
    }

    let newEmail: string | null = null
    let emailSource: "hunter" | "gemini" | null = null

    // 5. Try Hunter.io domain search first
    if (domain) {
      console.log(`    └─ Searching Hunter.io for ${domain}...`)
      const hunterResult = await searchDomainAllEmails(domain, 10)

      if (hunterResult.emails.length > 0) {
        // Sort by priority and get the best email
        const sortedEmails = sortEmailsByPriority(hunterResult.emails)
        const bestEmail = sortedEmails[0]

        if (bestEmail) {
          console.log(
            `    └─ Found ${hunterResult.emails.length} emails, selecting: ${bestEmail.value} (${bestEmail.type}, ${bestEmail.confidence}% confidence)`,
          )

          newEmail = bestEmail.value
          emailSource = "hunter"
        }
      } else {
        console.log(`    └─ No emails found from Hunter.io`)
      }
    }

    // 6. Fallback to Gemini enrichment if no Hunter.io emails
    if (!newEmail && contact.lead.websiteUrl) {
      console.log(`    └─ Trying Gemini enrichment...`)

      try {
        // First extract website content with Jina
        const websiteContent = await extractWebsiteContent(contact.lead.websiteUrl)

        if (websiteContent.content) {
          // Then use Gemini to find email
          const geminiResult = await summarizeCompanyInfo(
            websiteContent.content,
            contact.lead.companyName || domain || "",
            config.gemini.apiKey,
          )

          if (
            geminiResult.attachedEmailValue &&
            geminiResult.attachedEmailValue !== "example@example.com"
          ) {
            console.log(`    └─ Gemini found email: ${geminiResult.attachedEmailValue}`)

            // Verify the Gemini email
            const geminiVerification = await verifyEmail(geminiResult.attachedEmailValue)

            if (geminiVerification?.result === "undeliverable") {
              console.log(`    └─ ❌ Gemini email is also undeliverable - deleting lead`)
              newEmail = null
            } else {
              newEmail = geminiResult.attachedEmailValue
              emailSource = "gemini"
            }
          }
        }
      } catch (error) {
        console.log(`    └─ Gemini enrichment failed:`, error)
      }
    }

    // 7. Create new contact or delete lead
    if (newEmail && emailSource) {
      if (!dryRun) {
        await db.insert(leadContacts).values({
          leadId: contact.leadId,
          contactType: "email",
          contactValue: newEmail,
          isPrimary: true,
          isVerified: true,
        })
      }
      stats.contactsCreated++

      if (emailSource === "hunter") {
        stats.replacedWithHunter++
      } else {
        stats.replacedWithGemini++
      }

      console.log(`    ✓ Created new contact: ${newEmail} (from ${emailSource})`)
    } else {
      // No valid email found - delete the entire lead
      console.log(`    └─ No valid email found - deleting lead and cleaning up...`)

      const cleanup = await deleteLeadAndCleanup(contact.leadId, dryRun)
      stats.leadsDeleted++
      stats.sequencesUpdated += cleanup.sequencesUpdated
      stats.enrollmentsDeleted += cleanup.enrollmentsDeleted

      console.log(
        `    ✓ Lead deleted (sequences updated: ${cleanup.sequencesUpdated}, enrollments deleted: ${cleanup.enrollmentsDeleted})`,
      )
    }
  } catch (error) {
    console.error(`    ❌ Error processing contact ${contact.id}:`, error)
    stats.errors++
  }
}

// ==================== MAIN SCRIPT ====================

async function main() {
  const startTime = Date.now()

  // Parse configuration from environment variables
  const scriptConfig: ScriptConfig = {
    dryRun: process.env.DRY_RUN === "true",
    batchSize: Number.parseInt(process.env.BATCH_SIZE || "50", 10),
    concurrency: Number.parseInt(process.env.CONCURRENCY || "5", 10),
  }

  const stats: ProcessingStats = {
    totalContacts: 0,
    deliverable: 0,
    undeliverable: 0,
    replacedWithHunter: 0,
    replacedWithGemini: 0,
    leadsDeleted: 0,
    contactsDeleted: 0,
    contactsCreated: 0,
    sequencesUpdated: 0,
    enrollmentsDeleted: 0,
    errors: 0,
  }

  console.log("🚀 Clean Undeliverable Contacts Script")
  console.log("=====================================\n")
  console.log("Configuration:")
  console.log(`  • Mode: ${scriptConfig.dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  console.log(`  • Batch Size: ${scriptConfig.batchSize}`)
  console.log(`  • Concurrency: ${scriptConfig.concurrency}`)
  console.log("")

  try {
    // 1. Count total email contacts
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadContacts)
      .where(eq(leadContacts.contactType, "email"))

    stats.totalContacts = Number(totalCount[0]?.count || 0)

    if (stats.totalContacts === 0) {
      console.log("✨ No email contacts found. Nothing to process!\n")
      process.exit(0)
    }

    console.log(`📊 Found ${stats.totalContacts} email contacts to process\n`)

    // 2. Process in batches
    const totalBatches = Math.ceil(stats.totalContacts / scriptConfig.batchSize)
    let processedCount = 0

    for (let batch = 0; batch < totalBatches; batch++) {
      const offset = batch * scriptConfig.batchSize
      console.log(`\n📦 Processing batch ${batch + 1}/${totalBatches}...`)

      // Fetch batch of contacts with lead info
      const contacts = await db
        .select({
          id: leadContacts.id,
          leadId: leadContacts.leadId,
          contactValue: leadContacts.contactValue,
          lead: {
            id: leads.id,
            companyName: leads.companyName,
            websiteUrl: leads.websiteUrl,
            finalUrl: leads.finalUrl,
          },
        })
        .from(leadContacts)
        .innerJoin(leads, eq(leadContacts.leadId, leads.id))
        .where(eq(leadContacts.contactType, "email"))
        .limit(scriptConfig.batchSize)
        .offset(offset)

      // Process contacts sequentially to respect rate limits
      for (const contact of contacts) {
        await processContact(contact, scriptConfig, stats)
        processedCount++

        // Progress indicator every 10 contacts
        if (processedCount % 10 === 0) {
          console.log(`  [Progress: ${processedCount}/${stats.totalContacts}]`)
        }
      }
    }

    // 3. Final summary
    const totalDuration = Date.now() - startTime

    console.log("\n=====================================")
    console.log("📊 SUMMARY")
    console.log("=====================================\n")
    console.log(`Total contacts processed: ${stats.totalContacts}`)
    console.log(`✓ Deliverable: ${stats.deliverable}`)
    console.log(`✗ Undeliverable: ${stats.undeliverable}`)
    console.log(`  └─ Replaced with Hunter.io: ${stats.replacedWithHunter}`)
    console.log(`  └─ Replaced with Gemini: ${stats.replacedWithGemini}`)
    console.log(`  └─ Leads deleted (no valid email): ${stats.leadsDeleted}`)
    console.log("")
    console.log("Cleanup performed:")
    console.log(`  • Contacts deleted: ${stats.contactsDeleted}`)
    console.log(`  • Contacts created: ${stats.contactsCreated}`)
    console.log(`  • Leads deleted: ${stats.leadsDeleted}`)
    console.log(`  • Sequences updated: ${stats.sequencesUpdated}`)
    console.log(`  • Enrollments deleted: ${stats.enrollmentsDeleted}`)
    if (stats.errors > 0) {
      console.log(`  • Errors: ${stats.errors}`)
    }
    console.log(`\n⏱️  Duration: ${totalDuration}ms\n`)

    if (scriptConfig.dryRun) {
      console.log("⚠️  DRY RUN MODE - No changes were made to the database")
      console.log("Run without DRY_RUN=true to actually process contacts\n")
    }

    console.log("✨ Script completed successfully!\n")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Script failed with error:")
    console.error(error)
    process.exit(1)
  }
}

// Run the script
main()
