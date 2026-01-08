/**
 * Phase 2E: Deduplication and Normalization
 * 도메인 기준 중복 제거 및 데이터 병합
 */

import logger from "../../../utils/logger"
import type { RawCompany, UniqueCompany } from "../types"
import { extractDomain, guessCompanyNameFromDomain, normalizeDomain } from "../utils/domain"

/**
 * 회사명 유사도 계산 (간단 버전)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim()
  const n2 = name2.toLowerCase().trim()

  if (n1 === n2) return 1.0

  // Levenshtein distance 대신 간단한 포함 관계 체크
  if (n1.includes(n2) || n2.includes(n1)) {
    return 0.8
  }

  // 단어 기반 비교
  const words1 = new Set(n1.split(/\s+/))
  const words2 = new Set(n2.split(/\s+/))

  const intersection = new Set([...words1].filter((w) => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * 가장 완전한 값 선택 (길이 기준)
 */
function pickMostComplete(companies: RawCompany[], field: keyof RawCompany): string | null {
  const values = companies
    .map((c) => c[field])
    .filter((v): v is string => typeof v === "string" && v.length > 0)

  if (values.length === 0) return null

  // 가장 긴 값 선택
  return values.reduce((longest, current) => (current.length > longest.length ? current : longest))
}

/**
 * 가장 긴 값 선택
 */
function pickLongest(companies: RawCompany[], field: keyof RawCompany): string | null {
  return pickMostComplete(companies, field)
}

/**
 * 가장 빈도가 높은 값 선택
 */
function pickMostFrequent(companies: RawCompany[], field: keyof RawCompany): string {
  const values = companies
    .map((c) => c[field])
    .filter((v): v is string => typeof v === "string" && v.length > 0)

  if (values.length === 0) return ""

  // 빈도 계산
  const freq = new Map<string, number>()
  for (const val of values) {
    freq.set(val, (freq.get(val) || 0) + 1)
  }

  // 가장 빈도가 높은 값
  let maxCount = 0
  let mostFrequent = values[0] || ""

  for (const [val, count] of freq.entries()) {
    if (count > maxCount) {
      maxCount = count
      mostFrequent = val
    }
  }

  return mostFrequent
}

/**
 * 회사 규모 병합 (가장 빈도가 높은 값)
 */
function pickMostFrequentSize(companies: RawCompany[]): UniqueCompany["size"] {
  const values = companies.map((c) => c.size).filter((v): v is NonNullable<typeof v> => v != null)

  if (values.length === 0) return null

  // 빈도 계산
  const freq = new Map<string, number>()
  for (const val of values) {
    freq.set(val, (freq.get(val) || 0) + 1)
  }

  // 가장 빈도가 높은 값
  let maxCount = 0
  let mostFrequent: UniqueCompany["size"] = null

  for (const [val, count] of freq.entries()) {
    if (count > maxCount) {
      maxCount = count
      mostFrequent = val as UniqueCompany["size"]
    }
  }

  return mostFrequent
}

/**
 * 연락처 병합 (중복 제거)
 */
function mergeContacts(companies: RawCompany[]) {
  const allContacts = companies.flatMap((c) => c.contacts || [])

  const uniqueEmails = new Map<string, (typeof allContacts)[number]>()

  for (const contact of allContacts) {
    if (contact.email) {
      const emailKey = contact.email.toLowerCase()
      if (!uniqueEmails.has(emailKey)) {
        uniqueEmails.set(emailKey, contact)
      }
    }
  }

  return Array.from(uniqueEmails.values())
}

/**
 * 도메인 기준으로 회사 데이터 병합
 */
function mergeCompanyData(domain: string, sources: RawCompany[]): UniqueCompany {
  // 회사명: 가장 완전한 것 선택
  const companyName = pickMostComplete(sources, "companyName") || guessCompanyNameFromDomain(domain)

  // industry: 가장 긴 것
  const industry = pickLongest(sources, "industry")

  // country: 가장 빈도가 높은 것
  const country = pickMostFrequent(sources, "country")

  // description: 가장 긴 것
  const description = pickLongest(sources, "description")

  // size: 가장 빈도가 높은 것
  const size = pickMostFrequentSize(sources)

  // 연락처 병합
  const contacts = mergeContacts(sources)

  // 소스 목록
  const sourcesSet = new Set(sources.map((s) => s.source))

  return {
    id: domain,
    companyName,
    domain,
    website: `https://${domain}`,
    industry,
    country,
    description,
    size,
    contacts,
    sources: Array.from(sourcesSet),
  }
}

/**
 * 도메인 없는 회사들 회사명 기반 중복 제거
 */
function deduplicateByName(companies: RawCompany[]): UniqueCompany[] {
  const result: UniqueCompany[] = []
  const seenNames = new Set<string>()

  for (const company of companies) {
    const nameKey = company.companyName.toLowerCase().trim()

    // 이미 유사한 이름이 있는지 체크
    let isDuplicate = false
    for (const seenName of seenNames) {
      const similarity = calculateNameSimilarity(nameKey, seenName)
      if (similarity > 0.8) {
        isDuplicate = true
        break
      }
    }

    if (isDuplicate) continue
    seenNames.add(nameKey)

    // UniqueCompany로 변환 (ID는 회사명 기반)
    const id = `name:${nameKey.replace(/\s+/g, "-")}`

    result.push({
      id,
      companyName: company.companyName,
      domain: null,
      website: null,
      industry: company.industry || null,
      country: company.country || "",
      description: company.description || null,
      size: company.size || null,
      contacts: company.contacts || [],
      sources: [company.source],
    })
  }

  return result
}

/**
 * 중복 제거 및 정규화
 */
export function deduplicateAndNormalize(rawPool: RawCompany[]): UniqueCompany[] {
  const startTime = Date.now()

  logger.info(`[Dedup] 중복 제거 시작: ${rawPool.length}개 원시 데이터`)

  const domainMap = new Map<string, RawCompany[]>()
  const noDomainList: RawCompany[] = []

  // 1. 도메인별로 그룹화
  for (const company of rawPool) {
    const domainStr = extractDomain(company.website || company.domain)

    if (domainStr) {
      const normalized = normalizeDomain(domainStr)
      const existing = domainMap.get(normalized) || []
      domainMap.set(normalized, [...existing, company])
    } else {
      noDomainList.push(company)
    }
  }

  // 2. 도메인 기준 병합
  const merged = Array.from(domainMap.entries()).map(([domain, companies]) =>
    mergeCompanyData(domain, companies),
  )

  // 3. 도메인 없는 것들은 회사명 유사도로 중복 제거
  const noDomainMerged = deduplicateByName(noDomainList)

  const result = [...merged, ...noDomainMerged]

  const duration = Date.now() - startTime

  logger.info(`[Dedup] 중복 제거 완료 (${duration}ms):`)
  logger.info(`  - 입력: ${rawPool.length}개`)
  logger.info(`  - 도메인 있음: ${merged.length}개`)
  logger.info(`  - 도메인 없음: ${noDomainMerged.length}개`)
  logger.info(`  - 최종: ${result.length}개`)

  // 소스별 통계
  const sourceStats = new Map<string, number>()
  for (const company of result) {
    for (const source of company.sources) {
      sourceStats.set(source, (sourceStats.get(source) || 0) + 1)
    }
  }

  logger.info("  소스별 분포:")
  for (const [source, count] of sourceStats.entries()) {
    logger.info(`    - ${source}: ${count}개`)
  }

  return result
}
