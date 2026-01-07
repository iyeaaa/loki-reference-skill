/**
 * Buyer Search AI Prompts
 *
 * Hunter.io Discover API를 활용한 잠재 고객 검색을 위한 AI 프롬프트
 * GPT-5.2 및 GPT-5-mini 사용
 */

import { VALID_HUNTERIO_INDUSTRIES } from "../../constants/hunterio-industries"

// ==================== BUYER QUERY GENERATION ====================

/**
 * 바이어 검색 쿼리 생성 프롬프트
 *
 * 핵심: 내 회사 설명을 기반으로 **잠재 고객**의 키워드와 industry를 생성
 * - keywords: Hunter.io Discover API 검색 키워드
 * - hunterIndustries: 잠재 고객이 속할 Hunter.io 유효 industry (1-3개)
 */
export function buildBuyerQueryPrompt(params: {
  description: string
  targetType?: string
  myIndustry?: string
  countryISO?: string
}): string {
  const { description, targetType, myIndustry, countryISO } = params

  return `You are an expert B2B sales strategist specializing in lead generation.

## Your Company (Seller)
- **Description:** ${description}
- **My Industry:** ${myIndustry || "Not specified"}
- **Target Type:** ${targetType || "B2B"}
- **Target Country:** ${countryISO || "Not specified"}

## Your Task
Analyze the seller's business and identify **IDEAL BUYER PROFILES** - companies that would be interested in purchasing their products/services.

### Step 1: Understand the Seller
- What products/services does this company sell?
- Who would BUY these products? (retailers, distributors, wholesalers, importers, etc.)

### Step 2: Generate Search Keywords
Create 5-8 specific English keywords that would appear on **BUYER** company websites.
- Focus on buyer-side terms (not seller-side)
- Be specific - generic terms like "company" are useless

### Step 3: Identify BUYER Industries (CRITICAL)
Select 1-3 industries from the Hunter.io valid list where **BUYERS** would be found.

**IMPORTANT:** The seller's industry (${myIndustry || "Manufacturing"}) is NOT necessarily the buyer's industry!
- Example: If seller is a "cat litter manufacturer" (Manufacturing)
  → Buyers would be in "Pet Services", "Retail Recyclable Materials & Used Merchandise", "Wholesale" etc.
- Example: If seller is a "software company" (Technology)
  → Buyers could be in "Retail", "Manufacturing", "Financial Services" etc.

### Valid Hunter.io Industries (choose from this list ONLY):
${VALID_HUNTERIO_INDUSTRIES.join("\n")}

## Output Format (JSON only, no markdown):
{
  "keywords": ["pet store", "pet supplies distributor", "cat litter retailer", "eco-friendly pet products", "pet wholesale"],
  "hunterIndustries": ["Pet Services", "Retail Recyclable Materials & Used Merchandise", "Wholesale"],
  "buyerTypes": ["pet retailers", "pet supply distributors", "eco-friendly stores"],
  "excludeKeywords": ["veterinary clinic", "pet insurance"],
  "industryHint": "Pet retail and distribution"
}

## Critical Rules
1. Keywords must be in ENGLISH
2. Keywords should describe BUYER companies, not the seller
3. hunterIndustries must be EXACTLY from the valid list (case-sensitive)
4. Think: "Who would BUY from this company?" not "What industry is the seller in?"
5. Be specific and targeted for B2B lead generation`
}

// ==================== COUNTRY ISO CONVERSION ====================

/**
 * 국가명 → ISO 3166-1 alpha-2 코드 변환 프롬프트
 * GPT-5-mini (reasoning_effort: minimal) 사용
 */
export function buildCountryISOPrompt(country: string): string {
  return `Convert the following country name to its ISO 3166-1 alpha-2 code.
If it's already an ISO code or cannot be converted, return the original input.

Examples:
"United States" -> "US"
"미국" -> "US"
"Japan" -> "JP"
"일본" -> "JP"
"jp" -> "JP"
"South Korea" -> "KR"
"한국" -> "KR"
"Germany" -> "DE"
"unknown country" -> "unknown country"

Input: "${country}"
Output:`
}

// ==================== HUNTER INDUSTRY CONVERSION ====================

/**
 * 사용자 입력 industry → Hunter.io 유효 industry 변환 프롬프트
 * GPT-5-mini (reasoning_effort: minimal) 사용
 *
 * 참고: 이 프롬프트는 legacy 호환성을 위해 유지
 * 새로운 흐름에서는 buyerQueryPrompt에서 직접 hunterIndustries를 생성
 */
export function buildHunterIndustryPrompt(industry: string): string {
  return `Given the following industry name, find the BEST matching industry from the provided list of valid Hunter.io industries.
If no good match is found, return "NONE".

Valid Hunter.io Industries:
${VALID_HUNTERIO_INDUSTRIES.join("\n")}

Input Industry: "${industry}"
Output (BEST MATCH or NONE):`
}

// ==================== TYPES ====================

/**
 * AI가 생성한 바이어 검색 쿼리
 */
export interface AIGeneratedBuyerQuery {
  keywords: string[] // Hunter.io keywords (핵심!)
  hunterIndustries: string[] // 🆕 잠재 고객의 Hunter.io industry (1-3개)
  buyerTypes: string[] // 타겟 바이어 유형
  excludeKeywords: string[] // 제외할 키워드
  industryHint: string // 산업 힌트 (로깅용)
}
