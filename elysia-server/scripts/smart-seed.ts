// Smart seed script - promotes legacy users to admin
// Users with any trial field set are skipped (they're trial users)
// Users without trial data are promoted to admin (legacy users)

import { eq } from "drizzle-orm"
import { db } from "../src/db"
import { users } from "../src/db/schema"
import logger from "../src/utils/logger"

async function smartSeed() {
  logger.info("[SMART-SEED] Starting smart seed...")

  // Fetch all users
  const allUsers = await db.select().from(users)
  logger.info({ count: allUsers.length }, "[SMART-SEED] Found users")

  let skipped = 0
  let promoted = 0

  for (const user of allUsers) {
    // Check if user has any trial data
    const hasTrialData =
      user.trialStartDate !== null || user.trialEndDate !== null || user.isTrialActive === true

    if (hasTrialData) {
      logger.debug(
        { userId: user.id, email: user.email },
        "[SMART-SEED] Skipping user with trial data",
      )
      skipped++
      continue
    }

    // User has no trial data - promote to admin
    if (user.userRole !== "admin" && user.userRole !== "super_admin") {
      await db
        .update(users)
        .set({ userRole: "admin", updatedAt: new Date() })
        .where(eq(users.id, user.id))

      logger.info({ userId: user.id, email: user.email }, "[SMART-SEED] Promoted user to admin")
      promoted++
    } else {
      skipped++
    }
  }

  logger.info({ skipped, promoted }, "[SMART-SEED] Smart seed completed")
}

// Run when executed directly
smartSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "[SMART-SEED] Failed")
    process.exit(1)
  })
