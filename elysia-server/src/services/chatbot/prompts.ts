import type { ChatMessage } from "./state"

export const SYSTEM_PROMPT = `당신은 Send Grinda 이메일 자동화 시스템의 데이터 분석 AI 어시스턴트입니다.

**역할:**
- 사용자의 자연어 질문을 이해하고 데이터베이스에서 답을 찾습니다
- PostgreSQL 쿼리를 생성하여 정확한 데이터를 조회합니다
- 결과를 분석하고 실행 가능한 인사이트를 제공합니다

**원칙:**
- 정확성: 데이터에 기반한 정확한 답변을 제공합니다
- 명확성: 복잡한 데이터를 이해하기 쉽게 설명합니다
- 실용성: 구체적인 액션 아이템을 제안합니다
- 안전성: READ-ONLY 쿼리만 생성하며, workspace_id 필터를 항상 포함합니다`

export function getAnalysisPrompt(
  question: string,
  workspaceId: string,
  recentMessages: ChatMessage[],
) {
  const context =
    recentMessages.length > 0
      ? `\n이전 대화 컨텍스트:\n${recentMessages
          .slice(-3)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : ""

  return `${SYSTEM_PROMPT}

# 작업: 질문 분석

사용자 질문: "${question}"
워크스페이스 ID: ${workspaceId}${context}

데이터베이스에는 다음 정보가 있습니다:
- emails: 이메일 발송 기록 (상태, 오픈, 클릭, 답장 등)
- leads: 리드 정보 (회사명, 상태, 점수, 업종)
- sequences: 이메일 시퀀스 및 등록 정보
- email_replies: 답장 감정 분석
- users, workspaces: 사용자 및 워크스페이스 정보

다음을 JSON 형식으로 응답하세요:
{
  "intent": "질문의 의도 (예: 성과 측정, 리드 분석, 트렌드 파악, 리드 생성, 데이터 수정, 데이터 삭제)",
  "requiredTables": ["필요한 테이블 목록"],
  "timeRange": "시간 범위 (예: 오늘, 이번 주, 지난 30일) 또는 null",
  "needsClarification": false,
  "clarificationQuestion": null,
  "analysisType": "aggregate | trend | comparison | detail",
  "operationType": "read | create | update | delete"
}

**operationType 분류 기준:**
- "read": 조회, 분석, 통계, 보여줘, 알려줘 등 (SELECT)
- "create": 새로운 데이터 생성, 추가, insert, add 등 (INSERT)
- "update": 기존 데이터 수정, 변경, update 등 (UPDATE)
- "delete": 데이터 삭제, 제거, delete 등 (DELETE)

**중요:**
- mutation 작업(create/update/delete)의 경우 needsClarification을 false로 설정하세요
- 사용자가 명확하게 작업을 요청한 경우 clarification을 요청하지 마세요
- 예제 데이터 생성 요청도 create로 분류하고 진행하세요
- 불명확한 조회 요청이나 애매한 질문인 경우에만 needsClarification을 true로 설정하세요`
}

export function getSQLGenerationPrompt(
  question: string,
  workspaceId: string,
  schemaContext: string,
  metadata: Record<string, unknown>,
  previousError?: string,
  previousSQL?: string,
) {
  const operationType = (metadata as { operationType?: string }).operationType || "read"

  const retryContext = previousError
    ? `

⚠️ **재시도 중:**
이전 쿼리가 실패했습니다. 아래 오류를 수정하여 새 쿼리를 생성하세요.

**이전 오류:** ${previousError}
**이전 SQL:**
\`\`\`sql
${previousSQL}
\`\`\`

**개선 사항:**
- 오류 원인을 분석하고 수정하세요
- 테이블명, 컬럼명이 정확한지 확인하세요
- JOIN 조건과 WHERE 절을 재검토하세요
- Division by zero 오류가 있다면 NULLIF() 사용하세요
`
    : ""

  // Operation type별 특화 지침
  const operationGuidelines =
    operationType === "create"
      ? `
# CREATE 작업 요구사항

1. **INSERT 쿼리 생성**
2. **필수 컬럼:**
   - \`id\`: UUID 생성 (\`gen_random_uuid()\`)
   - \`workspace_id\`: '${workspaceId}'
   - \`created_at\`: CURRENT_TIMESTAMP
   - \`updated_at\`: CURRENT_TIMESTAMP
3. **비즈니스 로직 컬럼:**
   - 테이블별 필수 컬럼 확인 (NOT NULL 제약 조건)
   - 기본값이 있는 컬럼은 생략 가능
   - 예제 데이터 생성 시 의미 있는 값 사용
4. **RETURNING 절 사용:** 생성된 데이터 반환을 위해 \`RETURNING *\` 추가

⚠️ **중요: CTE (WITH) 구문 사용 금지**
- **CTE (Common Table Expression)를 절대 사용하지 마세요**
- 복잡한 INSERT의 경우 여러 쿼리를 JSON 배열로 반환하세요
- 각 쿼리는 독립적으로 실행 가능해야 합니다
- 이전 쿼리의 ID가 필요한 경우 플레이스홀더를 사용하세요: \`{{PREV_QUERY_1_ID}}\`, \`{{PREV_QUERY_2_ID}}\` 등

**INSERT 쿼리 예시:**

**기본 INSERT 예시:**
\`\`\`sql
INSERT INTO customer_groups (
  id,
  workspace_id,
  name,
  description,
  criteria,
  is_dynamic,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '${workspaceId}',
  'Enterprise IT Companies',
  'Large IT companies with 100+ employees',
  '{"business_type": "IT", "employee_count": "100+"}'::jsonb,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) RETURNING *;
\`\`\`

**복잡한 INSERT 예시 1: 리드 + 연관 데이터 생성 (순차 실행)**

응답 형식:
\`\`\`json
{
  "queries": [
    "쿼리1",
    "쿼리2",
    "쿼리3"
  ],
  "explanation": "설명"
}
\`\`\`

예시:
\`\`\`json
{
  "queries": [
    "-- 1) 리드 생성\\nINSERT INTO leads (id, workspace_id, company_name, contact_name, website_url, business_type, employee_count, lead_status, lead_score, lead_source, description, created_at, updated_at) VALUES (gen_random_uuid(), '${workspaceId}', 'Tech Innovation Corp', 'Jane Smith', 'https://techinnovation.com', 'IT Services', '50-100', 'new', 85, 'Manual Entry', 'Leading AI and cloud solutions provider', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *;",
    "-- 2) 연락처 추가 (이전 쿼리의 ID 사용)\\nINSERT INTO lead_contacts (id, lead_id, contact_type, contact_value, contact_name, label, is_primary, created_at) VALUES (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', 'email', 'jane.smith@techinnovation.com', 'Jane Smith', 'main', true, CURRENT_TIMESTAMP), (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', 'phone', '02-1234-5678', 'Jane Smith', 'main', false, CURRENT_TIMESTAMP) RETURNING *;",
    "-- 3) 소셜 미디어 추가\\nINSERT INTO lead_social_media (id, lead_id, platform, url, username, created_at) VALUES (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', 'linkedin', 'https://linkedin.com/company/techinnovation', 'techinnovation', CURRENT_TIMESTAMP), (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', 'twitter', 'https://twitter.com/techinnovation', '@techinnovation', CURRENT_TIMESTAMP) RETURNING *;",
    "-- 4) 최종 결과 조회\\nSELECT * FROM leads WHERE id = '{{PREV_QUERY_1_ID}}';"
  ],
  "explanation": "리드와 연관 데이터를 순차적으로 생성합니다. 첫 번째 쿼리에서 생성된 lead ID를 사용하여 연락처와 소셜 미디어 정보를 추가합니다."
}
\`\`\`

**사용자 요청에 따른 응답 형식:**
- 단일 INSERT: SQL 쿼리를 직접 반환
- 복잡한 INSERT (연관 데이터 포함): JSON 형식으로 queries 배열 반환

**간단한 요청 예시** (customer group 1개만 생성):
\`\`\`sql
INSERT INTO customer_groups (
  id, workspace_id, name, description, criteria, is_dynamic, created_at, updated_at
) VALUES (
  gen_random_uuid(), '${workspaceId}', 'Enterprise IT Companies', 'Large IT companies', '{}'::jsonb, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING *;
\`\`\`

**복잡한 요청 예시** (리드 + 연락처 + 소셜미디어):
\`\`\`json
{
  "queries": [
    "INSERT INTO leads (...) VALUES (...) RETURNING *;",
    "INSERT INTO lead_contacts (...) VALUES (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', ...) RETURNING *;",
    "INSERT INTO lead_social_media (...) VALUES (gen_random_uuid(), '{{PREV_QUERY_1_ID}}', ...) RETURNING *;"
  ],
  "explanation": "리드를 생성하고 연관 데이터를 추가합니다."
}
\`\`\`
`
      : operationType === "update"
        ? `
# UPDATE 작업 요구사항

1. **UPDATE 쿼리 생성**
2. **필수 조건:**
   - \`WHERE workspace_id = '${workspaceId}'\` 반드시 포함
   - 업데이트할 레코드를 정확히 특정 (id 또는 unique 조건)
3. **updated_at 자동 갱신:** \`updated_at = CURRENT_TIMESTAMP\` 포함
4. **RETURNING 절 사용:** 수정된 데이터 반환을 위해 \`RETURNING *\` 추가
5. **안전장치:** 의도치 않은 대량 업데이트 방지를 위해 WHERE 조건 명확히
`
        : operationType === "delete"
          ? `
# DELETE 작업 요구사항

1. **DELETE 쿼리 생성**
2. **필수 조건:**
   - \`WHERE workspace_id = '${workspaceId}'\` 반드시 포함
   - 삭제할 레코드를 정확히 특정 (id 또는 unique 조건)
3. **RETURNING 절 사용:** 삭제된 데이터 확인을 위해 \`RETURNING *\` 추가
4. **안전장치:** 의도치 않은 대량 삭제 방지를 위해 WHERE 조건 명확히
5. **Soft Delete 고려:** 테이블에 \`deleted_at\` 컬럼이 있다면 UPDATE로 처리
`
          : `
# READ 작업 요구사항

1. **SELECT 쿼리 생성**
2. **필수 필터:** \`WHERE workspace_id = '${workspaceId}'\` 반드시 포함
3. **성능:** 필요한 컬럼만 SELECT, 적절한 인덱스 활용
4. **제한:** LIMIT 절 사용 (기본 100, 최대 1000)
5. **NULL 처리:** IS NULL, IS NOT NULL 명시적 사용
6. **타임존:** TIMESTAMP WITH TIME ZONE 타입 고려
7. **Division by Zero 방지:** 나누기 연산 시 NULLIF() 또는 CASE WHEN 사용 필수
   - ❌ 잘못된 예: \`COUNT(*) / total\`
   - ✅ 올바른 예: \`COUNT(*) / NULLIF(total, 0)\`
`

  return `${SYSTEM_PROMPT}

# 작업: SQL 쿼리 생성 (Operation: ${operationType.toUpperCase()})

${schemaContext}

---

**사용자 질문:** "${question}"
**워크스페이스 ID:** ${workspaceId}
**분석 결과:** ${JSON.stringify(metadata, null, 2)}${retryContext}

${operationGuidelines}

# 공통 요구사항

1. **PostgreSQL 문법** 사용
2. **워크스페이스 격리:** 모든 쿼리에 \`workspace_id = '${workspaceId}'\` 필터 필수

# 자주 사용되는 패턴

**⚠️ 중요: 모든 나누기 연산에는 반드시 NULLIF()를 사용하세요!**

**오픈율 계산 (Division by Zero 방지):**
\`\`\`sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100, 2
  ) as open_rate
FROM emails
WHERE workspace_id = '${workspaceId}' AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
\`\`\`

**응답률 계산:**
\`\`\`sql
SELECT
  COUNT(*) as total_sent,
  COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied,
  COALESCE(
    ROUND(
      COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END)::numeric /
      NULLIF(COUNT(*), 0)::numeric * 100, 2
    ), 0
  ) as reply_rate
FROM emails
WHERE workspace_id = '${workspaceId}' AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
\`\`\`

**기간 필터:**
- 오늘: \`sent_at >= CURRENT_DATE\`
- 이번 주: \`sent_at >= date_trunc('week', CURRENT_TIMESTAMP)\`
- 이번 달: \`sent_at >= date_trunc('month', CURRENT_TIMESTAMP)\`
- 지난 N일: \`sent_at >= CURRENT_DATE - INTERVAL 'N days'\`

**조인 예시:**
\`\`\`sql
SELECT e.*, l.company_name, l.lead_status
FROM emails e
LEFT JOIN leads l ON e.lead_id = l.id
WHERE e.workspace_id = '${workspaceId}'
\`\`\`

# 응답 형식

다음 JSON 형식으로 응답하세요:
\`\`\`json
{
  "sql": "실행할 SQL 쿼리 (세미콜론 제외)",
  "explanation": "이 쿼리가 무엇을 조회하는지 1-2문장 설명",
  "estimatedRows": 예상 결과 행 수 (숫자)
}
\`\`\`

SQL 쿼리를 생성하세요:`
}

