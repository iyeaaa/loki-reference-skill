# PortOne V2 결제 시스템 구현 현황

> 최종 업데이트: 2025-01-12
>
> PG 심사용 토스페이먼츠 결제 연동 구현 상태

---

## 1. 구현 완료 현황

### 1.1 체크리스트

| 항목 | 상태 | 파일 |
|------|:----:|------|
| 결제창 호출 (PortOne SDK v2) | ✅ | `PaymentTestPage.tsx` |
| 이용약관/개인정보 동의 체크박스 | ✅ | `PaymentTestPage.tsx` |
| 실제 DB 요금제 연동 | ✅ | `useBillingPlans()` 훅 |
| 결제 완료 후 서버 검증 | ✅ | `POST /api/v1/payments/complete` |
| 구독 생성/활성화 | ✅ | `billingService.createSubscription()` |
| 결제 내역 조회 | ✅ | `GET /api/v1/payments/:paymentId` |
| 결제 취소 | ✅ | `POST /api/v1/payments/:paymentId/cancel` |
| 웹훅 수신 | ✅ | `POST /api/webhook/portone` |
| 웹훅 시그니처 검증 (HMAC-SHA256) | ✅ | `portone.service.ts` |
| 모바일 리다이렉트 처리 | ✅ | `PaymentTestPage.tsx` |
| Idempotency (중복 결제 방지) | ✅ | Redis 24h TTL |
| 분산 락 (Race Condition 방지) | ✅ | Redis SETNX 30s TTL |
| customerId 검증 | ✅ | userId === customerId |

---

## 2. 아키텍처

### 2.1 전체 결제 플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           결제 플로우                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [사용자]                                                                │
│     │                                                                   │
│     ▼                                                                   │
│  [Frontend: PaymentTestPage]                                            │
│     │                                                                   │
│     │ 1. 요금제 선택 (useBillingPlans → GET /api/v1/billing/plans)      │
│     │ 2. 약관 동의 체크                                                  │
│     │ 3. PortOne.requestPayment() 호출                                  │
│     │                                                                   │
│     ▼                                                                   │
│  [PortOne SDK → TossPayments]                                           │
│     │                                                                   │
│     │ 결제창 표시 → 사용자 결제 완료                                      │
│     │                                                                   │
│     ▼                                                                   │
│  [Frontend] ←────── paymentId 반환                                      │
│     │                                                                   │
│     │ POST /api/v1/payments/complete                                    │
│     │ { paymentId, planId, workspaceId, customerId }                    │
│     │                                                                   │
│     ▼                                                                   │
│  [Backend: payment.routes.ts]                                           │
│     │                                                                   │
│     │ 1. JWT 인증 확인                                                   │
│     │ 2. customerId === userId 검증                                     │
│     │ 3. Redis Idempotency 체크                                         │
│     │ 4. Redis 분산 락 획득                                              │
│     │ 5. Workspace 접근 권한 확인                                        │
│     │ 6. Plan 금액 조회                                                  │
│     │ 7. PortOne API로 결제 검증 (상태, 금액)                            │
│     │ 8. 구독 생성/업데이트                                              │
│     │ 9. Idempotency 결과 저장                                          │
│     │ 10. 락 해제                                                       │
│     │                                                                   │
│     ▼                                                                   │
│  [Response: 성공/실패]                                                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                        웹훅 백업 플로우 (비동기)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [PortOne 서버]                                                         │
│     │                                                                   │
│     │ POST /api/webhook/portone (Transaction.Paid)                      │
│     │ Header: x-portone-signature (HMAC-SHA256)                         │
│     │                                                                   │
│     ▼                                                                   │
│  [Backend: webhook.routes.ts]                                           │
│     │                                                                   │
│     │ 1. 시그니처 검증 (프로덕션 필수)                                    │
│     │ 2. 이벤트 타입별 처리                                              │
│     │    - Transaction.Paid → 구독 활성화 (이미 처리됐으면 스킵)          │
│     │    - Transaction.Cancelled → 구독 취소                            │
│     │                                                                   │
│     ▼                                                                   │
│  [Response: 200 OK]                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 파일 구조

