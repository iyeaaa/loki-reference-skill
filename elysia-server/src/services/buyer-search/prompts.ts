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
} from "./types"

// ============================================================================
// Phase 1: Intelligence Generation
// ============================================================================

/**
 * 바이어 인텔리전스 생성 프롬프트
 */
export function buildIntelligencePrompt(input: BuyerSearchInput): string {
  const industryHint = INDUSTRY_HINTS[input.industry]
  const countries = input.country.map((c) => COUNTRY_NAMES[c]).join(", ")
  const companySizeLabel = COMPANY_SIZE_LABELS[input.companySize]

  return `You are a B2B/B2C export buyer matching expert.

[Seller Info]
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

Analyze the types of buyers most likely to purchase or distribute the products/services of the company above.

Respond in the following JSON format:

{
  "productSummary": "Summary of analyzed key product/service (1-2 sentences in Korean)",
  
  "buyerPersonas": [
    {
      "type": "Buyer type name (English, e.g. Industrial Equipment Distributor)",
      "typeKo": "Buyer type name (Korean, e.g. 산업용 장비 유통사)",
      "description": "Why this type is a suitable buyer (2-3 sentences in Korean)",
      "decisionMakers": ["Purchasing Manager", "CEO", "Director of Operations"],
      "targetCompanySize": ["startup", "small"],
      "searchKeywords": {
        "en": ["keyword1", "keyword2", "keyword3"],
        "local": {
          "Japan": ["キーワード1", "キーワード2"],
          "China": ["关键词1", "关键词2"]
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
    "notes": "Notes on country-specific details or search strategy (in Korean)"
  }
}

Requirements:
- Generate EXACTLY 5 personas with company size targeting strategy:
  
  **Persona 1**: Similar-sized companies + Very specific/niche
    - targetCompanySize: [seller's size, one adjacent size]
    - Type: Very specific niche relevant to seller's product (High relevance, lower volume)
    - Example for "startup" seller: ["startup", "small"] + "Organic Vegan Lip Balm Distributor"
    
  **Persona 2**: Similar-sized companies + Specific
    - targetCompanySize: [seller's size, two adjacent sizes]
    - Type: Specific but slightly broader (High relevance, medium volume)
    - Example for "startup" seller: ["startup", "small", "medium"] + "Natural Cosmetics Distributor"
    
  **Persona 3**: Flexible size + Medium scope
    - targetCompanySize: [all sizes except extremely large if seller is small]
    - Type: Medium scope, good relevance (Good relevance, medium volume)
    - Example for "startup" seller: ["startup", "small", "medium", "large"] + "Cosmetics Wholesaler"
    
  **Persona 4**: All sizes + Broader scope
    - targetCompanySize: ["startup", "small", "medium", "large", "enterprise"]
    - Type: Broader industry category (Moderate relevance, high volume)
    - Example: "Beauty Products Distributor"
    
  **Persona 5**: All sizes + Very broad
    - targetCompanySize: ["startup", "small", "medium", "large", "enterprise"]
    - Type: Very broad, catch-all (Lower relevance, highest volume)
    - Example: "General Consumer Goods Importer"

- If target is B2B, focus on distributors/wholesalers/manufacturers. If B2C, focus on retailers/e-commerce.
- In 'searchKeywords.local', include only local language keywords for the target countries.
  (Japan: Japanese, China: Chinese, Southeast Asia: English, Europe: English, Middle East: English, USA: English)
- Output only JSON, no other text.`
}

// ============================================================================
// Phase 4: Scoring
// ============================================================================

/**
 * LLM 관련성 평가 프롬프트 (배치)
 */
export function buildBatchEvaluationPrompt(
  intelligence: BuyerIntelligence,
  companies: EnrichedCompany[],
  sellerSize: CompanySize,
): string {
  const personaTypes = intelligence.buyerPersonas.map((p) => p.typeKo).join(", ")
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
    "matchedPersona": "Matched persona type (Korean)",
    "reason": "Reason for suitability (briefly 1-2 sentences in Korean)"
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
 */
export function buildDescriptionPrompt(
  input: BuyerSearchInput,
  intelligence: BuyerIntelligence,
  buyer: ScoredCompany,
): string {
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

Explain why this buyer is a good candidate in 1-2 sentences in Korean.
Write concisely so that sales representatives can use it immediately.
Focus on the company's characteristics and potential for transaction.

Output only the explanation (no other text).`
}
