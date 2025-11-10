# 시퀀스 생성 프롬프트 정리

## 개요

AI 챗봇의 시퀀스 생성 기능은 고객 그룹의 리드 데이터를 분석하여 최적화된 이메일 시퀀스를 자동으로 생성합니다.

**관련 파일:**
- `src/services/chatbot/nodes/sequence-generation.ts`

---

## 1. 시간 설정 프롬프트

### 스텝별 시간 전략

시퀀스는 총 3개의 스텝으로 구성되며, 각 스텝은 다음과 같은 타이밍 전략을 사용합니다:

| 스텝 | 발송 시점 | 발송 시간 | 타임존 | 전략적 의미 |
|------|-----------|-----------|--------|------------|
| **Step 1** | Day 0 (즉시) | 9:00 AM | Asia/Seoul | 최적의 오픈율을 위한 아침 시간대 |
| **Step 2** | Day 3 (3일 후) | 10:00 AM | Asia/Seoul | 중간 아침 시간대로 재참여 유도 |
| **Step 3** | Day 8 (5일 후) | 2:00 PM | Asia/Seoul | 점심 식사 후 시간대, 최종 행동 유도 |

### 구현 코드

```typescript
emailStrategy: {
  step1: {
    delay_days: 0,      // 즉시 발송
    timing: "9:00 AM",  // 오전 9시
  },
  step2: {
    delay_days: 3,      // 3일 후
    timing: "10:00 AM", // 오전 10시
  },
  step3: {
    delay_days: 5,      // Step 2로부터 5일 후 (총 8일)
    timing: "2:00 PM",  // 오후 2시
  },
}
```

### 데이터베이스 저장 방식

```sql
-- sequence_steps 테이블 구조
INSERT INTO sequence_steps (
  delay_days,        -- 이전 스텝으로부터 지연 일수
  scheduled_hour,    -- 발송 시간 (24시간 형식)
  scheduled_minute,  -- 발송 분
  timezone          -- 타임존
) VALUES (
  0,                -- Step 1: 즉시
  9,                -- 9 AM
  0,                -- :00분
  'Asia/Seoul'      -- KST
);
```

---

## 2. 이메일 내용 생성 프롬프트

### 2.1 리드 분석 기반 전략

이메일 내용은 고객 그룹의 **20개 랜덤 샘플 리드**를 분석하여 생성됩니다.

#### 분석 항목:

```typescript
// 1. 평균 리드 스코어
avgLeadScore = sum(lead_score) / count(leads)

// 2. 주요 비즈니스 타입 (최다 빈도)
dominantBusinessType = mostFrequent(leads.business_type)

// 3. 평균 회사 규모
avgCompanySize = average(leads.employee_count)

// 4. 회사 규모 카테고리
companySizeCategory = {
  avgCompanySize > 500  → "large enterprise"
  avgCompanySize > 100  → "mid-sized"
  avgCompanySize ≤ 100  → "small to medium"
}

// 5. 비즈니스 타입 포커스
businessTypeFocus = {
  uniqueTypes ≤ 2  → "Type1 and Type2"
  uniqueTypes > 2  → "various"
}
```

### 2.2 이메일 스텝별 전략

#### **Step 1: Initial Contact (첫 접촉)**

**목적:** 소개 및 가치 제안 (Introduction and value proposition)

**템플릿 구조:**
```
제목: Transform Your {{dominantBusinessType}} Business with AI Solutions

본문:
Hi {{contact_name}},

I noticed {{company_name}} is a {{companySizeCategory}} company in the {{dominantBusinessType}} industry.

We specialize in helping companies like yours leverage AI to achieve breakthrough results and operational excellence.

Would you be interested in a brief 15-minute call next week to discuss how we can help {{company_name}} achieve its goals?

Best regards
```

**개인화 변수:**
- `{{contact_name}}`: 담당자 이름
- `{{company_name}}`: 회사명
- `{{dominantBusinessType}}`: AI가 분석한 주요 비즈니스 타입
- `{{companySizeCategory}}`: 회사 규모 카테고리

---

#### **Step 2: Value Demonstration (가치 입증)**

**목적:** 케이스 스터디 및 사회적 증명 (Case study and social proof)

**템플릿 구조:**
```
제목: Case Study: How {{dominantBusinessType}} Leaders Achieve 40% Growth

본문:
Hi {{contact_name}},

I wanted to share a recent case study that might interest {{company_name}}.

We recently helped a {{companySizeCategory}} {{dominantBusinessType}} company achieve 40% revenue growth in just 6 months by implementing our AI-powered automation platform.

Their challenges were similar to what many {{dominantBusinessType}} companies face:
• Manual processes consuming valuable time
• Difficulty scaling operations
• Limited visibility into key metrics

Would you like to see the full case study? I can send it over right away.

Best regards
```

