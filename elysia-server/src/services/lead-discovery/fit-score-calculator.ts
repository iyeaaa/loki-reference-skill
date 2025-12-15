/**
 * Fit Score Calculator
 * AI 기반 리드 적합도 계산 서비스
 */

import { ChatOpenAI } from "@langchain/openai"
import { leadDiscoveryLogger } from "./logger"

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

export interface LeadForScoring {
  id: string
  company_name?: string
  email?: string
  phone?: string
  web_address?: string
  country?: string
  industry?: string
  sub_industry?: string
  employee?: string
  revenue?: string
  title?: string
}

export interface WebsiteAnalysisContext {
  companyName?: string
  description?: string
  industry?: string
  products?: string[]
  targetMarkets?: string[]
  businessModel?: string
}

export interface FitScoreResult {
  leadId: string
  score: number
  reason?: string
}

// 한국어 쿼리에서 국가명 추출
function extractCountryFromQuery(query: string): string | null {
  const countryMap: Record<string, string> = {
    미국: "United States",
    "미 ": "United States",
    인도네시아: "Indonesia",
    캐나다: "Canada",
    영국: "United Kingdom",
    호주: "Australia",
    독일: "Germany",
    프랑스: "France",
    일본: "Japan",
    중국: "China",
    싱가포르: "Singapore",
    말레이시아: "Malaysia",
    태국: "Thailand",
    베트남: "Vietnam",
    필리핀: "Philippines",
    인도: "India",
    브라질: "Brazil",
    멕시코: "Mexico",
    스페인: "Spain",
    이탈리아: "Italy",
    네덜란드: "Netherlands",
    스위스: "Switzerland",
    스웨덴: "Sweden",
    노르웨이: "Norway",
    덴마크: "Denmark",
    벨기에: "Belgium",
    폴란드: "Poland",
    아일랜드: "Ireland",
    뉴질랜드: "New Zealand",
    남아프리카: "South Africa",
    아랍에미리트: "United Arab Emirates",
    사우디: "Saudi Arabia",
    터키: "Turkey",
  }

  for (const [korean, english] of Object.entries(countryMap)) {
    if (query.includes(korean)) {
      return english
    }
  }

  return null
}

/**
 * 배치로 리드 적합도 계산 (10개씩)
 */
export async function calculateFitScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  onScore: (result: FitScoreResult) => void,
  userQuery?: string, // 사용자 검색 쿼리 추가
): Promise<void> {
  const BATCH_SIZE = 10

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE)

    try {
      const scores = await calculateBatchScores(batch, websiteAnalysis, selectedTarget, userQuery)

      for (const score of scores) {
        onScore(score)
      }
    } catch (error) {
      leadDiscoveryLogger.error(`Fit score calculation error for batch ${i}: ${error}`)
      // 에러 시 해당 배치는 50점으로 기본값 설정
      for (const lead of batch) {
        onScore({
          leadId: lead.id,
          score: 50,
          reason: "계산 중 오류 발생",
        })
      }
    }
  }
}

/**
 * 배치 적합도 계산
 */
