#!/usr/bin/env node

/**
 * i18n utility functions
 */

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"
import { getLanguages } from "./i18n-config.js"
import type { LocalTranslationRow, TranslationRow } from "./i18n-types.js"

const LOCALES_DIR = join(process.cwd(), "locales")

/**
 * Generate hash value of CSV files (for change detection)
 */
export function calculateLocalHash(): string {
  const csvFiles = readdirSync(LOCALES_DIR).filter(
    (file) => file.endsWith(".csv") && !file.startsWith("."),
  )

  if (csvFiles.length === 0) {
    return ""
  }

  const hash = createHash("sha256")

  for (const csvFile of csvFiles.sort()) {
    try {
      const csvPath = join(LOCALES_DIR, csvFile)
      const content = readFileSync(csvPath, "utf-8")
      hash.update(csvFile)
      hash.update(content)
    } catch {
      // If file read fails, still include filename in hash to detect file changes
      hash.update(csvFile)
      hash.update("ERROR_READING_FILE")
      console.warn(`⚠️  Warning: Could not read ${csvFile} for hash calculation`)
    }
  }

  return hash.digest("hex")
}

/**
 * Read all local CSV files
 */
export function readAllLocalCSVs(): Map<string, LocalTranslationRow[]> {
  const csvFiles = readdirSync(LOCALES_DIR).filter(
    (file) => file.endsWith(".csv") && !file.startsWith("."),
  )

  const result = new Map<string, LocalTranslationRow[]>()

  for (const csvFile of csvFiles) {
    try {
      const csvPath = join(LOCALES_DIR, csvFile)
      const csvContent = readFileSync(csvPath, "utf-8")

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as LocalTranslationRow[]

      const filename = csvFile.replace(".csv", "")
      
      // Check for duplicate keys and warn
      const seenKeys = new Set<string>()
      const dedupedRecords: LocalTranslationRow[] = []
      
      for (const record of records) {
        if (seenKeys.has(record.key)) {
          console.warn(`⚠️  Warning: Duplicate key "${record.key}" found in ${csvFile}, using last occurrence`)
        } else {
          seenKeys.add(record.key)
        }
        // Always use the last occurrence (overwrite previous)
        const existingIndex = dedupedRecords.findIndex((r) => r.key === record.key)
        if (existingIndex >= 0) {
          dedupedRecords[existingIndex] = record
        } else {
          dedupedRecords.push(record)
        }
      }
      
      result.set(filename, dedupedRecords)
    } catch (error) {
      console.error(`❌ Error reading ${csvFile}:`, error instanceof Error ? error.message : error)
      // Continue with other files instead of failing completely
    }
  }

  return result
}

/**
 * Write CSV file
 */
export function writeCSV(
  filename: string,
  rows: LocalTranslationRow[],
): void {
  const languages = getLanguages()
  const csvPath = join(LOCALES_DIR, `${filename}.csv`)

  const columns = ["key", ...languages]
  const csvContent = stringify(rows, {
    header: true,
    columns,
  })

  writeFileSync(csvPath, csvContent, "utf-8")
}

/**
 * Convert local CSV to Google Sheet format (add filename column)
 */
export function convertLocalToSheetRows(
  localRows: Map<string, LocalTranslationRow[]>,
): TranslationRow[] {
  const result: TranslationRow[] = []

  for (const [filename, rows] of localRows.entries()) {
    for (const row of rows) {
      result.push({
        filename,
        ...row,
      })
    }
  }

  return result
}

/**
 * Convert Google Sheet rows to local CSV format (separate by filename)
 */
export function convertSheetRowsToLocal(
  sheetRows: TranslationRow[],
): Map<string, LocalTranslationRow[]> {
  const result = new Map<string, LocalTranslationRow[]>()

  for (const row of sheetRows) {
    const { filename, ...rest } = row
    if (!filename) continue

    if (!result.has(filename)) {
      result.set(filename, [])
    }

    const localRow: LocalTranslationRow = { ...rest }
    const fileRows = result.get(filename)
    if (fileRows) {
      fileRows.push(localRow)
    }
  }

  return result
}

/**
 * Return current time as ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Prompt utility (using readline)
 */
export async function promptYesNo(question: string): Promise<boolean> {
  const { createInterface } = await import("node:readline/promises")
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`${question} (y/n): `)
    return answer.toLowerCase().trim() === "yes" || answer.toLowerCase().trim() === "y"
  } finally {
    rl.close()
  }
}

/**
 * Read metadata file
 */
export function readSyncMetadata(): import("./i18n-types.js").SyncMetadata {
  const metadataPath = join(LOCALES_DIR, ".i18n-sync.json")

  if (!existsSync(metadataPath)) {
    return {}
  }

  try {
    const content = readFileSync(metadataPath, "utf-8")
    return JSON.parse(content)
  } catch {
    console.warn("⚠️  Error reading sync metadata, returning empty object")
    return {}
  }
}

/**
 * Write metadata file
 */
export function writeSyncMetadata(
  metadata: import("./i18n-types.js").SyncMetadata,
): void {
  const metadataPath = join(LOCALES_DIR, ".i18n-sync.json")

  mkdirSync(LOCALES_DIR, { recursive: true })
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8")
}

