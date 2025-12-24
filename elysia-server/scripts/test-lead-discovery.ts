#!/usr/bin/env bun
/**
 * CLI Script for Testing Lead Discovery (Buyer List Search)
 *
 * This script simulates the actual onboarding lead discovery process.
 * It uses the same fields and values as the real onboarding flow.
 *
 * Usage:
 *   bun run test:lead-discovery
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as p from "@clack/prompts"
import { config } from "../src/config"
import { searchBigQuery } from "../src/services/bigquery-search.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "../src/services/lead-discovery/nodes/bigquery-executor"
import { enrichLead } from "../src/services/lead-enrichment.service"
import { COUNTRY_NAMES, INDUSTRY_NAMES } from "../src/services/onboarding.service"
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

/**
 * Get target customer industries using B2B agent
 * Same logic as onboarding.service.ts:getB2BCustomerIndustries
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

    log(`   AI 응답 받음 (${result.text?.length || 0} chars)`, colors.dim)

    if (result.text) {
      try {
        const parsed = JSON.parse(result.text)
        if (parsed.target_industries && Array.isArray(parsed.target_industries)) {
          const industries = parsed.target_industries.slice(0, 3)
          log(`✅ 타겟 산업 분석 완료: ${industries.join(", ")}`, colors.green)
          return industries
        }
        log(`⚠️  AI 응답에 target_industries 없음, 원본 산업 사용`, colors.yellow)
      } catch (_e) {
        log(`⚠️  JSON 파싱 실패, 원본 산업 사용: ${industryName}`, colors.yellow)
        log(`   응답 내용: ${result.text?.substring(0, 100)}...`, colors.dim)
      }
    } else {
      log(`⚠️  AI 응답이 비어있음, 원본 산업 사용`, colors.yellow)
    }

    log(`   폴백: 원본 산업만 사용 - [${industryName}]`, colors.dim)
    return [industryName]
  } catch (error) {
    log(`❌ 타겟 산업 분석 실패: ${error}`, colors.red)
    log(`   폴백: 원본 산업만 사용 - [${industryName}]`, colors.dim)
    return [industryName]
  }
}

/**
 * Discover leads for onboarding (same logic as onboarding.service.ts)
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
  const MAX_ITERATIONS = 5 // Same as onboarding
  const BATCH_SIZE = 200

  // Map codes to actual Apollo BigQuery values (same as onboarding)
  const countryName = COUNTRY_NAMES[options.country] || options.country
  const industryName = INDUSTRY_NAMES[options.industry] || options.industry

  log(`\n📍 검색 조건:`, colors.cyan)
  log(`   산업: ${options.industry} → "${industryName}"`, colors.dim)
  log(`   타겟: ${options.target}`, colors.dim)
  log(`   국가: ${options.country} → "${countryName}"`, colors.dim)

  // Get target customer industries from B2B agent
  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)

  log(`\n🎯 검색할 산업:`, colors.bright + colors.cyan)
  for (const industry of targetIndustries) {
    log(`   - ${industry}`, colors.cyan)
  }

  const s = p.spinner()
  s.start(`${TARGET_LEADS}개의 검증된 바이어 리스트 검색 중...`)

  // In-memory state tracking
  const uniqueLeadsByWebsite = new Map<string, LeadData>()
  const stats = {
    totalFound: 0,
    totalEnriched: 0,
    totalWithEmail: 0,
    duplicatesSkipped: 0,
    iterations: 0,
  }

  try {
    // Step 1: Search BigQuery for each target industry
    s.message("Step 1/3: BigQuery에서 리드 검색 중...")

    for (let i = 0; i < targetIndustries.length; i++) {
      const targetIndustry = targetIndustries[i]
      if (!targetIndustry) continue

      const query = `${targetIndustry} companies in ${countryName}`
      s.message(`Step 1/3: "${targetIndustry}" 검색 중... (${i + 1}/${targetIndustries.length})`)

      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
        limitOverride: BATCH_SIZE,
      })

      if (!result.results.length) {
        s.message(
          `Step 1/3: "${targetIndustry}"에서 0개 발견 (${i + 1}/${targetIndustries.length})`,
        )
        continue
      }

      // Add leads to unique leads map
      let addedFromThisIndustry = 0
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
        addedFromThisIndustry++
      }

      s.message(
        `Step 1/3: "${targetIndustry}"에서 ${addedFromThisIndustry}개 발견 (${i + 1}/${targetIndustries.length})`,
      )
    }

    s.message(
      `Step 1/3 완료: 총 ${stats.totalFound}개 리드 발견 (${stats.duplicatesSkipped}개 중복 제외)`,
    )

    // Step 2: Enrich leads in iterations (same as onboarding)
    s.message("Step 2/3: 리드 정보 보강 중 (회사 정보 + 이메일 수집)...")

    // Get API keys from config (same as onboarding)
    const hunterApiKey = config.hunter.apiKey
    const geminiApiKey = config.gemini.apiKey

    let iteration = 0
    while (iteration < MAX_ITERATIONS) {
      iteration++
      stats.iterations = iteration

      // Count current enriched leads with emails
      const enrichedWithEmails = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => lead.enriched?.primaryEmail,
      )

      s.message(
        `Step 2/3 (반복 ${iteration}/${MAX_ITERATIONS}): ${enrichedWithEmails.length}/${TARGET_LEADS}개 이메일 확보`,
      )

      // BASE CASE: We have enough enriched leads with email
      if (enrichedWithEmails.length >= TARGET_LEADS) {
        break
      }

      // Enrich un-enriched leads
      const unenrichedLeads = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => !lead.enriched,
      )

      if (unenrichedLeads.length === 0) {
        break
      }

      // Process in batches to avoid overwhelming the APIs
      const BATCH_SIZE_ENRICH = 20
      const leadsThisBatch = unenrichedLeads.slice(0, BATCH_SIZE_ENRICH)

      for (const lead of leadsThisBatch) {
        try {
          const enrichment = await enrichLead(lead.website, lead.company, {
            hunterApiKey,
            geminiApiKey,
            skipHunter: false,
          })

          // Get primary email (highest confidence)
          const primaryEmail = enrichment.emails?.[0]?.value

          // Filter out invalid emails (same as onboarding)
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

          if (isValidEmail) {
            stats.totalWithEmail++
          }

          // Update map
          uniqueLeadsByWebsite.set(lead.website, lead)
        } catch (_error) {
          // Mark as enriched (failed) to avoid retry
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

      // Stop if we have enough leads with emails
      const currentWithEmail = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => lead.enriched?.primaryEmail,
      ).length

      if (currentWithEmail >= TARGET_LEADS) {
        break
      }
    }

    s.message(
      `Step 2/3 완료: ${stats.totalEnriched}개 보강 완료 (${stats.totalWithEmail}개 이메일 확보, ${stats.iterations}회 반복)`,
    )

    // Step 3: Filter leads with emails
    s.message("Step 3/3: 이메일 보유 리드 필터링...")

    const leadsWithEmail = Array.from(uniqueLeadsByWebsite.values())
      .filter((lead) => lead.enriched?.primaryEmail)
      .slice(0, TARGET_LEADS)

    s.stop(`✅ ${leadsWithEmail.length}개의 검증된 바이어 리스트 발견 완료`)

    return {
      leads: leadsWithEmail,
      stats,
    }
  } catch (error) {
    s.stop(`❌ 리드 검색 실패: ${error}`)
    throw error
  }
}

/**
 * Display discovered leads
 */
