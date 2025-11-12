#!/usr/bin/env node

/**
 * i18n type definitions
 */

import { getLanguages } from "./i18n-config.js"

/**
 * Translation row type (dynamic language fields)
 */
export type TranslationRow = {
  filename: string
  key: string
  [lang: string]: string // Dynamic language fields (ko, en, ...)
  lastModified?: string
}

/**
 * Translation row read from CSV file (no filename)
 */
export type LocalTranslationRow = {
  key: string
  [lang: string]: string // Dynamic language fields
}

/**
 * Translation row from Google Sheet (includes filename)
 */
export type SheetTranslationRow = {
  filename: string
  key: string
  [lang: string]: string // Dynamic language fields
  lastModified?: string
}

/**
 * Sync metadata type
 */
export interface SyncMetadata {
  lastPushTime?: string
  lastPullTime?: string
  lastSheetRowCount?: number
  lastLocalHash?: string
  lastSheetHash?: string
}

/**
 * Conflict information type
 */
export interface ConflictInfo {
  filename: string
  key: string
  localValue: Record<string, string> // Values by language
  sheetValue: Record<string, string> // Values by language
  sheetLastModified?: string
}

/**
 * Sync status type
 */
export type SyncStatus = "synced" | "local_ahead" | "sheet_ahead" | "conflict" | "unknown"

