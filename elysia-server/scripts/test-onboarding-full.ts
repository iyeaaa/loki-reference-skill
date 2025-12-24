#!/usr/bin/env bun
/**
 * CLI Script for Testing Full Onboarding Process
 *
 * This script combines both lead discovery and email generation tests.
 * It simulates the complete onboarding flow with a single set of inputs.
 *
 * Usage:
 *   bun run test:onboarding
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as p from "@clack/prompts"
import { config } from "../src/config"
import { getAITemplateGenerationService } from "../src/services/ai-template-generation.service"
import { searchBigQuery } from "../src/services/bigquery-search.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "../src/services/lead-discovery/nodes/bigquery-executor"
import { enrichLead } from "../src/services/lead-enrichment.service"
import {
  COUNTRY_NAMES,
  EMAIL_TYPES_3TOUCH,
  INDUSTRY_NAMES,
} from "../src/services/onboarding.service"
import {
  createB2BCustomerIndustryAgent,
  generateB2BCustomerIndustryPrompt,
} from "../src/shared/mastra"

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

// Onboarding field options
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

interface LeadData {
  company: string
  website: string
  industry: string
  employees: string
  country: string
  enriched?: {
    companyName: string
    websiteUrl: string
    businessType: string
    country: string
    employeeCount: string
    description?: string
    primaryEmail?: string
  }
}

interface EmailTemplate {
  stepOrder: number
  type: string
  delayDays: number
  template: {
    subject: string
    bodyText: string
    bodyHtml: string
  }
}

interface TestResults {
  leadDiscovery: {
    leads: LeadData[]
    stats: {
      totalFound: number
      totalEnriched: number
      totalWithEmail: number
      duplicatesSkipped: number
      iterations: number
    }
  }
  emailGeneration: {
    templates: EmailTemplate[]
  }
}

/**
 * Get target customer industries using B2B agent
 */
async function getB2BCustomerIndustries(
  industryName: string,
  countryName: string,
): Promise<string[]> {
  try {
    log("🤖 AI 에이전트로 타겟 고객 산업 분석 중...", colors.yellow)

    const agent = createB2BCustomerIndustryAgent()
    const prompt = generateB2BCustomerIndustryPrompt(industryName, countryName)

    const result = await agent.generate(prompt)

    if (result.text) {
      try {
        const parsed = JSON.parse(result.text)
        if (parsed.target_industries && Array.isArray(parsed.target_industries)) {
          const industries = parsed.target_industries.slice(0, 3)
          log(`✅ 타겟 산업 분석 완료: ${industries.join(", ")}`, colors.green)
          return industries
        }
      } catch (_e) {
        // Fallback to original
      }
    }

    log(`   폴백: 원본 산업만 사용 - [${industryName}]`, colors.dim)
    return [industryName]
  } catch (_error) {
    log(`❌ 타겟 산업 분석 실패, 폴백 사용`, colors.red)
    return [industryName]
  }
}

/**
 * Discover leads (same as test-lead-discovery.ts)
 */
