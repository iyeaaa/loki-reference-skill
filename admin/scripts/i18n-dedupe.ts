#!/usr/bin/env node

/**
 * Find and remove duplicate keys in CSV files
 * yarn i18n:dedupe [--auto]
 * 
 * Without --auto flag, prompts user to select which occurrence to keep
 * With --auto flag, automatically keeps last occurrence
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"
import { createInterface } from "node:readline/promises"
import { writeCSV } from "./i18n-utils.js"
import { getLanguages } from "./i18n-config.js"
import type { LocalTranslationRow } from "./i18n-types.js"

const LOCALES_DIR = join(process.cwd(), "locales")

async function dedupeTranslations(auto: boolean = false): Promise<void> {
  console.log("🔍 Checking for duplicate keys in CSV files...\n")

  const csvFiles = readdirSync(LOCALES_DIR).filter(
    (file) => file.endsWith(".csv") && !file.startsWith("."),
  )

  let totalDuplicates = 0

  for (const csvFile of csvFiles) {
    const csvPath = join(LOCALES_DIR, csvFile)
    const csvContent = readFileSync(csvPath, "utf-8")
    const filename = csvFile.replace(".csv", "")

    // Parse CSV directly without deduplication
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as LocalTranslationRow[]

    // Find duplicates and group by key
    const keyOccurrences = new Map<string, LocalTranslationRow[]>()

    for (const record of records) {
      if (!keyOccurrences.has(record.key)) {
        keyOccurrences.set(record.key, [])
      }
      const occurrences = keyOccurrences.get(record.key)
      if (occurrences) {
        occurrences.push(record)
      }
    }

    // Find which keys have duplicates
    const duplicateKeys = Array.from(keyOccurrences.entries()).filter(
      ([_key, occurrences]) => occurrences.length > 1,
    )

    if (duplicateKeys.length > 0) {
      console.log(`📝 ${csvFile}:`)
      console.log(`   Found ${duplicateKeys.length} duplicate key(s)\n`)

      const selectedOccurrences = new Map<string, LocalTranslationRow>()

      for (const [key, occurrences] of duplicateKeys) {
        console.log(`\n🔑 Duplicate key: "${key}" (${occurrences.length} occurrences)`)

        if (auto) {
          // Auto mode: keep last occurrence
          selectedOccurrences.set(key, occurrences[occurrences.length - 1])
          console.log(`   → Auto-selected: Last occurrence (#${occurrences.length})`)
        } else {
          // Interactive mode: let user choose
          const languages = getLanguages()

          occurrences.forEach((occurrence, index) => {
            console.log(`\n   [${index + 1}] Occurrence #${index + 1}:`)
            for (const lang of languages) {
              const value = occurrence[lang] || ""
              if (value) {
                console.log(`       ${lang}: "${value}"`)
              }
            }
          })

          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          })

          try {
            let selected = -1
            while (selected < 1 || selected > occurrences.length) {
              const answer = await rl.question(
                `\n   Select which occurrence to keep (1-${occurrences.length}): `,
              )
              selected = Number.parseInt(answer.trim(), 10)

              if (Number.isNaN(selected) || selected < 1 || selected > occurrences.length) {
                console.log(`   ❌ Invalid input. Please enter a number between 1 and ${occurrences.length}`)
              }
            }

            selectedOccurrences.set(key, occurrences[selected - 1])
            console.log(`   ✅ Selected occurrence #${selected}`)
          } finally {
            rl.close()
          }
        }
      }

      // Build deduplicated records maintaining original order
      const dedupedRecords: LocalTranslationRow[] = []
      const processedKeys = new Set<string>()

      for (const record of records) {
        const occurrences = keyOccurrences.get(record.key)
        if (occurrences && occurrences.length > 1) {
          // This is a duplicate key
          if (!processedKeys.has(record.key)) {
            // First time seeing this duplicate key, add the selected occurrence
            const selected = selectedOccurrences.get(record.key)
            if (selected) {
              dedupedRecords.push(selected)
            }
            processedKeys.add(record.key)
          }
          // Skip other occurrences of this key
        } else {
          // Not a duplicate, keep as-is
          dedupedRecords.push(record)
        }
      }

      writeCSV(filename, dedupedRecords)
      console.log(`\n   ✅ Removed ${duplicateKeys.length} duplicate key(s)`)
      console.log(`   Original: ${records.length} rows → Cleaned: ${dedupedRecords.length} rows\n`)

      totalDuplicates += duplicateKeys.length
    }
  }

  if (totalDuplicates === 0) {
    console.log("✅ No duplicate keys found!")
  } else {
    console.log(`\n🎉 Fixed ${totalDuplicates} duplicate key(s) across all files`)
    console.log("   Run yarn i18n:build to regenerate JSON files")
  }
}

// Execute script
const auto = process.argv.includes("--auto")
if (auto) {
  console.log("🤖 Running in auto mode (keeping last occurrence)\n")
}
dedupeTranslations(auto)



