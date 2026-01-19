# 초개인화 이메일 기능 개발 계획 (최적안)

## 📋 개요

기존 템플릿 기반 이메일 시스템을 유지하면서, 리드별 AI 초개인화 이메일 기능을 추가합니다.

---

## 🔍 현재 아키텍처 분석 요약

### 기존 이메일 생성 흐름
```
Survey 입력 → 리드 발굴 → 6단계 템플릿 생성(sequence_steps)
→ 리드별 드래프트 생성(workflow_generated_emails) → 발송(emails)
```

### 핵심 테이블
| 테이블 | 역할 |
|--------|------|
| `sequence_steps` | 6단계 이메일 템플릿 (공통) |
| `workflow_generated_emails` | 리드별 사전 생성 이메일 (node_id 기반) |
| `emails` | 실제 발송된 이메일 기록 |
| `sequence_step_executions` | 발송 실행 추적 |

### 발견된 최적화 포인트
> **`workflow_generated_emails` 테이블이 이미 `leadId` 컬럼을 보유**하고 있으나,
> 현재는 React Flow `node_id` 기반으로 설계되어 시퀀스 스텝과 1:1 매핑이 명확하지 않음.

---

## 🎯 최적 방안: 하이브리드 접근법

### 전략 요약

| 구분 | 기존 방식 | 초개인화 방식 |
|------|-----------|---------------|
| **템플릿** | `sequence_steps` 공통 템플릿 | 동일 (폴백용) |
| **이메일 저장** | `workflow_generated_emails` (node_id) | **신규** `sequence_personalized_emails` (stepId) |
| **발송 로직** | 템플릿 변수 치환 | AI 생성 초개인화 이메일 우선 사용 |
| **UI** | 템플릿 편집 모드 | 템플릿 + 개인화 모드 토글 |

---

## 📊 Phase 1: 데이터베이스 변경

### 1.1 신규 테이블: `sequence_personalized_emails`

```sql
CREATE TABLE sequence_personalized_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 핵심 FK (복합 유니크 인덱스)
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- 이메일 내용
  subject VARCHAR(500) NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,

  -- 생성 메타데이터
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | generating | generated | edited | failed
  generation_mode VARCHAR(20) DEFAULT 'ai',        -- ai | manual
  ai_model VARCHAR(100),                           -- gemini-1.5-pro, claude-3-sonnet 등
  ai_prompt TEXT,                                  -- 생성에 사용된 프롬프트

  -- 개인화 컨텍스트 (생성 시점의 리드 정보 스냅샷)
  lead_context JSONB,
  /*
    예시:
    {
      "companyName": "ABC Corp",
      "industry": "SaaS",
      "products": ["CRM", "Analytics"],
      "recentNews": "Series B funding...",
      "painPoints": ["scalability", "integration"],
      "website": "https://abc.com"
    }
  */

  -- 버전 관리 (A/B 테스트 대비)
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- 성능 추적
  generation_time_ms INTEGER,
  token_count INTEGER,

  -- 에러 처리
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- 타임스탬프
  generated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유니크 제약 (리드당 스텝당 하나의 활성 이메일)
  CONSTRAINT uq_personalized_email UNIQUE (sequence_id, step_id, lead_id, is_active)
);

-- 인덱스
CREATE INDEX idx_personalized_emails_sequence ON sequence_personalized_emails(sequence_id);
CREATE INDEX idx_personalized_emails_step ON sequence_personalized_emails(step_id);
CREATE INDEX idx_personalized_emails_lead ON sequence_personalized_emails(lead_id);
CREATE INDEX idx_personalized_emails_status ON sequence_personalized_emails(status);
CREATE INDEX idx_personalized_emails_lookup ON sequence_personalized_emails(sequence_id, step_id, lead_id) WHERE is_active = true;
```

### 1.2 `sequences` 테이블 확장

```sql
ALTER TABLE sequences ADD COLUMN personalization_mode VARCHAR(20) DEFAULT 'template';
-- 값: 'template' | 'personalized' | 'hybrid'

ALTER TABLE sequences ADD COLUMN personalization_config JSONB;
/*
  예시:
  {
    "aiModel": "gemini-1.5-pro",
    "tone": "professional",
    "language": "ko",
    "includeRecentNews": true,
    "maxTokens": 500
  }
*/
```

