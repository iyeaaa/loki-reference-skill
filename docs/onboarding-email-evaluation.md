# 온보딩 이메일 생성/번역 기능 평가 보고서

**평가일**: 2025-12-22
**평가 대상**: `ai-template-generation.service.ts`, `onboarding.service.ts`, `onboarding-worker.service.ts`

---

## 종합 평가 요약

| 항목 | 점수 | 등급 |
|------|------|------|
| AI 프롬프트 품질 | 85/100 | A |
| 번역 기능 | 72/100 | B |
| 변수 치환 | 78/100 | B+ |
| 에러 처리 | 70/100 | B |
| 국제화(i18n) | 65/100 | C+ |
| 아키텍처/코드 품질 | 80/100 | A- |
| 성능 최적화 | 75/100 | B+ |
| 보안 | 68/100 | C+ |
| 유지보수성 | 72/100 | B |
| 테스트 가능성 | 60/100 | C |
| **종합** | **72.5/100** | **B** |

---

## 1. AI 프롬프트 품질 (85/100) - A

### 장점

#### 1.1 체계적인 프롬프트 구조
```
✅ 역할 정의: "world-class cold email strategist"
✅ 명확한 컨텍스트 섹션 구분 (═══ 구분선 사용)
✅ 구체적인 예시 제공 (GOOD vs BAD)
✅ 엄격한 출력 형식 지정 (JSON)
```

#### 1.2 Cold Email 베스트 프랙티스 반영
```typescript
// ai-template-generation.service.ts:181-246
// 13-Word Rule, Hook-Bridge-Ask 구조, Data-Backed 인사이트 포함
✅ "13-Word Rule" - 프리뷰에서 보이는 단어 수 고려
✅ 구체적인 숫자 사용 권장 ("2x more credible")
✅ Low-Friction CTA 강조
✅ 금지 패턴 명시 (15개 이상)
```

#### 1.3 언어 혼합 방지 규칙
```typescript
// ai-template-generation.service.ts:197-205
⚠️ NEVER MIX LANGUAGES - This destroys credibility instantly.
- Writing in English? EVERYTHING in English
- Writing in Korean? EVERYTHING in Korean
```

### 단점 및 개선점

#### 1.4 이메일 예시가 활용되지 않음
```typescript
// ai-template-generation.service.ts:112-129
const examples = this.getRandomExamples(5)
const _examplesText = examples.length > 0 ? ... : ""
// ⚠️ _examplesText가 프롬프트에 포함되지 않음!
// 변수명 앞에 _ 접두사 = 미사용 변수
```
**문제**: CSV에서 로드한 이메일 예시들이 실제 프롬프트에 포함되지 않아 낭비됨

**개선안**:
```typescript
// System prompt에 예시 추가
const systemPrompt = `...
═══════════════════════════════════════════════════════════════
REFERENCE EXAMPLES (Learn from these successful emails)
═══════════════════════════════════════════════════════════════
${examplesText}
...`
```

#### 1.5 산업별 맞춤화 부족
```typescript
// 현재: 일반적인 cold email 전략만 제공
// 개선: 산업별 특화 프롬프트 추가
const industryPrompts = {
  beauty: "Focus on visual aesthetics, trends, and brand positioning...",
  it_saas: "Emphasize ROI, integration capabilities, scalability...",
  manufacturing: "Highlight efficiency, cost reduction, supply chain..."
}
```

#### 1.6 A/B 테스트 지원 없음
현재 단일 템플릿만 생성. 여러 버전 생성 후 성과 비교 기능 없음.

---

## 2. 번역 기능 (72/100) - B

### 장점

#### 2.1 Placeholder 자동 변환
```typescript
// ai-template-generation.service.ts:639-655
if (isEnglishTarget) {
  translatedSubject = translatedSubject
    .replace(/\{\{회사명\}\}/g, "{{company_name}}")
    .replace(/\{\{담당자명\}\}/g, "{{contact_name}}")
}
```
**평가**: AI 번역 후 regex로 placeholder를 강제 변환하여 일관성 보장

