# AI 이메일 생성 프롬프트 분석

## 개요

AI 이메일 생성 기능은 사용자가 입력한 정보를 바탕으로 GPT-4.1-mini 모델을 활용하여 맞춤형 콜드 이메일을 자동 생성합니다.

**관련 파일:**
- `admin/src/pages/sequences/components/ManualModeContent.tsx` - 프론트엔드 UI 및 프롬프트 조합
- `elysia-server/src/services/ai-template-generation.service.ts` - 백엔드 AI 호출 및 시스템 프롬프트
- `elysia-server/src/data/email-examples.csv` - 참고 예시 데이터

---

## 1. UI 입력 필드와 프롬프트 매핑

| UI 필드 | 변수명 | 프롬프트에서의 역할 | 필수 여부 |
|---------|--------|---------------------|-----------|
| 타겟 고객 그룹 정보 | `aiGroupInfo` | `[타겟 고객]: ...` | 권장 |
| 타겟 국가 | `aiCountry` | 언어 결정 및 `country` 파라미터 | 필수 |
| 팔로업 목표 | `aiGoal` | `[목표]: ...` | 권장 |
| 템플릿 전략 (톤앤매너) | `aiStrategy` | `[전략]: ...` | 권장 |
| 템플릿 참고 | `selectedAITemplateId` | `[참고 템플릿]: ...` | 선택 |
| 추가 지시사항 | `aiPrompt` | `[추가 지시사항]: ...` | 선택 |

---

## 2. 프론트엔드 프롬프트 조합

### 2.1 기본 프롬프트 조합 로직

**파일:** `ManualModeContent.tsx:323-389`

```typescript
const handleGenerateAI = async () => {
  const promptParts = []

  // 1. 그룹 정보 추가
  if (aiGroupInfo.trim()) {
    promptParts.push(`[타겟 고객]: ${aiGroupInfo.trim()}`)
  }

  // 2. 목표 추가
  if (aiGoal.trim()) {
    promptParts.push(`[목표]: ${aiGoal.trim()}`)
  }

  // 3. 전략 추가
  if (aiStrategy.trim()) {
    promptParts.push(`[전략]: ${aiStrategy.trim()}`)
  }

  // 4. 템플릿 참조 (선택된 경우)
  if (selectedAITemplateId && selectedAITemplateId !== "none") {
    const selectedTemplate = templatesData?.emailTemplates.find(
      (t) => t.id === selectedAITemplateId,
    )
    if (selectedTemplate) {
      const bodyText = selectedTemplate.bodyText || ""
      const bodyHtml = selectedTemplate.bodyHtml || ""
      const templateBody = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>/g, "").trim() : "")

      promptParts.push(
        `[참고 템플릿 - 반드시 이 템플릿의 구조와 스타일을 따라주세요]:
템플릿명: ${selectedTemplate.name}
${selectedTemplate.description ? `설명: ${selectedTemplate.description}\n` : ""}제목 예시: ${selectedTemplate.subject}
본문 예시:
${templateBody}

**중요 지시사항:**
1. 위 템플릿의 구조(인사말, 본문 흐름, 마무리 등)를 그대로 따라주세요
2. 템플릿의 톤과 스타일(공식적/비공식적, 길이, 문체 등)을 유지해주세요
3. 템플릿에서 사용된 변수 형식({{회사명}}, {{담당자명}} 등)을 동일하게 사용해주세요
4. 템플릿의 전체적인 흐름과 문단 구성을 참고하여 작성해주세요`,
      )
    }
  }

  // 5. 추가 지시사항 (선택)
  if (aiPrompt.trim()) {
    promptParts.push(`[추가 지시사항]: ${aiPrompt.trim()}`)
  }

  const finalPrompt = promptParts.join("\n\n")
}
```

### 2.2 조합된 프롬프트 예시

```
[타겟 고객]: 국가: 미국, 기업 규모: Medium, 비즈니스 타입: SaaS

[목표]: 첫 접촉 및 관심 유도

[전략]: 전문적이고 친근한 톤, 간결하고 명확한 메시지

[참고 템플릿 - 반드시 이 템플릿의 구조와 스타일을 따라주세요]:
템플릿명: 첫 접촉 이메일
제목 예시: {{회사명}} 담당자님께
본문 예시:
안녕하세요...

**중요 지시사항:**
1. 위 템플릿의 구조를 그대로 따라주세요
...

[추가 지시사항]: 최근 출시한 신제품에 대한 소개를 포함해주세요
```