### 1.3 Drizzle 스키마 추가

**파일:** `elysia-server/src/db/schema/sequence-personalized-emails.ts`

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sequences } from './sequences';
import { sequenceSteps } from './sequence-steps';
import { leads } from './leads';

export const sequencePersonalizedEmails = pgTable('sequence_personalized_emails', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 핵심 FK
  sequenceId: uuid('sequence_id').notNull().references(() => sequences.id, { onDelete: 'cascade' }),
  stepId: uuid('step_id').notNull().references(() => sequenceSteps.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),

  // 이메일 내용
  subject: varchar('subject', { length: 500 }).notNull(),
  bodyText: text('body_text').notNull(),
  bodyHtml: text('body_html'),

  // 생성 메타데이터
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  generationMode: varchar('generation_mode', { length: 20 }).default('ai'),
  aiModel: varchar('ai_model', { length: 100 }),
  aiPrompt: text('ai_prompt'),

  // 개인화 컨텍스트
  leadContext: jsonb('lead_context'),

  // 버전 관리
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),

  // 성능 추적
  generationTimeMs: integer('generation_time_ms'),
  tokenCount: integer('token_count'),

  // 에러 처리
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),

  // 타임스탬프
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // 인덱스
  sequenceIdx: index('idx_personalized_emails_sequence').on(table.sequenceId),
  stepIdx: index('idx_personalized_emails_step').on(table.stepId),
  leadIdx: index('idx_personalized_emails_lead').on(table.leadId),
  statusIdx: index('idx_personalized_emails_status').on(table.status),
  // 유니크 복합 인덱스
  uniqueActiveEmail: uniqueIndex('uq_personalized_email_active')
    .on(table.sequenceId, table.stepId, table.leadId)
    .where(sql`is_active = true`),
}));

// 타입 export
export type SequencePersonalizedEmail = typeof sequencePersonalizedEmails.$inferSelect;
export type NewSequencePersonalizedEmail = typeof sequencePersonalizedEmails.$inferInsert;
```

---

## 📊 Phase 2: 백엔드 API 변경

### 2.1 초개인화 이메일 생성 서비스

**파일:** `elysia-server/src/services/personalized-email-generation.service.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { sequencePersonalizedEmails, leads, sequenceSteps, sequences } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface PersonalizationContext {
  lead: {
    companyName: string;
    industry: string;
    products?: string[];
    website?: string;
    description?: string;
    recentNews?: string;
    painPoints?: string[];
    contactName?: string;
  };
  seller: {
    companyName: string;
    industry: string;
    valueProposition: string;
  };
  step: {
    order: number;
    purpose: string; // "cold_intro" | "follow_up" | "value" | "meeting" | "breakup"
  };
}

