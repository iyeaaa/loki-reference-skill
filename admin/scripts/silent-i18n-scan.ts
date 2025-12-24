#!/usr/bin/env node

/**
 * 조용한 i18n 스캔 스크립트
 * 개발 중에 자동 실행될 때 불필요한 출력을 최소화
 */

import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

async function silentScan() {
  try {
    // i18next-scanner 실행
    await execAsync("i18next-scanner --config i18next-scanner.config.cjs", { cwd: process.cwd() })

    // merge-keys-to-csv 실행
    const { stdout } = await execAsync("tsx scripts/merge-keys-to-csv.ts", { cwd: process.cwd() })

    // 새로운 키가 추가된 경우만 출력 (Added가 포함된 경우)
    if (stdout.includes("Added")) {
      console.log(`[scan] ${stdout.trim()}`)
    }
  } catch (error) {
    // 에러 발생 시에만 출력
    if (error instanceof Error && "stdout" in error) {
      const errorOutput = (error as any).stdout || (error as any).stderr
      if (errorOutput && !errorOutput.includes("No new keys")) {
        console.error(`[scan] ${errorOutput}`)
      }
    }
  }
}

silentScan()
