/**
 * Lead Import Service
 * Excel 파일에서 리드 데이터를 임포트하는 서비스
 */

import { and, eq, inArray } from "drizzle-orm"
import { db } from "../db"
import {
  customerGroupMembers,
  customerGroups,
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

export interface DuplicateEmailInfo {
  email: string
  existingLeadId: string
  rowNumber: number
  companyName: string | null
}

export interface SkippedLeadInfo {
  rowNumber: number
  companyName: string | null
  websiteUrl: string | null
  reason: string
  existingLeadId?: string
}

export interface ImportProgress {
  total: number
  processed: number
  success: number
  skipped: number
  failed: number
  currentRow: number
  currentCompanyName: string | null
  duplicateEmails: DuplicateEmailInfo[]
  emailsSkipped: number
  skippedLeads: SkippedLeadInfo[]
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
  duplicateEmails: DuplicateEmailInfo[]
  emailsSkipped: number
  skippedLeads: SkippedLeadInfo[]
  groupAssignment: {
    groupId: string
    groupName: string
    membersAdded: number
  } | null
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
  duplicateEmails: Map<string, string> = new Map(),
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
  skippedEmails: string[]
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

  const skippedEmails: string[] = []

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

      // 3. Contacts 생성 (이메일) - 중복 이메일 필터링
      if (data.emails.length > 0) {
        // 중복되지 않은 이메일만 필터링
        const uniqueEmails = data.emails.filter((email) => {
          if (duplicateEmails.has(email)) {
            skippedEmails.push(email)
            logger.debug({ email, leadId }, "Skipping duplicate email")
            return false
          }
          return true
        })

        // 유니크한 이메일이 있을 경우에만 삽입
        if (uniqueEmails.length > 0) {
          const emailContacts = uniqueEmails.map((email, index) => ({
            leadId,
            contactType: "email" as const,
            contactValue: email,
            isPrimary: index === 0, // 첫 번째 이메일은 primary
          }))

          await tx.insert(leadContacts).values(emailContacts)
          stats.contactsCreated += emailContacts.length
        }
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
      skippedEmails,
    }
  } catch (error: unknown) {
    logger.error({ error, websiteUrl: data.websiteUrl }, "Failed to import lead")
    return {
      success: false,
      stats,
      skippedEmails,
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
 * Workspace 내 중복 이메일 체크 (여러 이메일을 청크로 나누어 조회)
 *
 * @param workspaceId - Workspace ID
 * @param emails - 체크할 이메일 목록
 * @returns 이메일과 해당 이메일이 속한 lead ID의 매핑
 */
async function checkDuplicateEmailsInWorkspace(
  workspaceId: string,
  emails: string[],
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }

  const CHUNK_SIZE = 1000 // PostgreSQL 바인드 파라미터 제한을 고려한 청크 크기
  const emailToLeadIdMap = new Map<string, string>()

  try {
    // 이메일을 청크로 나누어 처리
    for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
      const chunk = emails.slice(i, i + CHUNK_SIZE)

      // leadContacts 테이블에서 이메일 조회 (workspace의 leads와 조인)
      const existingEmails = await db
        .select({
          email: leadContacts.contactValue,
          leadId: leadContacts.leadId,
        })
        .from(leadContacts)
        .innerJoin(leads, eq(leadContacts.leadId, leads.id))
        .where(
          and(
            eq(leads.workspaceId, workspaceId),
            eq(leadContacts.contactType, "email"),
            inArray(leadContacts.contactValue, chunk),
          ),
        )

      for (const row of existingEmails) {
        emailToLeadIdMap.set(row.email, row.leadId)
      }

      // 진행 상황 로깅 (대량 데이터의 경우)
      if (emails.length > CHUNK_SIZE) {
        logger.debug(
          {
            processed: Math.min(i + CHUNK_SIZE, emails.length),
            total: emails.length,
            found: emailToLeadIdMap.size,
          },
          "Duplicate email check progress",
        )
      }
    }

    logger.info(
      { total: emails.length, duplicates: emailToLeadIdMap.size },
      "Email duplicate check completed",
    )

    return emailToLeadIdMap
  } catch (error) {
    logger.error({ error }, "Failed to check duplicate emails")
    return new Map()
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
    duplicateEmails: [],
    emailsSkipped: 0,
    skippedLeads: [],
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

  // 1-2. 이메일 중복 체크 (두 단계):
  // Step 1: CSV 내부 중복 체크
  logger.info({ total: leadsData.length }, "Starting within-CSV email duplicate check")
  const emailToFirstOccurrence = new Map<string, number>() // email -> first row index
  const csvDuplicates = new Map<string, string>() // email -> "CSV_DUPLICATE" marker

  for (let i = 0; i < leadsData.length; i++) {
    const leadData = leadsData[i]
    if (!leadData) continue

    for (const email of leadData.emails) {
      if (email === "") continue

      if (!emailToFirstOccurrence.has(email)) {
        // 첫 번째 발견
        emailToFirstOccurrence.set(email, i)
      } else {
        // CSV 내 중복 발견
        csvDuplicates.set(email, "CSV_DUPLICATE")
        logger.debug(
          { email, firstRow: emailToFirstOccurrence.get(email), currentRow: i },
          "Found duplicate email within CSV",
        )
      }
    }
  }

  logger.info(
    { csvDuplicateCount: csvDuplicates.size, totalEmails: emailToFirstOccurrence.size },
    "Within-CSV duplicate check completed",
  )

  // Step 2: DB에 이미 존재하는 이메일들을 조회
  logger.info({ total: leadsData.length }, "Starting database email duplicate check")
  const allEmails = leadsData.flatMap((lead) => lead.emails).filter((email) => email !== "")
  const dbDuplicateEmailMap = await checkDuplicateEmailsInWorkspace(workspaceId, allEmails)
  logger.info(
    { dbDuplicateEmailCount: dbDuplicateEmailMap.size, totalEmails: allEmails.length },
    "Database email duplicate check completed",
  )

  // 두 중복 맵을 합치기: CSV 중복은 "CSV_DUPLICATE"로, DB 중복은 lead ID로
  const duplicateEmailMap = new Map<string, string>([...csvDuplicates, ...dbDuplicateEmailMap])

  // 2. 중복되지 않은 데이터만 필터링 (스킵된 항목 기록)
  const uniqueLeadsData: ParsedLeadData[] = []
  for (let i = 0; i < leadsData.length; i++) {
    const leadData = leadsData[i]
    if (!leadData) continue

    if (leadData.websiteUrl && existingUrls.has(leadData.websiteUrl)) {
      // website_url 중복으로 스킵
      progress.skippedLeads.push({
        rowNumber: i + 1,
        companyName: leadData.companyName,
        websiteUrl: leadData.websiteUrl,
        reason: "중복된 website_url (이미 워크스페이스에 존재)",
      })
      progress.skipped++
      progress.processed++
      logger.debug(
        { row: i + 1, websiteUrl: leadData.websiteUrl, companyName: leadData.companyName },
        "Skipping duplicate website_url",
      )
    } else {
      uniqueLeadsData.push(leadData)
    }
  }

  logger.info(
    { skipped: progress.skipped, toImport: uniqueLeadsData.length },
    "Filtered out duplicates",
  )

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

      // 리드 임포트 (중복 이메일 맵 전달)
      const result = await importSingleLead(
        workspaceId,
        sanitizedData,
        createdBy,
        customerGroupId,
        duplicateEmailMap,
      )

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

        // 스킵된 이메일 추적
        if (result.skippedEmails.length > 0) {
          for (const email of result.skippedEmails) {
            const duplicateInfo = duplicateEmailMap.get(email)
            if (duplicateInfo) {
              progress.duplicateEmails.push({
                email,
                existingLeadId: duplicateInfo, // "CSV_DUPLICATE" 또는 실제 lead ID
                rowNumber: originalIndex + 1,
                companyName: leadData.companyName,
              })
              progress.emailsSkipped++
            }
          }
        }
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

  // 그룹 할당 정보 가져오기 (customerGroupId가 제공된 경우)
  let groupAssignment: ImportResult["groupAssignment"] = null
  if (customerGroupId && details.groupMembersCreated > 0) {
    try {
      const [group] = await db
        .select({ id: customerGroups.id, name: customerGroups.name })
        .from(customerGroups)
        .where(eq(customerGroups.id, customerGroupId))
        .limit(1)

      if (group) {
        groupAssignment = {
          groupId: group.id,
          groupName: group.name,
          membersAdded: details.groupMembersCreated,
        }
      }
    } catch (error) {
      logger.error({ error, customerGroupId }, "Failed to fetch group info for result")
    }
  }

  return {
    total: progress.total,
    success: progress.success,
    skipped: progress.skipped,
    failed: progress.failed,
    details,
    duplicateEmails: progress.duplicateEmails,
    emailsSkipped: progress.emailsSkipped,
    skippedLeads: progress.skippedLeads,
    groupAssignment,
    errors: progress.errors,
    duration,
  }
}
