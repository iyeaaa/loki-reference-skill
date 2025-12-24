# AI 이메일 생성 테스트 가이드

## 개요

이 문서는 실제 온보딩 과정과 동일한 AI 이메일 생성 기능을 테스트하기 위한 CLI 도구 사용법을 설명합니다.

스크립트는 3-Touch 이메일 시퀀스를 생성하며, 실제 온보딩에서 사용되는 필드와 값을 동일하게 입력받습니다.

## 최근 개선 사항

### 1. 허위 통계 생성 방지 (2024년 개선)

**문제점**: AI가 검증 불가능한 구체적 수치를 생성하는 문제 (예: "35% 증가", "4개월 만에" 등)

**해결책**:
- 이메일 생성 프롬프트에 제약 조건 추가: "DO NOT include specific statistics unless provided"
- AI 응답 검증 단계 추가 (숫자+증가/growth 패턴 감지)
- 가치 제안 중심으로 콘텐츠 방향 전환

**적용 위치**: `elysia-server/src/services/ai-template-generation.service.ts`

### 2. 3번째 후속 메일 프롬프트 개선

**문제점**: "Many beauty companies..." 부분이 문맥상 어색하고 이전 이메일 언급이 부자연스러움

**해결책**:
- 이전 이메일 직접 언급 제거
- 고객이 놓치는 구체적 가치 1-2가지만 강조
- 부드러운 긴급성 표현과 명확한 CTA로 마무리

**적용 위치**: `elysia-server/src/services/onboarding.service.ts:EMAIL_TYPES_3TOUCH`

## CLI 테스트 도구

### 설치 및 준비

```bash
# 환경 변수 설정 (OPENAI_API_KEY 필요)
# .env 파일에 OPENAI_API_KEY가 설정되어 있어야 합니다
```

### 사용법

#### 인터랙티브 모드 (화살표 키 선택)

대화형으로 실제 온보딩과 동일한 입력을 받아 3-Touch 시퀀스를 생성합니다:

```bash
bun run test:ai-email
```

**UI 특징**:
- ✅ 화살표 키 (↑/↓)로 옵션 선택
- ✅ 깔끔한 프롬프트 UI (@clack/prompts)
- ✅ 생성 진행 상태 표시 (spinner)
- ✅ 모든 이메일 생성 후 한 번에 표시

**입력 필드 (실제 온보딩과 동일)**:

1. **회사 정보**:
   - `companyName`: 회사명 (텍스트 입력, 기본값: "데모 회사")
   - `companyDescription`: 회사 설명 (텍스트 입력, 선택사항)

2. **설문 정보** (화살표 키로 선택):
   - `industry`: 산업군
     - `beauty`: 뷰티/화장품
     - `fashion`: 패션/의류
     - `food`: 식품/음료
     - `it_saas`: IT/SaaS
     - `manufacturing`: 제조업
     - `retail`: 소매업
     - `healthcare`: 헬스케어
     - `education`: 교육
     - `other`: 기타
   
   - `target`: 타겟 고객
     - `b2b`: 기업 대상 (B2B)
     - `b2c`: 소비자 대상 (B2C)
     - `both`: 둘 다 (B2B + B2C)
   
   - `country`: 희망 진출 국가
     - `jp`: 일본 (Japan)
     - `us`: 미국 (United States)
     - `sea`: 동남아시아 (Southeast Asia)
     - `eu`: 유럽 (Europe)
     - `cn`: 중국 (China)
     - `ae`: UAE (United Arab Emirates)
     - `kr`: 한국 (South Korea)
     - `other`: 기타 (Other)

### 출력 예시

```
🤖 AI 이메일 생성 테스트 (3-Touch Sequence)

ℹ️  안내
│  실제 온보딩 과정과 동일한 입력값을 사용합니다.

◇  회사명 (companyName)
│  데모 회사
│
◆  회사 설명 (companyDescription, optional)
│  B2B 마케팅 자동화 솔루션 제공
│
◆  산업군 (industry)
│  ● 뷰티/화장품
│  ○ 패션/의류
│  ○ 식품/음료
│  ...
│
◆  타겟 고객 (target)
│  ● 기업 대상 (B2B)
│  ○ 소비자 대상 (B2C)
│  ○ 둘 다 (B2B + B2C)
│
◆  희망 진출 국가 (country)
│  ● 일본 (Japan)
│  ○ 미국 (United States)
│  ...
│
◒  3-Touch 이메일 시퀀스 생성 중...
│  Step 1/3: introduction 생성 중...
│  Step 2/3: follow_up_1 생성 중...
│  Step 3/3: follow_up_2 생성 중...
◆  ✅ 3개 이메일 생성 완료

======================================================================
생성된 이메일 시퀀스
======================================================================
회사명: 데모 회사
회사 설명: B2B 마케팅 자동화 솔루션 제공
산업: 뷰티/화장품
타겟: 기업 대상 (B2B)
국가: jp (Japan)

======================================================================
Step 1: introduction (+0일)
======================================================================

제목: {{company_name}}의 일본 시장 진출을 도와드립니다
──────────────────────────────────────────────────────────────────────
안녕하세요,

{{company_name}}의 뷰티 제품이 일본 시장에서 큰 관심을 받을 수 있을 것 같습니다.

많은 뷰티 기업들이 일본 진출 시 적합한 유통 파트너를 찾는 데 어려움을 겪고 있습니다. 
저희는 이러한 기업들이 신뢰할 수 있는 현지 파트너를 찾고 시장 진입을 가속화할 수 있도록 돕고 있습니다.

간단한 통화로 더 자세히 이야기 나눠볼까요?
──────────────────────────────────────────────────────────────────────

🔍 Quality Check:
  ℹ️  Contains vague quantifiers (acceptable if no specific numbers)
  ✅ Length: 87 words

[... Step 2 and Step 3 emails ...]

======================================================================
시퀀스 요약
======================================================================
Step 1 (introduction, +0일):
  제목: {{company_name}}의 일본 시장 진출을 도와드립니다
Step 2 (follow_up_1, +1일):
  제목: ...
Step 3 (follow_up_2, +2일):
  제목: ...

✅ 테스트 완료!
```

