# 이메일 템플릿 변수 가이드

시퀀스 이메일 템플릿에서 사용 가능한 개인화 변수 목록입니다.

## 사용 가능한 변수

### 회사 정보

| 영문 변수 | 한글 변수 | 설명 | 예시 |
|----------|---------|------|-----|
| `{{company_name}}` | `{{회사명}}` | 리드 회사명 | ABC Corp |
| `{{website}}` | `{{웹사이트}}` | 회사 웹사이트 URL | https://example.com |
| `{{industry}}` | `{{업종}}` | 업종 (복수 가능, 쉼표로 구분) | Retail, E-commerce |
| `{{description}}` | `{{설명}}` | 회사 설명 | Leading online retailer |
| `{{employee_count}}` | `{{직원수}}` | 직원 수 | 50-100 |
| `{{founded_year}}` | `{{설립연도}}` | 설립 연도 | 2015 |

### 위치 정보

| 영문 변수 | 한글 변수 | 설명 | 예시 |
|----------|---------|------|-----|
| `{{country}}` | `{{국가}}` | 국가 | United States |
| `{{city}}` | `{{도시}}` | 도시 | San Francisco |
| `{{state}}` | `{{주/도}}` | 주/도 | California |
| `{{address}}` | `{{주소}}` | 전체 주소 | 123 Main St, San Francisco, CA |

### 연락처

| 영문 변수 | 한글 변수 | 설명 | 예시 |
|----------|---------|------|-----|
| `{{contact_name}}` | `{{담당자명}}` | 담당자 이름 | John Smith |
| `{{email}}` | `{{이메일}}` | 연락처 이메일 | john@example.com |

### 리드 관리

| 영문 변수 | 한글 변수 | 설명 | 예시 |
|----------|---------|------|-----|
| `{{lead_source}}` | `{{리드소스}}` | 리드 출처 | Website Form |
| `{{lead_status}}` | `{{리드상태}}` | 리드 상태 | qualified |
| `{{lead_score}}` | `{{리드점수}}` | 리드 점수 | 85 |

## 사용 방법

### 이메일 제목에서 사용

```
K-Beauty Partnership Opportunity with {{company_name}}
```

발송 시:
```
K-Beauty Partnership Opportunity with ABC Corp
```

### 이메일 본문에서 사용

```
Dear {{company_name}} team,

I hope this email finds you well. I noticed your business in {{city}}, {{country}} 
and believe there could be a great partnership opportunity.

We specialize in {{industry}} and have been serving customers since {{founded_year}}.

Best regards,
Your Name
```

발송 시:
```
Dear ABC Corp team,

I hope this email finds you well. I noticed your business in San Francisco, United States 
and believe there could be a great partnership opportunity.

We specialize in Retail, E-commerce and have been serving customers since 2015.

Best regards,
Your Name
```

## 변수 치환 동작

### 영문 변수
- 대소문자 구분 없이 치환됩니다
- `{{Company_Name}}`, `{{COMPANY_NAME}}`, `{{company_name}}` 모두 동일하게 작동

### 한글 변수
- 대소문자 구분 있음 (한글은 영향 없음)
- `{{회사명}}`, `{{회사명}}` 정확히 일치해야 함

### camelCase와 snake_case
- 영문 변수는 두 형식 모두 지원
- `{{companyName}}` = `{{company_name}}`
- `{{employeeCount}}` = `{{employee_count}}`

## 주의사항

### 업종 정보
- 리드에 여러 업종이 연결된 경우 쉼표로 구분되어 표시됩니다
- 예: "Retail, E-commerce, Technology"

### 빈 값 처리
- 리드 데이터에 값이 없는 경우 변수는 빈 문자열로 치환됩니다
- 이메일 발송 전에 필수 변수가 제대로 채워져 있는지 확인하세요

## 기술 구현

### 변수 치환 함수
변수 치환은 `replaceTemplateVariables()` 함수에서 처리됩니다:

```typescript
// elysia-server/src/services/workflow-email.service.ts
export function replaceTemplateVariables(
  template: string,
  context: {
    companyName?: string
    contactName?: string
    contactEmail?: string
    industry?: string
    website?: string
    description?: string
    address?: string
    country?: string
    city?: string
    state?: string
    foundedYear?: string
    employeeCount?: string
    leadSource?: string
    leadStatus?: string
    leadScore?: string
    [key: string]: string | undefined
  }
): string
```

### 데이터 소스
변수 값은 다음 테이블에서 가져옵니다:

1. **leads 테이블**: 대부분의 기본 정보
2. **leadContacts 테이블**: 이메일 주소
3. **leadIndustryTypes 테이블**: 업종 정보 (조인)

### 발송 시점
변수 치환은 이메일 발송 직전에 수행됩니다:

```typescript
// elysia-server/src/workers/email-sequence-worker.ts
const personalizedSubject = replaceTemplateVariables(
  execution.emailSubject,
  leadContext
)
const personalizedBodyText = replaceTemplateVariables(
  execution.emailBodyText,
  leadContext
)
const personalizedBodyHtml = replaceTemplateVariables(
  execution.emailBodyHtml,
  leadContext
)
```

## AI 템플릿 생성

AI 이메일 템플릿 생성 시 타겟 국가에 맞춰 자동으로 적절한 변수를 선택합니다:

- 영어권 국가 → 영문 변수 사용 (`{{company_name}}`, `{{country}}` 등)
- 한국 → 한글 변수 사용 (`{{회사명}}`, `{{국가}}` 등)
- 기타 국가 → 해당 언어로 이메일 작성 + 영문 변수 사용

## 테스트 방법

1. 시퀀스 스탭 생성 시 변수를 포함한 템플릿 작성
2. 리드를 시퀀스에 등록
3. 이메일 발송 후 `emails` 테이블에서 치환된 내용 확인

```sql
SELECT subject, body_text, body_html
FROM emails
WHERE lead_id = 'your-lead-id'
ORDER BY created_at DESC
LIMIT 1;
```

