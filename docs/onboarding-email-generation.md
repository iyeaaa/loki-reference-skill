# 온보딩 이메일 생성 프로세스 분석

## 목차
1. [개요](#개요)
2. [전체 흐름](#전체-흐름)
3. [핵심 함수](#핵심-함수)
4. [AI 이메일 템플릿 생성 프롬프트](#ai-이메일-템플릿-생성-프롬프트)
5. [이메일 번역 프롬프트](#이메일-번역-프롬프트)
6. [2-Touch 이메일 시퀀스](#2-touch-이메일-시퀀스)
7. [변수 치환](#변수-치환)
8. [데이터 흐름](#데이터-흐름)

---

## 개요

온보딩 이메일 생성은 트라이얼 가입 시 자동으로 실행되며, AI를 사용하여 cold email 템플릿을 생성합니다.

### 관련 파일
| 파일 | 역할 |
|------|------|
| `ai-template-generation.service.ts` | AI 이메일 템플릿 생성 및 번역 |
| `onboarding.service.ts` | 온보딩 메인 로직 및 프리뷰 이메일 생성 |
| `onboarding-worker.service.ts` | BullMQ 백그라운드 워커 |

---

## 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    트라이얼 가입 시작                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Discovery (리드 발굴)                                  │
│  - BigQuery에서 리드 검색                                        │
│  - Hunter.io로 이메일 enrichment                                 │
│  - 목표: 20개 리드 (이메일 있는)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Group (고객 그룹 생성)                                  │
│  - 고객 그룹 생성                                                │
│  - 발굴된 리드 추가                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: Templates (AI 이메일 템플릿 생성)                       │
│  - OpenAI API (gpt-4.1-mini) 호출                               │
│  - 2-Touch 시퀀스 생성 (introduction + follow_up)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: Sequence (시퀀스 생성)                                  │
│  - 시퀀스 레코드 생성                                            │
│  - 시퀀스 스텝 생성 (Day 0, Day 3)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Previews (프리뷰 이메일 생성)                           │
│  - 리드별 × 스텝별 이메일 생성                                    │
│  - 리드 국가 기반 번역 (translateEmailTemplate)                   │
│  - 변수 치환 ({{company_name}} 등)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    온보딩 완료                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 핵심 함수

### 1. `generateEmailTemplate()`
**파일**: `ai-template-generation.service.ts:96`

AI를 사용하여 cold email 템플릿을 생성합니다.

```typescript
async generateEmailTemplate(options: GenerateTemplateOptions): Promise<GeneratedTemplate>
```

**파라미터**:
- `workspaceName`: 워크스페이스(회사) 이름
- `workspaceDescription`: 회사 설명 (선택)
- `country`: 타겟 국가
- `userPrompt`: 이메일 유형별 프롬프트
- `model`: OpenAI 모델 (기본: `gpt-4.1-mini`)
- `temperature`: 생성 다양성 (기본: `0.7`)

**반환값**:
```typescript
{
  subject: string      // 이메일 제목
  bodyText: string     // 본문 (텍스트)
  bodyHtml: string     // 본문 (HTML)
  detectedLanguage?: string  // 감지된 언어
}
```

### 2. `translateEmailTemplate()`
**파일**: `ai-template-generation.service.ts:525`

이메일을 타겟 언어로 번역합니다.

```typescript
async translateEmailTemplate(options: {
  subject: string
  bodyText: string
  bodyHtml: string | null
  targetLanguage: string  // "Japanese", "Korean", "English" 등
  model?: string
  temperature?: number
}): Promise<GeneratedTemplate>
```

### 3. `generatePreviewEmailsForSequence()`
**파일**: `onboarding.service.ts:831`

리드별 × 스텝별 프리뷰 이메일을 생성합니다.

```typescript
async generatePreviewEmailsForSequence(
  workspaceId: string,
  userEmailAccountId: string,
  fromEmail: string,
  sequenceId: string,
  stepTemplates: Array<StepTemplate>,
  leadDetails: Array<LeadDetail>,
  onProgress?: (generated: number, total: number) => Promise<void>,
  baseLanguage?: string
): Promise<number>
```

### 4. `autoGenerateOnboarding()`
**파일**: `onboarding.service.ts:1480`

트라이얼 가입 후 자동으로 온보딩 콘텐츠를 생성합니다.

### 5. `runTemplatesPhase()`
**파일**: `onboarding-worker.service.ts:647`

BullMQ 워커에서 템플릿 생성 페이즈를 실행합니다.

---

## AI 이메일 템플릿 생성 프롬프트

### System Prompt (전체)

**파일**: `ai-template-generation.service.ts:164-295`

```
You are a world-class cold email strategist who has personally written emails that generated $50M+ in pipeline for B2B companies.

Your philosophy: "The best cold email doesn't feel cold. It feels like someone did their homework."

═══════════════════════════════════════════════════════════════
WHO IS SENDING THIS EMAIL
═══════════════════════════════════════════════════════════════
Company: ${workspaceName}
${workspaceDescription ? `What we do (translate to ${isEnglishTarget ? "English" : `the primary language of ${country}`} if not already): ${workspaceDescription}` : ""}

═══════════════════════════════════════════════════════════════
TARGET AUDIENCE
═══════════════════════════════════════════════════════════════
- Region: ${country}
- Language: ${isEnglishTarget ? "English" : `Primary language of ${country}`}

═══════════════════════════════════════════════════════════════
THE 13-WORD RULE (Critical for Open Rates)
═══════════════════════════════════════════════════════════════
Email preview shows ~13 words. These determine if they open.

WINNING FIRST LINES:
✅ "Noticed {{company_name}} has been expanding into [specific market]..."
✅ "Quick question about {{company_name}}'s [specific initiative]..."
✅ "[Industry trend] is changing fast - wondering how {{company_name}} is adapting..."

INSTANT DELETE FIRST LINES:
❌ "I hope this email finds you well..."
❌ "My name is X and I work at Y..."
❌ "I'm reaching out because..."
❌ "We are a leading provider of..."

═══════════════════════════════════════════════════════════════
LANGUAGE RULES (CRITICAL - READ TWICE)
═══════════════════════════════════════════════════════════════
${targetLanguageInstruction}

⚠️ NEVER MIX LANGUAGES - This destroys credibility instantly.
- Writing in English? EVERYTHING in English
- Writing in Korean? EVERYTHING in Korean
- Writing in Japanese? EVERYTHING in Japanese

═══════════════════════════════════════════════════════════════
VARIABLES (Use These)
═══════════════════════════════════════════════════════════════
- {{company_name}} - Recipient's company (REQUIRED)
- {{contact_name}} - Recipient's name (SKIP - we often don't have it)

GREETING:
- English: "Hi there," or "Hello," (NOT "Hi {{contact_name}}")
- Korean: "안녕하세요," (NOT "{{담당자명}}님")
- NEVER: "Hi 담당자" (language mixing = amateur hour)

═══════════════════════════════════════════════════════════════
THE PERFECT COLD EMAIL STRUCTURE
═══════════════════════════════════════════════════════════════

LINE 1 - THE HOOK (Pattern Interrupt)
Show you did homework. Reference something specific about THEM.
"Noticed {{company_name}} just launched in [market]..."
"Saw {{company_name}}'s booth at [trade show]..."
"{{company_name}}'s expansion into [area] caught my eye..."

LINE 2-3 - THE BRIDGE (Relevant Insight)
Connect their situation to a relevant outcome. Use specifics.
"Many [similar companies] we work with faced [specific challenge]..."
"We helped [X companies] achieve [specific result] in [timeframe]..."

LINE 4 - THE ASK (Low-Friction CTA)
One simple question. No commitment.
"Worth a quick conversation?"
"Curious if this resonates?"
"Make sense to chat?"
NOT: "Would you be available for a 30-minute call next Tuesday at 3pm?"

═══════════════════════════════════════════════════════════════
WHAT MAKES EMAILS GET REPLIES (Data-Backed)
═══════════════════════════════════════════════════════════════
✅ One question: 50% more replies than multiple questions
✅ Personalized first line: 30%+ open rate increase
✅ Specific numbers: 2x more credible than vague claims
✅ "Quick question" in subject: 35% higher open rate

═══════════════════════════════════════════════════════════════
STRICT PROHIBITIONS
═══════════════════════════════════════════════════════════════
❌ Language mixing (kills trust instantly)
❌ Using Korean words in English emails (translate everything!)
❌ Copying company description in original language without translating
❌ "담당자", "귀사", "당사" in English emails
❌ "I hope this finds you well" (screams mass email)
❌ Signatures or placeholders like [Your Name]
❌ Multiple CTAs (confused = delete)
❌ Bullet points (feels like marketing, not conversation)
❌ Feature lists (nobody cares about features)
❌ Generic industry pain points (too obvious)
❌ "We are the leading provider of..." (nobody believes this)

═══════════════════════════════════════════════════════════════
EXAMPLES: BAD vs GOOD
═══════════════════════════════════════════════════════════════

❌ TERRIBLE (gets deleted):
"Hi 담당자, I hope this email finds you well. We are a leading provider of 기본 워크스페이스 solutions. Our platform helps streamline daily tasks. Would you like to schedule a call?"

✅ EXCELLENT (gets replies):
"Hi there,

Noticed {{company_name}} has been making waves in the Middle East fragrance market.

Many beauty distributors we've worked with struggled to find the right buyers when entering new regions. We helped 3 similar companies connect with 50+ qualified buyers in their first 90 days.

Worth a quick chat about your expansion plans?"

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (CRITICAL - MUST BE VALID JSON)
═══════════════════════════════════════════════════════════════
Respond ONLY with a valid JSON object. No other text before or after.
Use \n for line breaks within the body text.

{
  "language": "en",
  "subject": "your subject line here",
  "body": "First paragraph here.\n\nSecond paragraph here.\n\nClosing question?"
}

Example output:
{
  "language": "en",
  "subject": "quick question about {{company_name}}",
  "body": "Hi there,\n\nNoticed {{company_name}} has been making waves in the market.\n\nMany companies we work with faced similar challenges when scaling. We helped 3 similar businesses achieve 50% growth in 90 days.\n\nWorth a quick chat?"
}
```

### User Message Template

**파일**: `ai-template-generation.service.ts:297-309`

```
[USER REQUIREMENTS]
${userPrompt}

[TASK]
Write a cold email for prospects in "${country}".

REMEMBER:
- Language: ${isEnglishTarget ? "English ONLY - no Korean words" : `Primary language of ${country} ONLY`}
- Use {{company_name}} for company name (will be replaced with real data)
- Start with "Hi there," or "Hello," - do NOT use contact name variable
- End naturally - no signature needed
${workspaceDescription ? `- Company description to incorporate (TRANSLATE to ${isEnglishTarget ? "English" : `the primary language of ${country}`} first, then naturally weave into the email as a value proposition): "${workspaceDescription}"` : ""}
```

---

## 이메일 번역 프롬프트

### System Prompt

**파일**: `ai-template-generation.service.ts:560-581`

```
You are a professional translator specializing in business emails.
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
Use \n for line breaks within the body.

{
  "subject": "translated subject here",
  "body": "Translated body here.\n\nWith paragraphs."
}
```

### Placeholder 변환 규칙

```typescript
// 영어 타겟인 경우
{{회사명}} → {{company_name}}
{{담당자명}} → {{contact_name}}

// 한국어 타겟인 경우
{{company_name}} → {{회사명}}
{{contact_name}} → {{담당자명}}
```

---

## 2-Touch 이메일 시퀀스

**파일**: `onboarding.service.ts:1441-1458`

연구에 따르면:
- 첫 번째 후속 이메일은 응답률을 49-65.8% 높임
- 응답의 70%가 2-4번째 이메일에서 발생

### 시퀀스 구성

```typescript
export const EMAIL_TYPES_2TOUCH = [
  {
    type: "introduction",
    promptKr: "잠재 고객에게 보내는 첫 이메일을 작성해주세요. 짧고 간결하게(2-5문장) 고객의 핵심 문제점을 언급하고, 우리가 어떻게 도움을 줄 수 있는지 설명하세요. 부담 없는 다음 단계(예: 자료 확인, 짧은 통화)를 제안해주세요.",
    promptEn: "Write a brief introduction email (2-5 sentences) to a potential customer. Highlight a key pain point they likely face, briefly explain how you can help, and propose a low-commitment next step (e.g., viewing a resource, a quick 10-min call).",
    delayDays: 0,
  },
  {
    type: "follow_up",
    promptKr: "이전 이메일의 후속 메시지를 작성해주세요. 첫 이메일을 간략히 언급하고, 새로운 가치(성공 사례, 구체적 혜택, 또는 인사이트)를 추가하세요. 명확하고 시간이 정해진 행동 요청(예: '이번 주 10분 통화')으로 마무리해주세요.",
    promptEn: "Write a follow-up email referencing your previous outreach. Add new value (a success story, specific benefit, or insight) that wasn't in the first email. End with a clear, time-bound CTA (e.g., '10 minutes this week') to lower the commitment barrier.",
    delayDays: 3,
  },
]
```

| 순서 | 유형 | 발송 시점 | 목적 |
|------|------|----------|------|
| 1 | Introduction | Day 0 | 고객의 문제점 언급 + 저부담 CTA |
| 2 | Follow-up | Day 3 | 새로운 가치 제공 + 시간 제한 CTA |

---

## 변수 치환

### 지원 변수

**파일**: `onboarding.service.ts:746-811`

| 변수 | 설명 |
|------|------|
| `{{company_name}}` | 수신자 회사명 |
| `{{contact_name}}` | 수신자 이름 |
| `{{회사명}}` | 수신자 회사명 (한국어) |
| `{{담당자명}}` | 수신자 이름 (한국어) |
| `{{website}}` | 회사 웹사이트 |
| `{{country}}` | 국가 |

### 치환 함수

```typescript
function replaceVariables(
  template: string,
  lead: {
    companyName: string | null
    contactName?: string | null
    websiteUrl?: string | null
    country?: string | null
  },
  targetLanguage?: string,
): string
```

### 폴백 처리

- **회사명 없음**: 한국어면 "귀사", 영어면 "your company"
- **담당자명 없음**:
  - `Hi {{contact_name}},` → `Hi there,`
  - `안녕하세요 {{담당자명}}님,` → `안녕하세요,`

---

## 데이터 흐름

### 국가 → 언어 매핑

**파일**: `onboarding.service.ts:700-726`

```typescript
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  Japan: "Japanese",
  "United States": "English",
  "United Kingdom": "English",
  China: "Chinese",
  "South Korea": "Korean",
  Korea: "Korean",
  Germany: "German",
  France: "French",
  Spain: "Spanish",
  Italy: "Italian",
  Netherlands: "Dutch",
  Singapore: "English",
  "United Arab Emirates": "English",
  India: "English",
  Australia: "English",
  Canada: "English",
  Brazil: "Portuguese",
  Mexico: "Spanish",
  Taiwan: "Chinese",
  "Hong Kong": "Chinese",
  Vietnam: "Vietnamese",
  Thailand: "Thai",
  Indonesia: "Indonesian",
  Malaysia: "English",
  Philippines: "English",
}
```

### 국가 코드 → Apollo BigQuery 값 매핑

**파일**: `onboarding.service.ts:688-696`

```typescript
export const COUNTRY_NAMES: Record<string, string> = {
  jp: "Japan",
  us: "United States",
  sea: "Singapore",  // SEA 대표
  eu: "United Kingdom",  // EU 대표
  cn: "China",
  ae: "United Arab Emirates",
}
```

### 영어 타겟 국가

**파일**: `ai-template-generation.service.ts:136-155`

```typescript
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
  // 코드
  "ae", "us", "uk", "sg", "au", "ca", "in", "ph", "my",
]
```

---

## 워커 실행 흐름 상세

### BullMQ Job 처리

**파일**: `onboarding-worker.service.ts`

```typescript
// Phase 순서
1. runDiscoveryPhase()   // 리드 발굴 + enrichment
2. runGroupPhase()       // 고객 그룹 생성
3. runTemplatesPhase()   // AI 템플릿 생성
4. runSequencePhase()    // 시퀀스 생성
5. runPreviewsPhase()    // 프리뷰 이메일 생성
6. completeOnboarding()  // 완료 처리
```

### 체크포인트 상태

```typescript
interface CheckpointState {
  phase: "init" | "discovery" | "group" | "templates" | "sequence" | "previews" | "complete"
  leadsWithEmailsCount: number
  lastIterationCompleted: boolean
  customerGroupId?: string
  sequenceId?: string
  generatedTemplates?: Array<{
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string
  }>
  errors: Array<{
    phase: string
    message: string
    timestamp: string
  }>
}
```

---

## 주요 설정값

| 상수 | 값 | 설명 |
|------|---|------|
| `TARGET_LEADS` | 20 | 목표 리드 수 |
| `ENRICHMENT_BATCH_SIZE` | 20 | enrichment 배치 크기 |
| `BIGQUERY_BATCH_SIZE` | 100 | BigQuery 배치 크기 |
| `MAX_SEARCH_ITERATIONS` | 2 | 최대 검색 반복 횟수 |
| `TRIAL_PLACEHOLDER_EMAIL` | "trial@preview.local" | 이메일 없는 리드용 placeholder |

---

## API 사용

### OpenAI API

- **모델**: `gpt-4.1-mini`
- **Temperature**:
  - 템플릿 생성: `0.7` (다양성)
  - 번역: `0.3` (일관성)

### 외부 서비스

- **Hunter.io**: 이메일 발굴
- **BigQuery**: 리드 검색
- **Gemini**: 회사 분석 (enrichment)

---

## 에러 처리

각 페이즈에서 에러 발생 시:
1. 체크포인트에 에러 기록
2. SSE로 에러 이벤트 전송
3. DB에 알림 저장
4. 에러 throw

```typescript
catch (error) {
  console.error("[Phase] Error:", error)
  await addCheckpointError(job, "phase", String(error))
  await emitAndSaveNotification(
    createErrorEvent(workspaceId, jobId, String(error), "phase"),
    userId,
  )
  throw error
}
```
