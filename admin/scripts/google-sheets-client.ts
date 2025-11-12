#!/usr/bin/env node

/**
 * Google Sheets API client
 */

import "dotenv/config"
import { google } from "googleapis"
import { getLanguages } from "./i18n-config.js"
import type { TranslationRow } from "./i18n-types.js"

const SHEET_NAME = "send-grinda"

let sheetsClient: ReturnType<typeof google.sheets> | null = null

/**
 * Initialize Google Sheets API client
 */
export async function initializeSheetsClient(): Promise<void> {
  const credentials = process.env.GOOGLE_CREDENTIALS
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!credentials) {
    throw new Error(
      "GOOGLE_CREDENTIALS environment variable is not set.\n" +
        "Please add GOOGLE_CREDENTIALS to .env file.\n" +
        "Example: GOOGLE_CREDENTIALS='{\"type\":\"service_account\",...}'",
    )
  }

  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID environment variable is not set.\n" +
        "Please add GOOGLE_SHEET_ID to .env file.",
    )
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const authClient = await auth.getClient()
    sheetsClient = google.sheets({
      version: "v4",
      auth: authClient as any,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Sheets authentication failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Check if sheet exists and create if it doesn't
 */
export async function ensureSheetExists(): Promise<void> {
  if (!sheetsClient) {
    await initializeSheetsClient()
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const languages = getLanguages()

  try {
    // Get spreadsheet information
    const spreadsheet = await sheetsClient!.spreadsheets.get({
      spreadsheetId,
    })

    // Check sheet list
    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_NAME,
    )

    if (!sheetExists) {
      // Create sheet
      await sheetsClient!.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                },
              },
            },
          ],
        },
      })

      // Write header row
      const headers = ["filename", "key", ...languages, "lastModified"]
      await sheetsClient!.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      })

      console.log(`✅ Created sheet "${SHEET_NAME}" with headers`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to check/create sheet: ${error.message}`)
    }
    throw error
  }
}

/**
 * Read all data from Google Sheet
 */
export async function readSheetData(): Promise<TranslationRow[]> {
  if (!sheetsClient) {
    await initializeSheetsClient()
  }

  await ensureSheetExists()

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const languages = getLanguages()

  try {
    // Use A:Z to support up to (26 - 3) languages
    const response = await sheetsClient!.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return []
    }

    // First row is header
    const headers = rows[0] as string[]
    const dataRows = rows.slice(1)

    // Find header indices
    const filenameIndex = headers.indexOf("filename")
    const keyIndex = headers.indexOf("key")
    const lastModifiedIndex = headers.indexOf("lastModified")
    const langIndices: Record<string, number> = {}
    for (const lang of languages) {
      langIndices[lang] = headers.indexOf(lang)
    }

    const result: TranslationRow[] = []
    const seenKeys = new Map<string, number>() // Track seen keys with row index

    for (const row of dataRows) {
      if (!row[filenameIndex] || !row[keyIndex]) {
        continue // Skip if required fields are missing
      }

      const translationRow: TranslationRow = {
        filename: row[filenameIndex] as string,
        key: row[keyIndex] as string,
      }

      // Add language-specific values
      for (const lang of languages) {
        const index = langIndices[lang]
        if (index >= 0 && row[index]) {
          translationRow[lang] = row[index] as string
        }
      }

      // Add lastModified
      if (lastModifiedIndex >= 0 && row[lastModifiedIndex]) {
        translationRow.lastModified = row[lastModifiedIndex] as string
      }

      // Check for duplicate keys
      const compositeKey = `${translationRow.filename}:${translationRow.key}`
      const existingIndex = seenKeys.get(compositeKey)
      
      if (existingIndex !== undefined) {
        console.warn(`⚠️  Warning: Duplicate key "${compositeKey}" found in Google Sheet, using last occurrence`)
        result[existingIndex] = translationRow // Overwrite with last occurrence
      } else {
        seenKeys.set(compositeKey, result.length)
        result.push(translationRow)
      }
    }

    return result
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read sheet: ${error.message}`)
    }
    throw error
  }
}

/**
 * Write data to Google Sheet (overwrite all)
 */
export async function writeSheetData(rows: TranslationRow[]): Promise<void> {
  if (!sheetsClient) {
    await initializeSheetsClient()
  }

  await ensureSheetExists()

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const languages = getLanguages()

  try {
    // Header row
    const headers = ["filename", "key", ...languages, "lastModified"]

    // Convert data rows
    const values = rows.map((row) => {
      const rowValues: (string | undefined)[] = [
        row.filename,
        row.key,
        ...languages.map((lang) => row[lang] || ""),
        row.lastModified || "",
      ]
      return rowValues
    })

    // Overwrite entire sheet
    // Note: This will delete any rows beyond what we're writing
    // Consider using batchUpdate with clear operation if needed
    await sheetsClient!.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers, ...values],
      },
    })

    // Clear any remaining rows if we're writing fewer rows than before
    // This prevents orphaned data from remaining in the sheet
    if (values.length > 0) {
      const lastRow = values.length + 1 // +1 for header
      const clearRange = `${SHEET_NAME}!A${lastRow + 1}:ZZZ`
      try {
        await sheetsClient!.spreadsheets.values.clear({
          spreadsheetId,
          range: clearRange,
        })
      } catch {
        // Ignore clear errors - sheet might not have that many rows
      }
    }

    console.log(`✅ Wrote ${rows.length} rows to sheet "${SHEET_NAME}"`)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to write sheet: ${error.message}`)
    }
    throw error
  }
}

/**
 * Get row count of Google Sheet (for quick diff check)
 */
export async function getSheetRowCount(): Promise<number> {
  if (!sheetsClient) {
    await initializeSheetsClient()
  }

  await ensureSheetExists()

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!

  try {
    const response = await sheetsClient!.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:A`, // Read only first column to check row count
    })

    const rows = response.data.values || []
    return Math.max(0, rows.length - 1) // Exclude header
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get sheet row count: ${error.message}`)
    }
    throw error
  }
}

/**
 * Get last modified time of Google Sheet (from first data row's lastModified)
 */
export async function getSheetLastModified(): Promise<string | null> {
  if (!sheetsClient) {
    await initializeSheetsClient()
  }

  await ensureSheetExists()

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const languages = getLanguages()

  try {
    const headers = ["filename", "key", ...languages, "lastModified"]
    const lastModifiedIndex = headers.length - 1

    // Convert column index to letter (A=0, B=1, ..., Z=25, AA=26, ...)
    function indexToColumnLetter(index: number): string {
      let result = ""
      while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result
        index = Math.floor(index / 26) - 1
      }
      return result
    }

    const columnLetter = indexToColumnLetter(lastModifiedIndex)

    const response = await sheetsClient!.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!${columnLetter}2:${columnLetter}`, // Read excluding header
    })

    const values = response.data.values as string[][] | undefined
    if (!values || values.length === 0) {
      return null
    }

    // Find latest modification time
    let latest: string | null = null
    for (const row of values) {
      if (row[0]) {
        const timestamp = row[0]
        if (!latest || timestamp > latest) {
          latest = timestamp
        }
      }
    }

    return latest
  } catch (error) {
    // Log error but return null (sheet might be empty or column doesn't exist yet)
    if (error instanceof Error && !error.message.includes("Unable to parse range")) {
      console.warn(`⚠️  Warning: Could not read lastModified column: ${error.message}`)
    }
    return null
  }
}

