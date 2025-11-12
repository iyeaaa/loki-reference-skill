#!/usr/bin/env node

/**
 * Script to upload translations to Google Sheet
 * yarn i18n:push [--force]
 */

import "dotenv/config"
import { initializeSheetsClient, readSheetData, writeSheetData } from "./google-sheets-client.js"
import {
  readAllLocalCSVs,
  convertLocalToSheetRows,
  calculateLocalHash,
  readSyncMetadata,
  writeSyncMetadata,
  getCurrentTimestamp,
} from "./i18n-utils.js"
import { getLanguages } from "./i18n-config.js"
import type { TranslationRow, ConflictInfo } from "./i18n-types.js"

async function pushTranslations(force: boolean = false): Promise<void> {
  try {
    await initializeSheetsClient()

    console.log("📤 Uploading translations to Google Sheet...")

    // Read local CSV files
    const localRows = readAllLocalCSVs()
    const localSheetRows = convertLocalToSheetRows(localRows)

    // Read Google Sheet data
    const sheetRows = await readSheetData()

    // Build sheet row map for quick lookup
    const sheetRowMap = new Map<string, TranslationRow>()
    for (const row of sheetRows) {
      const key = `${row.filename}:${row.key}`
      sheetRowMap.set(key, row)
    }

    // Detect conflicts (only when force mode is enabled)
    const conflicts: ConflictInfo[] = []
    if (force) {
      for (const localRow of localSheetRows) {
        const key = `${localRow.filename}:${localRow.key}`
        const sheetRow = sheetRowMap.get(key)

        if (sheetRow) {
          // Compare values - use getLanguages() to ensure we only compare actual language columns
          const languages = getLanguages()

          const hasConflict = languages.some((lang) => {
            const localValue = ((localRow[lang] as string) || "").trim()
            const sheetValue = ((sheetRow[lang] as string) || "").trim()
            return localValue !== sheetValue && localValue !== "" && sheetValue !== ""
          })

          if (hasConflict) {
            const localValue: Record<string, string> = {}
            const sheetValue: Record<string, string> = {}

            for (const lang of languages) {
              localValue[lang] = ((localRow[lang] as string) || "").trim()
              sheetValue[lang] = ((sheetRow[lang] as string) || "").trim()
            }

            conflicts.push({
              filename: localRow.filename,
              key: localRow.key,
              localValue,
              sheetValue,
              sheetLastModified: sheetRow.lastModified,
            })
          }
        }
      }

      // Show conflicts in force mode
      if (conflicts.length > 0) {
        console.log(`\n⚠️  ${conflicts.length} conflict(s) detected (will be overwritten with local content):`)
        conflicts.slice(0, 5).forEach((conflict) => {
          console.log(`   - ${conflict.filename}.${conflict.key}`)
        })
        if (conflicts.length > 5) {
          console.log(`   ... and ${conflicts.length - 5} more`)
        }
        console.log("")
      }
    }

    // Prepare data to upload
    // Sheet-first rule: Sheet content is the source of truth by default
    const rowsToUpload: TranslationRow[] = []
    const newKeys = new Set<string>()
    const updatedKeys = new Set<string>()

    if (force) {
      // Force mode: overwrite sheet with local content (local takes priority)
      for (const localRow of localSheetRows) {
        const key = `${localRow.filename}:${localRow.key}`
        const sheetRow = sheetRowMap.get(key)

        if (!sheetRow) {
          newKeys.add(key)
        } else {
          // Check if any language value changed
          const languages = getLanguages()
          const hasChange = languages.some((lang) => {
            const localValue = ((localRow[lang] as string) || "").trim()
            const sheetValue = ((sheetRow[lang] as string) || "").trim()
            return localValue !== sheetValue
          })
          if (hasChange) {
            updatedKeys.add(key)
          }
        }

        rowsToUpload.push({
          ...localRow,
          lastModified: getCurrentTimestamp(),
        })
      }

      // Also include sheet-only items (not in local)
      for (const sheetRow of sheetRows) {
        const key = `${sheetRow.filename}:${sheetRow.key}`
        const localRow = localSheetRows.find(
          (r) => `${r.filename}:${r.key}` === key,
        )
        if (!localRow) {
          rowsToUpload.push(sheetRow)
        }
      }
    } else {
      // Default mode: Sheet-first rule - sheet content takes priority
      // Only add items that exist only in local (new items)
      const uploadedKeys = new Set<string>()

      // Items in Google Sheet (priority - source of truth)
      for (const sheetRow of sheetRows) {
        const key = `${sheetRow.filename}:${sheetRow.key}`
        uploadedKeys.add(key)
        rowsToUpload.push(sheetRow)
      }

      // Add items that only exist locally (new items)
      for (const localRow of localSheetRows) {
        const key = `${localRow.filename}:${localRow.key}`
        if (!uploadedKeys.has(key)) {
          newKeys.add(key)
          rowsToUpload.push({
            ...localRow,
            lastModified: getCurrentTimestamp(),
          })
        }
      }
    }

    // Upload to Google Sheet
    await writeSheetData(rowsToUpload)

    // Update metadata only after successful upload
    try {
      const metadata = readSyncMetadata()
      writeSyncMetadata({
        ...metadata,
        lastPushTime: getCurrentTimestamp(),
        lastLocalHash: calculateLocalHash(),
        lastSheetRowCount: rowsToUpload.length,
      })
    } catch (error) {
      console.warn("⚠️  Warning: Failed to update sync metadata:", error instanceof Error ? error.message : error)
      console.warn("   Sync will still work, but status check may be inaccurate.")
    }

    // Show summary
    if (newKeys.size === 0 && updatedKeys.size === 0) {
      console.log(`✅ No changes detected. Sheet is up to date. (${rowsToUpload.length} total items)`)
    } else {
      if (newKeys.size > 0) {
        console.log(`✅ Added ${newKeys.size} new translation(s)`)
      }
      if (updatedKeys.size > 0) {
        console.log(`✅ Updated ${updatedKeys.size} translation(s)`)
      }
      console.log(`   Total: ${rowsToUpload.length} items in sheet`)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Upload failed:", error.message)
      if (error.message.includes("GOOGLE_CREDENTIALS")) {
        console.log("\nPlease set GOOGLE_CREDENTIALS and GOOGLE_SHEET_ID in .env file.")
      }
    } else {
      console.error("❌ Upload failed:", error)
    }
    process.exit(1)
  }
}

// Execute script
const force = process.argv.includes("--force")
pushTranslations(force)

