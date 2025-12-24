#!/usr/bin/env node

/**
 * CSV → JSON 변환 스크립트
 * locales/*.csv 파일들을 읽어서 각 언어별 JSON 파일로 변환
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { parse } from "csv-parse/sync"
import { getLanguages } from "./i18n-config.js"
import { createLogger } from "./logger.js"

interface TranslationRow {
  key: string
  [lang: string]: string
}

const logger = createLogger("i18n:build")
const LOCALES_DIR = join(process.cwd(), "locales")
const OUTPUT_DIR = join(process.cwd(), "src", "i18n", "generated")

try {
  // 모든 CSV 파일 찾기
  const csvFiles = readdirSync(LOCALES_DIR).filter(
    (file) => file.endsWith(".csv") && !file.startsWith("."),
  )

  if (csvFiles.length === 0) {
    logger.warning("No CSV files found in locales/")
    process.exit(0)
  }

  // 언어별로 분류 (동적 언어 목록 사용)
  const languages = getLanguages()
  const translations: Record<string, Record<string, any>> = {}

  for (const lang of languages) {
    translations[lang] = {}
  }

  // 각 CSV 파일 처리
  for (const csvFile of csvFiles) {
    const csvPath = join(LOCALES_DIR, csvFile)
    const namespace = basename(csvFile, ".csv") // 파일명 (확장자 제외)

    // CSV 파일 읽기
    const csvContent = readFileSync(csvPath, "utf-8")

    // CSV 파싱
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as TranslationRow[]

    // 중첩된 객체로 변환
    for (const record of records) {
      const key = record.key
      if (!key) continue

      const fullKey = `${namespace}.${key}` // common.csv의 logout → common.logout

      for (const lang of languages) {
        const value = record[lang as keyof TranslationRow]
        if (value) {
          setNestedValue(translations[lang], fullKey, value)
        }
      }
    }
  }

  // 출력 디렉토리 생성
  mkdirSync(OUTPUT_DIR, { recursive: true })

  // JSON 파일로 저장
  for (const lang of languages) {
    const outputPath = join(OUTPUT_DIR, `${lang}.json`)
    writeFileSync(outputPath, JSON.stringify(translations[lang], null, 2), "utf-8")
    logger.success(`Generated ${logger.dim(lang + ".json")}`)
  }

  logger.info(`Converted ${logger.bright(csvFiles.length.toString())} CSV files`)
} catch (error) {
  logger.error(`Failed to convert CSV: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

/**
 * 중첩된 객체에 값을 설정하는 헬퍼 함수
 * 예: setNestedValue(obj, "common.welcome", "환영합니다")
 * => obj = { common: { welcome: "환영합니다" } }
 */
function setNestedValue(obj: Record<string, any>, path: string, value: string) {
  const keys = path.split(".")
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
}