---

## 3. 백엔드 시스템 프롬프트

### 3.1 시스템 프롬프트 구조

**파일:** `ai-template-generation.service.ts:138-180`

```typescript
const systemPrompt = `당신은 자연스럽고 효과적인 콜드 이메일 작성 전문가입니다.
처음 연락하는 잠재 고객에게 보내는 이메일을 작성합니다.

[발신자 정보]
- 회사: ${workspaceName}
${workspaceDescription ? `- 서비스: ${workspaceDescription}` : ""}

[수신자 정보]
- 국가: ${country}

[콜드 이메일 작성 핵심 원칙]
1. ${targetLanguageInstruction}
2. **자연스러운 대화체**: 템플릿처럼 느껴지지 않게 자연스러운 어조로 작성
3. **간결함**: 3-5문장으로 핵심만 전달 (200단어 이내)
4. **개인화**: 받는 사람의 회사나 상황에 맞춘 느낌 (placeholder 활용)
5. **명확한 가치**: 상대방이 얻을 수 있는 이점을 구체적으로 제시
6. **부담 없는 CTA**: "관심 있으시면 답장 주세요" 정도의 가벼운 행동 유도

[사용 가능한 변수 (필요한 것만 선택적으로 사용)]
- {{회사명}} - 받는 회사명
- {{담당자명}} - 받는 담당자명 (없으면 사용하지 마세요)

[절대 하지 말아야 할 것]
- "귀사", "당사" 같은 딱딱한 표현 사용 금지
- "워크스페이스", "담당자 & 워크스페이스" 같은 부자연스러운 표현 금지
- 너무 많은 정보 나열 금지
- 영어 placeholder 사용 금지 ({{company_name}} 등 사용 금지)
- {{리드점수}}, {{리드상태}}, {{리드소스}} 같은 내부 데이터 placeholder 사용 금지

${examplesText ? `
[참고 예시 - 자연스러운 콜드 이메일]
${examplesText}
` : ""}

[응답 형식]
LANGUAGE: [언어 코드]
SUBJECT: [이메일 제목 - 궁금증을 유발하는 짧은 제목]
BODY:
[이메일 본문 - 자연스럽고 간결하게]`
```

### 3.2 사용자 메시지

**파일:** `ai-template-generation.service.ts:182-188`

```typescript
const userMessage = `
요구사항: ${userPrompt}

"${country}" 국가의 잠재 고객에게 보내는 첫 콜드 이메일을 작성해주세요.
- 자연스럽고 친근한 톤 유지
- {{회사명}} 변수만 사용해도 충분함 (담당자명은 선택)
- 딱딱한 비즈니스 형식 피하기`
```

---

## 4. 언어 결정 로직

**파일:** `ai-template-generation.service.ts:133-136`

```typescript
// 국가가 여러 개인 경우 (comma로 구분) 영어로 고정
const isMultipleCountries = country.includes(",")
const targetLanguageInstruction = isMultipleCountries
  ? "여러 국가를 대상으로 하므로 이메일을 영어로 작성하세요"
  : `"${country}" 국가에서 사용하는 주요 언어로 이메일을 작성하세요`
```

### 언어 결정 규칙

| 조건 | 결과 |
|------|------|
| 단일 국가 (예: "Korea") | 해당 국가의 주요 언어로 작성 |
| 복수 국가 (예: "Korea, Japan, China") | 영어로 작성 |

---

## 5. 참고 예시 데이터

### 5.1 CSV 파일 로드

**파일:** `ai-template-generation.service.ts:45-79`

```typescript
private loadEmailExamples() {
  const csvPath = join(__dirname, "../../data/email-examples.csv")
  const csvContent = readFileSync(csvPath, "utf-8")

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  this.emailExamples = records
    .filter((record) => record.Company && record.Subject && record.Content)
    .map((record) => ({
      company: record.Company,
      day: record.Day,
      subject: record.Subject,
      content: record.Content,
    }))
}
```