async function calculateBatchScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  userQuery?: string,
): Promise<FitScoreResult[]> {
  const leadsInfo = leads
    .map(
      (lead, idx) =>
        `${idx + 1}. ID: ${lead.id}
   - Company: ${lead.company_name || "N/A"}
   - Industry: ${lead.industry || "N/A"} / ${lead.sub_industry || "N/A"}
   - Country: ${lead.country || "N/A"}
   - Title: ${lead.title || "N/A"}
   - Employees: ${lead.employee || "N/A"}
   - Has Email: ${lead.email ? "Yes" : "No"}
   - Has Phone: ${lead.phone ? "Yes" : "No"}
   - Has Website: ${lead.web_address ? "Yes" : "No"}`,
    )
    .join("\n\n")

  // userQuery가 있으면 검색 쿼리 기반 평가, 없으면 판매자 정보 기반 평가
  const searchCriteria = userQuery
    ? `## User Search Query (MOST IMPORTANT):
"${userQuery}"

Evaluate each lead based on how well they match this search query.`
    : `## Seller Company (Our Client):
- Company Name: ${websiteAnalysis.companyName || "Unknown"}
- Description: ${websiteAnalysis.description || "N/A"}
- Industry: ${websiteAnalysis.industry || "N/A"}
- Products/Services: ${websiteAnalysis.products?.join(", ") || "N/A"}
- Target Markets: ${websiteAnalysis.targetMarkets?.join(", ") || "N/A"}
- Business Model: ${websiteAnalysis.businessModel || "N/A"}`

  // 사용자 쿼리에서 국가 추출
  const extractedCountry = userQuery ? extractCountryFromQuery(userQuery) : null

  // 판매 관련 키워드 감지
  const isSalesSearch =
    userQuery &&
    /wholesale|distributor|supplier|vendor|retailer|판매|도매|유통|공급/i.test(userQuery)

  // 자재/제품 검색 감지 (도매/유통사를 찾는 경우)
  const isMaterialsSearch =
    userQuery &&
    /building materials?|construction materials?|건축\s*자재|건자재|인테리어\s*자재|외장\s*자재/i.test(
      userQuery,
    )

  // 제품/자재 키워드 추출
  const productKeywords = userQuery
    ? userQuery
        .toLowerCase()
        .replace(/wholesale|distributor|supplier|vendor|retailer|도매|유통|공급|업체|회사/gi, "")
        .trim()
    : ""

  const prompt = `You are evaluating potential business leads for a B2B context.

${searchCriteria}

## Selected Target Criteria:
- Target Country: ${selectedTarget.country}
- Target Industry: ${selectedTarget.industry}
${extractedCountry ? `- User Requested Country (from query): ${extractedCountry}` : ""}

## Leads to Evaluate:
${leadsInfo}

## ⚠️ CRITICAL: SEARCH INTENT UNDERSTANDING

${
  isMaterialsSearch && !isSalesSearch
    ? `**SEARCH INTENT: Finding BUILDING MATERIALS SUPPLIERS/DISTRIBUTORS/MANUFACTURERS**

The user is looking for companies that SUPPLY, DISTRIBUTE, or MANUFACTURE building materials.

### HIGH SCORE (80-100) - Actual materials suppliers/manufacturers:
- Building materials distributors/wholesalers
- Construction materials suppliers
- Lumber/wood products companies
- Aggregate/stone/gravel suppliers (Aggregates, Ready-mix concrete)
- Glass/window/door manufacturers
- Roofing materials suppliers (not contractors)
- Flooring materials suppliers
- Hardware/fastener distributors
- Steel/metal products suppliers
- Insulation/drywall manufacturers
- Plumbing/electrical supplies distributors

### MEDIUM SCORE (40-60) - Companies with some materials focus:
- Specialty contractors with materials division
- Equipment + materials suppliers
- Companies that both manufacture and install

### LOW SCORE (20-40) - Service-focused, NOT materials suppliers:
- General contractors (they BUY materials, not sell)
- Home builders (construction service)
- Roofing contractors (service, not materials)
- Paving companies (service)
- Landscaping companies (service)
- Remodeling contractors (service)

### VERY LOW SCORE (0-20) - Completely unrelated:
- Associations/trade groups
- Law firms, Insurance, Accounting
- Real estate brokers/agents
- Software/IT companies
- Government agencies

### KEY DISTINGUISHING FACTORS:
1. Look for keywords: "supplier", "distributor", "materials", "products", "wholesale", "manufacturer"
2. Avoid if keywords include: "contractor", "services", "installation", "repair", "consulting"
3. Company name containing: "Materials", "Supply", "Products", "Lumber" → Higher score
4. Company name containing: "Construction", "Builders", "Contractors" → Lower score (they are BUYERS not SELLERS)`
    : isSalesSearch
      ? `**THE USER IS A SELLER** looking for companies who would BUY their products/services.

When the search query contains "wholesale", "distributor", "supplier", or similar terms:
- The USER is the one SELLING these products
- We need to find companies that would CONSUME/PURCHASE these products

### Example: "building materials wholesale"
- The USER sells building materials
- IDEAL BUYERS include:
  - Construction companies (they BUY materials for projects)
  - Home builders (they BUY materials to build homes)
  - Real estate developers (they BUY materials for developments)
  - Remodeling/renovation contractors (they BUY materials)
  - Architecture firms (they specify materials for projects)
  - Interior design companies (they source materials)
  
- NOT ideal: Other building material wholesalers (competitors, not buyers)

### Product/Materials Keywords from Query: "${productKeywords}"
Companies that USE or CONSUME these products should score HIGH!`
      : `Evaluate leads based on industry alignment with the search criteria.`
}

## Task:
For each lead, calculate a FIT SCORE (0-100) based on:

1. **COUNTRY MATCH (30 points max)**
   - EXACT country match = 30 points
   - Related region = 15 points
   - Different country/region = 0 points
   ${extractedCountry ? `- User specifically requested "${extractedCountry}". If lead's country doesn't match, score penalty applies.` : ""}
   
2. **INDUSTRY/INTENT MATCH (40 points max) - MOST IMPORTANT** ${
    isMaterialsSearch && !isSalesSearch
      ? `
   - Actual materials supplier/distributor/manufacturer = 40 points
   - Company with materials + services = 25 points
   - Pure service/contractor company = 10 points
   - Unrelated industry = 0 points`
      : isSalesSearch
        ? `
   - Company that directly USES/CONSUMES the product = 40 points
     (e.g., construction company for building materials)
   - Company that PURCHASES for projects/resale = 30 points
     (e.g., developers, contractors)
   - Company in related field that might need the product = 20 points
     (e.g., architecture firms for building materials)
   - Competitor (same type of seller) = 5 points
   - Completely unrelated industry = 0 points`
        : `
   - Industry exactly matches = 40 points
   - Related industry = 20 points
   - Unrelated industry = 0 points`
  }
   
3. **Data Completeness (30 points max)**
   - Has email = 10 points
   - Has phone = 10 points
   - Has website = 10 points

${
  isMaterialsSearch && !isSalesSearch
    ? `## ⚠️ SCORING EXAMPLES for "Building Materials" search:
- "ABC Building Materials Supply" → 90-100 (materials supplier)
- "Hissong Ready Mix & Aggregates" → 85-95 (materials: concrete, aggregates)
- "County Line Stone Co" → 80-90 (materials: stone, aggregates)
- "Phoenix Building Components" → 80-90 (materials manufacturer)
- "Black Forest Wood Co" → 80-90 (lumber/wood products)
- "Thermotech Fiberglass" → 75-85 (insulation materials)
- "Gehring Concrete" → 50-60 (likely contractor, not supplier)
- "Fireside Homes Inc" → 30-40 (home builder = service)
- "Texas Roof and Fence" → 25-35 (contractor = service)
- "Home Builders Association" → 10-20 (association, not supplier)
- "NeuroMentix AI" → 0-10 (unrelated)`
    : isSalesSearch
      ? `## ⚠️ SCORING EXAMPLES for "${userQuery}":
- "Construction Company" in target country → 85-95 points (ideal BUYER)
- "Home Builder" in target country → 85-95 points (ideal BUYER)
- "Real Estate Developer" in target country → 75-85 points (needs materials)
- "Remodeling Contractor" in target country → 80-90 points (buys materials)
- "Architecture Firm" in target country → 70-80 points (specifies materials)
- "Building Materials Distributor" → 30-40 points (competitor, not buyer)
- "Landscaping Company" → 50-60 points (may need some materials)
- "Software Company" → 10-20 points (unrelated)`
      : `## ⚠️ CRITICAL SCORING RULES:
- If user searched for specific industry but lead doesn't match, score MUST be below 40!
- Only leads matching BOTH country AND industry criteria should score 70+`
}

## Response Format (JSON array only, no markdown):
[
  {"leadId": "id1", "score": 85},
  {"leadId": "id2", "score": 62}
]

Important: Return ONLY the JSON array, no explanation or markdown.`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  try {
    // JSON 파싱 시도
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ leadId: string; score: number }>
      return parsed.map((item) => ({
        leadId: item.leadId,
        score: Math.min(100, Math.max(0, item.score)),
      }))
    }
  } catch (parseError) {
    leadDiscoveryLogger.error(`Failed to parse fit scores: ${parseError}`)
  }

  // 파싱 실패 시 기본값 반환
  return leads.map((lead) => ({
    leadId: lead.id,
    score: 50,
    reason: "계산 중 오류",
  }))
}
