#!/usr/bin/env node

/**
 * Script to download translations from Google Sheet
 * yarn i18n:pull [--force]
 */

import "dotenv/config"
import { initializeSheetsClient, readSheetData } from "./google-sheets-client.js"
import { getLanguages } from "./i18n-config.js"
import type { ConflictInfo, LocalTranslationRow } from "./i18n-types.js"
import {
  calculateLocalHash,
  convertSheetRowsToLocal,
  getCurrentTimestamp,
  readAllLocalCSVs,
  readSyncMetadata,
  writeCSV,
  writeSyncMetadata,
} from "./i18n-utils.js"

/**
 * Check if file content has changed
 */
function hasFileChanged(localRows: LocalTranslationRow[], newRows: LocalTranslationRow[]): boolean {
  // Quick check: different number of rows
  if (localRows.length !== newRows.length) {
    return true
  }

  // Create maps for comparison
  const localMap = new Map(localRows.map((r) => [r.key, r]))
  const newMap = new Map(newRows.map((r) => [r.key, r]))

  // Check if keys differ
  if (localMap.size !== newMap.size) {
    return true
  }

  // Check if any values differ
  const languages = getLanguages()
  for (const [key, localRow] of localMap.entries()) {
    const newRow = newMap.get(key)
    if (!newRow) {
      return true
    }

    // Compare all language values
    for (const lang of languages) {
      const localValue = (localRow[lang] || "").trim()
      const newValue = (newRow[lang] || "").trim()
      if (localValue !== newValue) {
        return true
      }
    }
  }

  return false
}

async function pullTranslations(): Promise<void> {
  try {
    await initializeSheetsClient()

    console.log("📥 Downloading translations from Google Sheet...")

    // Read Google Sheet data
    const sheetRows = await readSheetData()

    if (sheetRows.length === 0) {
      console.log("ℹ️  No data found in Google Sheet.")
      process.exit(0)
    }

    // Read local CSV files
    const localRows = readAllLocalCSVs()

    // Detect conflicts
    const conflicts: ConflictInfo[] = []
    const localRowMap = new Map<string, Record<string, string>>()

    for (const [filename, rows] of localRows.entries()) {
      for (const row of rows) {
        const key = `${filename}:${row.key}`
        const languages = getLanguages()
        const values: Record<string, string> = {}
        for (const lang of languages) {
          values[lang] = row[lang] || ""
        }
        localRowMap.set(key, values)
      }
    }

    for (const sheetRow of sheetRows) {
      const key = `${sheetRow.filename}:${sheetRow.key}`
      const localValues = localRowMap.get(key)

      if (localValues) {
        // Compare values
        const languages = getLanguages()
        const hasConflict = languages.some((lang) => {
          const localValue = (localValues[lang] || "").trim()
          const sheetValue = ((sheetRow[lang] as string) || "").trim()
          // Only consider it a conflict if both values exist and are different
          return localValue !== sheetValue && localValue !== "" && sheetValue !== ""
        })

        if (hasConflict) {
          const sheetValue: Record<string, string> = {}
          for (const lang of languages) {
            sheetValue[lang] = ((sheetRow[lang] as string) || "").trim()
          }

          // Debug: log the actual values causing conflict
          const localValuesDebug: Record<string, string> = {}
          for (const lang of languages) {
            localValuesDebug[lang] = (localValues[lang] || "").trim()
          }

          conflicts.push({
            filename: sheetRow.filename,
            key: sheetRow.key,
            localValue: localValuesDebug,
            sheetValue,
            sheetLastModified: sheetRow.lastModified,
          })
        }
      }
    }

    // Convert Google Sheet data to local format
    const sheetRowsAsLocal = convertSheetRowsToLocal(sheetRows)

    // Sheet-first rule: By default, sheet content overwrites local conflicts
    // Show conflicts info but proceed with sheet content
    if (conflicts.length > 0) {
      console.log(
        `\n⚠️  ${conflicts.length} conflict(s) detected (will be overwritten with sheet content):`,
      )
      conflicts.slice(0, 5).forEach((conflict) => {
        console.log(`   - ${conflict.filename}.${conflict.key}`)
        // Show actual values for debugging
        const languages = getLanguages()
        for (const lang of languages) {
          if (conflict.localValue[lang] !== conflict.sheetValue[lang]) {
            console.log(
              `     [${lang}] Local: "${conflict.localValue[lang]}" → Sheet: "${conflict.sheetValue[lang]}"`,
            )
          }
        }
      })
      if (conflicts.length > 5) {
        console.log(`   ... and ${conflicts.length - 5} more`)
      }
      console.log("")
    }

    // Apply sheet-first rule: Use Google Sheet content directly
    // Sheet content is the source of truth, conflicts are automatically resolved by using sheet content
    let changedFiles = 0
    for (const [filename, rows] of sheetRowsAsLocal.entries()) {
      const localFileRows = localRows.get(filename) || []

      // Check if file actually changed
      if (hasFileChanged(localFileRows, rows)) {
        writeCSV(filename, rows)
        console.log(`✅ ${filename}.csv updated`)
        changedFiles++
      }
    }

    // Also preserve local-only items (not in sheet)
    for (const [filename, localFileRows] of localRows.entries()) {
      const sheetFileRows = sheetRowsAsLocal.get(filename) || []
      const sheetKeys = new Set(sheetFileRows.map((r) => r.key))

      // Find local-only items
      const localOnlyRows = localFileRows.filter((r) => !sheetKeys.has(r.key))

      if (localOnlyRows.length > 0) {
        // Merge: sheet content + local-only items
        const mergedRows = [...sheetFileRows, ...localOnlyRows]

        if (hasFileChanged(localFileRows, mergedRows)) {
          writeCSV(filename, mergedRows)
          console.log(
            `✅ ${filename}.csv updated (preserved ${localOnlyRows.length} local-only item(s))`,
          )
          changedFiles++
        }
      }
    }

    if (changedFiles === 0) {
      console.log("✅ No changes detected. All files are up to date.")
    }

    // Update metadata only after successful download
    try {
      const metadata = readSyncMetadata()
      writeSyncMetadata({
        ...metadata,
        lastPullTime: getCurrentTimestamp(),
        lastLocalHash: calculateLocalHash(),
        lastSheetRowCount: sheetRows.length,
      })
    } catch (error) {
      console.warn(
        "⚠️  Warning: Failed to update sync metadata:",
        error instanceof Error ? error.message : error,
      )
      console.warn("   Sync will still work, but status check may be inaccurate.")
    }

    console.log(`\n✅ Pull completed. Total items in sheet: ${sheetRows.length}`)
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Download failed:", error.message)
      if (error.message.includes("GOOGLE_CREDENTIALS")) {
        console.log("\nPlease set GOOGLE_CREDENTIALS and GOOGLE_SHEET_ID in .env file.")
      }
    } else {
      console.error("❌ Download failed:", error)
    }
    process.exit(1)
  }
}

// Execute script
pullTranslations()