export class PersonalizedEmailGenerationService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  /**
   * 단일 리드에 대한 초개인화 이메일 생성
   */
  async generateForLead(
    sequenceId: string,
    stepId: string,
    leadId: string,
    context: PersonalizationContext
  ): Promise<SequencePersonalizedEmail> {
    const startTime = Date.now();

    // 1. pending 상태로 레코드 생성
    const [record] = await db.insert(sequencePersonalizedEmails).values({
      sequenceId,
      stepId,
      leadId,
      subject: '',
      bodyText: '',
      status: 'generating',
      generationMode: 'ai',
      aiModel: 'gemini-1.5-pro',
      leadContext: context.lead,
    }).returning();

    try {
      // 2. AI 프롬프트 구성
      const prompt = this.buildPrompt(context);

      // 3. Gemini API 호출
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // 4. 응답 파싱 (JSON 형식 기대)
      const parsed = this.parseEmailResponse(response);

      // 5. 레코드 업데이트
      const [updated] = await db.update(sequencePersonalizedEmails)
        .set({
          subject: parsed.subject,
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          status: 'generated',
          aiPrompt: prompt,
          generationTimeMs: Date.now() - startTime,
          tokenCount: result.response.usageMetadata?.totalTokenCount,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sequencePersonalizedEmails.id, record.id))
        .returning();

      return updated;
    } catch (error) {
      // 에러 시 상태 업데이트
      await db.update(sequencePersonalizedEmails)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: sql`retry_count + 1`,
          updatedAt: new Date(),
        })
        .where(eq(sequencePersonalizedEmails.id, record.id));

      throw error;
    }
  }

  /**
   * 시퀀스의 모든 리드에 대해 배치 생성
   */
  async generateBatchForSequence(
    sequenceId: string,
    options: { concurrency?: number; stepIds?: string[] } = {}
  ): Promise<{ success: number; failed: number; total: number }> {
    const { concurrency = 5, stepIds } = options;

    // 1. 시퀀스 정보 조회
    const [sequence] = await db.select()
      .from(sequences)
      .where(eq(sequences.id, sequenceId));

    if (!sequence) throw new Error('Sequence not found');

    // 2. 스텝 목록 조회
    let stepsQuery = db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequenceId));
    if (stepIds?.length) {
      stepsQuery = stepsQuery.where(inArray(sequenceSteps.id, stepIds));
    }
    const steps = await stepsQuery;

    // 3. 선택된 리드 목록 조회
    const leadIds = sequence.selectedLeadIds as string[];
    const leadsData = await db.select().from(leads).where(inArray(leads.id, leadIds));

    // 4. 작업 대기열 구성
    const tasks: Array<{ stepId: string; leadId: string; lead: Lead }> = [];
    for (const step of steps) {
      for (const lead of leadsData) {
        tasks.push({ stepId: step.id, leadId: lead.id, lead });
      }
    }

    // 5. 병렬 처리 (concurrency 제한)
    let success = 0;
    let failed = 0;

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(({ stepId, leadId, lead }) =>
          this.generateForLead(sequenceId, stepId, leadId, {
            lead: {
              companyName: lead.companyName || '',
              industry: lead.businessType || '',
              website: lead.websiteUrl || '',
              description: lead.description || '',
            },
            seller: {
              companyName: sequence.name || '',
              industry: '', // TODO: 워크스페이스에서 가져오기
              valueProposition: '',
            },
            step: {
              order: steps.find(s => s.id === stepId)?.stepOrder || 1,
              purpose: this.getStepPurpose(steps.find(s => s.id === stepId)?.stepOrder || 1),
            },
          })
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled') success++;
        else failed++;
      }
    }

    return { success, failed, total: tasks.length };
  }

  private buildPrompt(context: PersonalizationContext): string {
    const stepPurposes: Record<number, string> = {
      1: '첫 번째 콜드 이메일 - 관심 유도',
      2: '가치 제안 팔로업',
      3: '문제-해결책 제시',
      4: '소프트 범프',
      5: '미팅 제안',
      6: '마지막 연락 (브레이크업)',
    };

    return `
당신은 B2B 세일즈 이메일 전문가입니다. 다음 정보를 바탕으로 초개인화된 콜드 이메일을 작성하세요.

## 수신자 회사 정보
- 회사명: ${context.lead.companyName}
- 산업: ${context.lead.industry}
- 제품/서비스: ${context.lead.products?.join(', ') || '정보 없음'}
- 웹사이트: ${context.lead.website || '정보 없음'}
- 회사 설명: ${context.lead.description || '정보 없음'}
${context.lead.recentNews ? `- 최근 뉴스: ${context.lead.recentNews}` : ''}
${context.lead.painPoints?.length ? `- 예상 페인포인트: ${context.lead.painPoints.join(', ')}` : ''}

## 발신자 회사 정보
- 회사명: ${context.seller.companyName}
- 산업: ${context.seller.industry}
- 가치 제안: ${context.seller.valueProposition}

## 이메일 목적
- 시퀀스 ${context.step.order}단계: ${stepPurposes[context.step.order] || context.step.purpose}

## 작성 가이드라인
1. 수신자 회사에 대한 구체적인 언급으로 시작
2. 그들의 비즈니스 상황에 맞는 가치 제안 포함
3. 짧고 임팩트 있게 (150단어 이내)
4. 자연스럽고 인간적인 톤
5. 명확한 CTA 포함

## 출력 형식 (JSON)
{
  "subject": "이메일 제목",
  "bodyText": "이메일 본문 (플레인 텍스트)",
  "bodyHtml": "이메일 본문 (HTML 포맷)"
}
`;
  }

  private parseEmailResponse(response: string): { subject: string; bodyText: string; bodyHtml?: string } {
    // JSON 파싱 시도
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 파싱 실패 시 폴백
      }
    }

    // 폴백: 전체 응답을 본문으로 사용
    return {
      subject: '귀사를 위한 제안',
      bodyText: response,
    };
  }

  private getStepPurpose(stepOrder: number): string {
    const purposes: Record<number, string> = {
      1: 'cold_intro',
      2: 'follow_up',
      3: 'value',
      4: 'bump',
      5: 'meeting',
      6: 'breakup',
    };
    return purposes[stepOrder] || 'follow_up';
  }
}

