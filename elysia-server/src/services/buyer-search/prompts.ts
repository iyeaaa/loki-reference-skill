/**
 * Buyer Search Prompts
 * LLM 프롬프트 모음
 */

import { COMPANY_SIZE_LABELS, COUNTRY_NAMES, INDUSTRY_HINTS } from "./constants"
import type {
  BuyerIntelligence,
  BuyerSearchInput,
  CompanySize,
  EnrichedCompany,
  ScoredCompany,
  SearchMode,
} from "./types"

// ============================================================================
// Phase 1: Intelligence Generation
// ============================================================================

/**
 * 바이어 인텔리전스 생성 프롬프트 (제한된 정보 기반 바이어 매칭 추론 프레임워크)
 * searchMode에 따라 다른 프롬프트 생성:
 * - "seller" (기본값): 내 회사 정보 → 적합한 바이어 페르소나 생성
 * - "direct": 검색 쿼리 → 타겟 기업 특성 도출
 */
export function buildIntelligencePrompt(input: BuyerSearchInput): string {
  const searchMode: SearchMode = input.searchMode || "seller"
  const industryHint = INDUSTRY_HINTS[input.industry]
  const countries = input.country.map((c) => COUNTRY_NAMES[c]).join(", ")
  const companySizeLabel = COMPANY_SIZE_LABELS[input.companySize]

  // Direct 모드: 검색 쿼리를 분석하여 타겟 기업 특성 도출
  if (searchMode === "direct") {
    return buildDirectModeIntelligencePrompt(input, industryHint, countries, companySizeLabel)
  }

  // Seller 모드 (기본값): 기존 로직 - 판매자 분석 → 바이어 페르소나 생성
  return buildSellerModeIntelligencePrompt(input, industryHint, countries, companySizeLabel)
}

/**
 * Direct 모드 인텔리전스 프롬프트
 * 검색 쿼리를 분석하여 찾고자 하는 기업 유형 도출
 */
function buildDirectModeIntelligencePrompt(
  input: BuyerSearchInput,
  industryHint: string,
  countries: string,
  companySizeLabel: string,
): string {
  return `You are an international company search expert.

📋 STEP 0: Search Query Analysis

**Search Query:**
"${input.companyDescription}"

**Search Parameters:**
- Target Countries: ${countries}
- Industry: ${input.industry} (${industryHint})
- Company Size Preference: ${companySizeLabel}
- Business Type: ${
    input.target === "b2b"
      ? "B2B (Business to Business)"
      : input.target === "b2c"
        ? "B2C (Business to Consumer)"
        : "B2B + B2C (Both)"
  }

🔍 STEP 1: Query Interpretation

Analyze the search query to understand:

**1.1 Target Company Characteristics**
- What type of company is the user looking for?
- What role do they play in the supply chain? (Manufacturer, Distributor, Retailer, Service Provider)
- What products/services do they handle?

**1.2 Industry Classification**
- Primary industry
- Sub-categories
- Related industries that might be relevant

**1.3 Size & Scale Requirements**
- Preferred company size (if specified)
- Capacity indicators (e.g., "대규모", "소규모", "스타트업")

🎯 STEP 2: Search Keyword Generation

Generate search keywords that will find the target companies:

**2.1 Primary Keywords**
- Direct descriptors of the target company type
- Industry-specific terms

**2.2 Alternative Keywords**
- Synonyms and variations
- Related business types

**2.3 Exclusion Keywords**
- Types of companies to exclude (competitors, irrelevant industries)

🎯 STEP 3: Company Profile Generation

Generate company profiles (personas) that match the search query.

Respond in the following JSON format:

{
  "productSummary": "찾고자 하는 기업 유형 요약 (1-2 sentences in Korean)",

  "buyerPersonas": [
    {
      "type": "Target company type name (English)",
      "typeKo": "타겟 기업 유형명 (Korean)",
      "description": "이런 기업을 찾는 이유 (2-3 sentences in Korean)",
      "decisionMakers": ["Job titles for contact"],
      "targetCompanySize": ["startup", "small", "medium"],
      "searchKeywords": {
        "en": ["keyword1", "keyword2"],
        "local": {
          "Japan": ["keyword1", "keyword2"]
        }
      }
    }
  ],

  "industryFilters": {
    "keywords": ["industry keyword1", "keyword2"],
    "excludeKeywords": ["irrelevant keyword", "competitor keyword"]
  },

  "searchStrategy": {
    "priorityPersonas": ["Highest priority company types"],
    "notes": "검색 전략 메모 (in Korean)"
  }
}

**Critical Instructions:**
- Generate EXACTLY 5 company profiles matching the search query
- For each profile:
  * Profile 1: Most specific match to the query
  * Profile 2: Slightly broader interpretation
  * Profile 3: Medium scope
  * Profile 4: Broader related category
  * Profile 5: Broad catch-all that still matches intent
- Include local language keywords for target countries
- Output ONLY valid JSON with no markdown, no explanation, no extra text`
}