```
send-grid-test/
├── admin/                              # Frontend (React + Vite)
│   ├── .env.example                    # 환경변수 템플릿
│   ├── src/
│   │   ├── lib/
│   │   │   └── env.ts                  # 환경변수 검증 (Zod)
│   │   └── pages/
│   │       └── settings/
│   │           └── PaymentTestPage.tsx # 결제 테스트 페이지
│
├── elysia-server/                      # Backend (Elysia + Bun)
│   ├── src/
│   │   ├── config.ts                   # PortOne 설정
│   │   ├── routes/
│   │   │   ├── payment.routes.ts       # 결제 API
│   │   │   └── webhook.routes.ts       # 웹훅 수신
│   │   ├── services/
│   │   │   ├── portone.service.ts      # PortOne API 연동
│   │   │   └── billing.service.ts      # 구독 관리
│   │   ├── plugins/
│   │   │   └── permission-guard.plugin.ts  # 라우트 권한
│   │   └── db/
│   │       └── schema/
│   │           └── billing.ts          # DB 스키마
│
└── docs/
    ├── PORTONE_V2_INTEGRATION_GUIDE.md    # 연동 가이드
    └── PORTONE_V2_IMPLEMENTATION_STATUS.md # 현재 문서
```

---

## 3. API 명세

### 3.1 결제 완료 처리

```http
POST /api/v1/payments/complete
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "paymentId": "payment-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "planId": "uuid",
  "workspaceId": "uuid",
  "customerId": "uuid"  // 반드시 현재 로그인 userId와 동일해야 함
}
```

**Response (성공)**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "uuid",
    "paymentId": "payment-xxx",
    "status": "active",
    "plan": {
      "id": "uuid",
      "name": "Pro Monthly",
      "amount": 29000
    },
    "product": {
      "id": "uuid",
      "name": "Pro",
      "tier": "pro"
    },
    "currentPeriodEnd": "2025-02-12T00:00:00.000Z"
  }
}
```

**Response (실패)**
```json
{
  "success": false,
  "error": "결제 검증에 실패했습니다.",
  "code": "BAD_REQUEST"
}
```

### 3.2 결제 조회

```http
GET /api/v1/payments/:paymentId
Authorization: Bearer <JWT>
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "payment-xxx",
    "status": "PAID",
    "amount": { "total": 29000 },
    "method": { "type": "CARD" },
    "paidAt": "2025-01-12T10:00:00.000Z"
  }
}
```

### 3.3 결제 취소

```http
POST /api/v1/payments/:paymentId/cancel
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "reason": "고객 요청에 의한 환불"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-xxx",
    "cancellationId": "cancellation-xxx",
    "subscriptionCancelled": true
  }
}
```

### 3.4 웹훅 수신

```http
POST /api/webhook/portone
Content-Type: application/json
x-portone-signature: <HMAC-SHA256 signature>

{
  "type": "Transaction.Paid",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "data": {
    "paymentId": "payment-xxx",
    "transactionId": "xxx"
  }
}
```

**지원 이벤트 타입**
| 타입 | 처리 |
|------|------|
| `Transaction.Paid` | 구독 활성화 |
| `Transaction.Cancelled` | 구독 취소 |
| `Transaction.PartialCancelled` | 구독 취소 |
| `Transaction.Failed` | 로그 기록 |
| `Transaction.VirtualAccountIssued` | 가상계좌 정보 저장 (TODO) |
| `BillingKey.Issued` | 빌링키 저장 (TODO) |
| `BillingKey.Deleted` | 정기결제 해지 (TODO) |

---

## 4. 보안 체크포인트

### 4.1 인증/권한

| 체크포인트 | 구현 위치 | 설명 |
|-----------|----------|------|
| JWT 인증 | `payment.routes.ts:158-162` | userId 추출 |
| customerId 검증 | `payment.routes.ts:164-170` | userId === customerId |
| 워크스페이스 멤버십 | `payment.routes.ts:198-204` | verifyWorkspaceAccess() |

### 4.2 결제 검증

| 체크포인트 | 구현 위치 | 설명 |
|-----------|----------|------|
| 결제 상태 확인 | `portone.service.ts:171-177` | status === "PAID" |
| 금액 일치 확인 | `portone.service.ts:179-189` | DB 금액 vs PortOne 금액 |
| Idempotency | `payment.routes.ts:172-177` | Redis 24h TTL |
| 분산 락 | `payment.routes.ts:179-195` | Redis SETNX 30s TTL |

### 4.3 웹훅 보안

| 체크포인트 | 구현 위치 | 설명 |
|-----------|----------|------|
| 시그니처 검증 | `portone.service.ts:257-283` | HMAC-SHA256 |
| 프로덕션 필수화 | `portone.service.ts:260-263` | secret 없으면 거부 |

---

## 5. 환경변수

### 5.1 Frontend (.env)

```env
# Required for payment features
VITE_PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PORTONE_CHANNEL_KEY_TOSS=channel-key-xxxxxxxxxxxxxx
```

### 5.2 Backend (.env)

```env
# Required for payment verification
PORTONE_API_SECRET=PortOne xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required in production for webhook security
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (for PayPal)
PORTONE_CHANNEL_KEY_PAYPAL=channel-key-yyyyyyyyyyyyyy
```

### 5.3 환경변수 검증

**Frontend** (`admin/src/lib/env.ts`)
- Zod 스키마로 런타임 검증
- `.min(1)` 필수값 체크
- 누락 시 앱 시작 실패

**Backend** (`elysia-server/src/config.ts`)
- 프로덕션 시작 시 경고 로그 출력
- 누락 시 결제 기능 비활성화 (API 실패)

---

## 6. DB 스키마

### 6.1 관련 테이블

```sql
-- 구독 테이블
billing_subscriptions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  customer_id UUID,
  plan_id UUID NOT NULL,
  status VARCHAR(50),  -- 'active', 'trialing', 'canceled', etc.
  is_primary BOOLEAN DEFAULT true,
  external_subscription_id VARCHAR(255) UNIQUE,  -- paymentId 저장
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_end TIMESTAMP,
  metadata JSONB,  -- lastPayment 정보 저장
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- 요금제 테이블
billing_plans (
  id UUID PRIMARY KEY,
  product_id UUID,
  name VARCHAR(100),
  amount INTEGER NOT NULL,  -- 결제 금액 (원)
  currency VARCHAR(10) DEFAULT 'KRW',
  billing_interval VARCHAR(20),  -- 'day', 'week', 'month', 'year'
  interval_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
)