**전략:**
- 구체적인 수치 제시 (40% 성장)
- 업종별 맞춤 케이스 스터디
- 공통 문제점 제시로 공감대 형성

---

#### **Step 3: Urgency & Final CTA (긴급성 조성)**

**목적:** 한정된 기회로 FOMO 생성 및 행동 유도

**템플릿 구조:**
```
제목: Last Chance: Exclusive Workshop for {{dominantBusinessType}} Leaders

본문:
Hi {{contact_name}},

This is my final email to you about our exclusive opportunity.

We are hosting a private workshop for top {{dominantBusinessType}} leaders next month where we will share:
• Advanced AI strategies that are working RIGHT NOW
• Live demonstrations of real-world implementations
• Exclusive networking with industry peers

Only 10 spots are available, and we are already at 7 confirmed attendees.

Would {{company_name}} like to join us?

Please reply by Friday to secure your spot!

Best regards
```

**전략:**
- 명확한 마감 기한 (Friday)
- 제한된 자리 (10 spots, 7 confirmed)
- 독점성 강조 (Exclusive, Private)
- 최종 CTA (Call-to-Action)

---

## 3. 프롬프트 생성 로직

### 3.1 리드 샘플링

```sql
-- 20개 랜덤 리드 샘플링
SELECT
  l.id,
  l.company_name,
  l.contact_name,
  l.business_type,
  l.employee_count,
  l.lead_score,
  l.lead_source,
  l.description,
  l.city,
  l.country
FROM leads l
INNER JOIN customer_group_members cgm ON cgm.lead_id = l.id
WHERE cgm.group_id = {{customerGroupId}}
  AND l.workspace_id = {{workspaceId}}
ORDER BY RANDOM()
LIMIT 20
```

### 3.2 전략 생성 알고리즘

```typescript
/**
 * 전략 생성 단계
 */
function generateSequenceStrategy(leadSamples: Lead[]) {
  // 1. 리드 특성 분석
  const avgLeadScore = calculateAverageScore(leadSamples)
  const dominantBusinessType = findMostFrequentType(leadSamples)
  const avgCompanySize = calculateAverageSize(leadSamples)
  const companySizeCategory = categorizeCompanySize(avgCompanySize)
  const businessTypeFocus = determineBusinessFocus(leadSamples)

  // 2. 이메일 전략 생성
  return {
    step1: generateInitialContact(dominantBusinessType, companySizeCategory),
    step2: generateValueDemonstration(dominantBusinessType, companySizeCategory),
    step3: generateUrgencyCTA(dominantBusinessType),
  }
}
```

### 3.3 데이터베이스 저장 (CTE Query)

```sql
WITH
-- 1. 시퀀스 생성
new_sequence AS (
  INSERT INTO sequences (
    id, workspace_id, customer_group_id,
    name, description, status
  ) VALUES (
    gen_random_uuid(),
    {{workspaceId}},
    {{customerGroupId}},
    'AI-Generated Sequence for {{customerGroupName}}',
    'AI-optimized sequence for {{companySizeCategory}} {{dominantBusinessType}} companies',
    'active'
  )
  RETURNING *
),

-- 2. Step 1 생성
new_sequence_step_1 AS (
  INSERT INTO sequence_steps (
    id, sequence_id, step_order, delay_days,
    scheduled_hour, scheduled_minute, timezone,
    email_subject, email_body_text
  ) SELECT
    gen_random_uuid(),
    id,
    1,
    0,    -- 즉시 발송
    9,    -- 9 AM
    0,    -- :00분
    'Asia/Seoul',
    {{step1_subject}},
    {{step1_body}}
  FROM new_sequence
  RETURNING *
),

-- 3. Step 2 생성
new_sequence_step_2 AS (
  INSERT INTO sequence_steps (
    id, sequence_id, step_order, delay_days,
    scheduled_hour, scheduled_minute, timezone,
    email_subject, email_body_text
  ) SELECT
    gen_random_uuid(),
    id,
    2,
    3,    -- 3일 후
    10,   -- 10 AM
    0,
    'Asia/Seoul',
    {{step2_subject}},
    {{step2_body}}
  FROM new_sequence
  RETURNING *
),

-- 4. Step 3 생성
new_sequence_step_3 AS (
  INSERT INTO sequence_steps (
    id, sequence_id, step_order, delay_days,
    scheduled_hour, scheduled_minute, timezone,
    email_subject, email_body_text
  ) SELECT
    gen_random_uuid(),
    id,
    3,
    5,    -- Step 2로부터 5일 후
    14,   -- 2 PM
    0,
    'Asia/Seoul',
    {{step3_subject}},
    {{step3_body}}
  FROM new_sequence
  RETURNING *
)

-- 5. 결과 반환
SELECT json_build_object(
  'sequence', (SELECT row_to_json(new_sequence.*) FROM new_sequence),
  'steps', (
    SELECT json_agg(row_to_json(steps.*) ORDER BY steps.step_order) FROM (
      SELECT * FROM new_sequence_step_1
      UNION ALL SELECT * FROM new_sequence_step_2
      UNION ALL SELECT * FROM new_sequence_step_3
    ) steps
  ),
  'total_steps', 3,
  'status', 'active'
) as result
```

