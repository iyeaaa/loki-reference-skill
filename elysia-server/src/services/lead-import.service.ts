/**
 * Lead Import Service
 * Excel 파일에서 리드 데이터를 임포트하는 서비스
 */

import { and, eq, inArray } from "drizzle-orm"
import { db } from "../db"
import {
  customerGroupMembers,
  leadBusinessSectors,
  leadContacts,
  leadIndustryTypes,
  leadProductCategories,
  leadProducts,
  leadSocialMedia,
  leads,
} from "../db/schema"
import type { ParsedLeadData } from "../utils/excel-parser.util"
import { extractUsername } from "../utils/excel-parser.util"
import logger from "../utils/logger"

export interface ImportProgress {
  total: number
  processed: number
  success: number
  skipped: number
  failed: number
  currentRow: number
  currentCompanyName: string | null
  errors: Array<{
    row: number
    companyName: string | null
    websiteUrl: string | null
    error: string
  }>
}

export interface ImportResult {
  total: number
  success: number
  skipped: number
  failed: number
  details: {
    leadsCreated: number
    contactsCreated: number
    socialMediaCreated: number
    productsCreated: number
    sectorsCreated: number
    categoriesCreated: number
    industriesCreated: number
    groupMembersCreated: number
  }
  errors: Array<{
    row: number
    companyName: string | null
    websiteUrl: string | null
    error: string
  }>
  duration: number
}

/**
 * 중복 체크: workspace_id와 website_url 조합으로 확인
 */
export async function checkDuplicate(
  workspaceId: string,
  websiteUrl: string | null,
): Promise<boolean> {
  if (!websiteUrl) {
    return false // website_url이 없으면 중복 체크 불가
  }

  try {
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.websiteUrl, websiteUrl)))
      .limit(1)

    return existing.length > 0
  } catch (error) {
    logger.error({ error, websiteUrl }, "Failed to check duplicate")
    return false
  }
}

/**
 * 단일 리드 임포트 (트랜잭션)
 */
