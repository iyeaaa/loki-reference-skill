# 워크플로우 트리거 가이드

## 🚀 워크플로우 자동 시작

### Before (수정 전)
시퀀스를 활성화해도 아무 일도 일어나지 않음
```
시퀀스 활성화
      ↓
❌ 수동으로 리드 등록해야 함
      ↓
워크플로우 실행
```

### After (수정 후)
시퀀스 활성화 → **자동으로 모든 리드 등록 및 실행**
```
시퀀스 활성화 버튼 클릭
      ↓
1. 워크플로우 검증 ✅
      ↓
2. 고객그룹의 모든 리드를 워크플로우에 자동 등록 ✅
      ↓
3. 각 리드별로 워크플로우 즉시 실행 ✅
      ↓
4. 첫 이메일 노드 발송 또는 타이머 시작 ✅
```

## 📊 워크플로우 실행 흐름

### 1. 시퀀스 활성화 시
```typescript
PUT /api/v1/sequences/:id
{ "status": "active" }

→ 자동으로:
  1. 워크플로우 검증
  2. 고객그룹의 모든 리드 조회
  3. workflow_enrollments에 등록 (각 리드별)
  4. 시작 노드에서 다음 노드로 즉시 이동
  5. 이메일 노드면 발송, 타이머 노드면 스케줄링
```

### 2. 워커 실행 조건
**Workflow Execution Worker** (1분마다 실행)
```typescript
// 찾는 조건:
1. workflow_execution_logs.status = 'pending'
2. workflow_execution_logs.scheduled_for <= NOW()
3. sequences.status = 'active'
4. workflow_enrollments.status = 'active'

// 실행:
- 타이머 대기 시간이 끝난 노드 실행
- 다음 이메일 발송
```

### 3. 실행 예시

**시나리오: 이메일 → 타이머(3일) → 이메일**

**T+0초 (활성화 즉시):**
```
고객그룹 리드: [A사, B사, C사]
      ↓
workflow_enrollments 생성 (3개)
      ↓
첫 이메일 노드 즉시 실행
      ↓
A사, B사, C사에게 첫 이메일 발송 ✉️
      ↓
타이머 노드 스케줄링 (T+3일)
```

**T+3일 (타이머 만료):**
```
워커가 1분마다 체크
      ↓
"아, 3일 지났네!" 감지
      ↓
다음 이메일 노드 실행
      ↓
A사, B사, C사에게 두 번째 이메일 발송 ✉️
```

**중간에 B사가 답장:**
```
B사 답장 감지 (30초마다 체크)
      ↓
B사 workflow_enrollments.status = 'stopped'
      ↓
B사는 더 이상 이메일 받지 않음 ✅
      ↓
A사, C사만 계속 진행
```

## 🔧 수정 내용

**파일:** `elysia-server/src/routes/sequences.routes.ts`

### 활성화 시 자동 등록 로직
```typescript
if (body.status === 'active' && currentSequence.status !== 'active') {
  // 1. 이메일 계정 조회
  const [defaultEmailAccount] = await db
    .select({ id: userEmailAccounts.id })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.workspaceId, currentSequence.workspaceId))
    .limit(1)

  // 2. 고객그룹의 모든 리드 등록
  const enrollResult = await bulkEnrollInWorkflow({
    sequenceId: id,
    customerGroupId: currentSequence.customerGroupId,
    userEmailAccountId: defaultEmailAccount.id,
  })

  // 3. 각 등록에 대해 워크플로우 즉시 실행
  for (const enrollment of enrollResult.enrollments) {
    await executeWorkflow(enrollment.id)
  }
}
```

## 📋 워크플로우 상태 확인

### DB에서 확인
```sql
-- 등록된 리드 확인
SELECT * FROM workflow_enrollments 
WHERE sequence_id = 'your-sequence-id';

-- 실행 로그 확인
SELECT * FROM workflow_execution_logs 
WHERE sequence_id = 'your-sequence-id'
ORDER BY created_at DESC;

-- 발송된 이메일 확인
SELECT * FROM emails 
WHERE sequence_id = 'your-sequence-id'
ORDER BY created_at DESC;
```

### 백엔드 로그 확인
```bash
# 활성화 시
[Sequence Activation] Enrolled 3 leads to workflow
[Workflow] Executing email draft node: emailDraft-123
[Workflow] ✓ Email sent successfully: email-uuid-1
[Workflow] Scheduling timer node: timer-456 (3 days)

# 1분 후 워커
[Workflow Execution Worker] Starting workflow processing...
[Workflow Execution Worker] No pending workflows to execute
# → 3일 후까지 pending 없음

# 3일 후
[Workflow Execution Worker] Found 3 pending workflows
[Workflow Execution Worker] Processing enrollment ...
[Workflow] ✓ Email sent successfully: email-uuid-2
```

## ✅ 테스트 방법

1. **시퀀스 생성**
   - 고객그룹 선택 (리드 3개 이상 권장)
   - 워크플로우 디자인
   - 이메일 → 타이머(3일) → 이메일

2. **이메일 생성**
   - 각 노드에서 "이메일 관리" 클릭
   - "모든 연락처에 대해 생성" 클릭
   - 생성 완료 확인

3. **활성화**
   - 시퀀스 상태 → "활성"으로 변경
   - ✅ 검증 통과
   - ✅ 자동으로 N명 등록 및 첫 이메일 발송

4. **확인**
   - 백엔드 로그 확인
   - DB `workflow_enrollments` 테이블 확인
   - emails 테이블에서 발송된 이메일 확인
   - 타이머 노드 통계 확인 (발송 N, 대기 N)

## 🎯 결론

**시퀀스 활성화 = 워크플로우 자동 시작**
- ✅ 검증
- ✅ 리드 등록
- ✅ 즉시 실행
- ✅ 워커가 스케줄 관리

이제 활성화 버튼 하나로 모든 게 자동으로 시작됩니다! 🎉