#### 2.2 낮은 Temperature 사용
```typescript
temperature = 0.3 // 번역 일관성을 위해 낮은 값 사용
```

#### 2.3 캐싱 구현
```typescript
// onboarding.service.ts:864-914
const translationCache = new Map<string, {...}>()
const cacheKey = `${step.stepOrder}-${targetLanguage}`
```
**평가**: 동일 언어/스텝 조합 재번역 방지로 API 비용 절감

### 단점 및 개선점

#### 2.4 언어 감지 없음
```typescript
// 현재: 국가 기반으로만 언어 결정
const targetLanguage = COUNTRY_TO_LANGUAGE[leadCountry] || "English"

// 문제:
// - 일본에 있는 영어권 고객
// - 미국에 있는 한국어 사용 고객
// 이런 케이스 처리 불가
```

**개선안**:
```typescript
// 리드 테이블에 preferredLanguage 필드 추가
// 또는 이메일 주소 도메인으로 추측
```

#### 2.5 번역 품질 검증 없음
```typescript
// 현재: AI 응답을 그대로 사용
const translatedTemplate = await aiService.translateEmailTemplate({...})

// 개선: 번역 품질 검증 추가
// - 원본 길이 대비 번역 길이 체크 (너무 짧거나 긴 경우 경고)
// - 특수문자/HTML 태그 보존 여부 확인
// - 필수 placeholder 존재 여부 확인
```

#### 2.6 지원 언어 제한적
```typescript
// ai-template-generation.service.ts:668-680
const languageCodeMap = {
  Japanese: "ja",
  Korean: "ko",
  Chinese: "zh",  // 간체/번체 구분 없음
  English: "en",
  // ... 11개 언어만 지원
}
```
**문제**: 아랍어, 히브리어 등 RTL 언어 미지원

#### 2.7 번역 실패 시 원본 사용
```typescript
// ai-template-generation.service.ts:631-634
if (!translatedBodyText) {
  console.warn("[AITemplate] ⚠️ Translation failed - using original body")
  translatedBodyText = bodyText  // 원본 언어 그대로 사용
}
```
**문제**: 일본 고객에게 한국어 이메일이 발송될 수 있음

---

## 3. 변수 치환 (78/100) - B+

### 장점

#### 3.1 다중 변수 형식 지원
```typescript
// onboarding.service.ts:777-807
.replace(/\{\{company_name\}\}/gi, lead.companyName || companyFallback)
.replace(/\{\{companyName\}\}/g, ...)  // 레거시
.replace(/\{\{회사명\}\}/g, ...)       // 한국어
```

#### 3.2 언어별 폴백 처리
```typescript
const companyFallback = isKorean ? "귀사" : "your company"
```

#### 3.3 누락된 담당자명 우아한 처리
```typescript
// onboarding.service.ts:793-808
.replace(/Hi \{\{contact_name\}\},?/gi, "Hi there,")
.replace(/안녕하세요 \{\{담당자명\}\}님,?/g, "안녕하세요,")
```

### 단점 및 개선점

#### 3.4 XSS 취약점 가능성
```typescript
// 현재: 리드 데이터를 그대로 HTML에 삽입
bodyHtml = bodyHtml ? replaceVariables(bodyHtml, lead, targetLanguage) : null

// 문제: lead.companyName이 "<script>alert('xss')</script>"라면?
```

**개선안**:
```typescript
import { escape } from 'lodash'

function sanitizeForHtml(value: string): string {
  return escape(value)  // < > & " ' 이스케이프
}

// HTML 변환 시 sanitize 적용
bodyHtml = bodyHtml?.replace(/\{\{company_name\}\}/gi,
  sanitizeForHtml(lead.companyName || companyFallback))
```

#### 3.5 변수 목록이 하드코딩됨
```typescript
// 새 변수 추가 시 여러 곳 수정 필요:
// 1. replaceVariables() 함수
// 2. AI 프롬프트의 VARIABLES 섹션
// 3. 번역 시 placeholder 변환 로직
```

