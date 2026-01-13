# 포트원 V2 결제 연동 가이드

> PG 심사를 위한 테스트 결제 연동 가이드
>
> 대상 PG: **토스페이먼츠**, **페이팔(PayPal)**

## 목차

1. [사전 준비](#1-사전-준비)
2. [포트원 콘솔 설정](#2-포트원-콘솔-설정)
3. [프론트엔드 연동](#3-프론트엔드-연동-admin)
4. [백엔드 연동](#4-백엔드-연동-elysia-server)
5. [웹훅 설정](#5-웹훅-설정)
6. [테스트 결제](#6-테스트-결제)
7. [PG 심사 체크리스트](#7-pg-심사-체크리스트)

---

## 1. 사전 준비

### 1.1 포트원 계정 및 Store ID

| 항목 | 값 |
|-----|-----|
| **Store ID** | 환경변수 `PORTONE_STORE_ID` 참조 |

### 1.2 V2 API Secret (결제 검증용)

환경변수 `PORTONE_API_SECRET`에 설정

> **주의**: 이 키는 서버에서만 사용. 프론트엔드/코드에 노출 금지!

### 1.3 채널 키

| PG사 | 채널 키 | 비고 |
|-----|--------|------|
| 토스페이먼츠 | 환경변수 `PORTONE_CHANNEL_KEY_TOSS` 참조 | 신모듈 V2, 정기결제 |
| 페이팔 | 환경변수 `PORTONE_CHANNEL_KEY_PAYPAL` 참조 | SPB/RT 방식 |

### 1.4 토스페이먼츠 테스트 채널 설정

| 항목 | 값 |
|-----|-----|
| 채널 이름 | `토스페이먼츠 결제창 정기결제` |
| PG상점아이디 (MID) | 포트원 콘솔에서 확인 |
| 시크릿 키 | 포트원 콘솔에서 확인 (서버 환경변수로 설정) |
| 클라이언트 키 | 포트원 콘솔에서 확인 |
| 과세구분 | `과세` (SaaS 서비스) |
| 결제 모듈 | 신모듈 V2 |

---

### 1.5 웹훅 설정

| 항목 | 값 |
|-----|-----|
| **Webhook URL** | `https://{your-domain}/api/webhook/portone` |
| **Webhook Secret** | 환경변수 `PORTONE_WEBHOOK_SECRET`에 설정 |

> **주의**: Webhook Secret은 서버에서만 사용. 프론트엔드/코드에 노출 금지!

---

## 2. 포트원 콘솔 설정

### 2.1 웹훅 설정 (완료됨 ✅)

1. **결제 연동** > **결제알림 (Webhook)** 탭
2. 설정:
   - 결제모듈: `V2`
   - 설정 모드: `테스트`
   - Endpoint URL: `https://app.rinda.ai/api/webhook/portone`
   - Content Type: `application/json`
   - 버전: `2024-01-01`
3. **웹훅 시크릿 발급** 클릭 → 저장

### 2.2 토스페이먼츠 채널 추가 (완료됨 ✅)

1. **결제 연동** > **연동 모드: 테스트** 선택
2. **채널 추가** 클릭
3. 설정:
   - 결제대행사: `토스페이먼츠`
   - 결제 모듈: `신모듈 (V2)`
   - 채널 속성: `결제`
   - PG상점아이디: `iamporttest_4` (테스트용)
   - 시크릿/클라이언트 키: 위 테스트용 값 입력

### 2.3 페이팔 채널 추가

1. **결제 연동** > **연동 모드: 테스트** 선택
2. **채널 추가** 클릭
3. 설정:
   - 결제대행사: `페이팔`
   - 연동 방식: `페이팔(SPB/RT)` - V2 전용
   - Sandbox 계정 정보 입력

> **주의**: 페이팔은 한국 판매자 + 한국 구매자 조합 시 결제 실패. 테스트 시 US Sandbox 계정 필요.

---

## 3. 프론트엔드 연동 (admin/)

### 3.1 SDK 설치

```bash
cd admin
yarn add @portone/browser-sdk
```

### 3.2 환경 변수 설정

```env
# admin/.env
VITE_PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PORTONE_CHANNEL_KEY_TOSS=channel-key-xxxxxx
VITE_PORTONE_CHANNEL_KEY_PAYPAL=channel-key-yyyyyy
```

### 3.3 결제 컴포넌트 구현

#### 3.3.1 토스페이먼츠 일반결제

```typescript
// admin/src/components/payment/TossPayment.tsx
import * as PortOne from "@portone/browser-sdk/v2";

interface PaymentRequest {
  planId: string;
  planName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
}

export async function requestTossPayment(request: PaymentRequest) {
  const paymentId = `payment-${crypto.randomUUID()}`;

  const response = await PortOne.requestPayment({
    storeId: import.meta.env.VITE_PORTONE_STORE_ID,
    channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_TOSS,
    paymentId,
    orderName: request.planName,
    totalAmount: request.amount,
    currency: "CURRENCY_KRW",
    payMethod: "CARD",
    customer: {
      email: request.customerEmail,
      fullName: request.customerName,
    },
    // 모바일 리다이렉트 URL
    redirectUrl: `${window.location.origin}/payment/complete`,
  });

  if (response.code) {
    // 오류 발생
    throw new Error(response.message);
  }

  // 서버에 결제 완료 요청
  const result = await fetch("/api/v1/payments/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId,
      planId: request.planId,
    }),
  });

  return result.json();
}
```

#### 3.3.2 페이팔 결제 (SPB 방식)

```typescript
// admin/src/components/payment/PayPalPayment.tsx
import * as PortOne from "@portone/browser-sdk/v2";

interface PayPalPaymentProps {
  planId: string;
  planName: string;
  amount: number;
  currency: "USD" | "KRW";
  onSuccess: (paymentId: string) => void;
  onError: (error: Error) => void;
}

export function PayPalPaymentButton(props: PayPalPaymentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paymentIdRef = useRef<string>("");

  useEffect(() => {
    if (!containerRef.current) return;

    paymentIdRef.current = `payment-${crypto.randomUUID()}`;

    PortOne.loadPaymentUI(
      {
        uiType: "PAYPAL_SPB", // 일반결제
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_PAYPAL,
        paymentId: paymentIdRef.current,
        orderName: props.planName,
        totalAmount: props.amount,
        currency: props.currency === "USD" ? "CURRENCY_USD" : "CURRENCY_KRW",
      },
      {
        onPaymentSuccess: async (response) => {
          // 서버에 결제 완료 요청
          await fetch("/api/v1/payments/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: paymentIdRef.current,
              planId: props.planId,
            }),
          });
          props.onSuccess(paymentIdRef.current);
        },
        onPaymentFail: (error) => {
          props.onError(new Error(error.message));
        },
      }
    );
  }, []);

  return <div ref={containerRef} className="portone-ui-container" />;
}
```

#### 3.3.3 결제 완료 페이지 (리다이렉트 처리)

```typescript
// admin/src/pages/payment/PaymentCompletePage.tsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function PaymentCompletePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const paymentId = searchParams.get("paymentId");
    const code = searchParams.get("code");

    if (code) {
      // 결제 실패
      const message = searchParams.get("message");
      toast.error(`결제 실패: ${message}`);
      navigate("/billing");
      return;
    }

    if (paymentId) {
      // 서버에 결제 완료 요청
      fetch("/api/v1/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            toast.success("결제가 완료되었습니다!");
            navigate("/billing?success=true");
          } else {
            toast.error("결제 검증 실패");
            navigate("/billing");
          }
        });
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner /> 결제 처리 중...
    </div>
  );
}
```

---

## 4. 백엔드 연동 (elysia-server/)

### 4.1 환경 변수 설정

```env
# elysia-server/.env
PORTONE_API_SECRET=PortOne xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

### 4.2 결제 검증 서비스

```typescript
// elysia-server/src/services/portone.service.ts
import { config } from "../config";
import logger from "../utils/logger";

const PORTONE_API_BASE = "https://api.portone.io";

interface PortOnePayment {
  id: string;
  status: "PENDING" | "VIRTUAL_ACCOUNT_ISSUED" | "PAID" | "FAILED" | "CANCELLED";
  amount: {
    total: number;
    currency: string;
  };
  method?: {
    type: string;
    card?: {
      number: string;
      issuer: string;
    };
  };
  customer?: {
    email?: string;
    name?: string;
  };
  paidAt?: string;
}

/**
 * 포트원 결제 조회 API
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment | null> {
  try {
    const response = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${config.portone.apiSecret}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error({ error, paymentId }, "[PortOne] Failed to get payment");
      return null;
    }

    return response.json();
  } catch (error) {
    logger.error({ error, paymentId }, "[PortOne] API error");
    return null;
  }
}

/**
 * 결제 검증
 */
export async function verifyPayment(
  paymentId: string,
  expectedAmount: number
): Promise<{
  verified: boolean;
  payment?: PortOnePayment;
  error?: string;
}> {
  const payment = await getPayment(paymentId);

  if (!payment) {
    return { verified: false, error: "Payment not found" };
  }

  if (payment.status !== "PAID") {
    return {
      verified: false,
      payment,
      error: `Payment status is ${payment.status}, expected PAID`,
    };
  }

  if (payment.amount.total !== expectedAmount) {
    return {
      verified: false,
      payment,
      error: `Amount mismatch: ${payment.amount.total} !== ${expectedAmount}`,
    };
  }

  return { verified: true, payment };
}

/**
 * 결제 취소
 */
export async function cancelPayment(
  paymentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${config.portone.apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### 4.3 결제 완료 라우트

```typescript
// elysia-server/src/routes/payment.routes.ts
import { Elysia, t } from "elysia";
import { db } from "../db";
import { subscriptions, billingCustomers, billingPlans } from "../db/schema/billing";
import * as portoneService from "../services/portone.service";
import logger from "../utils/logger";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  /**
   * 결제 완료 처리
   */
  .post(
    "/complete",
    async ({ body, set }) => {
      const { paymentId, planId } = body;

      // 1. Plan 정보 조회
      const plan = await db.query.billingPlans.findFirst({
        where: eq(billingPlans.id, planId),
        with: { product: true },
      });

      if (!plan) {
        set.status = 400;
        return { success: false, error: "Plan not found" };
      }

      // 2. 포트원 결제 검증
      const { verified, payment, error } = await portoneService.verifyPayment(
        paymentId,
        plan.amount
      );

      if (!verified) {
        logger.error({ paymentId, planId, error }, "[Payment] Verification failed");
        set.status = 400;
        return { success: false, error };
      }

      // 3. 구독 생성/업데이트
      // (기존 billing.service.ts의 createSubscription 활용)

      logger.info(
        { paymentId, planId, amount: payment?.amount.total },
        "[Payment] Payment completed successfully"
      );

      return {
        success: true,
        paymentId,
        status: payment?.status,
      };
    },
    {
      body: t.Object({
        paymentId: t.String(),
        planId: t.String(),
      }),
    }
  );
```

### 4.4 config.ts 수정

```typescript
// elysia-server/src/config.ts 에 추가
export const config = {
  // ... 기존 설정
  portone: {
    apiSecret: getEnv("PORTONE_API_SECRET"),
    webhookSecret: getEnvOrDefault("PORTONE_WEBHOOK_SECRET", ""),
  },
};
```

---

## 5. 웹훅 설정

### 5.1 웹훅 라우트

```typescript
// elysia-server/src/routes/webhook.portone.routes.ts
import { Elysia, t } from "elysia";
import { createHmac } from "crypto";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * 웹훅 시그니처 검증
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return signature === expected;
}

export const portoneWebhookRoutes = new Elysia({ prefix: "/webhooks" })
  .post(
    "/portone",
    async ({ body, headers, set }) => {
      const signature = headers["x-portone-signature"];
      const payload = JSON.stringify(body);

      // 시그니처 검증
      if (config.portone.webhookSecret) {
        if (!verifyWebhookSignature(payload, signature, config.portone.webhookSecret)) {
          logger.warn("[PortOne Webhook] Invalid signature");
          set.status = 401;
          return { error: "Invalid signature" };
        }
      }

      const { type, data } = body;

      logger.info({ type, paymentId: data?.paymentId }, "[PortOne Webhook] Received");

      switch (type) {
        case "Transaction.Paid":
          // 결제 완료 처리
          await handlePaymentPaid(data);
          break;

        case "Transaction.VirtualAccountIssued":
          // 가상계좌 발급 완료
          await handleVirtualAccountIssued(data);
          break;

        case "Transaction.Cancelled":
          // 결제 취소
          await handlePaymentCancelled(data);
          break;

        case "Transaction.Failed":
          // 결제 실패
          await handlePaymentFailed(data);
          break;

        default:
          logger.info({ type }, "[PortOne Webhook] Unhandled event type");
      }

      return { success: true };
    },
    {
      body: t.Object({
        type: t.String(),
        data: t.Any(),
      }),
    }
  );

async function handlePaymentPaid(data: any) {
  // 결제 완료 후 구독 활성화 등 처리
}

async function handleVirtualAccountIssued(data: any) {
  // 가상계좌 정보 저장
}

async function handlePaymentCancelled(data: any) {
  // 구독 취소 처리
}

async function handlePaymentFailed(data: any) {
  // 결제 실패 로깅
}
```

---

## 6. 테스트 결제

### 6.1 토스페이먼츠 테스트

| 항목 | 값 |
|-----|-----|
| 테스트 카드번호 | `4242424242424242` |
| 유효기간 | 미래 날짜 아무거나 |
| CVC | `123` |
| 비밀번호 앞 2자리 | `12` |

> 테스트 결제는 당일 23:30에 자동 취소됨 (체크카드 제외)

### 6.2 페이팔 Sandbox 테스트

1. [PayPal Developer](https://developer.paypal.com) 접속
2. Sandbox Accounts에서 **US Personal** 계정 생성
3. 해당 계정으로 로그인하여 테스트

---

## 7. PG 심사 체크리스트

### 7.1 필수 구현 항목

| 항목 | 상태 | 설명 |
|-----|:----:|------|
| 결제 페이지 | ⬜ | 상품 선택 및 결제 버튼 |
| 결제창 호출 | ⬜ | PortOne.requestPayment() 구현 |
| 결제 완료 처리 | ⬜ | 서버 검증 및 구독 생성 |
| 웹훅 수신 | ⬜ | /webhooks/portone 엔드포인트 |
| 결제 취소 | ⬜ | 취소 API 연동 |
| 이용약관 | ⬜ | 결제 전 동의 체크박스 |
| 환불 정책 | ⬜ | 환불 정책 페이지 |

### 7.2 PG 심사 제출 시 확인사항

1. **테스트모드 설정 완료** - 결제창이 정상 호출되어야 함
2. **실제 결제 테스트** - 테스트 카드로 결제 성공 확인
3. **결제 내역 조회** - 포트원 콘솔에서 결제 내역 확인
4. **웹훅 수신 확인** - 웹훅 로그 확인

---

## 8. 구현 단계별 계획

### Phase 1: 기본 설정 (1일)

1. [ ] 포트원 콘솔에서 토스페이먼츠/페이팔 채널 추가
2. [ ] 환경 변수 설정 (프론트엔드, 백엔드)
3. [ ] SDK 설치 (`@portone/browser-sdk`)

### Phase 2: 백엔드 구현 (1-2일)

1. [ ] `portone.service.ts` 생성 (결제 조회, 검증, 취소)
2. [ ] `payment.routes.ts` 생성 (결제 완료 처리)
3. [ ] `webhook.portone.routes.ts` 생성 (웹훅 수신)
4. [ ] config.ts에 포트원 설정 추가

### Phase 3: 프론트엔드 구현 (1-2일)

1. [ ] 결제 버튼 컴포넌트 (토스페이먼츠)
2. [ ] 페이팔 SPB 버튼 컴포넌트
3. [ ] 결제 완료 페이지 (리다이렉트 처리)
4. [ ] 결제 내역 페이지

### Phase 4: 테스트 및 심사 (1일)

1. [ ] 테스트 결제 진행
2. [ ] 웹훅 수신 확인
3. [ ] PG 심사 제출

---

## 참고 자료

- [포트원 V2 공식 문서](https://developers.portone.io/opi/ko/integration/start/v2/readme?v=v2)
- [토스페이먼츠 설정](https://portone.gitbook.io/docs/ready/2.-pg/payment-gateway/tosspayments)
- [페이팔 V2 연동](https://developers.portone.io/opi/ko/integration/pg/v2/paypal-v2?v=v2)
- [포트원 웹훅 가이드](https://developers.portone.io/opi/ko/integration/webhook/readme?v=v2)
- [포트원 GitHub 샘플](https://github.com/portone-io/portone-sample)

---

## Sources

- [포트원 토스페이먼츠 설정](https://portone.gitbook.io/docs/ready/2.-pg/payment-gateway/tosspayments)
- [포트원 V2 페이팔 연동](https://developers.portone.io/opi/ko/integration/pg/v2/paypal-v2?v=v2)
- [페이팔 채널설정방법](https://help.portone.io/content/paypal)
- [토스페이먼츠 신모듈 정기결제](https://guide.portone.io/64ad2129-a247-48f6-8da0-702757ca5860)
