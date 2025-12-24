#!/usr/bin/env node

/**
 * Translation sync status check script
 * Automatically runs during yarn dev, build to show notifications
 */

import "dotenv/config"
import {
  getSheetLastModified,
  getSheetRowCount,
  initializeSheetsClient,
} from "./google-sheets-client.js"
import type { SyncStatus } from "./i18n-types.js"
import { calculateLocalHash, readSyncMetadata } from "./i18n-utils.js"
import { createLogger } from "./logger.js"

const logger = createLogger("i18n:check")

async function checkSyncStatus(): Promise<SyncStatus> {
  // Show notification and exit if GOOGLE_CREDENTIALS is not set
  if (!process.env.GOOGLE_CREDENTIALS) {
    logger.warning("GOOGLE_CREDENTIALS not set")
    logger.item("Add to .env file: GOOGLE_CREDENTIALS='{...}'", 2)
    logger.item("Add to .env file: GOOGLE_SHEET_ID='...'", 2)
    logger.item("See .env.example for reference", 2)
    return "unknown"
  }

  try {
    await initializeSheetsClient()

    const metadata = readSyncMetadata()
    const currentLocalHash = calculateLocalHash()
    const currentSheetRowCount = await getSheetRowCount()
    const currentSheetLastModified = await getSheetLastModified()

    // First run or metadata lost - suggest initial sync
    if (!(metadata.lastLocalHash || metadata.lastPullTime || metadata.lastPushTime)) {
      logger.info("Translation sync status unknown")
      logger.item("No sync history found", 2)
      logger.item("Run: yarn i18n:pull or yarn i18n:push", 2)
      return "unknown"
    }

    const localChanged = metadata.lastLocalHash !== currentLocalHash
    const sheetChanged =
      metadata.lastSheetRowCount !== currentSheetRowCount ||
      (currentSheetLastModified &&
        metadata.lastPullTime &&
        currentSheetLastModified > metadata.lastPullTime)

    if (localChanged && sheetChanged) {
      logger.warning("Translation sync conflict")
      logger.item("Local CSV files changed", 2)
      logger.item("Google Sheet also has changes", 2)
      logger.item("Run: yarn i18n:push or yarn i18n:pull", 2)
      return "conflict"
    }
    if (localChanged) {
      logger.info("Local translation changes detected")
      logger.item("Run: yarn i18n:push to upload", 2)
      return "local_ahead"
    }
    if (sheetChanged) {
      logger.info("Google Sheet changes detected")
      logger.item("Run: yarn i18n:pull to download", 2)
      return "sheet_ahead"
    }

    // Synced
    return "synced"
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to check sync: ${error.message}`)
      if (error.message.includes("GOOGLE_CREDENTIALS")) {
        logger.item("Check your .env file", 2)
      }
    }
    return "unknown"
  }
}

// Run when executed directly as a script
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes("i18n-check-sync")) {
  checkSyncStatus()
    .then((status) => {
      if (status === "synced") {
        logger.success("Translations are synced")
      }
      process.exit(0)
    })
    .catch((error) => {
      logger.error(`Error: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    })
}

export { checkSyncStatus }