**개선안**:
```typescript
const VARIABLES = {
  company_name: {
    kr: '회사명',
    fallback: { kr: '귀사', en: 'your company' }
  },
  contact_name: {
    kr: '담당자명',
    fallback: { kr: '', en: '' }
  },
  // ... 중앙 관리
}
```

#### 3.6 복잡한 변수 미지원
```typescript
// 현재: 단순 텍스트 치환만 가능
// 미지원:
// - 조건부 렌더링: {{#if hasProduct}}...{{/if}}
// - 반복문: {{#each products}}...{{/each}}
// - 날짜 포맷팅: {{date format="YYYY-MM-DD"}}
```

---

## 4. 에러 처리 (70/100) - B

### 장점

#### 4.1 Phase별 에러 기록
```typescript
// onboarding-worker.service.ts:214-226
async function addCheckpointError(job, phase, message) {
  checkpoint.errors.push({
    phase,
    message,
    timestamp: new Date().toISOString(),
  })
  await saveCheckpoint(job, { errors: checkpoint.errors })
}
```

#### 4.2 SSE + DB 이중 알림
```typescript
// onboarding-worker.service.ts:77-99
async function emitAndSaveNotification(event, userId) {
  await emitOnboardingProgress(event)  // 실시간 SSE
  await upsertOnboardingProgressNotification(userId, event)  // DB 저장
}
```

#### 4.3 Fallback 응답 파싱
```typescript
// ai-template-generation.service.ts:345-360
// JSON 파싱 실패 시 텍스트 파싱으로 폴백
const jsonResult = this.tryParseJson(trimmedResponse)
if (jsonResult) return jsonResult

console.warn("[AITemplate] ⚠️ JSON parsing failed, falling back to text parsing")
return this.parseTextResponse(trimmedResponse)
```

### 단점 및 개선점

#### 4.4 에러 복구 전략 부재
```typescript
// 현재: 에러 발생 시 단순 throw
catch (error) {
  console.error("[TemplatesPhase] Error:", error)
  await addCheckpointError(job, "templates", String(error))
  throw error  // 전체 작업 실패
}

// 개선: 재시도 로직 추가
const MAX_RETRIES = 3
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    return await generateTemplate(...)
  } catch (error) {
    if (attempt === MAX_RETRIES) throw error
    await sleep(1000 * attempt)  // exponential backoff
  }
}
```

#### 4.5 에러 타입 구분 없음
```typescript
// 현재: 모든 에러를 동일하게 처리
String(error)  // 에러 메시지만 저장

// 개선: 에러 타입별 처리
interface OnboardingError {
  code: 'OPENAI_RATE_LIMIT' | 'BIGQUERY_TIMEOUT' | 'VALIDATION_ERROR' | ...
  message: string
  retryable: boolean
  context: Record<string, unknown>
}
```

#### 4.6 사용자 친화적 에러 메시지 없음
```typescript
// 현재: 기술적 에러 메시지 그대로 노출
"Error: connect ECONNREFUSED 127.0.0.1:6379"

// 개선: 사용자 친화적 메시지
"일시적인 연결 문제가 발생했습니다. 잠시 후 자동으로 재시도됩니다."
```

---

## 5. 국제화 - i18n (65/100) - C+

### 장점

#### 5.1 국가-언어 매핑 테이블
```typescript
// onboarding.service.ts:700-726
export const COUNTRY_TO_LANGUAGE = {
  Japan: "Japanese",
  "United States": "English",
  // ... 25개 국가 지원
}
```

#### 5.2 영어권 국가 자동 감지
```typescript
// ai-template-generation.service.ts:136-158
const englishCountries = [
  "United States", "United Kingdom", "Singapore",
  "United Arab Emirates", "Australia", "Canada",
  "India", "Philippines", "Malaysia",
]
```