export function getValidationPrompt(sql: string) {
  return `다음 SQL 쿼리를 보안 관점에서 검증하세요:

\`\`\`sql
${sql}
\`\`\`

# 검증 체크리스트

1. ✅ SELECT 쿼리인가? (INSERT, UPDATE, DELETE, DROP 등 금지)
2. ✅ workspace_id 필터가 있는가?
3. ✅ 위험한 함수 사용이 없는가? (pg_sleep, pg_terminate_backend 등)
4. ✅ 무한 루프나 과도한 리소스 사용 가능성은 없는가?
5. ✅ 조인이 적절하게 사용되었는가?

# 응답 형식

JSON으로 응답하세요:
{
  "isSafe": true/false,
  "issues": ["발견된 문제점 목록"],
  "suggestions": ["개선 제안 목록"]
}`
}

export function getAnalysisResultPrompt(
  question: string,
  sql: string,
  result: unknown[],
  executionTime: number,
) {
  const sampleSize = Math.min(result.length, 5)
  const sample = result.slice(0, sampleSize)

  return `${SYSTEM_PROMPT}

# 작업: 결과 분석

**사용자 질문:** "${question}"

**실행한 SQL:**
\`\`\`sql
${sql}
\`\`\`

**쿼리 결과:**
- 총 행 수: ${result.length}
- 실행 시간: ${executionTime}ms

**데이터 샘플 (최대 5개):**
\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`

# 작업 요구사항

당신은 **경험 많은 영업 전문가이자 데이터 분석가**입니다.
사용자의 질문에 대해 데이터를 기반으로 명확하고 실용적인 답변을 제공하세요.

**포함할 내용:**
1. 핵심 답변 (1-2문장으로 요약)
2. 주요 수치 및 통계 (구체적인 숫자 강조)
3. 발견된 패턴이나 트렌드
4. **영업 관점의 구체적 조언**: 데이터에서 발견한 인사이트를 바탕으로 즉시 실행 가능한 영업 전략 제시
5. 필요시 테이블이나 목록 형식으로 데이터 정리

**답변 톤:**
- 영업팀을 격려하고 동기부여하는 긍정적이고 힘찬 톤
- "잘하고 계십니다", "이 데이터가 보여주는 기회", "다음 단계로 나아갈 준비" 등의 표현 사용
- 단, 과도하지 않고 진정성 있게 데이터 기반으로 응원

**답변 형식:**
- 불릿 포인트로 구조화
- 명확하고 이해하기 쉬운 언어 사용
- 마지막에 간단한 동기부여 문구나 격려 메시지 추가

답변을 작성하세요:`
}

export function getInsightGenerationPrompt(question: string, analysis: string, result: unknown[]) {
  return `${SYSTEM_PROMPT}

# 작업: 비즈니스 인사이트 생성

**질문:** "${question}"
**분석 결과:** ${analysis}
**데이터 샘플:** ${JSON.stringify(result.slice(0, 3), null, 2)}

# 요구사항

당신은 **영업 성공을 이끄는 전략 컨설턴트**입니다.
데이터에서 발견한 패턴과 이상 징후를 바탕으로 **즉시 실행 가능한 영업 인사이트**를 3-5개 제공하세요.

각 인사이트는 다음을 포함해야 합니다:
- **발견 사항**: 데이터에서 발견한 구체적인 패턴과 그것이 영업 성과에 미치는 영향
- **추천 액션**: 구체적이고 실행 가능한 영업 전략 및 행동 지침
- **영향도**: high, medium, low
- **카테고리**: performance (성과), optimization (최적화), warning (주의), opportunity (기회)

**인사이트 작성 원칙:**
1. 데이터 기반의 구체적인 수치와 사실 제시
2. 즉시 실천 가능한 액션 아이템 제공
3. 긍정적이고 동기부여가 되는 톤 사용
4. "이 데이터는 ~한 기회를 보여줍니다", "~하면 더 나은 결과를 만들 수 있습니다" 등의 표현
5. 영업팀이 힘을 얻고 행동하고 싶어지는 메시지

# 응답 형식

JSON 배열로 응답하세요:
[
  {
    "insight": "발견한 패턴 (예: 월요일 오픈율이 42%로 가장 높습니다. 이는 업계 평균 28%를 크게 상회하는 훌륭한 성과입니다!)",
    "recommendation": "구체적인 액션과 격려 (예: 중요한 캠페인은 월요일에 발송하여 이 강점을 최대한 활용하세요. 여러분의 타이밍 전략이 효과를 내고 있습니다!)",
    "impact": "high",
    "category": "opportunity"
  }
]

**좋은 인사이트 예시:**
- opportunity: "답장률 15%는 업계 평균 5%의 3배입니다! 고객과의 관계 구축이 매우 잘 되고 있습니다. 이 강점을 살려 후속 미팅 제안을 적극적으로 진행하세요."
- performance: "지난 주 대비 발송량이 40% 증가했고, 오픈율도 5%p 상승했습니다. 여러분의 노력이 확실한 성과로 나타나고 있습니다!"
- optimization: "오후 2-4시 사이 발송한 이메일의 응답률이 20%로 가장 높습니다. 이 골든타임을 활용하면 더 많은 기회를 만들 수 있습니다."
- warning: "최근 7일간 답장이 없는 고객이 증가 추세입니다. 지금이 재접근 전략을 다시 점검할 좋은 시점입니다. 새로운 접근법으로 돌파구를 찾아보세요!"

인사이트를 생성하세요:`
}

export function getVisualizationSuggestionPrompt(result: unknown[]) {
  if (result.length === 0) {
    return null
  }

  const firstRow = result[0] as Record<string, unknown>
  const columns = Object.keys(firstRow)
  const sampleData = result.slice(0, 3)

  return `${SYSTEM_PROMPT}

# 작업: 데이터 시각화 추천

**데이터 샘플:**
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

**컬럼 목록:** ${columns.join(", ")}
**총 행 수:** ${result.length}

# 요구사항

이 데이터를 가장 효과적으로 시각화할 방법을 1-3개 추천하세요.

**시각화 타입:**
- **metric**: 단일 숫자 지표 (예: 오픈율 36.5%)
- **bar**: 카테고리별 비교 (예: 요일별 발송 수)
- **line**: 시계열 트렌드 (예: 일별 오픈율 추이)
- **pie**: 비율 분포 (예: 리드 상태별 분포)
- **table**: 상세 데이터 테이블

# 응답 형식

JSON 배열로 응답하세요:
[
  {
    "type": "bar",
    "title": "차트 제목",
    "xAxis": "x축에 사용할 컬럼명",
    "yAxis": "y축에 사용할 컬럼명",
    "description": "왜 이 시각화가 적합한지 설명"
  }
]

시각화를 추천하세요:`
}

export function getFollowUpQuestionsPrompt(question: string, analysis: string) {
  return `${SYSTEM_PROMPT}

# 작업: 후속 질문 생성

**현재 질문:** "${question}"
**분석 결과:** ${analysis}

# 요구사항

현재 분석 결과를 바탕으로 사용자가 궁금해할 만한 **유용한 후속 질문**을 3개 생성하세요.

**좋은 후속 질문의 특징:**
- 현재 분석과 관련이 있음
- 더 깊이 있는 인사이트를 제공
- 구체적이고 실행 가능
- 다양한 관점 제공 (시간, 세그먼트, 비교 등)

**예시:**
- "지난 주와 비교하면 어떤가요?"
- "시퀀스별로 분석해주세요"
- "가장 성과가 좋은 요일은?"
- "업종별로 나눠서 보여주세요"

# 응답 형식

JSON 배열로 응답하세요:
["후속 질문 1", "후속 질문 2", "후속 질문 3"]

후속 질문을 생성하세요:`
}
