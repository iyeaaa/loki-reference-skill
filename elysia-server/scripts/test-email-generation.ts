#!/usr/bin/env bun
/**
 * CLI Script for Testing AI Email Generation (3-Touch Sequence)
 *
 * This script simulates the actual onboarding email generation process.
 * It uses the same fields and values as the real onboarding flow.
 *
 * Usage:
 *   bun run test:ai-email
 */

import * as p from "@clack/prompts"
import { getAITemplateGenerationService } from "../src/services/ai-template-generation.service"
import { EMAIL_TYPES_3TOUCH } from "../src/services/onboarding.service"

// ANSI Colors for better terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
}

// Onboarding field options (same as actual onboarding)
const INDUSTRY_OPTIONS = {
  beauty: "뷰티/화장품",
  fashion: "패션/의류",
  food: "식품/음료",
  it_saas: "IT/SaaS",
  manufacturing: "제조업",
  retail: "소매업",
  healthcare: "헬스케어",
  education: "교육",
  other: "기타",
}

const TARGET_OPTIONS = {
  b2b: "기업 대상 (B2B)",
  b2c: "소비자 대상 (B2C)",
  both: "둘 다 (B2B + B2C)",
}

const COUNTRY_OPTIONS = {
  jp: "일본 (Japan)",
  us: "미국 (United States)",
  sea: "동남아시아 (Southeast Asia)",
  eu: "유럽 (Europe)",
  cn: "중국 (China)",
  ae: "UAE (United Arab Emirates)",
  kr: "한국 (South Korea)",
  other: "기타 (Other)",
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(70)}`)
  log(title, colors.bright + colors.cyan)
  console.log("=".repeat(70))
}

function checkEmailQuality(email: { subject: string; bodyText: string; bodyHtml?: string }) {
  const issues: string[] = []

  // Check for fake statistics
  const statsPattern = /\d+%|\d+\s*(times|x)|\d+\s*명|\d+개|increase|growth|boost|improve.*\d+/gi
  if (statsPattern.test(email.bodyText)) {
    issues.push("⚠️  Potential fabricated statistics detected")
  }

  // Check for vague claims
  if (/many companies|several|various|numerous|많은 기업|여러 회사/gi.test(email.bodyText)) {
    issues.push("ℹ️  Contains vague quantifiers (acceptable if no specific numbers)")
  }

  // Check length
  const wordCount = email.bodyText.split(/\s+/).length
  if (wordCount > 200) {
    issues.push(`⚠️  Email might be too long (${wordCount} words, recommend <200)`)
  } else {
    issues.push(`✅ Length: ${wordCount} words`)
  }

  return issues
}

function displayEmail(
  email: { subject: string; bodyText: string; bodyHtml?: string },
  stepInfo: { stepOrder: number; type: string; delayDays: number },
) {
  log(`\n${"=".repeat(70)}`, colors.cyan)
  log(
    `Step ${stepInfo.stepOrder}: ${stepInfo.type} (+${stepInfo.delayDays}일)`,
    colors.bright + colors.cyan,
  )
  log("=".repeat(70), colors.cyan)
  log(`\n제목: ${email.subject}`, colors.yellow)
  log("─".repeat(70), colors.dim)
  console.log(email.bodyText)
  log("─".repeat(70), colors.dim)

  const issues = checkEmailQuality(email)
  if (issues.length > 0) {
    log("\n🔍 Quality Check:", colors.bright)
    for (const issue of issues) {
      console.log(`  ${issue}`)
    }
  }
}

function getCountryFullName(countryCode: string): string {
  const countryMap: Record<string, string> = {
    jp: "Japan",
    us: "United States",
    sea: "Southeast Asia",
    eu: "Europe",
    cn: "China",
    ae: "United Arab Emirates",
    kr: "South Korea",
    other: "Other",
  }
  return countryMap[countryCode] || countryCode
}

async function generate3TouchSequence(options: {
  workspaceName: string
  workspaceDescription?: string
  industry: string
  target: string
  country: string
}) {
  const aiService = getAITemplateGenerationService()

  // Convert country code to full name
  const countryFullName = getCountryFullName(options.country)

  // Same as onboarding logic
  const industryContext = `${options.industry} 산업의 ${options.target} 고객을 대상으로`

  const s = p.spinner()
  s.start("3-Touch 이메일 시퀀스 생성 중...")

  const templates: Array<{
    stepOrder: number
    type: string
    delayDays: number
    template: { subject: string; bodyText: string; bodyHtml: string }
  }> = []

  for (let i = 0; i < EMAIL_TYPES_3TOUCH.length; i++) {
    const emailType = EMAIL_TYPES_3TOUCH[i]
    if (!emailType) continue

    const prompt = emailType.promptKr

    s.message(`Step ${i + 1}/${EMAIL_TYPES_3TOUCH.length}: ${emailType.type} 생성 중...`)

    try {
      // Same as onboarding: workspace.companyName || workspace.name, effectiveDescription
      const template = await aiService.generateEmailTemplate({
        workspaceName: options.workspaceName,
        workspaceDescription: options.workspaceDescription,
        country: countryFullName,
        userPrompt: `${prompt} ${industryContext}`,
      })

      templates.push({
        stepOrder: i + 1,
        type: emailType.type,
        delayDays: emailType.delayDays,
        template,
      })
    } catch (error) {
      s.stop(`Step ${i + 1} 생성 실패: ${error}`)
      throw error
    }
  }

  s.stop(`✅ ${templates.length}개 이메일 생성 완료`)

  // Display all emails at once
  console.log("\n")
  logSection("생성된 이메일 시퀀스")
  log(`회사명: ${options.workspaceName}`, colors.cyan)
  if (options.workspaceDescription) {
    log(`회사 설명: ${options.workspaceDescription}`, colors.cyan)
  }
  log(`산업: ${options.industry}`, colors.cyan)
  log(`타겟: ${options.target}`, colors.cyan)
  log(`국가: ${options.country} (${countryFullName})`, colors.cyan)

  for (const t of templates) {
    displayEmail(t.template, {
      stepOrder: t.stepOrder,
      type: t.type,
      delayDays: t.delayDays,
    })
  }

  // Summary
  console.log("\n")
  logSection("시퀀스 요약")
  for (const t of templates) {
    log(`Step ${t.stepOrder} (${t.type}, +${t.delayDays}일):`, colors.cyan)
    log(`  제목: ${t.template.subject}`, colors.dim)
  }
}

async function interactiveMode() {
  console.clear()

  p.intro("🤖 AI 이메일 생성 테스트 (3-Touch Sequence)")

  // Step 1: Company Info (same as onboarding)
  const workspaceName = await p.text({
    message: "회사명 (companyName)",
    placeholder: "데모 회사",
    defaultValue: "데모 회사",
    validate: (value) => {
      if (!value) return "회사명을 입력해주세요"
    },
  })

  if (p.isCancel(workspaceName)) {
    p.cancel("작업이 취소되었습니다.")
    process.exit(0)
  }

  const workspaceDescription = await p.text({
    message: "회사 설명 (companyDescription, optional)",
    placeholder: "예: B2B 마케팅 자동화 솔루션 제공",
  })

  if (p.isCancel(workspaceDescription)) {
    p.cancel("작업이 취소되었습니다.")
    process.exit(0)
  }

  // Step 2: Survey Data (same as onboarding)
  const industry = await p.select({
    message: "산업군 (industry)",
    options: Object.entries(INDUSTRY_OPTIONS).map(([value, label]) => ({
      value,
      label,
    })),
    initialValue: "beauty",
  })

  if (p.isCancel(industry)) {
    p.cancel("작업이 취소되었습니다.")
    process.exit(0)
  }

  const target = await p.select({
    message: "타겟 고객 (target)",
    options: Object.entries(TARGET_OPTIONS).map(([value, label]) => ({
      value,
      label,
    })),
    initialValue: "b2b",
  })

  if (p.isCancel(target)) {
    p.cancel("작업이 취소되었습니다.")
    process.exit(0)
  }

  const country = await p.select({
    message: "희망 진출 국가 (country)",
    options: Object.entries(COUNTRY_OPTIONS).map(([value, label]) => ({
      value,
      label,
    })),
    initialValue: "jp",
  })

  if (p.isCancel(country)) {
    p.cancel("작업이 취소되었습니다.")
    process.exit(0)
  }

  // Generate emails with validated inputs
  await generate3TouchSequence({
    workspaceName: workspaceName as string,
    workspaceDescription: workspaceDescription ? (workspaceDescription as string) : undefined,
    industry: INDUSTRY_OPTIONS[industry as keyof typeof INDUSTRY_OPTIONS],
    target: TARGET_OPTIONS[target as keyof typeof TARGET_OPTIONS],
    country: country as string,
  })
}

async function main() {
  try {
    await interactiveMode()
    p.outro("✅ 테스트 완료!")
  } catch (error) {
    p.cancel(`❌ 테스트 실패: ${error}`)
    console.error(error)
    process.exit(1)
  }
}

// Run
main()
