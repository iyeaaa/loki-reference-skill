/**
 * Phase 3: Email Enrichment with Hunter.io
 * 기존 searchDomainWithSmartSelection 활용
 */

import pLimit from "p-limit"
import logger from "../../../utils/logger"
import { searchDomainWithSmartSelection } from "../../hunterio-domain-search.service"
import type { EmailInfo, EnrichedCompany, RawContact, UniqueCompany } from "../types"

/**
 * 이메일이 일반 이메일인지 확인
 */
function isGenericEmail(email: string): boolean {
  const genericPrefixes = [
    "info",
    "contact",
    "sales",
    "hello",
    "support",
    "admin",
    "inquiry",
    "office",
    "general",
  ]
  const prefix = email.split("@")[0]?.toLowerCase()
  return prefix ? genericPrefixes.includes(prefix) : false
}

/**
 * 의사결정자 직책인지 확인
 */
function isDecisionMaker(title?: string): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  const keywords = [
    "buyer",
    "purchasing",
    "procurement",
    "sourcing",
    "import",
    "md",
    "director",
    "manager",
    "head",
    "ceo",
    "coo",
    "founder",
    "owner",
    "president",
    "vp",
    "chief",
    "lead",
  ]
  return keywords.some((k) => lower.includes(k))
}

/**
 * 여러 이메일 중 최적 선택
 */
function selectBestEmail(emails: EmailInfo[]): EmailInfo | null {
  if (emails.length === 0) return null

  return (
    emails.sort((a, b) => {
      // 1. 검증된 이메일 우선
      if (a.verified !== b.verified) return b.verified ? 1 : -1

      // 2. 개인 이메일 > 일반 이메일
      const aGeneric = isGenericEmail(a.email)
      const bGeneric = isGenericEmail(b.email)
      if (aGeneric !== bGeneric) return aGeneric ? 1 : -1

      // 3. 의사결정자 직책 우선
      const aDecision = isDecisionMaker(a.title)
      const bDecision = isDecisionMaker(b.title)
      if (aDecision !== bDecision) return bDecision ? 1 : -1

      // 4. 신뢰도 점수
      return b.confidence - a.confidence
    })[0] || null
  )
}

/**
 * 배치 처리로 이메일 Enrichment
 */
export async function enrichWithEmails(companies: UniqueCompany[]): Promise<EnrichedCompany[]> {
  const startTime = Date.now()
  logger.info(`[Enrichment] 이메일 수집 시작: ${companies.length}개 회사`)

  const enrichedResults: EnrichedCompany[] = []

  // 통계
  let alreadyHadEmail = 0
  let foundNewEmail = 0
  let noEmailFound = 0

  // 병렬 처리 (동시 5개로 제한)
  const limit = pLimit(5)

  const tasks = companies.map((company) =>
    limit(async () => {
      try {
        // 1. 이미 연락처가 있는 경우
        const existingEmails = company.contacts
          .filter((c): c is RawContact & { email: string } =>
            Boolean(c.email && c.email.length > 0),
          )
          .map(
            (c): EmailInfo => ({
              email: c.email,
              source: "apollo", // contacts는 주로 Apollo에서
              verified: true,
              confidence: 90,
              contactName: c.name,
              title: c.title,
            }),
          )

        if (existingEmails.length > 0) {
          const bestEmail = selectBestEmail(existingEmails)
          if (bestEmail) {
            alreadyHadEmail++
            return {
              ...company,
              primaryEmail: bestEmail,
            } as EnrichedCompany
          }
        }

        // 2. 도메인이 있으면 Hunter.io로 검색
        if (company.domain) {
          const hunterResult = await searchDomainWithSmartSelection(company.domain)

          if (hunterResult.email) {
            foundNewEmail++
            return {
              ...company,
              primaryEmail: {
                email: hunterResult.email,
                source: "hunter" as const,
                verified: true,
                confidence: 80,
                contactName: undefined,
                title: undefined,
              },
            } as EnrichedCompany
          } else {
            // 이메일 없음
            noEmailFound++
            return null
          }
        } else {
          // 도메인 없음
          noEmailFound++
          return null
        }
      } catch (error) {
        logger.error({ error, company: company.companyName }, "[Enrichment] 처리 중 오류")
        noEmailFound++
        return null
      }
    }),
  )

  const results = await Promise.all(tasks)

  // null이 아닌 결과만 수집
  for (const result of results) {
    if (result) {
      enrichedResults.push(result)
    }
  }

  const duration = Date.now() - startTime

  logger.info(`[Enrichment] 이메일 수집 완료 (${duration}ms):`)
  logger.info(`  - 입력: ${companies.length}개`)
  logger.info(`  - 기존 이메일 사용: ${alreadyHadEmail}개`)
  logger.info(`  - 새로 발견: ${foundNewEmail}개`)
  logger.info(`  - 이메일 없음: ${noEmailFound}개`)
  logger.info(`  - 최종 (이메일 있음): ${enrichedResults.length}개`)

  return enrichedResults
}
