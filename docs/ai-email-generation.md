# AI 기반 개별 이메일 생성

## 개요

이메일 초안 노드에서 각 고객(Lead)에게 맞춤형 이메일을 작성합니다.
두 가지 방식을 지원합니다:

1. **AI 자동 생성**: 프롬프트 입력 → AI가 각 고객별로 맞춤 이메일 생성
2. **수동 작성**: 사용자가 각 고객에 대해 직접 이메일 작성 또는 템플릿 수정

각 고객의 회사 정보, 업종, 담당자 정보 등을 참고하여 개인화된 이메일을 작성합니다.

## 프로세스 플로우

### AI 자동 생성 모드
```
1. 이메일 초안 노드 생성
   ↓
2. "설정" 클릭 → "AI 자동 생성" 선택
   ↓
3. AI 프롬프트 입력 및 저장
   ↓
4. "이메일 관리" 클릭 → 이메일 생성 관리 모달 열림
   ↓
5. "모든 연락처에 대해 생성" 클릭
   ↓
6. 각 연락처에 대해:
   - 고객 정보 + 프롬프트 조합
   - AI API 호출
   - 생성된 이메일 저장 (workflow_generated_emails)
   ↓
7. 생성 진행 상황 표시 (15/100...)
   ↓
8. 생성 완료 후 목록에서 확인/수정
   ↓
9. 워크플로우 실행 시 생성된 이메일로 발송
```

### 수동 작성 모드
```
1. 이메일 초안 노드 생성
   ↓
2. "설정" 클릭 → "수동 작성" 선택
   ↓
3. 제목/본문 템플릿 입력 (변수 사용 가능)
   ↓
4. "이메일 관리" 클릭 → 모든 연락처 목록 표시
   ↓
5. 각 연락처별로:
   - 템플릿 기반 초기값 표시
   - 사용자가 직접 수정
   - 저장 (workflow_generated_emails)
   ↓
6. 워크플로우 실행 시 작성된 이메일로 발송
```

## 데이터베이스 스키마

### workflow_generated_emails 테이블

```sql
CREATE TABLE workflow_generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL, -- React Flow 노드 ID
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- 생성된 이메일 내용
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- 생성 정보
  status VARCHAR(50) NOT NULL DEFAULT 'pending', 
  -- 'pending', 'generating', 'generated', 'edited', 'failed'
  ai_prompt TEXT, -- 사용된 프롬프트
  ai_model VARCHAR(100), -- 사용된 AI 모델 (예: gpt-4)
  generation_error TEXT, -- 에러 메시지
  
  -- 컨텍스트 스냅샷 (생성 당시 고객 정보)
  context_snapshot JSONB, -- { companyName, industry, contactName, etc }
  
  -- 타임스탬프
  generated_at TIMESTAMP,
  edited_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 인덱스
  UNIQUE(sequence_id, node_id, lead_id),
  INDEX idx_workflow_emails_sequence_node (sequence_id, node_id),
  INDEX idx_workflow_emails_status (status)
);
```

## UI 구조

### 이메일 초안 노드 컴포넌트

```tsx
interface EmailDraftNodeData {
  subject?: string; // 템플릿 (폴백용)
  bodyText?: string; // 템플릿 (폴백용)
  
  // AI 생성 관련
  aiPrompt?: string; // AI 프롬프트
  useAI?: boolean; // AI 사용 여부
  generationStatus?: 'not_started' | 'in_progress' | 'completed' | 'partial';
  generatedCount?: number; // 생성된 이메일 개수
  totalCount?: number; // 전체 연락처 개수
}
```

### 이메일 생성 관리 모달