### 5.2 랜덤 예시 선택

**파일:** `ai-template-generation.service.ts:84-91`

```typescript
private getRandomExamples(count = 5): EmailExample[] {
  if (this.emailExamples.length === 0) {
    return []
  }

  const shuffled = [...this.emailExamples].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, this.emailExamples.length))
}
```

### 5.3 예시 텍스트 포맷

```typescript
const examplesText = examples
  .map((ex, idx) => `
예시 ${idx + 1}:
회사: ${ex.company}
발송 시점: ${ex.day}
제목: ${ex.subject}
본문:
${ex.content}
`)
  .join("\n---\n")
```

---

## 6. 기본값 자동 설정

### 6.1 스텝별 기본 목표

**파일:** `ManualModeContent.tsx:450-469`

```typescript
const stepNumber = currentStep?.stepOrder || 1

if (stepNumber === 1) {
  setAiGoal("첫 접촉 및 관심 유도")
} else if (stepNumber === 2) {
  setAiGoal("후속 팔로업 및 가치 제안")
} else if (stepNumber === 3) {
  setAiGoal("미팅 제안 또는 행동 유도")
} else {
  setAiGoal("최종 팔로업 및 클로징")
}
```

### 6.2 기본 전략

```typescript
setAiStrategy("전문적이고 친근한 톤, 간결하고 명확한 메시지")
```

### 6.3 리드 데이터 기반 자동 감지

```typescript
const analysis = analyzeLeadsForGroupName(leadsResult.leads)

// 국가 설정
if (analysis.country && analysis.country !== "Unknown") {
  setAiCountry(analysis.country)
}

// 그룹 정보 요약 생성
const groupInfoParts = []
if (analysis.country) groupInfoParts.push(`국가: ${analysis.country}`)
if (analysis.scale) groupInfoParts.push(`기업 규모: ${analysis.scale}`)
if (analysis.businessType) groupInfoParts.push(`비즈니스 타입: ${analysis.businessType}`)
if (analysis.businessSector) groupInfoParts.push(`업종: ${analysis.businessSector}`)

setAiGroupInfo(groupInfoParts.join(", "))
```

---

## 7. API 호출 및 응답 처리

### 7.1 API 호출

**파일:** `ai-template-generation.service.ts:191-198`

```typescript
const { text } = await generateText({
  model: this.openai(model),  // 기본: "gpt-4.1-mini"
  system: systemPrompt,
  prompt: userMessage,
  temperature,  // 기본: 0.7
})
```

### 7.2 응답 파싱

**파일:** `ai-template-generation.service.ts:223-288`

```typescript
private parseAIResponse(response: string): GeneratedTemplate {
  const lines = response.trim().split("\n")
  let language = "en"
  let subject = ""
  let bodyLines: string[] = []
  let inBody = false

  for (const line of lines) {
    if (line.startsWith("LANGUAGE:")) {
      language = line.substring("LANGUAGE:".length).trim()
    } else if (line.startsWith("SUBJECT:")) {
      subject = line.substring("SUBJECT:".length).trim()
    } else if (line.startsWith("BODY:")) {
      inBody = true
    } else if (inBody) {
      bodyLines.push(line)
    }
  }

  const bodyText = bodyLines.join("\n").trim()
  const bodyHtml = /* HTML 변환 로직 */

  return {
    subject,
    bodyText,
    bodyHtml,
    detectedLanguage: language,
  }
}
```

---