/**
 * Seller 모드 인텔리전스 프롬프트 (기존 로직)
 * 판매자 정보를 분석하여 적합한 바이어 페르소나 생성
 */
function buildSellerModeIntelligencePrompt(
  input: BuyerSearchInput,
  industryHint: string,
  countries: string,
  companySizeLabel: string,
): string {
  return `You are a B2B/B2C export buyer matching expert using a limited information-based inference framework.

📋 STEP 0: Information Collection & Classification

**Seller Basic Information:**
- Company Name: ${input.companyName}
- Company Description: ${input.companyDescription}
- Industry: ${input.industry} (${industryHint})
- Company Size: ${companySizeLabel}
- Target Customer: ${
    input.target === "b2b"
      ? "B2B (Business to Business)"
      : input.target === "b2c"
        ? "B2C (Business to Consumer)"
        : "B2B + B2C (Both)"
  }
- Target Countries: ${countries}

🔍 STEP 1: Primary Inference

Analyze the seller based on the provided information:

**1.1 Company Scale Estimation**
- Infer actual business scale from: employee count, office/factory size, product range, market presence
- Classification: Startup / Small / Medium / Large / Enterprise

**1.2 Business Classification**
[Stage 1] Major Category
□ B2C Consumer Goods
□ B2B Industrial Goods
□ B2B2C (Both possible)
□ Service/Platform

[Stage 2] Sub-category
Identify specific industry (e.g., Food/Beverage, Beauty/Cosmetics, Fashion, Electronics, etc.)

[Stage 3] Price Positioning
- Budget (value-focused)
- Mid-range (reasonable premium)
- Premium (luxury/artisan)

**1.3 International Experience**
- Evidence: overseas partners, exhibition participation, export contracts, international awards
- Level: None / Initial / Active

**1.4 Business Model**
- Manufacturing (own production)
- OEM/ODM specialist
- Distribution/Trading
- Brand company
- Mixed model

🎯 STEP 2: Buyer Profile Derivation

**Question 1: What buyer scale fits our company scale?**

Our Scale → Suitable Buyer Scale (with reasoning)
- Small companies → Small to medium buyers (flexible terms, fast decisions)
- Medium companies → Medium to large buyers (balanced conditions, growth partnership)
- Large companies → Large to global buyers (stable volume, global network)

**Exceptions to consider:**
- IF small + innovative product + patents THEN large buyers possible
- IF medium + OEM specialist + low cost THEN large corporate PL supply possible

**Question 2: What countries fit our products?**

Consider:
- Certification-based filtering (FDA → US, CE → EU, Halal → Middle East)
- Product characteristics matching (Premium food → Japan/Singapore, Budget goods → Southeast Asia/Latin America)
- Logistics & entry barriers (Experience = None → nearby countries, Experience = High → major markets)

**Question 3: What buyer business types are suitable?**

IF we = Manufacturing (OEM/ODM capable)
THEN buyers = Retailers with private brands, Distributors developing PL, Brand companies outsourcing production

IF we = Brand company (own products only)
THEN buyers = Distributors, Retailers (online/offline), Trading companies
LIMIT: Avoid buyers with manufacturing (potential competitors)

IF we = Distribution (handling other brands)
THEN buyers = End retailers, Secondary wholesalers
LIMIT: Avoid buyers handling same brands (conflict)

🎯 STEP 4: Final Buyer Search ICP Priority Guide

Based on the analysis above, generate buyer personas and search strategy.

Respond in the following JSON format:

{
  "productSummary": "Analyzed key product/service summary (1-2 sentences in Korean)",

  "buyerPersonas": [
    {
      "type": "Buyer type name (English)",
      "typeKo": "Buyer type name (Korean)",
      "description": "Why suitable (2-3 sentences in Korean)",
      "decisionMakers": ["Job titles"],
      "targetCompanySize": ["startup", "small"],
      "searchKeywords": {
        "en": ["keyword1", "keyword2"],
        "local": {
          "Japan": ["keyword1", "keyword2"]
        }
      }
    }
  ],

  "industryFilters": {
    "keywords": ["industry keyword1", "keyword2"],
    "excludeKeywords": ["competitor keyword", "unrelated keyword"]
  },

  "searchStrategy": {
    "priorityPersonas": ["Highest priority persona types"],
    "notes": "Search strategy notes (in Korean)"
  }
}

**Critical Instructions:**
- Generate EXACTLY 5 buyer personas following the size targeting strategy (Persona 1: specific+similar size → Persona 5: broad+all sizes)
- For each persona:
  * Persona 1: Most specific + similar size (high relevance, lower volume)
  * Persona 2: Specific + slightly broader size range
  * Persona 3: Medium scope + flexible size
  * Persona 4: Broader category + all sizes
  * Persona 5: Very broad catch-all + all sizes
- Focus on RESELLERS/REDISTRIBUTORS, not end-users (except for bulk buyers)
- Include local language keywords for target countries
- Output ONLY valid JSON with no markdown, no explanation, no extra text`
}