export const personalizedEmailGenerationService = new PersonalizedEmailGenerationService();
```

### 2.2 API 라우트 추가

**파일:** `elysia-server/src/routes/personalized-emails.route.ts`

```typescript
import { Elysia, t } from 'elysia';
import { personalizedEmailGenerationService } from '../services/personalized-email-generation.service';
import { db } from '../db';
import { sequencePersonalizedEmails } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const personalizedEmailsRoute = new Elysia({ prefix: '/personalized-emails' })

  // 단일 초개인화 이메일 생성
  .post('/generate', async ({ body }) => {
    const { sequenceId, stepId, leadId, context } = body;

    const email = await personalizedEmailGenerationService.generateForLead(
      sequenceId, stepId, leadId, context
    );

    return { success: true, email };
  }, {
    body: t.Object({
      sequenceId: t.String(),
      stepId: t.String(),
      leadId: t.String(),
      context: t.Object({
        lead: t.Object({
          companyName: t.String(),
          industry: t.String(),
          products: t.Optional(t.Array(t.String())),
          website: t.Optional(t.String()),
          description: t.Optional(t.String()),
        }),
        seller: t.Object({
          companyName: t.String(),
          industry: t.String(),
          valueProposition: t.String(),
        }),
        step: t.Object({
          order: t.Number(),
          purpose: t.String(),
        }),
      }),
    }),
  })

  // 시퀀스 전체 배치 생성
  .post('/generate-batch', async ({ body }) => {
    const { sequenceId, stepIds, concurrency } = body;

    const result = await personalizedEmailGenerationService.generateBatchForSequence(
      sequenceId,
      { stepIds, concurrency }
    );

    return { success: true, ...result };
  }, {
    body: t.Object({
      sequenceId: t.String(),
      stepIds: t.Optional(t.Array(t.String())),
      concurrency: t.Optional(t.Number()),
    }),
  })

  // 초개인화 이메일 조회
  .get('/:sequenceId/:stepId/:leadId', async ({ params }) => {
    const { sequenceId, stepId, leadId } = params;

    const [email] = await db.select()
      .from(sequencePersonalizedEmails)
      .where(and(
        eq(sequencePersonalizedEmails.sequenceId, sequenceId),
        eq(sequencePersonalizedEmails.stepId, stepId),
        eq(sequencePersonalizedEmails.leadId, leadId),
        eq(sequencePersonalizedEmails.isActive, true),
      ));

    return { email };
  })

  // 초개인화 이메일 수정
  .put('/:id', async ({ params, body }) => {
    const { id } = params;
    const { subject, bodyText, bodyHtml } = body;

    const [updated] = await db.update(sequencePersonalizedEmails)
      .set({
        subject,
        bodyText,
        bodyHtml,
        status: 'edited',
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sequencePersonalizedEmails.id, id))
      .returning();

    return { success: true, email: updated };
  }, {
    body: t.Object({
      subject: t.String(),
      bodyText: t.String(),
      bodyHtml: t.Optional(t.String()),
    }),
  })

  // 시퀀스의 생성 상태 조회
  .get('/status/:sequenceId', async ({ params }) => {
    const { sequenceId } = params;

    const emails = await db.select({
      status: sequencePersonalizedEmails.status,
      count: sql<number>`count(*)::int`,
    })
      .from(sequencePersonalizedEmails)
      .where(eq(sequencePersonalizedEmails.sequenceId, sequenceId))
      .groupBy(sequencePersonalizedEmails.status);

    const statusMap = emails.reduce((acc, { status, count }) => {
      acc[status] = count;
      return acc;
    }, {} as Record<string, number>);

    return {
      pending: statusMap.pending || 0,
      generating: statusMap.generating || 0,
      generated: statusMap.generated || 0,
      edited: statusMap.edited || 0,
      failed: statusMap.failed || 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
    };
  });
