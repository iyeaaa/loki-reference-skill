#!/usr/bin/env node

/**
 * 스캔된 키를 CSV에 병합하는 스크립트
 * i18next-scanner가 생성한 JSON 파일에서 새로운 키를 추출하여 해당 CSV 파일에 추가
 * 키의 첫 번째 부분으로 파일명 결정 (예: common.logout → common.csv)
 */

import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

interface TranslationRow {
  key: string
  ko: string
  en: string
}

const LOCALES_DIR = join(process.cwd(), "locales")
const SCANNED_JSON_PATH = join(process.cwd(), "locales", ".scanned", "ko", "translation.json")

try {
  // 스캔된 JSON 파일이 없으면 종료
  if (!existsSync(SCANNED_JSON_PATH)) {
    console.log("ℹ️  No scanned keys found. Run i18next-scanner first.")
    process.exit(0)
  }

  // 스캔된 JSON 읽기
  const scannedData = JSON.parse(readFileSync(SCANNED_JSON_PATH, "utf-8"))
  const scannedKeys = flattenKeys(scannedData)

  // 파일별로 키 그룹화
  const keysByFile: Record<string, string[]> = {}

  for (const fullKey of scannedKeys) {
    const [namespace, ...rest] = fullKey.split(".")
    if (!namespace || rest.length === 0) continue

    const csvFileName = `${namespace}.csv`
    const keyWithoutNamespace = rest.join(".")

    if (!keysByFile[csvFileName]) {
      keysByFile[csvFileName] = []
    }
    keysByFile[csvFileName].push(keyWithoutNamespace)
  }

  // 각 CSV 파일별로 처리
  let totalNewKeys = 0
  const addedKeys: string[] = []

  for (const [csvFileName, keysToAdd] of Object.entries(keysByFile)) {
    const csvPath = join(LOCALES_DIR, csvFileName)

    // 기존 CSV 파일 읽기 (없으면 새로 생성)
    let existingRows: TranslationRow[] = []
    let existingKeys = new Set<string>()

    if (existsSync(csvPath)) {
      const csvContent = readFileSync(csvPath, "utf-8")
      existingRows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as TranslationRow[]
      existingKeys = new Set(existingRows.map((row) => row.key))
    }

    // 새로운 키만 추가
    const newKeys: string[] = []
    for (const key of keysToAdd) {
      if (!existingKeys.has(key)) {
        newKeys.push(key)
        const namespace = csvFileName.replace(".csv", "")
        const fullKey = `${namespace}.${key}`
        existingRows.push({
          key,
          ko: `[NO TRANSLATION] ${fullKey}`,
          en: `[NO TRANSLATION] ${fullKey}`,
        })
        addedKeys.push(fullKey)
      }
    }

    // 새로운 키가 있으면 CSV 파일 업데이트
    if (newKeys.length > 0) {
      const newCsvContent = stringify(existingRows, {
        header: true,
        columns: ["key", "ko", "en"],
      })

      writeFileSync(csvPath, newCsvContent, "utf-8")
      totalNewKeys += newKeys.length
    }
  }

  if (totalNewKeys === 0) {
    console.log("✅ No new keys found. CSV files are up to date!")
    process.exit(0)
  }

  console.log(`🎉 Added ${totalNewKeys} new key(s) to CSV files:`)
  addedKeys.forEach((key) => console.log(`  - ${key}`))
} catch (error) {
  console.error("❌ Error merging keys to CSV:", error)
  process.exit(1)
}

/**
 * 중첩된 객체를 평탄화하여 키 목록 추출
 * 예: { common: { welcome: "..." } } => ["common.welcome"]
 */
function flattenKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