// ============================================================================
// Phase 4: Scoring
// ============================================================================

/**
 * LLM 관련성 평가 프롬프트 (배치)
 * searchMode에 따라 다른 프롬프트 생성:
 * - "seller" (기본값): 판매자의 바이어로 적합한지 평가
 * - "direct": 검색 조건에 부합하는지 평가
 */
export function buildBatchEvaluationPrompt(
  intelligence: BuyerIntelligence,
  companies: EnrichedCompany[],
  sellerSize: CompanySize,
  locale: "ko" | "en" = "ko",
  searchMode: SearchMode = "seller",
): string {
  const isKorean = locale === "ko"
  const personaTypes = intelligence.buyerPersonas
    .map((p) => (isKorean ? p.typeKo : p.type))
    .join(", ")
  const sellerSizeLabel = COMPANY_SIZE_LABELS[sellerSize]

  const companyDescriptions = companies
    .map(
      (c, idx) => `---
[${idx}] ${c.companyName}
- Website: ${c.website || "N/A"}
- Industry: ${c.industry || "N/A"}
- Country: ${c.country}
- Company Size: ${c.size ? COMPANY_SIZE_LABELS[c.size] : "Unknown"}
- Description: ${c.description || "N/A"}
---`,
    )
    .join("\n")

  const languageInstruction = isKorean
    ? `"matchedPersona": "Matched persona type (Korean)",
    "reason": "Reason for suitability (briefly 1-2 sentences in Korean)"`
    : `"matchedPersona": "Matched persona type (English)",
    "reason": "Reason for suitability (briefly 1-2 sentences in English)"`

  // Direct 모드: 검색 조건에 부합하는지 평가
  if (searchMode === "direct") {
    return `You are an international company search expert.

[Search Criteria]
- Target Company Type: ${intelligence.productSummary}
- Target Company Profiles: ${personaTypes}
- Preferred Size: ${sellerSizeLabel}

Evaluate how well the following companies match the search criteria above.

${companyDescriptions}

Respond with a JSON array for each company:
[
  {
    "index": 0,
    "score": 8,
    ${languageInstruction}
  },
  ...
]

Scoring Criteria:
- 9-10: Excellent match (Exact fit with search criteria)
- 7-8: Good match (Closely related to target profile)
- 5-6: Moderate (Partial match, some relevance)
- 3-4: Low (Weak connection to search criteria)
- 1-2: Unsuitable (Does not match search criteria)

Output only JSON.`
  }

  // Seller 모드 (기본값): 바이어 적합성 평가
  return `You are a B2B/B2C export buyer matching expert.

[Seller Info]
- Product/Service: ${intelligence.productSummary}
- Seller Company Size: ${sellerSizeLabel}
- Target Buyer Types: ${personaTypes}

Evaluate how suitable the following companies are as buyers for the seller above.

**Consider company size compatibility:**
- Small sellers (${sellerSizeLabel}) typically struggle with very large buyers due to MOQ, supply capacity, payment terms
- Similar-sized or slightly larger buyers are more realistic and accessible
- Much larger buyers should receive lower scores unless there's exceptional product fit

${companyDescriptions}

Respond with a JSON array for each company:
[
  {
    "index": 0,
    "score": 8,
    ${languageInstruction}
  },
  ...
]

Scoring Criteria:
- 9-10: Excellent fit (Exact match with target persona + appropriate size)
- 7-8: Good fit (Related industry, high purchasing probability, reasonable size gap)
- 5-6: Moderate (Indirect relevance or challenging size mismatch)
- 3-4: Low (Weak relevance or very large size gap)
- 1-2: Unsuitable (Competitor, irrelevant, or impossible size gap)

Output only JSON.`
}

