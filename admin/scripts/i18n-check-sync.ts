#!/usr/bin/env node

/**
 * Translation sync status check script
 * Automatically runs during yarn dev, build to show notifications
 */

import "dotenv/config"
import { calculateLocalHash, readSyncMetadata } from "./i18n-utils.js"
import { getSheetRowCount, getSheetLastModified, initializeSheetsClient } from "./google-sheets-client.js"
import type { SyncStatus } from "./i18n-types.js"

async function checkSyncStatus(): Promise<SyncStatus> {
  // Show notification and exit if GOOGLE_CREDENTIALS is not set
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.log("\n⚠️  GOOGLE_CREDENTIALS environment variable is not set.")
    console.log("   To use translation sync feature, add the following to .env file:")
    console.log("   GOOGLE_CREDENTIALS='{...}'")
    console.log("   GOOGLE_SHEET_ID='...'")
    console.log("   See .env.example file for reference.\n")
    return "unknown"
  }

  try {
    await initializeSheetsClient()

    const metadata = readSyncMetadata()
    const currentLocalHash = calculateLocalHash()
    const currentSheetRowCount = await getSheetRowCount()
    const currentSheetLastModified = await getSheetLastModified()

    // First run or metadata lost - suggest initial sync
    if (!metadata.lastLocalHash && !metadata.lastPullTime && !metadata.lastPushTime) {
      console.log("\n💡 Translation sync status unknown:")
      console.log("   No sync history found. This might be your first run or after git pull.")
      console.log("   Run yarn i18n:pull to sync from Google Sheet,")
      console.log("   or yarn i18n:push to upload local translations.\n")
      return "unknown"
    }

    const localChanged = metadata.lastLocalHash !== currentLocalHash
    const sheetChanged =
      metadata.lastSheetRowCount !== currentSheetRowCount ||
      (currentSheetLastModified &&
        metadata.lastPullTime &&
        currentSheetLastModified > metadata.lastPullTime)

    if (localChanged && sheetChanged) {
      console.log("\n⚠️  Translation sync required:")
      console.log("   - Local CSV files changed (possibly from git pull)")
      console.log("   - Google Sheet also has changes")
      console.log("   Check both sources and run yarn i18n:push or yarn i18n:pull.\n")
      return "conflict"
    } else if (localChanged) {
      console.log("\n💡 Translation changes detected:")
      console.log("   Local CSV files have changed.")
      console.log("   If you made changes: run yarn i18n:push to upload to Google Sheet.")
      console.log("   If from git pull: run yarn i18n:pull to ensure sync with Google Sheet.\n")
      return "local_ahead"
    } else if (sheetChanged) {
      console.log("\n💡 Translation pull needed:")
      console.log("   Google Sheet changes detected.")
      console.log("   Run yarn i18n:pull to download to local.\n")
      return "sheet_ahead"
    }

    // Synced
    return "synced"
  } catch (error) {
    if (error instanceof Error) {
      console.error("\n❌ Failed to check sync status:", error.message)
      if (error.message.includes("GOOGLE_CREDENTIALS")) {
        console.log("   Please check your .env file.\n")
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
        console.log("✅ Translations are synced.")
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Error:", error)
      process.exit(1)
    })
}

export { checkSyncStatus }