```tsx
<EmailGenerationModal
  sequenceId={sequenceId}
  nodeId={nodeId}
  onClose={handleClose}
>
  {/* 프롬프트 입력 영역 */}
  <PromptEditor
    value={aiPrompt}
    onChange={setAiPrompt}
    placeholder="예: {{회사명}}에게 우리 서비스를 소개하는 친근한 이메일을 작성해주세요. {{업종}} 업계의 특성을 고려해주세요."
  />
  
  {/* 변수 안내 */}
  <AvailableVariables>
    - {{회사명}} - 고객 회사명
    - {{담당자명}} - 담당자 이름
    - {{업종}} - 회사 업종
    - {{이메일}} - 담당자 이메일
  </AvailableVariables>
  
  {/* 생성 옵션 */}
  <GenerationOptions>
    <Select label="AI 모델" value={model} onChange={setModel}>
      <option value="gpt-4">GPT-4 (고품질, 느림)</option>
      <option value="gpt-3.5-turbo">GPT-3.5 (빠름, 저렴)</option>
    </Select>
    
    <Checkbox 
      label="생성된 이메일 자동 검토 후 발송"
      checked={autoReview}
    />
  </GenerationOptions>
  
  {/* 액션 버튼 */}
  <Actions>
    <Button onClick={handleGenerateAll}>
      모든 연락처에 대해 생성 ({totalLeads}명)
    </Button>
    <Button variant="secondary" onClick={handleRegenerateAll}>
      전체 재생성
    </Button>
  </Actions>
  
  {/* 진행 상황 */}
  {isGenerating && (
    <Progress>
      <ProgressBar value={generatedCount} max={totalLeads} />
      <Text>{generatedCount} / {totalLeads} 생성 중...</Text>
    </Progress>
  )}
  
  {/* 생성된 이메일 목록 */}
  <GeneratedEmailsList>
    <Table>
      <thead>
        <tr>
          <th>회사명</th>
          <th>담당자</th>
          <th>상태</th>
          <th>제목 미리보기</th>
          <th>액션</th>
        </tr>
      </thead>
      <tbody>
        {generatedEmails.map(email => (
          <tr key={email.id}>
            <td>{email.companyName}</td>
            <td>{email.contactName}</td>
            <td>
              <StatusBadge status={email.status} />
            </td>
            <td>
              <div className="truncate">
                {email.subject}
              </div>
            </td>
            <td>
              <Button 
                size="sm" 
                onClick={() => handleViewEdit(email)}
              >
                보기/수정
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => handleRegenerate(email)}
              >
                재생성
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </GeneratedEmailsList>
</EmailGenerationModal>
```

### 개별 이메일 편집 모달

```tsx
<EmailEditModal email={selectedEmail}>
  <Header>
    <CompanyInfo>
      <h3>{email.companyName}</h3>
      <p>{email.contactName} ({email.contactEmail})</p>
    </CompanyInfo>
    <GenerationInfo>
      <Badge>AI 생성됨</Badge>
      <small>{formatDate(email.generatedAt)}</small>
    </GenerationInfo>
  </Header>
  
  <Form>
    <Input 
      label="제목"
      value={subject}
      onChange={setSubject}
    />
    
    <Textarea
      label="본문"
      value={bodyText}
      onChange={setBodyText}
      rows={10}
    />
    
    <Actions>
      <Button onClick={handleSave}>저장</Button>
      <Button variant="secondary" onClick={handleRegenerate}>
        AI 재생성
      </Button>
      <Button variant="ghost" onClick={handleCancel}>
        취소
      </Button>
    </Actions>
  </Form>
</EmailEditModal>
```

## API 엔드포인트

### 1. 이메일 일괄 생성

```
POST /api/v1/sequences/:sequenceId/nodes/:nodeId/generate-emails

Request Body:
{
  "aiPrompt": "{{회사명}}에게 우리 서비스를 소개하는 이메일",
  "aiModel": "gpt-4",
  "options": {
    "temperature": 0.7,
    "maxTokens": 500
  }
}

Response:
{
  "jobId": "job-uuid-123",
  "status": "started",
  "totalLeads": 150,
  "estimatedTime": 300 // seconds
}
```

### 2. 생성 진행 상황 조회

```
GET /api/v1/sequences/:sequenceId/nodes/:nodeId/generation-status?jobId=job-uuid-123

Response:
{
  "jobId": "job-uuid-123",
  "status": "in_progress",
  "progress": {
    "total": 150,
    "generated": 45,
    "failed": 2,
    "pending": 103
  }
}
```