-- 상품 테이블
billing_products (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  tier VARCHAR(50),  -- 'free', 'starter', 'pro', 'enterprise'
  description TEXT
)
```

### 6.2 구독 상태

| 상태 | 설명 |
|------|------|
| `trialing` | 트라이얼 기간 |
| `active` | 활성 구독 (결제 완료) |
| `past_due` | 결제 실패 |
| `canceled` | 취소됨 |
| `unpaid` | 미결제 |

---

## 7. 테스트

### 7.1 테스트 카드 정보

| 항목 | 값 |
|------|-----|
| 카드번호 | `4242424242424242` |
| 유효기간 | `12/30` |
| CVC | `123` |
| 비밀번호 앞 2자리 | `12` |

> 테스트 결제는 당일 23:30에 자동 취소됨 (체크카드 제외)

### 7.2 테스트 페이지 접근

```
http://localhost:5173/settings?tab=payment-test
```

### 7.3 테스트 시나리오

1. **정상 결제 플로우**
   - 요금제 선택 → 약관 동의 → 결제하기 → 테스트 카드 입력 → 완료

2. **중복 결제 방지**
   - 동일 paymentId로 /complete 2회 호출 → 첫 번째 결과 반환

3. **권한 없는 워크스페이스**
   - 다른 워크스페이스 ID로 요청 → 403 Forbidden

4. **금액 조작 시도**
   - 프론트에서 금액 변경 → 백엔드 검증 실패

---

## 8. 주의사항

### 8.1 프로덕션 배포 전 체크리스트

- [ ] `PORTONE_API_SECRET` 환경변수 설정
- [ ] `PORTONE_WEBHOOK_SECRET` 환경변수 설정
- [ ] 프론트엔드 환경변수 설정 (`VITE_PORTONE_*`)
- [ ] 웹훅 URL 등록 (포트원 콘솔)
- [ ] 테스트 모드 → 라이브 모드 전환
- [ ] 도메인 SSL 인증서 확인

### 8.2 알려진 제한사항

1. **페이팔**: 한국 판매자 + 한국 구매자 조합 시 결제 실패
2. **가상계좌**: 입금 확인 후 구독 활성화 로직 미구현 (TODO)
3. **정기결제**: 빌링키 기반 자동결제 미구현 (TODO)
4. **프로레이션**: 플랜 업그레이드 시 일할 계산 미구현 (TODO)

---

## 9. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-01-12 | 분산 락 추가 (Race Condition 방지) |
| 2025-01-12 | customerId === userId 검증 추가 |
| 2025-01-12 | 웹훅 시그니처 검증 프로덕션 필수화 |
| 2025-01-12 | calculatePeriodEnd Date mutation 버그 수정 |
| 2025-01-12 | 프론트엔드 에러 메시지 정확도 개선 |
| 2025-01-12 | config.ts PortOne 환경변수 경고 추가 |
| 2025-01-11 | 초기 구현 (payment.routes.ts, portone.service.ts) |

---

## 10. 참고 자료

- [포트원 V2 공식 문서](https://developers.portone.io/opi/ko/integration/start/v2/readme?v=v2)
- [토스페이먼츠 설정 가이드](https://portone.gitbook.io/docs/ready/2.-pg/payment-gateway/tosspayments)
- [포트원 웹훅 가이드](https://developers.portone.io/opi/ko/integration/webhook/readme?v=v2)
- [포트원 GitHub 샘플](https://github.com/portone-io/portone-sample)