### 단점 및 개선점

#### 5.3 불완전한 국가 매핑
```typescript
// COUNTRY_NAMES에서 SEA/EU를 대표 국가 1개로만 매핑
sea: "Singapore",  // 태국, 베트남, 인도네시아 등 누락
eu: "United Kingdom",  // 독일, 프랑스 등 누락
```

#### 5.4 다중 언어 국가 미고려
```typescript
// 문제 케이스:
// - 캐나다: 영어/프랑스어
// - 스위스: 독일어/프랑스어/이탈리아어
// - 벨기에: 네덜란드어/프랑스어
// - 싱가포르: 영어/중국어/말레이어/타밀어
```

#### 5.5 UI 메시지 하드코딩
```typescript
// onboarding.service.ts:1524-1534
name: isKorean ? "데모 리드 그룹" : "Demo Lead Group",
description: isKorean
  ? `트라이얼 가입 시 자동 생성된 리드 그룹...`
  : `Lead group auto-generated during trial signup...`

// 문제: 일본어, 중국어 등 미지원
// 개선: i18n 라이브러리 사용
import { t } from './i18n'
name: t('onboarding.demoLeadGroup', { locale: surveyData.lang })
```

#### 5.6 날짜/시간 로컬라이제이션 없음
```typescript
// KST 하드코딩
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const kstNow = new Date(now.getTime() + KST_OFFSET_MS)

// 문제: 미국 고객에게도 KST 기준 스케줄링
// 개선: 사용자/워크스페이스 타임존 설정 사용
```

---

## 6. 아키텍처/코드 품질 (80/100) - A-

### 장점

#### 6.1 싱글톤 패턴 사용
```typescript
// ai-template-generation.service.ts:700-714
let aiTemplateServiceInstance: AITemplateGenerationService | null = null

export function getAITemplateGenerationService(): AITemplateGenerationService {
  if (!aiTemplateServiceInstance) {
    aiTemplateServiceInstance = new AITemplateGenerationService(apiKey)
  }
  return aiTemplateServiceInstance
}
```

#### 6.2 Phase 기반 설계
```typescript
// onboarding-worker.service.ts
// 각 Phase가 독립적으로 실행/재시도 가능
runDiscoveryPhase() → runGroupPhase() → runTemplatesPhase()
→ runSequencePhase() → runPreviewsPhase() → completeOnboarding()
```

#### 6.3 체크포인트로 멱등성 보장
```typescript
// onboarding-worker.service.ts:571-593
if (checkpoint.customerGroupId) {
  const existingGroup = await db.select(...)
  if (existingGroup.length > 0) {
    return checkpoint.customerGroupId  // 재사용
  }
}
```

### 단점 및 개선점

#### 6.4 함수 길이 과다
```typescript
// autoGenerateOnboarding(): 320줄 (1480-1800)
// generatePreviewEmailsForSequence(): 130줄 (831-963)
// 권장: 50줄 이하로 분리
```

#### 6.5 Magic Number 사용
```typescript
// 상수로 추출 필요
const leadOffset = leadIndex * 60 * 1000  // 1 minute
scheduledMinute = Math.min(59, kstNow.getUTCMinutes() + 2)  // 2 min buffer
```

#### 6.6 관심사 분리 부족
```typescript
// onboarding.service.ts에 너무 많은 책임:
// - 온보딩 상태 관리
// - 리드 발굴
// - 이메일 생성
// - 시퀀스 생성
// - 번역 처리

// 개선: 각각 별도 서비스로 분리
// - OnboardingStateService
// - LeadDiscoveryService
// - EmailGenerationService
// - SequenceService
```

---

## 7. 성능 최적화 (75/100) - B+

### 장점

#### 7.1 배치 처리
```typescript
// onboarding-worker.service.ts:64-67
const TARGET_LEADS = 20
const ENRICHMENT_BATCH_SIZE = 20
const BIGQUERY_BATCH_SIZE = 100
```