```

---

## 📊 Phase 3: BullMQ 워커 변경

### 3.1 시퀀스 이메일 워커 수정

**파일:** `elysia-server/src/workers/sequence-email.worker.ts` (수정)

```typescript
// 기존 코드에 다음 로직 추가

async function getEmailContent(
  job: SequenceEmailJob,
  sequence: Sequence
): Promise<{ subject: string; bodyText: string; bodyHtml?: string }> {

  // 1. 개인화 모드 확인
  if (sequence.personalizationMode === 'personalized' || sequence.personalizationMode === 'hybrid') {
    // 2. 초개인화 이메일 테이블에서 조회
    const [personalizedEmail] = await db.select()
      .from(sequencePersonalizedEmails)
      .where(and(
        eq(sequencePersonalizedEmails.sequenceId, job.sequenceId),
        eq(sequencePersonalizedEmails.stepId, job.stepId),
        eq(sequencePersonalizedEmails.leadId, job.leadId),
        eq(sequencePersonalizedEmails.isActive, true),
        inArray(sequencePersonalizedEmails.status, ['generated', 'edited']),
      ));

    if (personalizedEmail) {
      console.log(`[SequenceEmailWorker] Using personalized email for lead ${job.leadId}`);
      return {
        subject: personalizedEmail.subject,
        bodyText: personalizedEmail.bodyText,
        bodyHtml: personalizedEmail.bodyHtml || undefined,
      };
    }

    // hybrid 모드이고 개인화 이메일이 없으면 템플릿으로 폴백
    if (sequence.personalizationMode === 'hybrid') {
      console.log(`[SequenceEmailWorker] Falling back to template for lead ${job.leadId}`);
    }
  }

  // 3. 기존 workflow_generated_emails 조회 (호환성 유지)
  const [workflowEmail] = await db.select()
    .from(workflowGeneratedEmails)
    .where(and(
      eq(workflowGeneratedEmails.sequenceId, job.sequenceId),
      eq(workflowGeneratedEmails.leadId, job.leadId),
      inArray(workflowGeneratedEmails.status, ['generated', 'edited']),
    ));

  if (workflowEmail) {
    return {
      subject: workflowEmail.subject,
      bodyText: workflowEmail.bodyText,
      bodyHtml: workflowEmail.bodyHtml || undefined,
    };
  }

  // 4. 템플릿 폴백 (변수 치환)
  return {
    subject: applyVariables(job.emailSubject, job),
    bodyText: applyVariables(job.emailBodyText, job),
    bodyHtml: job.emailBodyHtml ? applyVariables(job.emailBodyHtml, job) : undefined,
  };
}

// 변수 치환 함수
function applyVariables(template: string, job: SequenceEmailJob): string {
  return template
    .replace(/\{\{companyName\}\}/g, job.leadCompanyName || '')
    .replace(/\{\{contactName\}\}/g, job.leadContactName || '')
    .replace(/\{\{industry\}\}/g, job.leadIndustry || '');
}
```

### 3.2 초개인화 이메일 생성 워커 (신규)

**파일:** `elysia-server/src/workers/personalized-email-generation.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/queue/connection';
import { personalizedEmailGenerationService } from '../services/personalized-email-generation.service';

export interface PersonalizedEmailGenerationJob {
  sequenceId: string;
  stepIds?: string[];
  concurrency?: number;
  workspaceId: string;
  triggeredBy: string;
}