function displayLeads(
  leads: LeadData[],
  stats: {
    totalFound: number
    totalEnriched: number
    totalWithEmail: number
    duplicatesSkipped: number
    iterations: number
  },
) {
  console.log("\n")
  logSection("발견된 바이어 리스트")

  // Display stats
  log(`\n📊 검색 통계:`, colors.bright + colors.cyan)
  log(`   총 발견: ${stats.totalFound}개`, colors.dim)
  log(`   정보 보강 시도: ${stats.totalEnriched}개`, colors.dim)
  log(`   이메일 확보: ${stats.totalWithEmail}개`, colors.green)
  log(`   중복 제외: ${stats.duplicatesSkipped}개`, colors.dim)
  log(`   반복 횟수: ${stats.iterations}회`, colors.dim)

  // Display sample leads
  console.log("\n")
  log(`📋 샘플 바이어 리스트 (처음 10개):`, colors.bright + colors.cyan)
  log("─".repeat(70), colors.dim)

  const samplesToShow = leads.slice(0, 10)
  for (let i = 0; i < samplesToShow.length; i++) {
    const lead = samplesToShow[i]
    if (!lead) continue

    const enriched = lead.enriched

    console.log(`\n${i + 1}. ${enriched?.companyName || lead.company}`)
    log(`   🌐 Website: ${enriched?.websiteUrl || lead.website}`, colors.dim)
    log(`   🏢 Industry: ${enriched?.businessType || lead.industry}`, colors.dim)
    log(`   🌍 Country: ${enriched?.country || lead.country}`, colors.dim)
    log(`   👥 Employees: ${enriched?.employeeCount || lead.employees}`, colors.dim)

    if (enriched?.primaryEmail) {
      log(`   📧 Email: ${enriched.primaryEmail}`, colors.green)
    }

    if (enriched?.description) {
      const shortDesc = enriched.description.substring(0, 100)
      log(`   📝 ${shortDesc}${enriched.description.length > 100 ? "..." : ""}`, colors.dim)
    }
  }

  if (leads.length > 10) {
    log(`\n... 외 ${leads.length - 10}개 더`, colors.dim)
  }

  log(`\n${"─".repeat(70)}`, colors.dim)

  // Summary
  console.log("\n")
  logSection("요약")
  log(`✅ 총 ${leads.length}개의 검증된 바이어를 발견했습니다.`, colors.green)
  log(`   - 이메일 주소 확보: ${stats.totalWithEmail}개`, colors.dim)
  log(`   - 즉시 영업 가능한 리드: ${leads.length}개`, colors.dim)
}

