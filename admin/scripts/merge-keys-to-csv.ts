#!/usr/bin/env node

/**
 * 스캔된 키를 CSV에 병합하는 스크립트
 * i18next-scanner가 생성한 JSON 파일에서 새로운 키를 추출하여 해당 CSV 파일에 추가
 * 키의 첫 번째 부분으로 파일명 결정 (예: common.logout → common.csv)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"
import { getLanguages } from "./i18n-config.js"

interface TranslationRow {
  key: string
  [lang: string]: string
}

const LOCALES_DIR = join(process.cwd(), "locales")
const SCANNED_JSON_PATH_KO = join(process.cwd(), "locales", ".scanned", "ko", "translation.json")

try {
  // 스캔된 JSON 파일이 없으면 종료
  if (!existsSync(SCANNED_JSON_PATH_KO)) {
    console.log("ℹ️  No scanned keys found. Run i18next-scanner first.")
    process.exit(0)
  }

  // 한국어 스캔 결과 읽기 (기본 키만)
  const scannedDataKo = JSON.parse(readFileSync(SCANNED_JSON_PATH_KO, "utf-8"))
  const scannedKeys = flattenKeys(scannedDataKo)

  // 파일별로 키 그룹화
  const keysByFile: Record<string, string[]> = {}

  for (const fullKey of scannedKeys) {
    const [namespace, ...rest] = fullKey.split(".")
    if (!namespace || rest.length === 0) continue

    const keyWithoutNamespace = rest.join(".")

    // 한국어 스캔에서 복수형 키가 나오면 무시
    // (한국어는 복수형이 없으므로 i18next-scanner가 잘못 생성한 것)
    const pluralSuffixes = ["_other", "_one", "_zero", "_two", "_few", "_many"]
    if (pluralSuffixes.some((suffix) => keyWithoutNamespace.endsWith(suffix))) {
      continue // 복수형 키는 건너뛰기
    }

    const csvFileName = `${namespace}.csv`

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
        const languages = getLanguages()
        const newRow: TranslationRow = { key }
        for (const lang of languages) {
          newRow[lang] = `[NO TRANSLATION] ${fullKey}`
        }
        existingRows.push(newRow)
        addedKeys.push(fullKey)
      }
    }

    // 새로운 키가 있으면 CSV 파일 업데이트
    if (newKeys.length > 0) {
      const languages = getLanguages()
      const columns = ["key", ...languages]
      const newCsvContent = stringify(existingRows, {
        header: true,
        columns,
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