// ============================================================================
// Phase 5: Finalizing
// ============================================================================

/**
 * 설명 생성 프롬프트
 * searchMode에 따라 다른 프롬프트 생성:
 * - "seller" (기본값): 바이어로 적합한 이유 설명
 * - "direct": 검색 조건에 적합한 이유 설명
 */
export function buildDescriptionPrompt(
  input: BuyerSearchInput,
  intelligence: BuyerIntelligence,
  buyer: ScoredCompany,
): string {
  const searchMode: SearchMode = input.searchMode || "seller"
  const isKorean = input.locale === "ko"

  // Direct 모드: 검색 조건에 적합한 이유 설명
  if (searchMode === "direct") {
    const languageInstruction = isKorean
      ? "이 기업이 검색 조건에 적합한 이유를 1-2문장으로 설명하세요."
      : "Explain why this company matches the search criteria in 1-2 sentences."

    return `You are an international company search expert.

[Search Criteria]
${intelligence.productSummary}

[Found Company]
Company Name: ${buyer.companyName}
Website: ${buyer.website}
Industry: ${buyer.industry || "N/A"}
Country: ${buyer.country}
Company Info: ${buyer.description || "N/A"}
Match Reason: ${buyer.llmEvaluation.reason}

${languageInstruction}
Write concisely, focusing on why this company is relevant to the search.

Output only the explanation (no other text).`
  }

  // Seller 모드 (기본값): 바이어로 적합한 이유 설명
  const languageInstruction = isKorean
    ? "Explain why this buyer is a good candidate in 1-2 sentences in Korean."
    : "Explain why this buyer is a good candidate in 1-2 sentences in English."

  return `You are a B2B export sales expert.

[Seller]
${input.companyName} - ${intelligence.productSummary}

[Buyer Candidate]
Company Name: ${buyer.companyName}
Website: ${buyer.website}
Industry: ${buyer.industry || "N/A"}
Country: ${buyer.country}
Collected Info: ${buyer.description || "N/A"}
Suitability Reason: ${buyer.llmEvaluation.reason}

${languageInstruction}
Write concisely so that sales representatives can use it immediately.
Focus on the company's characteristics and potential for transaction.

Output only the explanation (no other text).`
}
