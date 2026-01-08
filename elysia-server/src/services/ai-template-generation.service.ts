import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { parse } from "csv-parse/sync"
import logger from "../utils/logger"

interface GenerateTemplateOptions {
  workspaceName: string
  workspaceNameEn?: string
  workspaceDescription?: string
  country: string
  userPrompt: string
  model?: string
  temperature?: number
  // NEW: Sequence context for differentiated emails
  sequenceContext?: {
    stepNumber: number // 1, 2, 3
    totalSteps: number // e.g., 3
    stepType: "introduction" | "follow_up_1" | "follow_up_2"
    previousEmails?: Array<{
      stepNumber: number
      subject: string
      bodySummary: string // First 100 chars of body
    }>
  }
}

interface GeneratedTemplate {
  subject: string
  bodyText: string
  bodyHtml: string
  detectedLanguage?: string
}

interface EmailExample {
  company: string
  day: string
  subject: string
  content: string
}

class AITemplateGenerationService {
  private openai: ReturnType<typeof createOpenAI>
  private emailExamples: EmailExample[] = []

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
    this.loadEmailExamples()
  }

  /**
   * CSV 파일에서 이메일 예시 로드
   */
  private loadEmailExamples() {
    try {
      const csvPath = join(__dirname, "../../data/email-examples.csv")
      const csvContent = readFileSync(csvPath, "utf-8")

      // CSV 파싱 (csv-parse 라이브러리 사용)
      const records = parse(csvContent, {
        columns: true, // 첫 번째 행을 헤더로 사용
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        escape: '"',
        relax_column_count: true, // 컬럼 수가 다른 행 허용
      }) as Array<{
        Company: string
        Day: string
        Subject: string
        Content: string
      }>

      this.emailExamples = records
        .filter((record) => record.Company && record.Subject && record.Content)
        .map((record) => ({
          company: record.Company,
          day: record.Day,
          subject: record.Subject,
          content: record.Content,
        }))

      logger.info({ count: this.emailExamples.length }, "Email examples loaded from CSV")
    } catch (error) {
      logger.warn({ err: error }, "Failed to load email examples, continuing without examples")
      this.emailExamples = []
    }
  }

  /**
   * 랜덤으로 5개의 이메일 예시 선택
   */
  private getRandomExamples(count = 5): EmailExample[] {
    if (this.emailExamples.length === 0) {
      return []
    }

    const shuffled = [...this.emailExamples].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(count, this.emailExamples.length))
  }

  /**
   * AI를 사용하여 회사명의 언어 감지
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.openai("gpt-5-nano"),
        prompt: `Detect the language of this company name and respond with ONLY one word: English, Korean, Japanese, Chinese, German, French, Spanish, or Other.

Company name: "${text}"`,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })

      return result.text.trim()
    } catch (error) {
      console.error(`[AITemplate] Failed to detect language:`, error)
      // Fallback: assume English for latin characters, otherwise Other
      return /^[a-zA-Z0-9\s\-.,&()]+$/.test(text) ? "English" : "Other"
    }
  }

  /**
   * 시퀀스 컨텍스트 섹션 생성 - 각 스텝별 차별화된 이메일 생성을 위한 지침
   */
  private buildSequenceContextSection(
    context: NonNullable<GenerateTemplateOptions["sequenceContext"]>,
    isEnglishTarget: boolean,
  ): string {
    const { stepNumber, totalSteps, stepType, previousEmails } = context

    // 스텝별 전략 정의
    const stepStrategies = {
      introduction: {
        goal: isEnglishTarget
          ? "First contact - spark curiosity and establish relevance"
          : "첫 접촉 - 호기심 유발 및 관련성 확립",
        subjectStrategy: isEnglishTarget
          ? 'Question-based: "Quick question about {{company_name}}\'s [specific area]"'
          : '질문형: "{{company_name}}의 [특정 영역]에 대해 궁금한 점이 있어요"',
        tone: isEnglishTarget ? "Curious, observational, non-salesy" : "호기심, 관찰적, 비영업적",
        focus: isEnglishTarget
          ? "Reference something specific about THEM (not about you)"
          : "상대방에 대한 구체적인 언급 (우리 회사 이야기 X)",
        avoidSubjects: isEnglishTarget
          ? ['"Introduction to..."', '"Partnership opportunity"', '"[Company] + [Their Company]"']
          : ['"...를 소개합니다"', '"파트너십 제안"', '"[우리회사] + [상대회사]"'],
      },
      follow_up_1: {
        goal: isEnglishTarget
          ? "Add value - share a success story or insight they didn't have"
          : "가치 추가 - 성공 사례나 새로운 인사이트 공유",
        subjectStrategy: isEnglishTarget
          ? 'Value-add: "Thought this might help {{company_name}}" or "Re: [original subject]"'
          : '가치 제공형: "{{company_name}}에 도움이 될 것 같아요" 또는 "Re: [이전 제목]"',
        tone: isEnglishTarget
          ? "Helpful, specific, credible"
          : "도움을 주는, 구체적인, 신뢰할 수 있는",
        focus: isEnglishTarget
          ? "Share a relevant case study or specific benefit"
          : "관련 성공 사례나 구체적인 혜택 공유",
        avoidSubjects: isEnglishTarget
          ? ['"Following up"', '"Just checking in"', '"Touching base"']
          : ['"후속 연락드립니다"', '"안부 인사드립니다"', '"다시 연락드려요"'],
      },
      follow_up_2: {
        goal: isEnglishTarget
          ? "Create urgency - last chance, focus on what they're missing"
          : "긴급성 창출 - 마지막 기회, 놓치고 있는 것에 집중",
        subjectStrategy: isEnglishTarget
          ? 'Urgency-based: "Before I close your file" or "Last thought on [topic]"'
          : '긴급성형: "마지막으로 여쭤볼게요" 또는 "[주제]에 대한 마지막 생각"',
        tone: isEnglishTarget
          ? "Direct, respectful urgency, no pressure"
          : "직접적, 존중하는 긴급성, 압박 없이",
        focus: isEnglishTarget
          ? "1-2 specific values they're currently missing"
          : "현재 놓치고 있는 1-2가지 구체적인 가치",
        avoidSubjects: isEnglishTarget
          ? ['"Final follow-up"', '"Last chance"', '"Urgent"']
          : ['"마지막 연락"', '"마지막 기회"', '"긴급"'],
      },
    }

    const strategy = stepStrategies[stepType]

    // 이전 이메일 정보 섹션
    let previousEmailsSection = ""
    if (previousEmails && previousEmails.length > 0) {
      const prevEmailsList = previousEmails
        .map(
          (e) =>
            `  - Email ${e.stepNumber}: Subject: "${e.subject}" | Preview: "${e.bodySummary}..."`,
        )
        .join("\n")

      previousEmailsSection = isEnglishTarget
        ? `
⚠️ PREVIOUS EMAILS IN THIS SEQUENCE (DO NOT REPEAT):
${prevEmailsList}

CRITICAL: Your email MUST be COMPLETELY DIFFERENT from the above.
- Use a DIFFERENT subject line pattern
- Use a DIFFERENT opening hook
- Focus on a DIFFERENT angle/benefit`
        : `
⚠️ 이 시퀀스의 이전 이메일 (반복 금지):
${prevEmailsList}

중요: 위 이메일과 완전히 다르게 작성해야 합니다.
- 다른 제목 패턴 사용
- 다른 오프닝 훅 사용
- 다른 각도/혜택에 집중`
    }

    return `
═══════════════════════════════════════════════════════════════
📧 EMAIL SEQUENCE CONTEXT (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════
This is email ${stepNumber} of ${totalSteps} in a multi-touch sequence.
${isEnglishTarget ? "Each email MUST be distinctly different from others." : "각 이메일은 다른 이메일과 확실히 달라야 합니다."}

🎯 THIS EMAIL'S GOAL: ${strategy.goal}

📝 SUBJECT LINE STRATEGY: ${strategy.subjectStrategy}
❌ AVOID these subject patterns: ${strategy.avoidSubjects.join(", ")}

🎨 TONE: ${strategy.tone}
🔍 FOCUS: ${strategy.focus}
${previousEmailsSection}
`
  }

  /**
   * 회사명을 타겟 언어로 번역
   */
  async translateCompanyName(companyName: string, targetLanguage: string): Promise<string> {
    try {
      console.log(`[AITemplate] Translating company name: "${companyName}" to ${targetLanguage}`)

      const translationPrompt = `You are a professional translator specializing in company names and business terminology.

**Task**: Translate the company name to ${targetLanguage}, but ONLY if translation is needed.

**Company name**: "${companyName}"
**Target language**: ${targetLanguage}

**IMPORTANT - Follow these rules strictly**:

1. **Detect the source language** of the company name first.

2. **If the company name is ALREADY in ${targetLanguage}**, return it as-is without any changes.
   - Example: If target is English and name is "Apple Inc.", return "Apple Inc."
   - Example: If target is Japanese and name is "ソニー株式会社", return "ソニー株式会社"

3. **If multiple languages are mixed** (e.g., "Samsung Electronics 주식회사"), return the original name as-is.

4. **If translation is needed**, follow these guidelines:

   **To Japanese (日本語)**:
   - Convert business entity types: "Inc./Corp./Ltd./주식회사/㈜/有限公司" → "株式会社"
   - Transliterate company name to katakana (for foreign words) or use standard Japanese name
   - Examples:
     * "주식회사 거목" → "株式会社ゴモク"
     * "Apple Inc." → "アップル株式会社" (or just "アップル" if well-known)
     * "微软公司" → "マイクロソフト株式会社"

   **To English**:
   - Convert business entity types: "주식회사/㈜/株式会社/有限公司" → "Ltd." or "Co., Ltd." or "Corporation"
   - Romanize or use standard English name
   - Examples:
     * "주식회사 거목" → "Geomok Ltd."
     * "ソニー株式会社" → "Sony Corporation"
     * "阿里巴巴集团" → "Alibaba Group"

   **To Korean (한국어)**:
   - Convert business entity types: "Inc./Corp./Ltd./株式会社/有限公司" → "주식회사"
   - Transliterate company name to Hangul
   - Examples:
     * "Apple Inc." → "주식회사 애플"
     * "ソニー株式会社" → "주식회사 소니"

   **To Chinese (中文)**:
   - Convert business entity types: "Inc./Corp./Ltd./주식회사/㈜/株式会社" → "有限公司" or "公司"
   - Translate or transliterate to Chinese
   - Examples:
     * "주식회사 거목" → "巨木有限公司"
     * "Apple Inc." → "苹果公司"

   **To other languages**:
   - Adapt business entity format to local conventions
   - Transliterate or translate the company name appropriately

5. **For well-known brands** (e.g., Apple, Google, Samsung, Sony, Toyota), use the standard translation/transliteration for that brand in the target language.

6. **Maintain professional tone** and business naming conventions of the target language.

**Output**: Respond with ONLY the company name (translated or original), nothing else. No explanations, no quotes, no additional text.`

      const result = await generateText({
        model: this.openai("gpt-5-nano"),
        prompt: translationPrompt,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })

      const translatedName = result.text.trim()

      // If translation failed or returned empty, use original
      if (!translatedName || translatedName === companyName) {
        console.log(
          `[AITemplate] No translation needed or failed, using original: "${companyName}"`,
        )
        return companyName
      }

      console.log(`[AITemplate] Translated: "${companyName}" → "${translatedName}"`)
      return translatedName
    } catch (error) {
      console.error(`[AITemplate] Failed to translate company name:`, error)
      // Fallback: return original name
      return companyName
    }
  }

  /**
   * 여러 이메일 템플릿을 배치로 생성 (언어 감지/번역 1회, 병렬 생성)
   * 순차 생성 대비 3배 빠름
   */
  async generateEmailTemplatesBatch(options: {
    workspaceName: string
    workspaceNameEn?: string
    workspaceDescription?: string
    country: string
    emailConfigs: Array<{
      userPrompt: string
      stepNumber: number
      totalSteps: number
      stepType: "introduction" | "follow_up_1" | "follow_up_2"
    }>
    model?: string
    temperature?: number
  }): Promise<GeneratedTemplate[]> {
    const {
      workspaceName,
      workspaceNameEn,
      workspaceDescription,
      country,
      emailConfigs,
      model = "gpt-5.2",
      temperature: _temperature = 0.7,
    } = options

    console.log(
      `[AITemplate] Starting batch email template generation (${emailConfigs.length} templates)`,
    )
    console.log(`[AITemplate]   - workspace: ${workspaceName}`)
    console.log(`[AITemplate]   - country: ${country}`)
    console.log(`[AITemplate]   - model: ${model}`)

    try {
      // 1. 언어 감지 및 번역 (한 번만 수행)
      const isMultipleCountries = country.includes(",")
      const countryLower = country.toLowerCase()

      // 영어권 국가 및 지역 (동남아시아, 동아시아 등 지역명 포함)
      const englishCountries = [
        "United States",
        "United Kingdom",
        "Singapore",
        "United Arab Emirates",
        "Australia",
        "Canada",
        "India",
        "Philippines",
        "Malaysia",
        "Vietnam",
        "Thailand",
        "Indonesia",
        "ae",
        "us",
        "uk",
        "sg",
        "au",
        "ca",
        "in",
        "ph",
        "my",
        "vn",
        "th",
        "id",
      ]

      // 지역명 (영어로 처리)
      const englishRegions = [
        "southeast asia",
        "south east asia",
        "east asia",
        "south asia",
        "middle east",
        "europe",
        "africa",
        "latin america",
        "north america",
      ]

      const isEnglishRegion = englishRegions.some((region) => countryLower.includes(region))
      // 정확한 매칭 사용 (부분 문자열 매칭 방지: "china"에 "in"이 포함되는 문제)
      const isEnglishCountry = englishCountries.some(
        (c) =>
          countryLower === c.toLowerCase() ||
          countryLower.startsWith(`${c.toLowerCase()} `) ||
          countryLower.endsWith(` ${c.toLowerCase()}`),
      )
      const isEnglishTarget = isMultipleCountries || isEnglishRegion || isEnglishCountry

      console.log(`[AITemplate] Language detection for country "${country}":`)
      console.log(`[AITemplate]   - countryLower: "${countryLower}"`)
      console.log(`[AITemplate]   - isMultipleCountries: ${isMultipleCountries}`)
      console.log(`[AITemplate]   - isEnglishRegion: ${isEnglishRegion}`)
      console.log(`[AITemplate]   - isEnglishCountry: ${isEnglishCountry}`)
      console.log(`[AITemplate]   - isEnglishTarget: ${isEnglishTarget}`)

      const targetLanguage = isEnglishTarget
        ? "English"
        : countryLower.includes("japan") || countryLower === "jp"
          ? "Japanese"
          : countryLower.includes("china") || countryLower === "cn"
            ? "Chinese"
            : countryLower === "kr" || countryLower === "korea"
              ? "Korean"
              : "English" // fallback to English

      console.log(`[AITemplate]   ➜ targetLanguage: ${targetLanguage}`)

      // 회사명 언어 감지 (1회)
      const companyNameLang = await this.detectLanguage(workspaceName)
      console.log(`[AITemplate] Detected language for "${workspaceName}": ${companyNameLang}`)

      // 회사명 번역 (1회)
      let finalCompanyName: string
      const needsTranslation = companyNameLang !== targetLanguage

      if (!needsTranslation) {
        finalCompanyName = workspaceName
        console.log(
          `[AITemplate] Language matches target (${targetLanguage}), using original name: "${workspaceName}"`,
        )
      } else if (workspaceNameEn) {
        finalCompanyName = workspaceNameEn
        console.log(`[AITemplate] Using English company name as fallback: "${workspaceNameEn}"`)
      } else {
        finalCompanyName = await this.translateCompanyName(workspaceName, targetLanguage)
        console.log(
          `[AITemplate] Translated company name: "${workspaceName}" → "${finalCompanyName}"`,
        )
      }

      // 2. 랜덤 예시 선택 (공통)
      const examples = this.getRandomExamples(3)
      const examplesText =
        examples.length > 0
          ? examples
              .map(
                (ex, idx) => `
Example ${idx + 1} (${ex.company}):
Subject: ${ex.subject}
Body: ${ex.content}
`,
              )
              .join("\n")
          : ""

      // 3. 병렬로 모든 템플릿 생성
      console.log(`[AITemplate] Generating ${emailConfigs.length} templates in parallel...`)
      const startTime = Date.now()

      const templatePromises = emailConfigs.map(async (config) => {
        // 각 템플릿에 대한 시퀀스 컨텍스트 생성
        const sequenceContext = {
          stepNumber: config.stepNumber,
          totalSteps: config.totalSteps,
          stepType: config.stepType,
          // 이전 이메일은 순차 생성이 아니므로 제공 안 함 (병렬 생성)
          previousEmails: undefined,
        }

        const sequenceSection = this.buildSequenceContextSection(sequenceContext, isEnglishTarget)

        const targetLanguageInstruction = isEnglishTarget
          ? "Write the ENTIRE email in English. Do NOT mix languages."
          : `Write the email in the primary language of "${country}". Keep it consistent - do NOT mix languages.`

        const systemPrompt = `You are an expert cold email writer. Write concise, personalized B2B emails that get replies.

CONTEXT:
Company: ${finalCompanyName}
${workspaceDescription ? `Description (translate to target language): ${workspaceDescription}` : ""}
Target Region: ${country}
Language: ${isEnglishTarget ? "English ONLY" : `Primary language of ${country} ONLY`}
${sequenceSection}

CRITICAL RULES:
1. LANGUAGE: ${targetLanguageInstruction} NO mixing languages (e.g., no Korean in English emails).
2. VARIABLES: Use {{company_name}} for recipient company. Start with "Hi there," or "Hello," (no contact name).
3. STRUCTURE:
   - Hook (13 words): Personalized opener about THEM
   - Bridge: Connect their situation to value (NO fabricated stats/numbers)
   - Ask: One simple question, low-friction CTA

AVOID:
❌ "I hope this finds you well" / generic openers
❌ Language mixing (e.g., "Hi 담당자" in English)
❌ Multiple CTAs, bullet points, feature lists
❌ Signatures, "We are a leading provider", fabricated numbers
❌ Translating company description literally without adapting

GOOD EXAMPLE:
"Hi there,

Noticed {{company_name}} expanding into [specific market].

Many similar companies struggled with [challenge]. We've helped businesses like yours build [outcome] and accelerate [result].

Worth a quick chat?"
${
  examplesText
    ? `
REFERENCE EXAMPLES (learn tone/structure, don't copy):
${examplesText}
`
    : ""
}

OUTPUT (JSON only):
{
  "language": "en",
  "subject": "concise subject with {{company_name}}",
  "body": "Hook here.\\n\\nBridge here.\\n\\nAsk here?"
}`

        const userMessage = `Write a cold email for prospects in "${country}".

Requirements: ${config.userPrompt}

Key points:
- Use {{company_name}} variable
- Start with "Hi there," or "Hello,"
- No signature
${workspaceDescription ? `- Naturally incorporate company value proposition (translate first if needed)` : ""}`

        const { text } = await generateText({
          model: this.openai(model),
          system: systemPrompt,
          prompt: userMessage,
          providerOptions: {
            openai: {
              reasoningEffort: "medium",
            },
          },
        })

        return this.parseAIResponse(text)
      })

      const templates = await Promise.all(templatePromises)

      const elapsed = Date.now() - startTime
      console.log(
        `[AITemplate] ✅ Batch generation complete: ${templates.length} templates in ${elapsed}ms`,
      )

      return templates
    } catch (error) {
      console.error(`[AITemplate] ❌ Batch template generation failed:`, error)
      logger.error(
        { err: error, country: options.country, workspaceName: options.workspaceName },
        "AI batch template generation failed",
      )
      throw error
    }
  }

  /**
   * 국가 정보로부터 언어 감지 및 이메일 템플릿 생성
   */
  async generateEmailTemplate(options: GenerateTemplateOptions): Promise<GeneratedTemplate> {
    const {
      workspaceName,
      workspaceNameEn,
      workspaceDescription,
      country,
      userPrompt,
      model = "gpt-5-mini",
      temperature: _temperature = 0.7,
      sequenceContext,
    } = options

    console.log(`[AITemplate] Starting email template generation`)
    console.log(`[AITemplate]   - workspace: ${workspaceName}`)
    console.log(`[AITemplate]   - country: ${country}`)
    console.log(`[AITemplate]   - model: ${model}`)
    if (sequenceContext) {
      console.log(
        `[AITemplate]   - step: ${sequenceContext.stepNumber}/${sequenceContext.totalSteps} (${sequenceContext.stepType})`,
      )
    }

    try {
      // 1. 랜덤 예시 2개만 선택 (최적화: 5개 → 3개)
      const examples = this.getRandomExamples(3)
      console.log(`[AITemplate] Selected ${examples.length} random email examples`)
      const examplesText =
        examples.length > 0
          ? examples
              .map(
                (ex, idx) => `
Example ${idx + 1} (${ex.company}):
Subject: ${ex.subject}
Body: ${ex.content}
`,
              )
              .join("\n")
          : ""

      // 2. 시스템 프롬프트 구성
      // 국가가 여러 개인 경우 (comma로 구분) 영어로 고정
      const isMultipleCountries = country.includes(",")
      const countryLower = country.toLowerCase()

      // 영어권 국가 및 지역 (동남아시아, 동아시아 등 지역명 포함)
      const englishCountries = [
        "United States",
        "United Kingdom",
        "Singapore",
        "United Arab Emirates",
        "Australia",
        "Canada",
        "India",
        "Philippines",
        "Malaysia",
        "Vietnam",
        "Thailand",
        "Indonesia",
        "ae",
        "us",
        "uk",
        "sg",
        "au",
        "ca",
        "in",
        "ph",
        "my",
        "vn",
        "th",
        "id",
      ]

      // 지역명 (영어로 처리)
      const englishRegions = [
        "southeast asia",
        "south east asia",
        "east asia",
        "south asia",
        "middle east",
        "europe",
        "africa",
        "latin america",
        "north america",
      ]

      const isEnglishRegion = englishRegions.some((region) => countryLower.includes(region))
      // 정확한 매칭 사용 (부분 문자열 매칭 방지: "china"에 "in"이 포함되는 문제)
      const isEnglishCountry = englishCountries.some(
        (c) =>
          countryLower === c.toLowerCase() ||
          countryLower.startsWith(`${c.toLowerCase()} `) ||
          countryLower.endsWith(` ${c.toLowerCase()}`),
      )
      const isEnglishTarget = isMultipleCountries || isEnglishRegion || isEnglishCountry

      console.log(`[AITemplate] Language detection for individual email "${country}":`)
      console.log(`[AITemplate]   - countryLower: "${countryLower}"`)
      console.log(`[AITemplate]   - isMultipleCountries: ${isMultipleCountries}`)
      console.log(`[AITemplate]   - isEnglishRegion: ${isEnglishRegion}`)
      console.log(`[AITemplate]   - isEnglishCountry: ${isEnglishCountry}`)
      console.log(`[AITemplate]   - isEnglishTarget: ${isEnglishTarget}`)

      const targetLanguageInstruction = isEnglishTarget
        ? "Write the ENTIRE email in English. Do NOT mix languages."
        : `Write the email in the primary language of "${country}". Keep it consistent - do NOT mix languages.`

      // 3. 회사명 언어 감지 및 선택 로직
      const targetLanguage = isEnglishTarget
        ? "English"
        : countryLower.includes("japan") || countryLower === "jp"
          ? "Japanese"
          : countryLower.includes("china") || countryLower === "cn"
            ? "Chinese"
            : countryLower === "kr" || countryLower === "korea"
              ? "Korean"
              : "English" // fallback to English

      console.log(`[AITemplate]   ➜ targetLanguage: ${targetLanguage}`)

      // 3-1. companyName의 언어 감지
      const companyNameLang = await this.detectLanguage(workspaceName)
      console.log(`[AITemplate] Detected language for "${workspaceName}": ${companyNameLang}`)

      // 3-2. 타겟 언어와 비교하여 회사명 결정
      let finalCompanyName: string
      const needsTranslation = companyNameLang !== targetLanguage

      if (!needsTranslation) {
        // 언어가 같으면 원본 사용
        finalCompanyName = workspaceName
        console.log(
          `[AITemplate] Language matches target (${targetLanguage}), using original name: "${workspaceName}"`,
        )
      } else if (workspaceNameEn) {
        // 다르고 영어 회사명이 있으면 사용
        finalCompanyName = workspaceNameEn
        console.log(`[AITemplate] Using English company name as fallback: "${workspaceNameEn}"`)
      } else {
        // 없으면 번역
        finalCompanyName = await this.translateCompanyName(workspaceName, targetLanguage)
        console.log(
          `[AITemplate] Translated company name: "${workspaceName}" → "${finalCompanyName}"`,
        )
      }

      const translatedWorkspaceName = finalCompanyName

      // Build sequence context section if provided
      const sequenceSection = sequenceContext
        ? this.buildSequenceContextSection(sequenceContext, isEnglishTarget)
        : ""

      const systemPrompt = `You are an expert cold email writer. Write concise, personalized B2B emails that get replies.

CONTEXT:
Company: ${translatedWorkspaceName}
${workspaceDescription ? `Description (translate to target language): ${workspaceDescription}` : ""}
Target Region: ${country}
Language: ${isEnglishTarget ? "English ONLY" : `Primary language of ${country} ONLY`}
${sequenceSection}

CRITICAL RULES:
1. LANGUAGE: ${targetLanguageInstruction} NO mixing languages (e.g., no Korean in English emails).
2. VARIABLES: Use {{company_name}} for recipient company. Start with "Hi there," or "Hello," (no contact name).
3. STRUCTURE:
   - Hook (13 words): Personalized opener about THEM
   - Bridge: Connect their situation to value (NO fabricated stats/numbers)
   - Ask: One simple question, low-friction CTA

AVOID:
❌ "I hope this finds you well" / generic openers
❌ Language mixing (e.g., "Hi 담당자" in English)
❌ Multiple CTAs, bullet points, feature lists
❌ Signatures, "We are a leading provider", fabricated numbers
❌ Translating company description literally without adapting

GOOD EXAMPLE:
"Hi there,

Noticed {{company_name}} expanding into [specific market].

Many similar companies struggled with [challenge]. We've helped businesses like yours build [outcome] and accelerate [result].

Worth a quick chat?"
${
  examplesText
    ? `
REFERENCE EXAMPLES (learn tone/structure, don't copy):
${examplesText}
`
    : ""
}

OUTPUT (JSON only):
{
  "language": "en",
  "subject": "concise subject with {{company_name}}",
  "body": "Hook here.\\n\\nBridge here.\\n\\nAsk here?"
}`

      const userMessage = `Write a cold email for prospects in "${country}".

Requirements: ${userPrompt}

Key points:
- Use {{company_name}} variable
- Start with "Hi there," or "Hello,"
- No signature
${workspaceDescription ? `- Naturally incorporate company value proposition (translate first if needed)` : ""}`

      // 2. AI API 호출
      console.log(`[AITemplate] Calling OpenAI API...`)
      const startTime = Date.now()
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        // temperature,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })
      const elapsed = Date.now() - startTime
      console.log(`[AITemplate] OpenAI API response received (${elapsed}ms)`)

      logger.info({ country, workspaceName }, "AI template generation successful")

      // 3. 응답 파싱
      console.log(`[AITemplate] Parsing AI response...`)
      const parsedTemplate = this.parseAIResponse(text)
      console.log(`[AITemplate] ✅ Template generated successfully`)
      console.log(`[AITemplate]   - subject: ${parsedTemplate.subject.substring(0, 50)}...`)
      console.log(`[AITemplate]   - language: ${parsedTemplate.detectedLanguage}`)
      console.log(`[AITemplate]   - bodyLength: ${parsedTemplate.bodyText.length} chars`)

      return parsedTemplate
    } catch (error) {
      console.error(`[AITemplate] ❌ Template generation failed:`, error)
      logger.error({ err: error, country, workspaceName }, "AI template generation failed")
      throw error
    }
  }

  /**
   * AI 응답에서 언어, 제목, 본문 파싱
   * JSON 형식 우선, 실패 시 텍스트 파싱 폴백
   */
  private parseAIResponse(response: string): GeneratedTemplate {
    const trimmedResponse = response.trim()

    // 1단계: JSON 파싱 시도 (우선)
    const jsonResult = this.tryParseJson(trimmedResponse)
    if (jsonResult) {
      console.log(
        `[AITemplate] ✅ JSON parsed - subject: "${jsonResult.subject.substring(0, 50)}", body: ${jsonResult.bodyText.length} chars`,
      )
      return jsonResult
    }

    // 2단계: JSON 파싱 실패 시 텍스트 기반 파싱 (레거시 폴백)
    console.warn("[AITemplate] ⚠️ JSON parsing failed, falling back to text parsing")
    return this.parseTextResponse(trimmedResponse)
  }

  /**
   * JSON 형식 응답 파싱 시도
   */
  private tryParseJson(response: string): GeneratedTemplate | null {
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      let jsonStr = response

      // 마크다운 코드 블록 제거
      const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonBlockMatch?.[1]) {
        jsonStr = jsonBlockMatch[1].trim()
      }

      // { } 로 감싸진 부분만 추출
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return null
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        language?: string
        subject?: string
        body?: string
      }

      // 필수 필드 검증
      if (!parsed.subject || !parsed.body) {
        console.warn("[AITemplate] JSON parsed but missing required fields")
        return null
      }

      const bodyText = parsed.body.trim()
      const bodyHtml = this.convertTextToHtml(bodyText)

      return {
        subject: parsed.subject.trim(),
        bodyText,
        bodyHtml,
        detectedLanguage: parsed.language || "en",
      }
    } catch {
      // JSON 파싱 실패 - 무시하고 텍스트 파싱으로 폴백
      return null
    }
  }

  /**
   * 텍스트 기반 응답 파싱 (레거시 형식 지원)
   */
  private parseTextResponse(response: string): GeneratedTemplate {
    // LANGUAGE: / SUBJECT: / BODY: 마커 기반 파싱
    const languageMatch = response.match(/^LANGUAGE:\s*(.+?)$/im)
    const subjectMatch = response.match(/^SUBJECT:\s*(.+?)$/im)
    const bodyMatch = response.match(/^BODY:\s*([\s\S]*)$/im)

    const language = languageMatch?.[1]?.trim() || "en"
    let subject = subjectMatch?.[1]?.trim() || ""
    let bodyText = bodyMatch?.[1]?.trim() || ""

    // BODY: 마커 이후 텍스트 추출 (정규식 실패 시)
    if (!bodyText && response.includes("BODY:")) {
      const bodyIndex = response.indexOf("BODY:")
      bodyText = response.substring(bodyIndex + "BODY:".length).trim()
    }

    // 마커 없는 경우: 첫 줄을 제목으로, 나머지를 본문으로
    if (!subject && !bodyText) {
      const lines = response.split("\n").filter((line) => line.trim())
      if (lines.length > 0) {
        const firstLine = lines[0]?.trim() || ""
        const isGreeting = /^(hi|hello|hey|dear|안녕하세요|안녕)/i.test(firstLine)

        if (isGreeting) {
          subject = "Quick question"
          bodyText = lines.join("\n").trim()
        } else {
          subject = firstLine
          bodyText = lines.slice(1).join("\n").trim()
        }
      }
    }

    // 본문이 비어있으면 마커 제외한 모든 내용 사용
    if (subject && !bodyText) {
      const contentLines = response.split("\n").filter((line) => {
        const trimmed = line.trim()
        return (
          trimmed &&
          !trimmed.startsWith("LANGUAGE:") &&
          !trimmed.startsWith("SUBJECT:") &&
          !trimmed.startsWith("BODY:")
        )
      })
      if (contentLines.length > 0) {
        bodyText = contentLines.join("\n").trim()
      }
    }

    // 최후의 폴백
    if (!bodyText) {
      console.error("[AITemplate] ❌ Empty body - using fallback")
      console.error(`[AITemplate] Raw: ${response.substring(0, 200)}...`)
      bodyText =
        "Hi there,\n\nI noticed {{company_name}} and thought there might be an opportunity to connect.\n\nWorth a quick conversation?"
    }

    if (!subject) {
      subject = "Quick question"
    }

    console.log(
      `[AITemplate] Text parsed - subject: "${subject.substring(0, 50)}", body: ${bodyText.length} chars`,
    )

    return {
      subject,
      bodyText,
      bodyHtml: this.convertTextToHtml(bodyText),
      detectedLanguage: language,
    }
  }

  /**
   * 텍스트를 HTML로 변환
   */
  private convertTextToHtml(text: string): string {
    return text
      .split("\n\n")
      .map((para) => {
        // 빈 단락 스킵
        if (!para.trim()) return ""

        // 리스트 항목 처리
        if (para.includes("\n-") || para.includes("\n•") || para.includes("\n*")) {
          const listItems = para
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              if (
                line.trim().startsWith("-") ||
                line.trim().startsWith("•") ||
                line.trim().startsWith("*")
              ) {
                return `<li>${line.trim().substring(1).trim()}</li>`
              }
              return `<p>${line}</p>`
            })
            .join("\n")
          return `<ul>\n${listItems}\n</ul>`
        }

        // 일반 단락
        return `<p>${para.replace(/\n/g, "<br>")}</p>`
      })
      .filter((para) => para)
      .join("\n")
  }

  /**
   * AI를 사용하여 기존 이메일을 사용자 프롬프트에 따라 편집
   */
  async editEmailWithAI(options: {
    subject: string
    bodyText: string
    editPrompt: string
    targetLanguage?: string // e.g., "Korean", "English", "Japanese"
    model?: string
    temperature?: number
  }): Promise<GeneratedTemplate> {
    const {
      subject,
      bodyText,
      editPrompt,
      targetLanguage = "English",
      model = "gpt-5-mini",
      // temperature = 0.7,
    } = options

    console.log(`[AITemplate] Editing email with AI prompt: "${editPrompt.substring(0, 50)}..."`)

    try {
      const systemPrompt = `You are an expert email editor. Modify the given email according to the user's instructions.

CRITICAL RULES:
1. Keep the original structure and format unless asked to change it
2. Maintain the same language (${targetLanguage}) throughout
3. Preserve placeholders like {{company_name}}, {{contact_name}}, {{country}} exactly as they are
4. Keep the email professional and concise
5. Do NOT add signatures unless asked
6. Do NOT change the core message unless specifically requested

OUTPUT FORMAT (CRITICAL - MUST BE VALID JSON):
Respond ONLY with a valid JSON object. No other text.
Use \\n for line breaks within the body.

{
  "subject": "modified subject here",
  "body": "Modified body here.\\n\\nWith paragraphs."
}`

      const userMessage = `Edit this email according to the following instruction:

EDIT INSTRUCTION: ${editPrompt}

ORIGINAL EMAIL:
Subject: ${subject}
Body:
${bodyText}

Apply the edit instruction and return the modified email in JSON format.`

      const startTime = Date.now()
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        // temperature,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })
      const elapsed = Date.now() - startTime
      console.log(`[AITemplate] Email edit completed (${elapsed}ms)`)

      // Parse JSON response
      const jsonResult = this.tryParseJson(text)
      if (jsonResult) {
        console.log(`[AITemplate] ✅ Email edited successfully`)
        return jsonResult
      }

      // Fallback to text parsing
      console.warn(`[AITemplate] ⚠️ JSON parsing failed, using original email`)
      return {
        subject,
        bodyText,
        bodyHtml: this.convertTextToHtml(bodyText),
        detectedLanguage: targetLanguage.toLowerCase().substring(0, 2),
      }
    } catch (error) {
      console.error(`[AITemplate] ❌ Email edit failed:`, error)
      throw error
    }
  }

  /**
   * 이메일 템플릿을 특정 언어로 번역
   * 리드의 국가에 맞게 이메일을 번역할 때 사용
   */
  async translateEmailTemplate(options: {
    subject: string
    bodyText: string
    bodyHtml: string | null
    targetLanguage: string // e.g., "Japanese", "Korean", "Chinese", "English"
    model?: string
    temperature?: number
  }): Promise<GeneratedTemplate> {
    const { subject, bodyText, bodyHtml: _bodyHtml, targetLanguage, model = "gpt-5-mini" } = options

    console.log(`[AITemplate] Translating email to ${targetLanguage}`)

    // Determine if target is English (for placeholder mapping and language validation)
    const isEnglishTarget = targetLanguage === "English"
    const isKoreanTarget = targetLanguage === "Korean"

    // Placeholder mapping instructions
    const placeholderInstruction = isEnglishTarget
      ? `Convert Korean placeholders to English:
   - {{회사명}} → {{company_name}}
   - {{담당자명}} → {{contact_name}}`
      : isKoreanTarget
        ? `Convert English placeholders to Korean:
   - {{company_name}} → {{회사명}}
   - {{contact_name}} → {{담당자명}}`
        : `Keep placeholders as {{company_name}} and {{contact_name}}`

    try {
      const systemPrompt = `You are a professional translator specializing in business emails.
Translate the following email to ${targetLanguage}.

CRITICAL RULES:
1. Keep the same tone and style as the original
2. ${placeholderInstruction}
3. Make the translation sound natural, not literal
4. Keep the email concise and professional
5. ⚠️ NEVER MIX LANGUAGES - Write EVERYTHING in ${targetLanguage}
   - Do NOT keep any words from the original language
   - Translate ALL content including greetings and closings
   ${isEnglishTarget ? '- Use "Hi there," or "Hello," for greetings (NOT Korean greetings)' : ""}
   ${isKoreanTarget ? '- Use "안녕하세요," for greetings (NOT English greetings)' : ""}

OUTPUT FORMAT (CRITICAL - MUST BE VALID JSON):
Respond ONLY with a valid JSON object. No other text.
Use \\n for line breaks within the body.

{
  "subject": "translated subject here",
  "body": "Translated body here.\\n\\nWith paragraphs."
}`

      const userMessage = `Translate this email to ${targetLanguage}:

SUBJECT: ${subject}

BODY:
${bodyText}`

      const startTime = Date.now()
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        // temperature,
        providerOptions: {
          openai: {
            reasoningEffort: "minimal",
          },
        },
      })
      const elapsed = Date.now() - startTime
      console.log(`[AITemplate] Translation completed (${elapsed}ms)`)

      // JSON 파싱 시도
      let translatedSubject: string | null = null
      let translatedBodyText: string | null = null

      const jsonResult = this.tryParseJson(text)
      if (jsonResult) {
        translatedSubject = jsonResult.subject
        translatedBodyText = jsonResult.bodyText
        console.log(`[AITemplate] ✅ Translation JSON parsed successfully`)
      } else {
        // 레거시 텍스트 파싱 폴백
        console.warn("[AITemplate] ⚠️ Translation JSON parsing failed, trying text parsing")
        const lines = text.trim().split("\n")
        const translatedBodyLines: string[] = []
        let inBody = false

        for (const line of lines) {
          if (line.startsWith("SUBJECT:")) {
            translatedSubject = line.substring("SUBJECT:".length).trim()
          } else if (line.startsWith("BODY:")) {
            inBody = true
          } else if (inBody) {
            translatedBodyLines.push(line)
          }
        }

        if (translatedBodyLines.length > 0) {
          translatedBodyText = translatedBodyLines.join("\n").trim()
        }
      }

      // 번역 실패 검증: 본문이 비어있으면 에러로 처리
      // 잘못된 언어의 이메일이 발송되는 것을 방지
      if (!translatedBodyText || translatedBodyText.trim().length === 0) {
        const errorMsg = `Translation to ${targetLanguage} failed: empty body result`
        console.error(`[AITemplate] ❌ ${errorMsg}`)
        throw new Error(errorMsg)
      }

      // 제목이 비어있으면 원본 유지 (본문보다 덜 치명적)
      if (!translatedSubject || translatedSubject.trim().length === 0) {
        console.warn(`[AITemplate] ⚠️ Translation subject empty, using original`)
        translatedSubject = subject
      }

      // Post-process: Force placeholder conversion based on target language
      // This ensures placeholders are correct even if AI didn't convert them properly
      if (isEnglishTarget) {
        // Convert Korean placeholders to English
        translatedSubject = translatedSubject
          .replace(/\{\{회사명\}\}/g, "{{company_name}}")
          .replace(/\{\{담당자명\}\}/g, "{{contact_name}}")
        translatedBodyText = translatedBodyText
          .replace(/\{\{회사명\}\}/g, "{{company_name}}")
          .replace(/\{\{담당자명\}\}/g, "{{contact_name}}")
      } else if (isKoreanTarget) {
        // Convert English placeholders to Korean
        translatedSubject = translatedSubject
          .replace(/\{\{company_name\}\}/gi, "{{회사명}}")
          .replace(/\{\{contact_name\}\}/gi, "{{담당자명}}")
        translatedBodyText = translatedBodyText
          .replace(/\{\{company_name\}\}/gi, "{{회사명}}")
          .replace(/\{\{contact_name\}\}/gi, "{{담당자명}}")
      }

      // Generate HTML version
      const translatedBodyHtml = translatedBodyText
        .split("\n\n")
        .map((para) => {
          if (!para.trim()) return ""
          return `<p>${para.replace(/\n/g, "<br>")}</p>`
        })
        .filter((para) => para)
        .join("\n")

      // Map language name to language code
      const languageCodeMap: Record<string, string> = {
        Japanese: "ja",
        Korean: "ko",
        Chinese: "zh",
        English: "en",
        German: "de",
        French: "fr",
        Spanish: "es",
        Portuguese: "pt",
        Vietnamese: "vi",
        Thai: "th",
        Indonesian: "id",
      }

      console.log(
        `[AITemplate] ✅ Translation complete to ${targetLanguage} - subject: "${translatedSubject.substring(0, 50)}"`,
      )

      return {
        subject: translatedSubject,
        bodyText: translatedBodyText,
        bodyHtml: translatedBodyHtml,
        detectedLanguage: languageCodeMap[targetLanguage] || "en",
      }
    } catch (error) {
      console.error(`[AITemplate] Translation failed:`, error)
      throw error
    }
  }
}

// 싱글톤 인스턴스
let aiTemplateServiceInstance: AITemplateGenerationService | null = null

/**
 * AI 템플릿 생성 서비스 인스턴스 가져오기
 */
export function getAITemplateGenerationService(): AITemplateGenerationService {
  if (!aiTemplateServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다")
    }
    aiTemplateServiceInstance = new AITemplateGenerationService(apiKey)
  }
  return aiTemplateServiceInstance
}

export type { GenerateTemplateOptions, GeneratedTemplate }
export { AITemplateGenerationService }