### 3. 생성된 이메일 목록 조회

```
GET /api/v1/sequences/:sequenceId/nodes/:nodeId/generated-emails?page=1&limit=50

Response:
{
  "emails": [
    {
      "id": "email-uuid-1",
      "leadId": "lead-uuid-1",
      "companyName": "ABC Corp",
      "contactName": "John Doe",
      "subject": "ABC Corp를 위한 맞춤형 솔루션 제안",
      "bodyText": "안녕하세요 John님...",
      "status": "generated",
      "generatedAt": "2025-09-30T10:30:00Z"
    },
    ...
  ],
  "total": 150,
  "page": 1,
  "totalPages": 3
}
```

### 4. 개별 이메일 수정

```
PATCH /api/v1/sequences/:sequenceId/nodes/:nodeId/generated-emails/:emailId

Request Body:
{
  "subject": "수정된 제목",
  "bodyText": "수정된 본문",
  "status": "edited"
}

Response:
{
  "id": "email-uuid-1",
  "subject": "수정된 제목",
  "bodyText": "수정된 본문",
  "status": "edited",
  "editedAt": "2025-09-30T11:00:00Z"
}
```

### 5. 개별 이메일 재생성

```
POST /api/v1/sequences/:sequenceId/nodes/:nodeId/generated-emails/:emailId/regenerate

Request Body:
{
  "aiPrompt": "더 친근한 톤으로 재작성"
}

Response:
{
  "id": "email-uuid-1",
  "subject": "새로 생성된 제목",
  "bodyText": "새로 생성된 본문",
  "status": "generated",
  "generatedAt": "2025-09-30T11:05:00Z"
}
```

## 백엔드 구현 로직

### AI 이메일 생성 서비스

```typescript
// services/ai-email-generator.service.ts

interface EmailGenerationContext {
  lead: {
    id: string;
    companyName: string;
    industry?: string;
    contactName?: string;
    contactEmail: string;
    // ... 기타 고객 정보
  };
  prompt: string;
  model: string;
}

async function generateEmailForLead(
  context: EmailGenerationContext
): Promise<GeneratedEmail> {
  // 1. 프롬프트에 변수 치환
  const processedPrompt = replaceVariables(context.prompt, context.lead);
  
  // 2. 시스템 프롬프트 구성
  const systemPrompt = `
    당신은 전문적인 비즈니스 이메일 작성 도우미입니다.
    다음 정보를 바탕으로 개인화된 이메일을 작성해주세요:
    
    회사명: ${context.lead.companyName}
    업종: ${context.lead.industry || '알 수 없음'}
    담당자: ${context.lead.contactName || '담당자'}
    
    이메일은 다음 구조를 따라주세요:
    1. 친근한 인사
    2. 회사/업종에 맞춤화된 제안
    3. 명확한 행동 촉구 (CTA)
    4. 전문적인 마무리
  `;
  
  // 3. AI API 호출
  const response = await openai.chat.completions.create({
    model: context.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: processedPrompt }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  
  // 4. 응답 파싱 (제목과 본문 분리)
  const generatedText = response.choices[0].message.content;
  const { subject, body } = parseEmailFromAIResponse(generatedText);
  
  return {
    subject,
    bodyText: body,
    bodyHtml: convertToHtml(body),
  };
}

// 일괄 생성 (Job Queue 사용 권장)
async function generateEmailsForAllLeads(
  sequenceId: string,
  nodeId: string,
  prompt: string,
  model: string
): Promise<{ jobId: string }> {
  // 1. 시퀀스에 등록된 모든 leads 조회
  const enrollments = await getSequenceEnrollments(sequenceId);
  
  // 2. Job 생성
  const jobId = generateJobId();
  
  // 3. 백그라운드에서 처리 (Queue)
  await emailGenerationQueue.add({
    jobId,
    sequenceId,
    nodeId,
    prompt,
    model,
    leads: enrollments.map(e => e.lead),
  });
  
  return { jobId };
}
```

### Job Queue 처리