async function discoverLeads(options: {
  industry: string
  target: string
  country: string
}): Promise<{
  leads: LeadData[]
  stats: {
    totalFound: number
    totalEnriched: number
    totalWithEmail: number
    duplicatesSkipped: number
    iterations: number
  }
}> {
  const TARGET_LEADS = 30
  const MAX_ITERATIONS = 5
  const BATCH_SIZE = 200

  const countryName = COUNTRY_NAMES[options.country] || options.country
  const industryName = INDUSTRY_NAMES[options.industry] || options.industry

  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)

  const s = p.spinner()
  s.start("1/2: 바이어 리스트 검색 중...")

  const uniqueLeadsByWebsite = new Map<string, LeadData>()
  const stats = {
    totalFound: 0,
    totalEnriched: 0,
    totalWithEmail: 0,
    duplicatesSkipped: 0,
    iterations: 0,
  }

  try {
    // Step 1: Search BigQuery
    for (let i = 0; i < targetIndustries.length; i++) {
      const targetIndustry = targetIndustries[i]
      if (!targetIndustry) continue

      const query = `${targetIndustry} companies in ${countryName}`

      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
        limitOverride: BATCH_SIZE,
      })

      if (!result.results.length) continue

      for (const row of result.results) {
        const website = row.website as string
        if (!website || uniqueLeadsByWebsite.has(website)) {
          stats.duplicatesSkipped++
          continue
        }

        uniqueLeadsByWebsite.set(website, {
          company: row.company as string,
          website,
          industry: row.industry as string,
          employees: row.employees?.toString() || "",
          country: row.country as string,
        })
        stats.totalFound++
      }
    }

    // Step 2: Enrich leads
    const hunterApiKey = config.hunter.apiKey
    const geminiApiKey = config.gemini.apiKey

    let iteration = 0
    while (iteration < MAX_ITERATIONS) {
      iteration++
      stats.iterations = iteration

      const enrichedWithEmails = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => lead.enriched?.primaryEmail,
      )

      if (enrichedWithEmails.length >= TARGET_LEADS) break

      const unenrichedLeads = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => !lead.enriched,
      )

      if (unenrichedLeads.length === 0) break

      const BATCH_SIZE_ENRICH = 20
      const leadsThisBatch = unenrichedLeads.slice(0, BATCH_SIZE_ENRICH)

      for (const lead of leadsThisBatch) {
        try {
          const enrichment = await enrichLead(lead.website, lead.company, {
            hunterApiKey,
            geminiApiKey,
            skipHunter: false,
          })

          const primaryEmail = enrichment.emails?.[0]?.value

          const isValidEmail =
            primaryEmail &&
            !primaryEmail.toLowerCase().includes("noreply") &&
            !primaryEmail.toLowerCase().startsWith("postmaster@") &&
            !primaryEmail.toLowerCase().startsWith("abuse@")

          lead.enriched = {
            companyName: lead.company || "Unknown Company",
            websiteUrl: lead.website,
            businessType: lead.industry,
            country: lead.country,
            employeeCount: lead.employees,
            description: enrichment.companyInfo?.description,
            primaryEmail: isValidEmail ? primaryEmail : undefined,
          }

          stats.totalEnriched++
          if (isValidEmail) stats.totalWithEmail++

          uniqueLeadsByWebsite.set(lead.website, lead)
        } catch (_error) {
          lead.enriched = {
            companyName: lead.company || "Unknown Company",
            websiteUrl: lead.website,
            businessType: lead.industry,
            country: lead.country,
            employeeCount: lead.employees,
          }
          uniqueLeadsByWebsite.set(lead.website, lead)
        }
      }

      const currentWithEmail = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => lead.enriched?.primaryEmail,
      ).length

      if (currentWithEmail >= TARGET_LEADS) break
    }

    const leadsWithEmail = Array.from(uniqueLeadsByWebsite.values())
      .filter((lead) => lead.enriched?.primaryEmail)
      .slice(0, TARGET_LEADS)

    s.stop(
      `✅ 1/2: 바이어 ${leadsWithEmail.length}개 발견 (총 ${stats.totalFound}개 중 이메일 ${stats.totalWithEmail}개)`,
    )

    return {
      leads: leadsWithEmail,
      stats,
    }
  } catch (error) {
    s.stop(`❌ 바이어 검색 실패: ${error}`)
    throw error
  }
}

/**
 * Generate email templates (same as test-email-generation.ts)
 */
async function generateEmails(options: {
  workspaceName: string
  workspaceDescription?: string
  industry: string
  target: string
  country: string
}): Promise<EmailTemplate[]> {
  const aiService = getAITemplateGenerationService()
  const countryFullName = COUNTRY_NAMES[options.country] || options.country
  const industryContext = `${options.industry} 산업의 ${options.target} 고객을 대상으로`

  const s = p.spinner()
  s.start("2/2: AI 이메일 생성 중...")

  const templates: EmailTemplate[] = []

  for (let i = 0; i < EMAIL_TYPES_3TOUCH.length; i++) {
    const emailType = EMAIL_TYPES_3TOUCH[i]
    if (!emailType) continue

    const prompt = emailType.promptKr

    try {
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
      s.stop(`❌ Step ${i + 1} 생성 실패`)
      throw error
    }
  }

  s.stop(`✅ 2/2: 이메일 ${templates.length}개 생성 완료`)

  return templates
}

/**
 * Display results summary
 */
