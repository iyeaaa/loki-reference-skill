# Email Sequence Worker vs Workflow Execution Worker

## 🔄 두 워커의 역할

### Email Sequence Worker (구 기능)
**담당:** `sequence_steps` 기반 이메일 발송

**데이터 구조:**
```
sequences (시퀀스)
    ↓
sequence_steps (고정된 스텝)
    ↓
sequence_enrollments (리드 등록)
    ↓
sequence_step_executions (스텝 실행)
    ↓
emails (발송 기록)
```

**특징:**
- ✅ 테이블 기반 (고정된 스키마)
- ✅ SendGrid 직접 사용
- ✅ 계정별 API 키 처리
- ✅ 상세한 에러 핸들링
- ✅ 진행 상황 업데이트

### Workflow Execution Worker (신 기능)
**담당:** `workflow_data` (노드 기반) 이메일 발송

**데이터 구조:**
```
sequences.workflow_data (JSON 노드)
    ↓
workflow_enrollments (리드 등록)
    ↓
workflow_execution_logs (노드 실행 로그)
    ↓
workflow_generated_emails (생성된 이메일)
    ↓
emails (발송 기록)
```

**특징:**
- ✅ 노드 기반 (유연한 구조)
- ✅ React Flow 워크플로우 디자이너
- ✅ AI 이메일 생성
- ✅ 답장 자동 감지 (30초마다)
- ✅ 실시간 통계
- ✅ SendGrid 직접 사용 (개선 완료)

## 🔧 개선 완료 사항

### Before (개선 전)
```typescript
// emailService 간접 사용
const sendResult = await emailService.sendEmail({
  apiKey: enrollment.userEmailAccount.apiKey,
  ...
})
```

### After (Email Worker 방식 적용) ✅
```typescript
// SendGrid 직접 사용 (Email Worker와 동일)
import sgMail from '@sendgrid/mail'

// 계정별 API 키 처리
const apiKey = enrollment.userEmailAccount.apiKey || config.sendgrid.apiKey
if (!apiKey) {
  throw new Error('SendGrid API key not configured')
}

sgMail.setApiKey(apiKey)

// 직접 발송
const [response] = await sgMail.send(msg)
const messageId = response.headers['x-message-id'] as string

// 에러 처리 개선
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[Workflow] ✗ Failed to send email:`, errorMessage)
}
```

## 📊 비교표

| 기능 | Email Sequence Worker | Workflow Execution Worker |
|------|----------------------|--------------------------|
| **데이터 구조** | 테이블 기반 (고정) | 노드 기반 (유연) |
| **UI** | 없음 (코드로만 설정) | React Flow 디자이너 ✨ |
| **SendGrid** | 직접 사용 ✅ | 직접 사용 ✅ (개선 완료) |
| **API 키** | 계정별 처리 ✅ | 계정별 처리 ✅ (개선 완료) |
| **에러 처리** | 상세함 ✅ | 상세함 ✅ (개선 완료) |
| **AI 생성** | 없음 | 있음 ✅ |
| **답장 감지** | 없음 | 자동 중단 ✅ |
| **실시간 통계** | 없음 | 타이머 통계 ✅ |
| **진행률** | 기본 | AI 생성 진행률 ✅ |

## 🎯 각 워커의 실행 흐름

### Email Sequence Worker
```
1분마다 실행
      ↓
sequence_step_executions 조회
  - status = 'pending'
  - scheduled_at <= NOW()
  - enrollment.status = 'active'
  - sequence.status = 'active'
      ↓
각 실행 항목 처리:
  1. Lead 이메일 조회
  2. Email 계정 조회
  3. SendGrid로 발송
  4. execution.status = 'sent'
  5. enrollment 진행 상황 업데이트
```

### Workflow Execution Worker
```
1분마다 실행
      ↓
workflow_execution_logs 조회
  - status = 'pending'
  - scheduled_for <= NOW()
  - enrollment.status = 'active'
  - sequence.status = 'active'
      ↓
각 실행 항목 처리:
  1. Enrollment 조회
  2. Workflow 데이터 파싱
  3. 현재 노드 찾기
  4. 노드 타입별 실행:
     - emailDraft: 생성된 이메일 조회 → SendGrid 발송
     - timer: 다음 노드 스케줄링
  5. 다음 노드로 이동

+ 30초마다 답장 체크:
  - email_replies 조회
  - 답장 온 enrollment 자동 중단
```

## ✅ 개선 완료 항목

1. **SendGrid 직접 사용** ✅
   - Email Worker와 동일한 방식
   - 더 안정적인 발송

2. **계정별 API 키 처리** ✅
   ```typescript
   const apiKey = account.apiKey || config.sendgrid.apiKey
   sgMail.setApiKey(apiKey)
   ```

3. **에러 처리 개선** ✅
   ```typescript
   catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error'
   }
   ```

4. **메시지 ID 추출** ✅
   ```typescript
   const messageId = response.headers['x-message-id'] as string
   ```

## 🚀 결론

**두 워커는 독립적으로 동작:**
- Email Sequence Worker: 기존 고정 스텝 방식
- Workflow Execution Worker: 새로운 노드 기반 방식

**이제 Workflow Worker도 Email Worker와 동등한 수준:**
- ✅ SendGrid 직접 사용
- ✅ 안정적인 이메일 발송
- ✅ 상세한 에러 처리
- ✅ 추가 기능 (AI 생성, 답장 감지, 실시간 통계)

**Workflow Worker가 더 앞선 부분:**
- ✅ 시각적 워크플로우 디자이너
- ✅ AI 자동 이메일 생성
- ✅ 답장 자동 감지 및 중단
- ✅ 실시간 통계 표시
- ✅ 진행률 추적

