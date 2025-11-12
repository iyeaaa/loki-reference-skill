#!/usr/bin/env node

/**
 * i18n language configuration utility
 * Dynamically loads language list from i18next-scanner.config.cjs
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"

let cachedLanguages: string[] | null = null

/**
 * Load supported language list from i18next-scanner.config.cjs
 */
export function getLanguages(): string[] {
  if (cachedLanguages) {
    return cachedLanguages
  }

  try {
    const configPath = join(process.cwd(), "i18next-scanner.config.cjs")
    const configContent = readFileSync(configPath, "utf-8")

    // Extract lngs array (using regex with non-greedy match)
    // This should match lngs: ["ko", "en"] pattern in the config
    const match = configContent.match(/lngs:\s*\[(.*?)\]/s)
    if (!match) {
      console.warn("⚠️  Could not find lngs in i18next-scanner.config.cjs, using default: ['ko', 'en']")
      cachedLanguages = ["ko", "en"]
      return cachedLanguages
    }

    const languagesString = match[1]
    // Extract strings (remove quotes)
    const languages = languagesString
      .split(",")
      .map((lang) => lang.trim().replace(/['"]/g, ""))
      .filter((lang) => lang.length > 0)

    if (languages.length === 0) {
      console.warn("⚠️  No languages found in config, using default: ['ko', 'en']")
      cachedLanguages = ["ko", "en"]
      return cachedLanguages
    }

    cachedLanguages = languages
    return cachedLanguages
  } catch (error) {
    console.warn("⚠️  Error reading i18next-scanner.config.cjs, using default: ['ko', 'en']", error)
    cachedLanguages = ["ko", "en"]
    return cachedLanguages
  }
}

/**
 * Return default language
 */
export function getDefaultLanguage(): string {
  const languages = getLanguages()
  return languages[0] || "ko"
}