```typescript
// workers/email-generation-worker.ts

emailGenerationQueue.process(async (job) => {
  const { jobId, sequenceId, nodeId, prompt, model, leads } = job.data;
  
  let generated = 0;
  let failed = 0;
  
  for (const lead of leads) {
    try {
      // AI 이메일 생성
      const email = await generateEmailForLead({
        lead,
        prompt,
        model,
      });
      
      // DB에 저장
      await db.insert(workflowGeneratedEmails).values({
        sequenceId,
        nodeId,
        leadId: lead.id,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        status: 'generated',
        aiPrompt: prompt,
        aiModel: model,
        contextSnapshot: {
          companyName: lead.companyName,
          industry: lead.industry,
          contactName: lead.contactName,
        },
        generatedAt: new Date(),
      });
      
      generated++;
      
      // 진행 상황 업데이트
      await updateJobProgress(jobId, { generated, failed });
      
      // Rate limiting
      await sleep(1000); // 1초 대기
      
    } catch (error) {
      console.error(`Failed to generate email for lead ${lead.id}:`, error);
      failed++;
      
      // 실패 기록
      await db.insert(workflowGeneratedEmails).values({
        sequenceId,
        nodeId,
        leadId: lead.id,
        status: 'failed',
        generationError: error.message,
        aiPrompt: prompt,
        aiModel: model,
      });
    }
  }
  
  return { generated, failed };
});
```

## 비용 및 성능 고려사항

### 예상 비용 (GPT-4 기준)
- 1개 이메일 생성: 약 500 토큰 사용
- 비용: $0.03 / 1K 토큰 (input) + $0.06 / 1K 토큰 (output)
- 100명 일괄 생성: 약 $3-5

### 최적화 방안
1. **배치 처리**: 한 번에 여러 이메일 생성 요청
2. **캐싱**: 유사한 회사는 캐시 활용
3. **모델 선택**: GPT-3.5-turbo 사용 시 비용 1/10
4. **Rate Limiting**: API 제한 준수
5. **재시도 로직**: 실패 시 자동 재시도

## 구현 체크리스트

### 백엔드 ✅ 완료
- [x] workflow_generated_emails 테이블 생성
- [x] AI 이메일 생성 서비스 구현 (`ai-workflow-email.service.ts`)
- [x] API 엔드포인트 구현
  - [x] GET /sequences/:id/nodes/:nodeId/generated-emails
  - [x] POST /sequences/:id/nodes/:nodeId/generate-emails
  - [x] PATCH /sequences/:id/nodes/:nodeId/generated-emails/:emailId
  - [x] POST /sequences/:id/nodes/:nodeId/generated-emails/:emailId/regenerate
- [x] Rate limiting (1초 대기)
- [x] 에러 처리 및 폴백 로직
- [x] 변수 치환 엔진 (한글/영문 지원)
- [ ] Job Queue 설정 (향후 개선)
- [ ] 진행 상황 실시간 추적 (향후 개선)

### 프론트엔드 ✅ 완료
- [x] EmailDraftNode에 AI/수동 옵션 추가
- [x] 이메일 생성 관리 모달 컴포넌트
- [x] 개별 이메일 편집 모달
- [x] 생성된 이메일 목록 테이블
- [x] API 연동 및 상태 관리 (React Query)
- [x] 로딩 및 에러 상태 처리
- [ ] 진행 상황 실시간 표시 (향후 개선)

### 환경 설정 ⚙️
- [ ] OPENAI_API_KEY 환경변수 설정 필요
- [x] 데이터베이스 마이그레이션 완료

### 테스트 🧪
- [ ] 소규모 테스트 (10명)
- [ ] 대규모 테스트 (100명+)
- [ ] 에러 케이스 테스트
- [ ] 비용 모니터링

## 향후 개선 사항

- [ ] 이메일 템플릿 라이브러리
- [ ] A/B 테스트 (여러 버전 생성)
- [ ] 이메일 품질 점수 (AI 평가)
- [ ] 업종별 최적화 프롬프트
- [ ] 다국어 지원
- [ ] 이미지 생성 및 삽입
- [ ] 실시간 미리보기 (Streaming)