function displayResults(
  _input: {
    workspaceName: string
    workspaceDescription?: string
    industry: string
    target: string
    country: string
  },
  results: TestResults,
) {
  console.log("\n")
  logSection("온보딩 테스트 완료 - 결과 요약")

  // Lead Discovery Summary
  log(`\n📊 바이어 검색 결과:`, colors.bright + colors.cyan)
  log(`   총 발견: ${results.leadDiscovery.stats.totalFound}개`, colors.dim)
  log(`   이메일 확보: ${results.leadDiscovery.stats.totalWithEmail}개`, colors.green)
  log(`   최종 선정: ${results.leadDiscovery.leads.length}개`, colors.green)

  // Email Generation Summary
  log(`\n📧 이메일 생성 결과:`, colors.bright + colors.cyan)
  log(`   생성된 이메일: ${results.emailGeneration.templates.length}개`, colors.green)
  for (const t of results.emailGeneration.templates) {
    log(`   Step ${t.stepOrder} (${t.type}): ${t.template.subject}`, colors.dim)
  }

  // Sample leads
  log(`\n👥 샘플 바이어 (처음 5개):`, colors.bright + colors.cyan)
  const samples = results.leadDiscovery.leads.slice(0, 5)
  for (let i = 0; i < samples.length; i++) {
    const lead = samples[i]
    if (!lead) continue
    const enriched = lead.enriched
    log(
      `   ${i + 1}. ${enriched?.companyName || lead.company} - ${enriched?.primaryEmail}`,
      colors.dim,
    )
  }
}

/**
 * Save test results to separate directories (same as individual test scripts)
 */
function saveResults(
  input: {
    workspaceName: string
    workspaceDescription?: string
    industry: string
    target: string
    country: string
  },
  results: TestResults,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)

  // Save Lead Discovery Results
  const leadOutputDir = join(process.cwd(), "test-results", "lead-discovery")
  if (!existsSync(leadOutputDir)) {
    mkdirSync(leadOutputDir, { recursive: true })
  }

  const leadJsonFile = join(leadOutputDir, `lead-test-${timestamp}.json`)
  const leadJsonData = {
    timestamp: new Date().toISOString(),
    input: {
      industry: input.industry,
      target: input.target,
      country: input.country,
      industryName: INDUSTRY_NAMES[input.industry] || input.industry,
      countryName: COUNTRY_NAMES[input.country] || input.country,
    },
    stats: results.leadDiscovery.stats,
    leads: results.leadDiscovery.leads.map((lead) => ({
      company: lead.enriched?.companyName || lead.company,
      website: lead.enriched?.websiteUrl || lead.website,
      industry: lead.enriched?.businessType || lead.industry,
      country: lead.enriched?.country || lead.country,
      employees: lead.enriched?.employeeCount || lead.employees,
      email: lead.enriched?.primaryEmail,
      description: lead.enriched?.description,
    })),
  }
  writeFileSync(leadJsonFile, JSON.stringify(leadJsonData, null, 2), "utf-8")

  const leadMdFile = join(leadOutputDir, `lead-test-${timestamp}.md`)
  let leadMdContent = `# 바이어 리스트 검색 테스트 결과\n\n`
  leadMdContent += `**생성 시간**: ${new Date().toLocaleString("ko-KR")}\n\n`

  leadMdContent += `## 검색 조건\n\n`
  leadMdContent += `- **산업**: ${input.industry} → "${INDUSTRY_NAMES[input.industry] || input.industry}"\n`
  leadMdContent += `- **타겟**: ${input.target}\n`
  leadMdContent += `- **국가**: ${input.country} → "${COUNTRY_NAMES[input.country] || input.country}"\n\n`

  leadMdContent += `## 검색 통계\n\n`
  leadMdContent += `- 총 발견: ${results.leadDiscovery.stats.totalFound}개\n`
  leadMdContent += `- 정보 보강 시도: ${results.leadDiscovery.stats.totalEnriched}개\n`
  leadMdContent += `- 이메일 확보: ${results.leadDiscovery.stats.totalWithEmail}개\n`
  leadMdContent += `- 중복 제외: ${results.leadDiscovery.stats.duplicatesSkipped}개\n`
  leadMdContent += `- 반복 횟수: ${results.leadDiscovery.stats.iterations}회\n\n`

  leadMdContent += `## 발견된 바이어 (${results.leadDiscovery.leads.length}개)\n\n`

  for (let i = 0; i < results.leadDiscovery.leads.length; i++) {
    const lead = results.leadDiscovery.leads[i]
    if (!lead) continue

    const enriched = lead.enriched
    leadMdContent += `### ${i + 1}. ${enriched?.companyName || lead.company}\n\n`
    leadMdContent += `- **Website**: ${enriched?.websiteUrl || lead.website}\n`
    leadMdContent += `- **Industry**: ${enriched?.businessType || lead.industry}\n`
    leadMdContent += `- **Country**: ${enriched?.country || lead.country}\n`
    leadMdContent += `- **Employees**: ${enriched?.employeeCount || lead.employees}\n`

    if (enriched?.primaryEmail) {
      leadMdContent += `- **Email**: ${enriched.primaryEmail}\n`
    }

    if (enriched?.description) {
      leadMdContent += `- **Description**: ${enriched.description}\n`
    }

    leadMdContent += `\n`
  }

  writeFileSync(leadMdFile, leadMdContent, "utf-8")

  // Save Email Generation Results
  const emailOutputDir = join(process.cwd(), "test-results", "email-generation")
  if (!existsSync(emailOutputDir)) {
    mkdirSync(emailOutputDir, { recursive: true })
  }

  const emailJsonFile = join(emailOutputDir, `email-test-${timestamp}.json`)
  const emailJsonData = {
    timestamp: new Date().toISOString(),
    input,
    results: results.emailGeneration.templates.map((t) => ({
      step: t.stepOrder,
      type: t.type,
      delayDays: t.delayDays,
      subject: t.template.subject,
      bodyText: t.template.bodyText,
      bodyHtml: t.template.bodyHtml,
    })),
  }
  writeFileSync(emailJsonFile, JSON.stringify(emailJsonData, null, 2), "utf-8")

  const emailMdFile = join(emailOutputDir, `email-test-${timestamp}.md`)
  let emailMdContent = `# AI 이메일 생성 테스트 결과\n\n`
  emailMdContent += `**생성 시간**: ${new Date().toLocaleString("ko-KR")}\n\n`
  emailMdContent += `## 입력 정보\n\n`
  emailMdContent += `- **회사명**: ${input.workspaceName}\n`
  if (input.workspaceDescription) {
    emailMdContent += `- **회사 설명**: ${input.workspaceDescription}\n`
  }
  emailMdContent += `- **산업**: ${input.industry}\n`
  emailMdContent += `- **타겟**: ${input.target}\n`
  emailMdContent += `- **국가**: ${input.country}\n\n`

  emailMdContent += `## 생성된 이메일 (${results.emailGeneration.templates.length}개)\n\n`

  for (const t of results.emailGeneration.templates) {
    emailMdContent += `### Step ${t.stepOrder}: ${t.type} (+${t.delayDays}일)\n\n`
    emailMdContent += `**제목**: ${t.template.subject}\n\n`
    emailMdContent += `**본문**:\n\`\`\`\n${t.template.bodyText}\n\`\`\`\n\n`
  }

  writeFileSync(emailMdFile, emailMdContent, "utf-8")

  log(`\n✅ 결과 저장 완료:`, colors.green)
  log(`\n📧 이메일 생성 결과:`, colors.cyan)
  log(`   JSON: ${emailJsonFile}`, colors.dim)
  log(`   Markdown: ${emailMdFile}`, colors.dim)
  log(`\n👥 바이어 검색 결과:`, colors.cyan)
  log(`   JSON: ${leadJsonFile}`, colors.dim)
  log(`   Markdown: ${leadMdFile}`, colors.dim)
}

