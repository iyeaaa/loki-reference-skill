/**
 * Script to fix Korean text encoding in emails
 * Re-parses emails that have MIME headers in bodyText/bodyHtml
 */

import { eq, like, or } from "drizzle-orm"
import { db } from "../db/index"
import { emails } from "../db/schema/emails"
import { parseEmailBody } from "../utils/email.util"
import logger from "../utils/logger"

async function fixEmailEncoding() {
  logger.info("🔧 Starting email encoding fix...")

  try {
    // Find all emails with MIME headers in bodyText or bodyHtml
    const emailsWithMimeHeaders = await db
      .select({
        id: emails.id,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        rawEmail: emails.rawEmail,
        direction: emails.direction,
      })
      .from(emails)
      .where(
        or(
          like(emails.bodyText, "%Content-Type:%"),
          like(emails.bodyText, "%Content-Transfer-Encoding:%"),
          like(emails.bodyHtml, "%Content-Type:%"),
          like(emails.bodyHtml, "%Content-Transfer-Encoding:%"),
        ),
      )

    logger.info({
      msg: "📧 Found emails with MIME headers",
      count: emailsWithMimeHeaders.length,
    })

    let fixedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const email of emailsWithMimeHeaders) {
      try {
        let newBodyText = email.bodyText
        let newBodyHtml = email.bodyHtml

        // Try to parse bodyText if it has MIME headers
        if (
          email.bodyText &&
          (email.bodyText.includes("Content-Type:") ||
            email.bodyText.includes("Content-Transfer-Encoding:"))
        ) {
          logger.debug({
            msg: "🔍 Parsing bodyText",
            emailId: email.id,
            preview: email.bodyText.substring(0, 200),
          })

          const parsed = parseEmailBody(email.bodyText)

          if (parsed.text && parsed.text !== email.bodyText) {
            newBodyText = parsed.text
            logger.debug({
              msg: "✅ Successfully parsed bodyText",
              emailId: email.id,
              oldLength: email.bodyText.length,
              newLength: parsed.text.length,
              preview: parsed.text.substring(0, 100),
            })
          }

          if (parsed.html && !email.bodyHtml) {
            newBodyHtml = parsed.html
          }
        }

        // Try to parse bodyHtml if it has MIME headers
        if (
          email.bodyHtml &&
          (email.bodyHtml.includes("Content-Type:") ||
            email.bodyHtml.includes("Content-Transfer-Encoding:"))
        ) {
          const parsed = parseEmailBody(email.bodyHtml)

          if (parsed.html && parsed.html !== email.bodyHtml) {
            newBodyHtml = parsed.html
          }

          if (parsed.text && !newBodyText) {
            newBodyText = parsed.text
          }
        }

        // Update if anything changed
        if (newBodyText !== email.bodyText || newBodyHtml !== email.bodyHtml) {
          await db
            .update(emails)
            .set({
              bodyText: newBodyText,
              bodyHtml: newBodyHtml,
              updatedAt: new Date(),
            })
            .where(eq(emails.id, email.id))

          fixedCount++
          logger.info({
            msg: "✅ Fixed email encoding",
            emailId: email.id,
            direction: email.direction,
            textChanged: newBodyText !== email.bodyText,
            htmlChanged: newBodyHtml !== email.bodyHtml,
          })
        } else {
          skippedCount++
          logger.debug({
            msg: "⏭️  Skipped (no changes)",
            emailId: email.id,
          })
        }
      } catch (error) {
        errorCount++
        logger.error({
          msg: "❌ Failed to fix email",
          emailId: email.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info({
      msg: "🎉 Email encoding fix completed",
      total: emailsWithMimeHeaders.length,
      fixed: fixedCount,
      skipped: skippedCount,
      errors: errorCount,
    })

    return {
      total: emailsWithMimeHeaders.length,
      fixed: fixedCount,
      skipped: skippedCount,
      errors: errorCount,
    }
  } catch (error) {
    logger.error({
      msg: "❌ Email encoding fix failed",
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Run if called directly
if (import.meta.main) {
  fixEmailEncoding()
    .then((result) => {
      logger.info({ msg: "✅ Script completed successfully", result })
      process.exit(0)
    })
    .catch((error) => {
      logger.error({ msg: "❌ Script failed", error })
      process.exit(1)
    })
}

export { fixEmailEncoding }