## 8. 전체 프롬프트 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    프론트엔드 (UI 입력)                      │
├─────────────────────────────────────────────────────────────┤
│ • 타겟 고객 그룹 정보 (자동 감지)                            │
│ • 타겟 국가                                                  │
│ • 팔로업 목표                                                │
│ • 템플릿 전략 (톤앤매너)                                     │
│ • 템플릿 참고 (선택)                                         │
│ • 추가 지시사항 (선택)                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 프롬프트 조합 (finalPrompt)                  │
├─────────────────────────────────────────────────────────────┤
│ [타겟 고객]: 국가: 미국, 기업 규모: Medium                   │
│ [목표]: 첫 접촉 및 관심 유도                                 │
│ [전략]: 전문적이고 친근한 톤                                 │
│ [참고 템플릿]: (선택된 경우 포함)                            │
│ [추가 지시사항]: (입력된 경우 포함)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              백엔드 시스템 프롬프트 + 사용자 메시지           │
├─────────────────────────────────────────────────────────────┤
│ SYSTEM: 콜드 이메일 작성 전문가 역할 정의                    │
│   - 작성 원칙 (자연스러운 대화체, 간결함, 개인화 등)         │
│   - 사용 가능한 변수 ({{회사명}}, {{담당자명}})              │
│   - 금지사항                                                 │
│   - 참고 예시 5개 (CSV에서 랜덤 로드)                        │
│                                                              │
│ USER: finalPrompt + 언어/톤 지시사항                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    GPT-4.1-mini 호출                         │
│                   (temperature: 0.7)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        응답 파싱                             │
├─────────────────────────────────────────────────────────────┤
│ LANGUAGE: ko                                                 │
│ SUBJECT: {{회사명}} 성장을 위한 제안                         │
│ BODY: 안녕하세요...                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    프론트엔드 UI 반영                         │
├─────────────────────────────────────────────────────────────┤
│ • emailSubject: 파싱된 제목                                  │
│ • emailBodyText: 파싱된 본문                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 프롬프트 설계 원칙

### 9.1 핵심 원칙

1. **자연스러운 대화체**: 템플릿처럼 느껴지지 않게 작성
2. **간결함**: 3-5문장, 200단어 이내
3. **개인화**: `{{회사명}}`, `{{담당자명}}` 변수 활용
4. **명확한 가치**: 수신자가 얻을 이점 구체화
5. **부담 없는 CTA**: 가벼운 행동 유도

### 9.2 금지사항

- "귀사", "당사" 같은 딱딱한 표현
- 영어 placeholder (예: `{{company_name}}`)
- 내부 데이터 변수 (예: `{{리드점수}}`)
- 과도한 정보 나열

### 9.3 스텝별 전략

| 스텝 | 목표 | 패턴 |
|------|------|------|
| Step 1 | 첫 접촉 및 관심 유도 | Introduction + Value Proposition |
| Step 2 | 후속 팔로업 및 가치 제안 | Social Proof / Case Study |
| Step 3 | 미팅 제안 또는 행동 유도 | Educational Content |
| Step 4+ | 최종 팔로업 및 클로징 | Urgency / Breakup Email |

---

## 10. 번역 기능

### 10.1 이메일 템플릿 번역

**파일:** `ai-template-generation.service.ts:294-405`

리드의 국가에 맞게 생성된 이메일을 다른 언어로 번역할 수 있습니다.

```typescript
async translateEmailTemplate(options: {
  subject: string
  bodyText: string
  bodyHtml: string | null
  targetLanguage: string  // "Japanese", "Korean", "Chinese" 등
  model?: string
  temperature?: number  // 기본: 0.3 (일관된 번역을 위해 낮은 값)
}): Promise<GeneratedTemplate>
```

### 10.2 번역 프롬프트

```typescript
const systemPrompt = `You are a professional translator specializing in business emails.
Translate the following email to ${targetLanguage}.

IMPORTANT RULES:
1. Keep the same tone and style as the original
2. Preserve all placeholders exactly as they are (e.g., {{회사명}}, {{담당자명}})
3. Make the translation sound natural, not literal
4. Keep the email concise and professional
5. Do NOT translate placeholder names - keep them in Korean`
```

### 10.3 지원 언어

| 언어 | 코드 |
|------|------|
| Japanese | ja |
| Korean | ko |
| Chinese | zh |
| English | en |
| German | de |
| French | fr |
| Spanish | es |
| Portuguese | pt |
| Vietnamese | vi |
| Thai | th |
| Indonesian | id |

---

## 11. 관련 문서

- [시퀀스 생성 프롬프트](/SEQUENCE_GENERATION_PROMPTS.md) - 시퀀스 전체 생성 관련
- [템플릿 변수](/docs/template-variables.md) - 사용 가능한 변수 목록
- [AI 이메일 생성](/docs/ai-email-generation.md) - 일반 AI 이메일 생성 가이드