### 품질 체크 기능

CLI 도구는 생성된 이메일에 대해 자동으로 다음을 확인합니다:

1. **허위 통계 감지**: 
   - 패턴: `\d+%`, `\d+ times`, `increase`, `growth`, `boost` + 숫자
   - 경고: "⚠️  Potential fabricated statistics detected"

2. **모호한 표현 확인**:
   - 패턴: "many companies", "several", "various", "numerous"
   - 정보: "ℹ️  Contains vague quantifiers (acceptable if no specific numbers)"

3. **길이 체크**:
   - 권장: 200 단어 이하
   - 경고: "⚠️  Email might be too long"
   - 정상: "✅ Length: X words"

## 테스트 시나리오

### 시나리오 1: 허위 통계 생성 방지 확인

```bash
bun run test:ai-email
# industry: beauty, target: b2b, country: jp
```

**확인 사항**:
- ✅ "많은 기업들", "고객들" 같은 모호한 표현은 OK
- ❌ "35% 증가", "4개월 만에", "50+ 바이어" 같은 구체적 수치는 NO

### 시나리오 2: 3번째 후속 메일 품질 확인

```bash
bun run test:ai-email
```

**Step 3 이메일 확인 사항**:
- ✅ 이전 이메일을 직접 언급하지 않음
- ✅ 1-2가지 핵심 가치만 강조
- ✅ 부드러운 긴급성 + 명확한 CTA

### 시나리오 3: 다양한 산업/국가 조합 테스트

```bash
bun run test:ai-email
```

**테스트 조합 예시**:
1. `beauty` + `b2b` + `jp` (뷰티 → 일본 B2B)
2. `it_saas` + `b2b` + `us` (IT/SaaS → 미국 B2B)
3. `fashion` + `b2c` + `sea` (패션 → 동남아 B2C)
4. `food` + `both` + `eu` (식품 → 유럽 B2B+B2C)

**확인 사항**:
- ✅ 산업별 적절한 용어 사용
- ✅ 타겟(B2B/B2C)에 맞는 톤앤매너
- ✅ 국가별 시장 특성 반영

## 문제 해결

### 오류: "OPENAI_API_KEY not found"

`.env` 파일에 OpenAI API 키를 설정하세요:

```bash
OPENAI_API_KEY=sk-...
```

### 오류: "Cannot find module"

의존성을 설치하세요:

```bash
bun install
```

### 생성된 이메일에 여전히 구체적 수치가 포함됨

1. `ai-template-generation.service.ts`의 프롬프트 확인
2. AI 모델이 최신 프롬프트를 사용하는지 확인
3. 이슈를 GitHub에 보고

## 개발자 노트

### 코드 위치

- **CLI 스크립트**: `scripts/test-email-generation.ts`
- **AI 템플릿 서비스**: `src/services/ai-template-generation.service.ts`
- **이메일 타입 정의**: `src/services/onboarding.service.ts:EMAIL_TYPES_3TOUCH`

### 프롬프트 수정하기

1. `ai-template-generation.service.ts` 파일 열기
2. `systemPrompt` 변수 수정 (라인 164-306)
3. `bun run test:email-gen:3touch`로 테스트
4. 결과 확인 후 커밋

### 새 시퀀스 타입 추가하기

1. `onboarding.service.ts`에서 `EMAIL_TYPES_3TOUCH` 수정
2. CLI 스크립트에 새 프리셋 추가 (선택사항)
3. 테스트

## 참고 자료

- [AI Template Generation Service](/src/services/ai-template-generation.service.ts)
- [Onboarding Service](/src/services/onboarding.service.ts)
- [Sequence Generation Prompts](/SEQUENCE_GENERATION_PROMPTS.md)