---

## 4. 개선 가능한 부분 (TODO)

현재는 하드코딩된 전략을 사용하지만, 향후 개선 방향:

### 4.1 LLM 기반 동적 생성

```typescript
// TODO: LLM을 활용한 고도화된 전략 생성
async function generateStrategyWithLLM(leadSamples: Lead[]) {
  const prompt = `
    Analyze the following ${leadSamples.length} leads and generate
    a personalized email sequence strategy:

    Lead Data:
    ${JSON.stringify(leadSamples, null, 2)}

    Generate:
    1. 3 email subjects
    2. 3 email bodies
    3. Optimal timing for each email
    4. Personalization strategy
  `

  return await llm.generate(prompt)
}
```

### 4.2 A/B 테스트 기능

```typescript
// TODO: 다양한 전략 변형 생성 및 테스트
interface StrategyVariant {
  name: string
  subject: string
  body: string
  timing: EmailTiming
  expectedPerformance: number
}
```

### 4.3 성과 기반 학습

```typescript
// TODO: 이전 캠페인 성과를 학습하여 전략 개선
function learnFromPastCampaigns(
  pastSequences: Sequence[],
  performanceMetrics: Metrics[]
) {
  // 높은 성과를 낸 패턴 분석
  // 향후 시퀀스 생성에 반영
}
```

---

## 5. 참고 정보

### 데이터베이스 스키마

```sql
-- sequences 테이블
CREATE TABLE sequences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  customer_group_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('draft', 'active', 'paused', 'archived', 'completed'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- sequence_steps 테이블
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL,
  scheduled_hour INTEGER,
  scheduled_minute INTEGER,
  timezone VARCHAR(50),
  email_subject VARCHAR(255) NOT NULL,
  email_body_text TEXT,
  email_body_html TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 관련 노드

- `handleSequenceGenerationRequest`: 시퀀스 생성 요청 처리
- `analyzeLeadsAndGenerateStrategy`: 리드 분석 및 전략 생성 (src/services/chatbot/nodes/sequence-generation.ts:96)
- `generateSequenceWithStrategy`: DB에 시퀀스 저장 (src/services/chatbot/nodes/sequence-generation.ts:361)

---

## 6. 사용 예시

### 입력 데이터

```json
{
  "customerGroupId": "abc-123",
  "customerGroupName": "Tech Startups Q1 2024",
  "membersCount": 150,
  "workspaceId": "workspace-xyz"
}
```

### 생성된 시퀀스

```json
{
  "sequence": {
    "id": "seq-456",
    "name": "AI-Generated Sequence for Tech Startups Q1 2024",
    "status": "active"
  },
  "steps": [
    {
      "step_order": 1,
      "delay_days": 0,
      "scheduled_hour": 9,
      "email_subject": "Transform Your SaaS Business with AI Solutions",
      "timing": "Day 0 - 9:00 AM KST"
    },
    {
      "step_order": 2,
      "delay_days": 3,
      "scheduled_hour": 10,
      "email_subject": "Case Study: How SaaS Leaders Achieve 40% Growth",
      "timing": "Day 3 - 10:00 AM KST"
    },
    {
      "step_order": 3,
      "delay_days": 5,
      "scheduled_hour": 14,
      "email_subject": "Last Chance: Exclusive Workshop for SaaS Leaders",
      "timing": "Day 8 - 2:00 PM KST"
    }
  ],
  "ai_analysis": {
    "avg_lead_score": 75.5,
    "dominant_business_type": "SaaS",
    "avg_company_size": 45,
    "company_size_category": "small to medium",
    "samples_analyzed": 20
  }
}
```
