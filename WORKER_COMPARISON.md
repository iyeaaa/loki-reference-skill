# Workflow Execution Worker vs Email Sequence Worker 비교

## 📊 주요 차이점

### 1. 데이터 구조

| 항목 | Email Sequence Worker | Workflow Execution Worker |
|------|----------------------|--------------------------|
| **테이블** | `sequence_steps` | `workflow_data` (JSON) |
| **등록** | `sequence_enrollments` | `workflow_enrollments` |
| **실행** | `sequence_step_executions` | `workflow_execution_logs` |
| **데이터 구조** | 고정된 테이블 스키마 | 유연한 노드 기반 |

### 2. 이메일 발송 방식

**Email Sequence Worker** (더 안정적 ✅):
```typescript
// SendGrid 직접 사용
import sgMail from '@sendgrid/mail'

// 계정별 API 키 처리
const apiKey = emailAccount.sendgridApiKey || config.sendgrid.apiKey
sgMail.setApiKey(apiKey)

// 직접 발송
const [response] = await sgMail.send({
  to: leadContact.email,
  from: { email: emailAccount.emailAddress, name: emailAccount.displayName },
  subject: execution.emailSubject,
  text: execution.emailBodyText,
  html: execution.emailBodyHtml,
})

// Message ID 추출
messageId: response.headers['x-message-id']
```

**Workflow Execution Worker** (개선 필요):
```typescript
// emailService 통해 간접 사용
const sendResult = await emailService.sendEmail({
  fromEmail: enrollment.userEmailAccount.emailAddress,
  toEmail: generatedEmail.contactEmail,
  subject: generatedEmail.subject,
  apiKey: enrollment.userEmailAccount.apiKey, // ❌ 필드명 불일치
})
```

### 3. 에러 처리

**Email Sequence Worker** (더 상세 ✅):
```typescript
try {
  const result = await sendSequenceEmail(execution)
  
  if (result.success) {
    await sequenceService.updateStepExecutionStatus('sent', undefined, result.messageId)
    await sequenceService.updateEnrollmentProgress(enrollmentId, stepOrder)
    console.log(`✓ Email sent successfully: ${result.messageId}`)
  } else {
    await sequenceService.updateStepExecutionStatus('failed', result.error)
    console.error(`✗ Email failed: ${result.error}`)
  }
} catch (error) {
  console.error('Error:', error)
}
```

**Workflow Execution Worker**:
```typescript
try {
  const result = await workflowExecutionService.executeWorkflow(enrollmentId)
  
  if (result.success) {
    console.log('✓ Workflow executed successfully')
  } else {
    console.error('✗ Workflow execution failed')
    // 에러 로그 업데이트
  }
}
```

## 🔧 개선 필요 사항

### 1. SendGrid 직접 사용 (Email Worker 방식 적용)

**현재 문제:**
- `emailService.sendEmail` → `userEmailAccount.apiKey` 사용
- 하지만 DB 필드는 `sendgridApiKey`

**개선:**
```typescript
// workflow-execution.service.ts의 executeEmailDraftNode
const apiKey = enrollment.userEmailAccount.sendgridApiKey || config.sendgrid.apiKey
if (!apiKey) {
  throw new Error('SendGrid API key not configured')
}

sgMail.setApiKey(apiKey)

const [response] = await sgMail.send({
  to: generatedEmail.contactEmail,
  from: {
    email: enrollment.userEmailAccount.emailAddress,
    name: enrollment.userEmailAccount.displayName || enrollment.userEmailAccount.emailAddress,
  },
  subject: generatedEmail.subject,
  text: generatedEmail.bodyText,
  html: generatedEmail.bodyHtml,
})

const messageId = response.headers['x-message-id']
```

### 2. 필드명 불일치 수정

**DB 스키마:**
```typescript
// user_email_accounts 테이블
sendgridApiKey  // ✅ 실제 필드명
```

**현재 사용:**
```typescript
apiKey: enrollment.userEmailAccount.apiKey  // ❌ 잘못된 필드명
```

### 3. 답장 감지 방식

**Workflow Worker만 있는 기능 ✅:**
```typescript
// 30초마다 답장 체크
async function checkRepliesAndStopWorkflows() {
  // email_replies 테이블 모니터링
  // 답장 온 enrollment 자동 중단
}
```

**Email Worker에는 없음** - 이 기능은 Workflow가 더 앞서있음!

## ✅ 즉시 수정 항목

1. **SendGrid API 키 필드명 수정**
2. **SendGrid 직접 사용** (더 안정적)
3. **에러 처리 개선**
4. **이메일 발송 로직 통일**