/**
 * Main interactive mode
 */
async function interactiveMode() {
  console.clear()

  p.intro("🚀 온보딩 전체 테스트 (바이어 검색 + 이메일 생성)")

  // Company Info
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

  // Survey Data
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

  const testInput = {
    workspaceName: workspaceName as string,
    workspaceDescription: workspaceDescription ? (workspaceDescription as string) : undefined,
    industry: industry as string,
    target: target as string,
    country: country as string,
  }

  // Run tests
  console.log("\n")
  const leadDiscoveryResult = await discoverLeads({
    industry: testInput.industry,
    target: testInput.target,
    country: testInput.country,
  })

  const emailTemplates = await generateEmails({
    workspaceName: testInput.workspaceName,
    workspaceDescription: testInput.workspaceDescription,
    industry: INDUSTRY_OPTIONS[testInput.industry as keyof typeof INDUSTRY_OPTIONS],
    target: TARGET_OPTIONS[testInput.target as keyof typeof TARGET_OPTIONS],
    country: testInput.country,
  })

  const results: TestResults = {
    leadDiscovery: leadDiscoveryResult,
    emailGeneration: {
      templates: emailTemplates,
    },
  }

  // Display results
  displayResults(testInput, results)

  // Ask to save
  const shouldSave = await p.confirm({
    message: "결과를 파일로 저장하시겠습니까?",
    initialValue: true,
  })

  if (p.isCancel(shouldSave)) {
    return
  }

  if (shouldSave) {
    saveResults(testInput, results)
  }
}

async function main() {
  try {
    await interactiveMode()
    p.outro("✅ 테스트 완료!")
    process.exit(0)
  } catch (error) {
    p.cancel(`❌ 테스트 실패: ${error}`)
    console.error(error)
    process.exit(1)
  }
}

// Run
main()