export const personalizedEmailGenerationWorker = new Worker<PersonalizedEmailGenerationJob>(
  'personalized-email-generation',
  async (job: Job<PersonalizedEmailGenerationJob>) => {
    const { sequenceId, stepIds, concurrency } = job.data;

    console.log(`[PersonalizedEmailWorker] Starting batch generation for sequence ${sequenceId}`);

    const result = await personalizedEmailGenerationService.generateBatchForSequence(
      sequenceId,
      { stepIds, concurrency }
    );

    console.log(`[PersonalizedEmailWorker] Completed: ${result.success}/${result.total} success, ${result.failed} failed`);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 1, // 배치 작업이므로 1개씩 처리
    limiter: {
      max: 10,
      duration: 1000, // Gemini API rate limit 고려
    },
  }
);
```

---

## 📊 Phase 4: 프론트엔드 변경

### 4.1 시퀀스 생성 시 개인화 모드 선택

**파일:** `admin/src/pages/app/sequences/CreateSequence.tsx` (수정)

```tsx
// 개인화 모드 선택 UI 추가
<FormField
  label="이메일 생성 방식"
  name="personalizationMode"
>
  <RadioGroup value={personalizationMode} onChange={setPersonalizationMode}>
    <Radio value="template">
      <div className="flex flex-col">
        <span className="font-medium">템플릿 모드</span>
        <span className="text-sm text-gray-500">
          공통 템플릿을 모든 리드에게 발송 (변수 치환)
        </span>
      </div>
    </Radio>
    <Radio value="personalized">
      <div className="flex flex-col">
        <span className="font-medium">초개인화 모드</span>
        <span className="text-sm text-gray-500">
          AI가 각 리드별 맞춤 이메일 생성 (Gemini)
        </span>
      </div>
    </Radio>
    <Radio value="hybrid">
      <div className="flex flex-col">
        <span className="font-medium">하이브리드 모드</span>
        <span className="text-sm text-gray-500">
          초개인화 우선, 실패 시 템플릿 폴백
        </span>
      </div>
    </Radio>
  </RadioGroup>
</FormField>
```

### 4.2 개인화 이메일 미리보기/편집 UI

**파일:** `admin/src/pages/app/sequences/PersonalizedEmailPreview.tsx` (신규)

```tsx
interface PersonalizedEmailPreviewProps {
  sequenceId: string;
  stepId: string;
  leadId: string;
}

