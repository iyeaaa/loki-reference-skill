import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import logger from "../utils/logger"

export interface EnhanceSuggestion {
  type: "product" | "strength" | "certification" | "experience" | "target"
  messageKo: string
  messageEn: string
  suggestionKo: string // AI-generated example text (Korean)
  suggestionEn: string // AI-generated example text (English)
}

interface AnalyzeDescriptionOptions {
  description: string
  industry?: string
  target?: string
  model?: string
}

class AIDescriptionEnhanceService {
  private openai: ReturnType<typeof createOpenAI>

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
  }

  /**
   * Analyze company description and suggest missing information
   * Returns empty array if description is complete
   */
  async analyzeCompanyDescription(
    options: AnalyzeDescriptionOptions,
  ): Promise<EnhanceSuggestion[]> {
    const { description, industry, target, model = "gpt-5-mini" } = options

    try {
      logger.info({
        msg: "AI description analysis started",
        descriptionLength: description.length,
        industry,
        target,
        model,
      })

      const prompt = this.buildAnalysisPrompt(description, industry, target)

      const { text } = await generateText({
        model: this.openai(model),
        prompt,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })

      const suggestions = this.parseSuggestions(text)

      logger.info({
        msg: "AI description analysis completed",
        suggestionsCount: suggestions.length,
        types: suggestions.map((s) => s.type),
      })

      return suggestions
    } catch (error) {
      logger.error({
        msg: "AI description analysis failed",
        error: error instanceof Error ? error.message : String(error),
      })

      // Return empty array on error (fail gracefully)
      return []
    }
  }

  /**
   * Build the analysis prompt based on ai-template-generation.service.ts requirements
   */
  private buildAnalysisPrompt(description: string, industry?: string, target?: string): string {
    return `You are an expert B2B cold email strategist. Your job: decide if this company description has ENOUGH information to write an effective cold email.

COMPANY DESCRIPTION:
"""
${description}
"""

${industry ? `INDUSTRY: ${industry}` : ""}
${target ? `TARGET CUSTOMER: ${target}` : ""}

---

WHAT MAKES A GOOD COLD EMAIL DESCRIPTION?
It needs enough specific details to create trust and interest. Think: "Can I write a compelling email with this?"

KEY ELEMENTS TO CHECK:
1. **PRODUCT/SERVICE** - What they actually sell
   ✅ "Coffee ground cat litter" / "선크림" / "Industrial valves"
   ❌ "Products" / "Solutions" (too vague)

2. **DIFFERENTIATION** - Why they're different/better
   ✅ "Patented technology" / "50% better performance" / "20 years experience"
   ❌ "High quality" / "Best in class" (everyone says this)

3. **CREDIBILITY** - Trust signals
   ✅ "ISO 9001" / "FDA certified" / "Export to 30 countries" / "Allergy tested"
   ❌ "Certified" / "Trusted" (by whom?)

---

EVALUATION CRITERIA:

✅ **SUFFICIENT (Return [])** - Ready for cold emails:
   - "커피 찌꺼기 고양이 모래 전문 기업 / 특허 냄새 제어 기술 / 타사보다 50% 성능 개선 / ISO 9001, 알러지 테스트 통과 / 제품명: 서현네코002"
     → Product ✓ + Tech differentiation ✓ + Performance claim ✓ + Certifications ✓ = EXCELLENT ✅
   
   - "K-beauty 화장품 / 비타민C 세럼, HA 크림 / FDA 인증, 비건"
     → Products ✓ + Certifications ✓ = GOOD ENOUGH ✅
   
   - "산업용 밸브 제조 / 20년 OEM 경험 / 30개국 수출"
     → Product ✓ + Experience ✓ + Track record ✓ = GOOD ✅

❌ **INSUFFICIENT (Suggest 1-2 improvements)** - Need more info:
   - "천연 성분 기반 선크림"
     → Only product + vague claim = TOO THIN ❌
   
   - "친환경 고양이 모래"
     → Product + generic claim = NEED MORE ❌
   
   - "화장품 제조업체"
     → Too vague = DEFINITELY NEED MORE ❌

---

DECISION RULES:
1. **Focus on "Can I write a good cold email?"** - Not "Is this a perfect company profile?"
2. **Be practical** - We don't need lab reports or patent numbers for cold emails
3. **3+ specific details = Usually sufficient**
4. **If description mentions concrete differentiators (patents, certifications, performance claims, experience) = Usually sufficient**
5. **ONLY suggest improvements if genuinely lacking for cold email purposes**

---

OUTPUT FORMAT (JSON only):

**If sufficient for cold emails:**
[]

**If need 1-2 key improvements:**
[
  {
    "type": "strength",
    "messageKo": "차별점(예: 성능, 탈취력, 가격, 친환경성 등)이나 특허·기술이 있다면 적어주세요. 차별화 요소가 있어야 관심을 끌기 쉽습니다.",
    "messageEn": "Add differentiation points (performance, features, price, eco-friendly) or patents/technology to attract more interest.",
    "suggestionKo": "차별화 포인트: 특허받은 냄새 억제 기술로 타사 대비 50% 성능 개선",
    "suggestionEn": "Differentiation: Patented odor control technology, 50% better than competitors"
  }
]

**IMPORTANT:** Each suggestion MUST include:
- type: "product" | "strength" | "certification" | "experience" | "target"
- messageKo: Korean explanation (why this info is needed)
- messageEn: English explanation
- suggestionKo: **Concrete example text in Korean** (1-2 lines) that user can directly add
- suggestionEn: **Concrete example text in English** (1-2 lines) that user can directly add

**Example Suggestions by Type:**

**product type:**
{
  "type": "product",
  "messageKo": "주력 제품명이나 모델명을 구체적으로 알려주세요. 제품명이 있어야 바이어가 쉽게 이해합니다.",
  "messageEn": "Add specific product names or model numbers for better buyer understanding.",
  "suggestionKo": "주력제품: 서현네코001 일반형 (입자크기 2~3mm, 5L/10L 포장)",
  "suggestionEn": "Main product: SeoHyun Neko001 Standard (particle size 2-3mm, 5L/10L packaging)"
}

**strength type:**
{
  "type": "strength",
  "messageKo": "차별점(예: 성능, 특허, 가격경쟁력)을 추가하면 관심을 끌기 쉽습니다.",
  "messageEn": "Add differentiation points (performance, patents, price advantage) to attract interest.",
  "suggestionKo": "차별화 포인트: 자사 특허 기술로 타사 대비 30% 성능 향상",
  "suggestionEn": "Differentiation: Proprietary patented technology with 30% better performance than competitors"
}

**certification type:**
{
  "type": "certification",
  "messageKo": "인증이나 자격증이 있다면 적어주세요. 신뢰도가 크게 올라갑니다.",
  "messageEn": "Add certifications or credentials to build trust with buyers.",
  "suggestionKo": "보유 인증: ISO 9001:2015, FDA 승인, 비건 인증",
  "suggestionEn": "Certifications: ISO 9001:2015, FDA approved, Vegan certified"
}

**experience type:**
{
  "type": "experience",
  "messageKo": "사업 경력이나 실적(예: OEM 경험, 수출 국가 수)을 추가하면 신뢰도가 올라갑니다.",
  "messageEn": "Add business track record (OEM experience, export countries) to build credibility.",
  "suggestionKo": "사업 실적: 15년 OEM 경험, 20개국 수출 중",
  "suggestionEn": "Track record: 15 years OEM experience, exporting to 20+ countries"
}

VALID TYPES: "product", "strength", "certification", "experience", "target"

**Remember:** 
- Be practical. If there's enough to write a compelling cold email, return []
- Generate realistic, helpful suggestion texts in BOTH Korean and English based on the company's industry/context`
  }

  /**
   * Parse AI response into structured suggestions
   */
  private parseSuggestions(text: string): EnhanceSuggestion[] {
    try {
      // Remove markdown code blocks if present
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()

      const parsed = JSON.parse(cleanedText)

      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        logger.warn({
          msg: "AI response is not an array",
          rawText: text,
        })
        return []
      }

      // Validate and filter suggestions
      const validTypes = ["product", "strength", "certification", "experience", "target"]
      const suggestions: EnhanceSuggestion[] = parsed
        .filter((item) => {
          return (
            item &&
            typeof item === "object" &&
            validTypes.includes(item.type) &&
            typeof item.messageKo === "string" &&
            typeof item.messageEn === "string" &&
            typeof item.suggestionKo === "string" &&
            typeof item.suggestionEn === "string" &&
            item.messageKo.length > 0 &&
            item.messageEn.length > 0 &&
            item.suggestionKo.length > 0 &&
            item.suggestionEn.length > 0
          )
        })
        .slice(0, 2) // Maximum 2 suggestions

      return suggestions
    } catch (error) {
      logger.error({
        msg: "Failed to parse AI suggestions",
        error: error instanceof Error ? error.message : String(error),
        rawText: text,
      })

      return []
    }
  }
}

// Singleton instance
let aiDescriptionEnhanceService: AIDescriptionEnhanceService | null = null

export function getAIDescriptionEnhanceService(): AIDescriptionEnhanceService {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set")
  }

  if (!aiDescriptionEnhanceService) {
    aiDescriptionEnhanceService = new AIDescriptionEnhanceService(apiKey)
    logger.info({
      msg: "AI Description Enhance Service initialized",
    })
  }

  return aiDescriptionEnhanceService
}

export default AIDescriptionEnhanceService