async function interactiveMode() {
  console.clear()

  p.intro("🔍 바이어 리스트 검색 테스트 (Lead Discovery)")

  // Survey Data (same as onboarding)
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

  // Discover leads with validated inputs
  const testInput = {
    industry: industry as string,
    target: target as string,
    country: country as string,
  }

  const { leads, stats } = await discoverLeads(testInput)

  // Display results
  displayLeads(leads, stats)

  // Ask to save results
  const shouldSave = await p.confirm({
    message: "결과를 파일로 저장하시겠습니까?",
    initialValue: true,
  })

  if (p.isCancel(shouldSave)) {
    return
  }

  if (shouldSave) {
    saveResults(testInput, leads, stats)
  }
}

/**
 * Save test results to file
 */
function saveResults(
  input: {
    industry: string
    target: string
    country: string
  },
  leads: LeadData[],
  stats: {
    totalFound: number
    totalEnriched: number
    totalWithEmail: number
    duplicatesSkipped: number
    iterations: number
  },
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
  const outputDir = join(process.cwd(), "test-results", "lead-discovery")

  // Create output directory if not exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Save as JSON
  const jsonFile = join(outputDir, `lead-test-${timestamp}.json`)
  const jsonData = {
    timestamp: new Date().toISOString(),
    input: {
      industry: input.industry,
      target: input.target,
      country: input.country,
      industryName: INDUSTRY_NAMES[input.industry] || input.industry,
      countryName: COUNTRY_NAMES[input.country] || input.country,
    },
    stats,
    leads: leads.map((lead) => ({
      company: lead.enriched?.companyName || lead.company,
      website: lead.enriched?.websiteUrl || lead.website,
      industry: lead.enriched?.businessType || lead.industry,
      country: lead.enriched?.country || lead.country,
      employees: lead.enriched?.employeeCount || lead.employees,
      email: lead.enriched?.primaryEmail,
      description: lead.enriched?.description,
    })),
  }
  writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), "utf-8")

  // Save as Markdown
  const mdFile = join(outputDir, `lead-test-${timestamp}.md`)
  let mdContent = `# 바이어 리스트 검색 테스트 결과\n\n`
  mdContent += `**생성 시간**: ${new Date().toLocaleString("ko-KR")}\n\n`

  mdContent += `## 검색 조건\n\n`
  mdContent += `- **산업**: ${input.industry} → "${INDUSTRY_NAMES[input.industry] || input.industry}"\n`
  mdContent += `- **타겟**: ${input.target}\n`
  mdContent += `- **국가**: ${input.country} → "${COUNTRY_NAMES[input.country] || input.country}"\n\n`

  mdContent += `## 검색 통계\n\n`
  mdContent += `- 총 발견: ${stats.totalFound}개\n`
  mdContent += `- 정보 보강 시도: ${stats.totalEnriched}개\n`
  mdContent += `- 이메일 확보: ${stats.totalWithEmail}개\n`
  mdContent += `- 중복 제외: ${stats.duplicatesSkipped}개\n`
  mdContent += `- 반복 횟수: ${stats.iterations}회\n\n`

  mdContent += `## 발견된 바이어 (${leads.length}개)\n\n`

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    if (!lead) continue

    const enriched = lead.enriched
    mdContent += `### ${i + 1}. ${enriched?.companyName || lead.company}\n\n`
    mdContent += `- **Website**: ${enriched?.websiteUrl || lead.website}\n`
    mdContent += `- **Industry**: ${enriched?.businessType || lead.industry}\n`
    mdContent += `- **Country**: ${enriched?.country || lead.country}\n`
    mdContent += `- **Employees**: ${enriched?.employeeCount || lead.employees}\n`

    if (enriched?.primaryEmail) {
      mdContent += `- **Email**: ${enriched.primaryEmail}\n`
    }

    if (enriched?.description) {
      mdContent += `- **Description**: ${enriched.description}\n`
    }

    mdContent += `\n`
  }

  writeFileSync(mdFile, mdContent, "utf-8")

  log(`\n✅ 결과 저장 완료:`, colors.green)
  log(`   JSON: ${jsonFile}`, colors.dim)
  log(`   Markdown: ${mdFile}`, colors.dim)
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