export function PersonalizedEmailPreview({ sequenceId, stepId, leadId }: PersonalizedEmailPreviewProps) {
  const { data: email, isLoading } = useQuery({
    queryKey: ['personalized-email', sequenceId, stepId, leadId],
    queryFn: () => api.get(`/personalized-emails/${sequenceId}/${stepId}/${leadId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { subject: string; bodyText: string }) =>
      api.put(`/personalized-emails/${email.id}`, data),
  });

  if (isLoading) return <Skeleton />;
  if (!email) return <EmptyState message="이메일이 아직 생성되지 않았습니다" />;

  return (
    <div className="space-y-4">
      <Badge color={email.status === 'generated' ? 'green' : email.status === 'edited' ? 'blue' : 'yellow'}>
        {email.status}
      </Badge>

      <div>
        <Label>제목</Label>
        <Input
          value={email.subject}
          onChange={(e) => updateMutation.mutate({ ...email, subject: e.target.value })}
        />
      </div>

      <div>
        <Label>본문</Label>
        <Textarea
          rows={10}
          value={email.bodyText}
          onChange={(e) => updateMutation.mutate({ ...email, bodyText: e.target.value })}
        />
      </div>

      <div className="text-xs text-gray-500">
        생성 시간: {email.generationTimeMs}ms | 토큰: {email.tokenCount}
      </div>
    </div>
  );
}
```

### 4.3 체험판 온보딩 플로우 수정

**파일:** `admin/src/pages/app/components/StepChatOnboarding.tsx` (수정)

온보딩 완료 시 `personalizationMode: 'personalized'`로 시퀀스 생성하도록 수정.

---

## 📊 Phase 5: 온보딩 워커 수정

### 5.1 Previews Phase에서 초개인화 이메일 생성

**파일:** `elysia-server/src/workers/onboarding-auto-generate.worker.ts` (수정)

```typescript
// Phase 5: Previews
case 'previews': {
  const sequence = await db.select().from(sequences).where(eq(sequences.id, checkpoint.sequenceId));

  // 개인화 모드 확인
  if (sequence.personalizationMode === 'personalized' || sequence.personalizationMode === 'hybrid') {
    // 새로운 sequence_personalized_emails 테이블에 생성
    await personalizedEmailGenerationService.generateBatchForSequence(
      checkpoint.sequenceId,
      { concurrency: 5 }
    );
  } else {
    // 기존 workflow_generated_emails에 생성 (호환성)
    await generateWorkflowEmails(checkpoint.sequenceId);
  }

  // 다음 단계로
  checkpoint.phase = 'complete';
  break;
}
```

---

## 📊 구현 우선순위 및 의존성

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phase 1: DB                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. sequence_personalized_emails 테이블 생성             │    │
│  │ 2. sequences 테이블에 personalization_mode 컬럼 추가    │    │
│  │ 3. Drizzle 스키마 추가                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 2: Backend                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. PersonalizedEmailGenerationService 구현               │    │
│  │ 5. API 라우트 추가 (/personalized-emails/*)              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 3: Workers                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 6. sequence-email.worker.ts 수정 (개인화 이메일 조회)    │    │
│  │ 7. personalized-email-generation.worker.ts 신규 생성     │    │
│  │ 8. onboarding-auto-generate.worker.ts 수정               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 4: Frontend                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 9. 시퀀스 생성 UI에 개인화 모드 선택 추가                │    │
│  │ 10. 개인화 이메일 미리보기/편집 컴포넌트                 │    │
│  │ 11. 체험판 온보딩 플로우 수정                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ 체크리스트

### Phase 1: Database (예상 작업량: 1일)
- [ ] `sequence_personalized_emails` 테이블 마이그레이션 생성
- [ ] `sequences` 테이블 `personalization_mode` 컬럼 마이그레이션
- [ ] Drizzle 스키마 파일 추가
- [ ] 타입 export 및 index.ts 업데이트

### Phase 2: Backend (예상 작업량: 2일)
- [ ] `PersonalizedEmailGenerationService` 구현
- [ ] Gemini API 연동 및 프롬프트 최적화
- [ ] API 라우트 추가 및 테스트
- [ ] 에러 핸들링 및 재시도 로직

### Phase 3: Workers (예상 작업량: 1일)
- [ ] `sequence-email.worker.ts` 수정
- [ ] `personalized-email-generation.worker.ts` 생성
- [ ] `onboarding-auto-generate.worker.ts` 수정
- [ ] 워커 테스트

### Phase 4: Frontend (예상 작업량: 2일)
- [ ] 시퀀스 생성 UI 수정
- [ ] 개인화 이메일 미리보기 컴포넌트
- [ ] 편집 기능 구현
- [ ] 체험판 온보딩 수정

### 테스트 (예상 작업량: 1일)
- [ ] 통합 테스트
- [ ] E2E 테스트
- [ ] 성능 테스트 (대량 리드)

---

## 📌 핵심 고려사항

### 1. 기존 시스템 호환성
- `workflow_generated_emails` 테이블은 그대로 유지
- `personalization_mode = 'template'`인 경우 기존 로직 사용
- 점진적 마이그레이션 가능

### 2. 비용 최적화
- Gemini API 호출 비용 고려 → 배치 처리 권장
- 캐싱 전략: 리드 정보가 변경되지 않으면 재생성 불필요
- 토큰 사용량 모니터링

### 3. 성능
- 대량 리드 (100+) 시 배치 + 진행률 표시
- 병렬 처리 최적화 (concurrency 조절)
- 생성 시간 측정 및 로깅

### 4. 사용자 경험
- 생성 진행률 실시간 표시
- 실패한 이메일 재생성 기능
- 템플릿 폴백으로 안정성 보장

---

## 🔄 데이터 흐름 다이어그램

```
[사용자]
    │
    ▼ 시퀀스 생성 (personalizationMode: 'personalized')
[sequences 테이블]
    │
    ▼ 리드 등록
[sequence_enrollments]
    │
    ▼ BullMQ Job 생성
[personalized-email-generation Queue]
    │
    ▼ 워커 처리
[PersonalizedEmailGenerationWorker]
    │
    ▼ 각 리드별 AI 생성
[Gemini API]
    │
    ▼ 결과 저장
[sequence_personalized_emails 테이블]
    │
    ▼ 발송 시점
[sequence-email Queue]
    │
    ▼ 개인화 이메일 조회 → 발송
[SequenceEmailWorker]
    │
    ▼ 발송 기록
[emails 테이블]
```

---

*문서 작성일: 2025-01-19*
*버전: 1.0*