export async function importSingleLead(
  workspaceId: string,
  data: ParsedLeadData,
  createdBy: string | null = null,
  customerGroupId: string | null = null,
): Promise<{
  success: boolean
  leadId?: string
  stats: {
    contactsCreated: number
    socialMediaCreated: number
    productsCreated: number
    sectorsCreated: number
    categoriesCreated: number
    industriesCreated: number
    groupMembersCreated: number
  }
  error?: string
}> {
  const stats = {
    contactsCreated: 0,
    socialMediaCreated: 0,
    productsCreated: 0,
    sectorsCreated: 0,
    categoriesCreated: 0,
    industriesCreated: 0,
    groupMembersCreated: 0,
  }

  try {
    // 트랜잭션 시작
    const result = await db.transaction(async (tx) => {
      // 1. Lead 생성
      const [lead] = await tx
        .insert(leads)
        .values({
          workspaceId,
          companyName: data.companyName,
          foundCompanyName: data.foundCompanyName,
          websiteUrl: data.websiteUrl,
          finalUrl: data.finalUrl,
          httpStatus: data.httpStatus,
          nameUrlMatch: data.nameUrlMatch,
          businessType: data.businessType,
          isBusinessTypeMatched: data.isBusinessTypeMatched,
          description: data.description,
          address: data.address,
          country: data.country,
          city: data.city,
          state: data.state,
          foundedYear: data.foundedYear,
          employeeCount: data.employeeCount,
          leadSource: data.leadSource,
          crawlTimeSeconds: data.crawlTimeSeconds?.toString(),
          gptTimeSeconds: data.gptTimeSeconds?.toString(),
          collectedAt: data.collectedAt,
          errorMessage: data.errorMessage,
          createdBy: createdBy || undefined,
        })
        .returning({ id: leads.id })

      if (!lead) {
        throw new Error("Failed to create lead")
      }

      const leadId = lead.id

      // 2. Contacts 생성 (전화번호)
      if (data.phoneNumbers.length > 0) {
        const phoneContacts = data.phoneNumbers.map((phone, index) => ({
          leadId,
          contactType: "phone" as const,
          contactValue: phone,
          isPrimary: index === 0, // 첫 번째 전화번호는 primary
        }))

        await tx.insert(leadContacts).values(phoneContacts)
        stats.contactsCreated += phoneContacts.length
      }

      // 3. Contacts 생성 (이메일)
      if (data.emails.length > 0) {
        const emailContacts = data.emails.map((email, index) => ({
          leadId,
          contactType: "email" as const,
          contactValue: email,
          isPrimary: index === 0, // 첫 번째 이메일은 primary
        }))

        await tx.insert(leadContacts).values(emailContacts)
        stats.contactsCreated += emailContacts.length
      }

      // 4. Social Media 생성
      const socialMediaEntries = []

      if (data.facebookUrl) {
        socialMediaEntries.push({
          leadId,
          platform: "facebook" as const,
          url: data.facebookUrl,
          username: extractUsername(data.facebookUrl, "facebook"),
        })
      }

      if (data.instagramUrl) {
        socialMediaEntries.push({
          leadId,
          platform: "instagram" as const,
          url: data.instagramUrl,
          username: extractUsername(data.instagramUrl, "instagram"),
        })
      }

      if (data.twitterUrl) {
        socialMediaEntries.push({
          leadId,
          platform: "twitter" as const,
          url: data.twitterUrl,
          username: extractUsername(data.twitterUrl, "twitter"),
        })
      }

      if (data.linkedinUrl) {
        socialMediaEntries.push({
          leadId,
          platform: "linkedin" as const,
          url: data.linkedinUrl,
          username: extractUsername(data.linkedinUrl, "linkedin"),
        })
      }

      if (socialMediaEntries.length > 0) {
        await tx.insert(leadSocialMedia).values(socialMediaEntries)
        stats.socialMediaCreated = socialMediaEntries.length
      }

      // 5. Products 생성
      if (data.products.length > 0) {
        const productEntries = data.products.map((product) => ({
          leadId,
          productName: product,
        }))

        await tx.insert(leadProducts).values(productEntries)
        stats.productsCreated = productEntries.length
      }

      // 6. Business Sectors 생성
      if (data.businessSectors.length > 0) {
        const sectorEntries = data.businessSectors.map((sector) => ({
          leadId,
          sectorName: sector,
        }))

        await tx.insert(leadBusinessSectors).values(sectorEntries)
        stats.sectorsCreated = sectorEntries.length
      }

      // 7. Product Categories 생성
      if (data.productCategories.length > 0) {
        const categoryEntries = data.productCategories.map((category) => ({
          leadId,
          categoryName: category,
        }))

        await tx.insert(leadProductCategories).values(categoryEntries)
        stats.categoriesCreated = categoryEntries.length
      }

      // 8. Industry Types 생성
      if (data.industryTypes.length > 0) {
        const industryEntries = data.industryTypes.map((industry) => ({
          leadId,
          industryName: industry,
        }))

        await tx.insert(leadIndustryTypes).values(industryEntries)
        stats.industriesCreated = industryEntries.length
      }

      // 9. Customer Group Member 추가 (선택사항)
      if (customerGroupId) {
        await tx.insert(customerGroupMembers).values({
          groupId: customerGroupId,
          leadId,
          addedBy: createdBy || undefined,
        })
        stats.groupMembersCreated = 1
      }

      return { leadId }
    })

    return {
      success: true,
      leadId: result.leadId,
      stats,
    }
  } catch (error: unknown) {
    logger.error({ error, websiteUrl: data.websiteUrl }, "Failed to import lead")
    return {
      success: false,
      stats,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 문자열 필드를 최대 길이로 자르기
 */
function truncateString(value: string | null, maxLength: number): string | null {
  if (!value) return value
  if (value.length <= maxLength) return value
  return value.substring(0, maxLength)
}

/**
 * 배치 임포트용 중복 체크 (여러 URL을 청크로 나누어 조회)
 * PostgreSQL의 바인드 파라미터 제한을 고려하여 청크 단위로 처리
 */
async function checkDuplicateBatch(
  workspaceId: string,
  websiteUrls: string[],
): Promise<Set<string>> {
  if (websiteUrls.length === 0) {
    return new Set()
  }

  const CHUNK_SIZE = 1000 // PostgreSQL 바인드 파라미터 제한을 고려한 청크 크기
  const existingUrls = new Set<string>()

  try {
    // URL을 청크로 나누어 처리
    for (let i = 0; i < websiteUrls.length; i += CHUNK_SIZE) {
      const chunk = websiteUrls.slice(i, i + CHUNK_SIZE)

      const existing = await db
        .select({ websiteUrl: leads.websiteUrl })
        .from(leads)
        .where(and(eq(leads.workspaceId, workspaceId), inArray(leads.websiteUrl, chunk)))

      for (const row of existing) {
        if (row.websiteUrl) {
          existingUrls.add(row.websiteUrl)
        }
      }

      // 진행 상황 로깅 (대량 데이터의 경우)
      if (websiteUrls.length > CHUNK_SIZE) {
        logger.debug(
          {
            processed: Math.min(i + CHUNK_SIZE, websiteUrls.length),
            total: websiteUrls.length,
            found: existingUrls.size,
          },
          "Duplicate check progress",
        )
      }
    }

    return existingUrls
  } catch (error) {
    logger.error({ error }, "Failed to check duplicates in batch")
    return new Set()
  }
}

/**
 * 배치 임포트 (여러 리드를 순차적으로 처리)
 */
export async function importLeadsBatch(
  workspaceId: string,
  leadsData: ParsedLeadData[],
  createdBy: string | null = null,
  customerGroupId: string | null = null,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const startTime = Date.now()

  const progress: ImportProgress = {
    total: leadsData.length,
    processed: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    currentRow: 0,
    currentCompanyName: null,
    errors: [],
  }

  const details = {
    leadsCreated: 0,
    contactsCreated: 0,
    socialMediaCreated: 0,
    productsCreated: 0,
    sectorsCreated: 0,
    categoriesCreated: 0,
    industriesCreated: 0,
    groupMembersCreated: 0,
  }

  // 1. 중복 체크: DB에 이미 존재하는 website_url들을 미리 조회
  logger.info({ total: leadsData.length }, "Starting duplicate check")
  const websiteUrls = leadsData
    .map((lead) => lead.websiteUrl)
    .filter((url): url is string => url !== null && url !== "")
  const existingUrls = await checkDuplicateBatch(workspaceId, websiteUrls)
  logger.info(
    { existingCount: existingUrls.size, totalUrls: websiteUrls.length },
    "Duplicate check completed",
  )

  // 2. 중복되지 않은 데이터만 필터링
  const uniqueLeadsData = leadsData.filter((leadData) => {
    if (!leadData.websiteUrl) {
      return true // website_url이 없으면 일단 포함 (나중에 실패할 수 있음)
    }
    return !existingUrls.has(leadData.websiteUrl)
  })

  const skippedCount = leadsData.length - uniqueLeadsData.length
  logger.info(
    { skipped: skippedCount, toImport: uniqueLeadsData.length },
    "Filtered out duplicates",
  )

  // 진행상황 업데이트: 스킵된 항목 반영
  progress.skipped = skippedCount
  progress.processed = skippedCount

  // 3. 중복되지 않은 항목들만 처리
  for (let i = 0; i < uniqueLeadsData.length; i++) {
    const leadData = uniqueLeadsData[i]
    if (!leadData) continue // TypeScript strict 모드 대응

    const originalIndex = leadsData.indexOf(leadData)
    progress.currentRow = originalIndex + 1
    progress.currentCompanyName = leadData.companyName

    try {
      // 필드 길이 제한 적용 (DB 제약 조건 준수)
      const sanitizedData: ParsedLeadData = {
        ...leadData,
        companyName: truncateString(leadData.companyName, 255),
        foundCompanyName: truncateString(leadData.foundCompanyName, 255),
        websiteUrl: truncateString(leadData.websiteUrl, 500),
        finalUrl: truncateString(leadData.finalUrl, 500),
        businessType: truncateString(leadData.businessType, 100),
        country: truncateString(leadData.country, 100),
        city: truncateString(leadData.city, 100),
        state: truncateString(leadData.state, 100),
        employeeCount: truncateString(leadData.employeeCount, 50),
        leadSource: truncateString(leadData.leadSource, 100) || "뷰티DB",
      }

      // 리드 임포트
      const result = await importSingleLead(workspaceId, sanitizedData, createdBy, customerGroupId)

      if (result.success) {
        progress.success++
        details.leadsCreated++
        details.contactsCreated += result.stats.contactsCreated
        details.socialMediaCreated += result.stats.socialMediaCreated
        details.productsCreated += result.stats.productsCreated
        details.sectorsCreated += result.stats.sectorsCreated
        details.categoriesCreated += result.stats.categoriesCreated
        details.industriesCreated += result.stats.industriesCreated
        details.groupMembersCreated += result.stats.groupMembersCreated
      } else {
        progress.failed++
        progress.errors.push({
          row: originalIndex + 1,
          companyName: leadData.companyName,
          websiteUrl: leadData.websiteUrl,
          error: result.error || "Unknown error",
        })
      }

      progress.processed++

      // 진행상황 콜백
      if (onProgress) {
        onProgress({ ...progress })
      }
    } catch (error: unknown) {
      progress.failed++
      progress.processed++
      progress.errors.push({
        row: originalIndex + 1,
        companyName: leadData.companyName,
        websiteUrl: leadData.websiteUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      // 진행상황 콜백
      if (onProgress) {
        onProgress({ ...progress })
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    total: progress.total,
    success: progress.success,
    skipped: progress.skipped,
    failed: progress.failed,
    details,
    errors: progress.errors,
    duration,
  }
}
