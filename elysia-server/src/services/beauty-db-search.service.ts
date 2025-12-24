/**
 * Beauty DB Search Service
 *
 * 뷰티/화장품 관련 리드 검색 시 내부 DB (뷰티_DB_통합데이터)를 사용합니다.
 * - 43,511개의 검증된 뷰티/화장품 리드 보유
 * - 국가별 필터링 지원
 * - description, business_type 등 상세 정보 포함
 */

import { and, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db"
import { customerGroupMembers, leads } from "../db/schema"
import { logger } from "../utils/logger"

// 뷰티 DB 통합데이터 그룹 정보
const BEAUTY_DB_CONFIG = {
  GROUP_ID: "c0574d01-dbba-4fb2-aa8d-9e3d36f4a010",
  WORKSPACE_ID: "6c0f63d3-6988-438d-92f9-7033ccd9cba8",
  GROUP_NAME: "뷰티_DB_통합데이터",
}

// 뷰티/화장품 관련 산업 키워드
const BEAUTY_INDUSTRY_KEYWORDS = [
  "beauty",
  "cosmetics",
  "skincare",
  "makeup",
  "뷰티",
  "화장품",
  "스킨케어",
  "메이크업",
  "cosmetic",
  "personal care",
  "haircare",
  "fragrance",
  "perfume",
  "향수",
  "헤어케어",
]

export interface BeautyDbLead {
  id: string
  companyName: string
  websiteUrl: string
  businessType: string | null
  description: string | null
  country: string | null
  employeeCount: string | null
  leadSource: string | null
}

export interface BeautyDbSearchResult {
  leads: BeautyDbLead[]
  totalCount: number
  source: "beauty_db"
}

/**
 * 산업이 뷰티/화장품 관련인지 확인
 */
export function isBeautyRelatedIndustry(industry: string): boolean {
  const lowerIndustry = industry.toLowerCase()
  return BEAUTY_INDUSTRY_KEYWORDS.some((keyword) => lowerIndustry.includes(keyword.toLowerCase()))
}

/**
 * 국가명 정규화 (다양한 형식 처리)
 */
function normalizeCountryName(country: string): string[] {
  const countryMappings: Record<string, string[]> = {
    japan: ["japan", "일본", "日本", "jp"],
    "united states": ["united states", "usa", "us", "미국", "america"],
    china: ["china", "중국", "中国", "cn"],
    "south korea": ["south korea", "korea", "한국", "대한민국", "kr"],
    germany: ["germany", "독일", "deutschland", "de"],
    france: ["france", "프랑스", "fr"],
    "united kingdom": ["united kingdom", "uk", "england", "영국", "britain"],
    canada: ["canada", "캐나다", "ca"],
    australia: ["australia", "호주", "au"],
    russia: ["russia", "러시아", "ru"],
    brazil: ["brazil", "브라질", "br"],
    italy: ["italy", "이탈리아", "it"],
    spain: ["spain", "스페인", "es"],
    netherlands: ["netherlands", "네덜란드", "nl", "holland"],
    singapore: ["singapore", "싱가포르", "sg"],
    thailand: ["thailand", "태국", "th"],
    vietnam: ["vietnam", "베트남", "vn"],
    indonesia: ["indonesia", "인도네시아", "id"],
    malaysia: ["malaysia", "말레이시아", "my"],
    uae: ["uae", "united arab emirates", "아랍에미리트", "두바이", "dubai"],
    europe: [
      "europe",
      "유럽",
      "germany",
      "france",
      "italy",
      "spain",
      "netherlands",
      "belgium",
      "poland",
      "sweden",
      "austria",
      "switzerland",
    ],
    "southeast asia": [
      "southeast asia",
      "동남아시아",
      "동남아",
      "sea",
      "singapore",
      "thailand",
      "vietnam",
      "indonesia",
      "malaysia",
      "philippines",
    ],
  }

  const lowerCountry = country.toLowerCase()

  // 직접 매핑 확인
  for (const [_key, aliases] of Object.entries(countryMappings)) {
    if (aliases.some((alias) => lowerCountry.includes(alias))) {
      return aliases
    }
  }

  // 매핑에 없으면 원본 반환
  return [country]
}

/**
 * 뷰티 DB에서 리드 검색
 */
export async function searchBeautyDatabase(options: {
  country?: string
  limit?: number
  keywords?: string[]
  excludeWebsites?: Set<string>
}): Promise<BeautyDbSearchResult> {
  const { country, limit = 100, keywords, excludeWebsites } = options
  const startTime = Date.now()

  logger.info(
    `[BeautyDB] Searching beauty database: country=${country || "all"}, limit=${limit}, keywords=${keywords?.length || 0}`,
  )

  try {
    // 기본 쿼리: 뷰티 그룹에 속한 리드 조회
    let query = db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        businessType: leads.businessType,
        description: leads.description,
        country: leads.country,
        employeeCount: leads.employeeCount,
        leadSource: leads.leadSource,
      })
      .from(leads)
      .innerJoin(customerGroupMembers, eq(leads.id, customerGroupMembers.leadId))
      .where(eq(customerGroupMembers.groupId, BEAUTY_DB_CONFIG.GROUP_ID))
      .$dynamic()

    // 국가 필터링
    if (country) {
      const countryVariants = normalizeCountryName(country)
      const countryConditions = countryVariants.map((variant) =>
        ilike(leads.country, `%${variant}%`),
      )

      if (countryConditions.length > 0) {
        query = query.where(
          and(
            eq(customerGroupMembers.groupId, BEAUTY_DB_CONFIG.GROUP_ID),
            or(...countryConditions),
          ),
        )
      }
    }

    // 키워드 필터링 (description 또는 businessType에서 검색)
    if (keywords && keywords.length > 0) {
      const keywordConditions = keywords.flatMap((keyword) => [
        ilike(leads.description, `%${keyword}%`),
        ilike(leads.businessType, `%${keyword}%`),
        ilike(leads.companyName, `%${keyword}%`),
      ])

      if (keywordConditions.length > 0) {
        query = query.where(
          and(
            eq(customerGroupMembers.groupId, BEAUTY_DB_CONFIG.GROUP_ID),
            or(...keywordConditions),
          ),
        )
      }
    }

    // 랜덤 정렬 + 제한
    const results = await query.orderBy(sql`RANDOM()`).limit(limit * 2) // 중복 제거 대비 여유분

    // 중복 웹사이트 제거
    const uniqueLeads: BeautyDbLead[] = []
    const seenWebsites = new Set<string>(excludeWebsites || [])

    for (const row of results) {
      const website = row.websiteUrl?.toLowerCase().replace(/\/+$/, "") || ""
      if (!website || seenWebsites.has(website)) {
        continue
      }
      seenWebsites.add(website)

      uniqueLeads.push({
        id: row.id,
        companyName: row.companyName || "Unknown Company",
        websiteUrl: row.websiteUrl || "",
        businessType: row.businessType,
        description: row.description,
        country: row.country,
        employeeCount: row.employeeCount,
        leadSource: row.leadSource,
      })

      if (uniqueLeads.length >= limit) {
        break
      }
    }

    const elapsed = Date.now() - startTime
    logger.info(`[BeautyDB] Found ${uniqueLeads.length} leads from beauty database in ${elapsed}ms`)

    return {
      leads: uniqueLeads,
      totalCount: uniqueLeads.length,
      source: "beauty_db",
    }
  } catch (error) {
    logger.error(`[BeautyDB] Search failed: ${error}`)
    return {
      leads: [],
      totalCount: 0,
      source: "beauty_db",
    }
  }
}

/**
 * 뷰티 DB에서 국가별 리드 수 확인
 */
export async function getBeautyDbCountryStats(country: string): Promise<number> {
  try {
    const countryVariants = normalizeCountryName(country)
    const countryConditions = countryVariants.map((variant) => ilike(leads.country, `%${variant}%`))

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .innerJoin(customerGroupMembers, eq(leads.id, customerGroupMembers.leadId))
      .where(
        and(eq(customerGroupMembers.groupId, BEAUTY_DB_CONFIG.GROUP_ID), or(...countryConditions)),
      )

    return Number(result[0]?.count || 0)
  } catch (error) {
    logger.error(`[BeautyDB] Failed to get country stats: ${error}`)
    return 0
  }
}