#### 7.2 번역 캐싱
```typescript
// onboarding.service.ts:864-867
const translationCache = new Map<string, {...}>()
// 동일 언어/스텝 조합 재번역 방지
```

#### 7.3 병렬 처리
```typescript
// onboarding.service.ts:1370-1416
const batchResults = await Promise.allSettled(
  batch.map(async (lead) => {
    return await enrichLead(lead.website, lead.company, {...})
  })
)
```

### 단점 및 개선점

#### 7.4 N+1 쿼리 문제
```typescript
// onboarding.service.ts:1891-1915
for (let i = 0; i < steps.length; i++) {
  // 각 스텝마다 DB 조회 + 업데이트
  const [updatedStep] = await db.select()...
  await db.update(emails)...
}

// 개선: 배치 업데이트
await db.update(emails)
  .set({ ... })
  .where(
    and(
      eq(emails.sequenceId, sequenceId),
      eq(emails.status, "draft"),
      inArray(emails.stepId, stepIds)
    )
  )
```

#### 7.5 불필요한 DB 라운드트립
```typescript
// onboarding-worker.service.ts:1088-1095
// 리드 조회 후 별도로 이메일 조회
const leadDetails = await db.select()...
const leadEmails = await db.select()...

// 개선: JOIN으로 단일 쿼리
const leadDetailsWithEmail = await db
  .select({...})
  .from(leadsTable)
  .leftJoin(leadContacts, ...)
```

#### 7.6 OpenAI API 동기 호출
```typescript
// ai-template-generation.service.ts:314-318
for (let i = 0; i < templatesNeeded; i++) {
  const template = await aiService.generateEmailTemplate(...)
  // 순차 실행, 병렬화 가능
}
```

---

## 8. 보안 (68/100) - C+

### 장점

#### 8.1 API 키 환경변수 사용
```typescript
// ai-template-generation.service.ts:707-710
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다")
}
```

### 단점 및 개선점

#### 8.2 XSS 취약점 (앞서 언급)
```typescript
// HTML 본문에 사용자 데이터 직접 삽입
bodyHtml = replaceVariables(bodyHtml, lead, targetLanguage)
// sanitization 없음
```

#### 8.3 이메일 주소 검증 부족
```typescript
// onboarding.service.ts:1200-1206
// 기본적인 패턴만 필터링
if (email.includes("noreply")) return false
if (email.startsWith("postmaster@")) return false

// 누락: RFC 5322 형식 검증, 도메인 MX 레코드 확인
```

#### 8.4 Rate Limiting 고려 없음
```typescript
// OpenAI API 호출에 rate limit 처리 없음
// 대량 요청 시 429 에러 발생 가능

// 개선: Rate limiter 추가
import { RateLimiter } from 'limiter'
const limiter = new RateLimiter({ tokensPerInterval: 60, interval: 'minute' })
await limiter.removeTokens(1)
```

#### 8.5 민감 정보 로깅
```typescript
// ai-template-generation.service.ts:106-109
console.log(`[AITemplate]   - workspace: ${workspaceName}`)
// 프로덕션에서 고객 정보 노출 가능

// 개선: 민감 정보 마스킹
console.log(`[AITemplate]   - workspace: ${maskString(workspaceName)}`)
```

---

## 9. 유지보수성 (72/100) - B

### 장점

#### 9.1 명확한 로깅
```typescript
console.log(`[AutoGenerate] Starting for workspace ${workspaceId}`)
console.log(`[DiscoveryPhase] Iteration ${iteration}/${MAX_ITERATIONS}...`)
console.log(`[PreviewsPhase] Generated ${previewCount} preview emails`)
```

#### 9.2 TypeScript 타입 정의
```typescript
interface GenerateTemplateOptions {
  workspaceName: string
  workspaceDescription?: string
  country: string
  userPrompt: string
  model?: string
  temperature?: number
}
```

### 단점 및 개선점

#### 9.3 주석 부족
```typescript
// 복잡한 비즈니스 로직에 주석 없음
const koreanCharCount = (template.match(/[\u3131-\uD79D]/g) || []).length
isKorean = koreanCharCount > 10  // 왜 10인지 설명 없음
```

#### 9.4 설정값 분산
```typescript
// 여러 파일에 설정값이 흩어져 있음
// ai-template-generation.service.ts:
const englishCountries = [...]
// onboarding.service.ts:
export const COUNTRY_TO_LANGUAGE = {...}
export const COUNTRY_NAMES = {...}
// onboarding-worker.service.ts:
const TARGET_LEADS = 20

// 개선: config/constants.ts로 통합
```

#### 9.5 중복 코드
```typescript
// 동일한 로직이 여러 파일에 반복
// autoGenerateOnboarding() in onboarding.service.ts
// runTemplatesPhase() in onboarding-worker.service.ts
// 둘 다 AI 템플릿 생성 로직 포함
```

---

## 10. 테스트 가능성 (60/100) - C

### 문제점

#### 10.1 외부 의존성 직접 호출
```typescript
// 테스트 시 실제 OpenAI API 호출 필요
const { text } = await generateText({
  model: this.openai(model),
  ...
})
```

**개선안**: 의존성 주입
```typescript
class AITemplateGenerationService {
  constructor(
    private readonly openaiClient: OpenAIClient,
    private readonly emailExamplesLoader: EmailExamplesLoader
  ) {}
}
```

#### 10.2 부작용이 많은 함수
```typescript
// autoGenerateOnboarding()가 하는 일:
// - BigQuery 검색
// - 리드 enrichment
// - DB 삽입 (leads, customer_groups, sequences, emails)
// - 온보딩 상태 업데이트
// 단위 테스트 불가
```

#### 10.3 Private 메서드 테스트 불가
```typescript
private parseAIResponse(response: string): GeneratedTemplate
private tryParseJson(response: string): GeneratedTemplate | null
private parseTextResponse(response: string): GeneratedTemplate
// 중요한 파싱 로직인데 직접 테스트 불가
```

---

## 개선 우선순위 권장

### 높은 우선순위 (즉시 수정)

1. **이메일 예시 미사용 버그 수정**
   - `_examplesText`가 프롬프트에 포함되지 않음
   - CSV 로드하고도 활용하지 않아 리소스 낭비

2. **XSS 취약점 수정**
   - HTML 본문에 사용자 데이터 sanitization 추가

3. **번역 실패 시 원본 사용 문제**
   - 잘못된 언어의 이메일 발송 방지 로직 필요

### 중간 우선순위 (1-2주 내)

4. **에러 재시도 로직 추가**
   - OpenAI API Rate Limit 대응
   - Exponential backoff 구현

5. **N+1 쿼리 최적화**
   - 배치 업데이트로 변경

6. **국가/언어 매핑 확장**
   - 다중 언어 국가 처리
   - SEA/EU 개별 국가 지원

### 낮은 우선순위 (장기)

7. **서비스 분리**
   - 관심사별 서비스 분리
   - 단위 테스트 가능한 구조로 리팩토링

8. **A/B 테스트 기능**
   - 여러 이메일 버전 생성/성과 비교

9. **i18n 라이브러리 도입**
   - 하드코딩된 메시지 제거

---

## 결론

전반적으로 **잘 구현된 시스템**이지만, 몇 가지 **치명적인 버그**와 **보안 이슈**가 있습니다.

### 강점
- 체계적인 AI 프롬프트 설계
- Phase 기반 아키텍처로 복원력 확보
- 번역 캐싱으로 비용 최적화

### 약점
- 이메일 예시가 실제로 사용되지 않는 버그
- XSS 취약점
- 번역 실패 시 잘못된 언어 이메일 발송 가능
- 테스트 가능성 낮음

**종합 점수: 72.5/100 (B)**

즉시 수정이 필요한 높은 우선순위 항목들을 먼저 해결하면 80점 이상으로 개선 가능합니다.
