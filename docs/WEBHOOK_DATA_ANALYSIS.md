# SendGrid Inbound Parse 웹훅 데이터 분석

## 개요

이 문서는 SendGrid Inbound Parse 웹훅을 통해 수신되는 데이터 구조에 대한 종합 분석을 제공합니다.

**테스트 날짜:** 2025년 10월 6일
**웹훅 엔드포인트:** `/api/webhook/inbound`
**MX 레코드:** `send.grinda.ai` → `mx.sendgrid.net` (우선순위: 50)
**테스트 이메일:** rinda@send.grinda.ai

---

## 웹훅 페이로드 구조

### 전체 필드 목록

웹훅은 페이로드에서 **11개의 표준 필드**를 수신합니다:

```json
{
  "from": "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)",
  "to": "rinda@send.grinda.ai",
  "subject": "Webhook Data Analysis Test",
  "envelope": "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}",
  "email": "Received: from MACMINIM4PROui-Macmini.local...",
  "SPF": "none",
  "dkim": "none",
  "sender_ip": "125.138.122.162",
  "spam_score": "1.2",
  "spam_report": "Spam detection software...",
  "charsets": "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}"
}
```

---

## TypeScript 타입 정의

### SendGridInboundPayload

```typescript
/**
 * SendGrid Inbound Parse Webhook Payload
 *
 * 예시 데이터:
 * {
 *   "from": "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)",
 *   "to": "rinda@send.grinda.ai",
 *   "subject": "Webhook Data Analysis Test",
 *   "envelope": "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}",
 *   "email": "Received: from MACMINIM4PROui-Macmini.local...",
 *   "SPF": "none",
 *   "dkim": "none",
 *   "sender_ip": "125.138.122.162",
 *   "spam_score": "1.2",
 *   "spam_report": "Spam detection software...",
 *   "charsets": "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}"
 * }
 */
export interface SendGridInboundPayload {
  // 기본 이메일 정보
  /** 발신자 이메일 주소 (선택적 표시 이름 포함)
   * 예시: "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)" */
  from: string

  /** 수신자 이메일 주소
   * 예시: "rinda@send.grinda.ai" */
  to: string

  /** 이메일 제목
   * 예시: "Webhook Data Analysis Test" */
  subject: string

  /** 참조 수신자 (쉼표로 구분)
   * 예시: "user1@example.com, user2@example.com" */
  cc?: string

  /** 숨은 참조 수신자 (쉼표로 구분) */
  bcc?: string

  // 콘텐츠 필드
  /** 순수 텍스트 본문 내용 */
  text?: string

  /** HTML 본문 내용 */
  html?: string

  /** RFC 822 형식의 전체 원본 이메일 (모든 헤더 포함)
   * 예시: "Received: from MACMINIM4PROui-Macmini.local (mxd [125.138.122.162])..." */
  email?: string

  // Envelope 및 라우팅
  /** SMTP envelope 정보 (JSON 문자열)
   * 예시: "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}" */
  envelope?: string

  // 보안 및 인증
  /** SPF 검증 결과
   * 예시: "none", "pass", "fail", "softfail" */
  SPF?: string

  /** DKIM 서명 검증 결과
   * 예시: "none", "pass", "fail" */
  dkim?: string

  /** 발신 메일 서버의 IP 주소
   * 예시: "125.138.122.162" */
  sender_ip?: string

  /** SpamAssassin 점수 (숫자 문자열)
   * 예시: "1.2" */
  spam_score?: string

  /** SpamAssassin 상세 분석 보고서
   * 예시: "Spam detection software, running on the system..." */
  spam_report?: string

  // 첨부파일
  /** 첨부파일 개수 (JSON 문자열)
   * 예시: "2" */
  attachments?: string

  /** 첨부파일 메타데이터 (JSON 객체를 문자열로)
   * 예시: "{\"file1.pdf\": {\"type\": \"application/pdf\", \"size\": 12345}}" */
  "attachment-info"?: string

  // 문자 인코딩
  /** 이메일 파트별 문자 인코딩 (JSON 문자열)
   * 예시: "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}" */
  charsets?: string

  /** 인라인 이미지용 Content-ID 매핑 (JSON 문자열)
   * 예시: "{\"image1.png\": \"cid:12345\"}" */
  "content-ids"?: string

  // 헤더 (SendGrid 설정에서 요청 시)
  /** 전체 이메일 헤더 (JSON 문자열) */
  headers?: string
}
```

### 보조 타입들

```typescript
/**
 * 파싱된 envelope 객체
 * 예시: { "to": ["rinda@send.grinda.ai"], "from": "sender@example.com" }
 */
export interface SendGridEnvelope {
  to: string[]
  from: string
}

/**
 * 파싱된 charsets 객체
 * 예시: { "to": "UTF-8", "from": "UTF-8", "subject": "UTF-8" }
 */
export interface SendGridCharsets {
  to?: string
  from?: string
  subject?: string
  text?: string
  html?: string
}

/**
 * 파싱된 첨부파일 정보
 * 예시: { "file1.pdf": { "type": "application/pdf", "size": 12345 } }
 */
export interface SendGridAttachmentInfo {
  [filename: string]: {
    type: string
    size: number
    charset?: string
  }
}
```

---

## 필드 상세 설명

### 1. 기본 이메일 정보

#### `from` (string)
- **설명:** 발신자 이메일 주소 (선택적 표시 이름 포함)
- **예시:** `"macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)"`
- **용도:** 발신자 식별, 답장 주소 추출

#### `to` (string)
- **설명:** 수신자 이메일 주소
- **예시:** `"rinda@send.grinda.ai"`
- **용도:** 어떤 이메일 계정이 이 메시지를 받았는지 식별

#### `subject` (string)
- **설명:** 이메일 제목
- **예시:** `"Webhook Data Analysis Test"`
- **용도:** 이메일 목록에 표시, 스레드 매칭

---

### 2. Envelope 정보

#### `envelope` (JSON 문자열)
- **설명:** 실제 발신자/수신자를 포함하는 SMTP envelope 정보
- **형식:** 파싱이 필요한 JSON 문자열
- **구조:**
  ```json
  {
    "to": ["rinda@send.grinda.ai"],
    "from": "macminim4pro@MACMINIM4PROui-Macmini.local"
  }
  ```
- **용도:**
  - 실제 메일 라우팅 확인
  - 전달된 이메일 감지
  - BCC 수신자 확인

---

### 3. 이메일 콘텐츠

#### `email` (string)
- **설명:** 헤더와 본문을 포함한 전체 원본 이메일 메시지
- **형식:** SMTP 헤더가 포함된 RFC 822 형식
- **포함 내용:**
  - 모든 이메일 헤더 (Received, Message-Id, Date 등)
  - 전체 이메일 본문
  - MIME 경계 (multipart인 경우)

**헤더 예시:**
```
Received: from MACMINIM4PROui-Macmini.local (mxd [125.138.122.162])
  by mx.sendgrid.net with ESMTP id tpotgClJRO2GOgLiD7RKtQ
  for <rinda@send.grinda.ai>; Mon, 06 Oct 2025 10:55:18.886 +0000 (UTC)
Received: by MACMINIM4PROui-Macmini.local (Postfix, from userid 501)
  id 4B6901E4625D; Mon,  6 Oct 2025 19:55:17 +0900 (KST)
To: rinda@send.grinda.ai
Subject: Webhook Data Analysis Test
Message-Id: <20251006105517.4B6901E4625D@MACMINIM4PROui-Macmini.local>
Date: Mon,  6 Oct 2025 19:55:17 +0900 (KST)
From: macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)

Test email for webhook data analysis

This is a comprehensive test to analyze all data fields received through SendGrid Inbound Parse webhook.

Test details:
- Timestamp: $(date)
- Purpose: Document webhook payload structure
- Testing: All available SendGrid fields

Best regards,
Claude Code
```

- **용도:**
  - 스레딩을 위한 Message-Id 추출
  - 대화 추적을 위한 In-Reply-To 및 References 파싱
  - 별도 필드로 제공되지 않는 추가 헤더 추출

---

### 4. 보안 및 인증

#### `SPF` (string)
- **설명:** SPF (Sender Policy Framework) 검증 결과
- **예시:** `"none"`, `"pass"`, `"fail"`, `"softfail"`
- **용도:** 스푸핑 방지 검증

#### `dkim` (string)
- **설명:** DKIM (DomainKeys Identified Mail) 서명 검증 결과
- **예시:** `"none"`, `"pass"`, `"fail"`
- **용도:** 이메일 인증, 발신자 도메인 검증

#### `sender_ip` (string)
- **설명:** 발신 메일 서버의 IP 주소
- **예시:** `"125.138.122.162"`
- **용도:**
  - 지오로케이션
  - 블랙리스트 확인
  - 속도 제한

#### `spam_score` (string)
- **설명:** SpamAssassin 점수
- **예시:** `"1.2"`
- **형식:** 숫자 문자열 (낮을수록 좋음, 일반적으로 < 5.0이 스팸 아님)
- **용도:** 의심스러운 이메일 필터링

#### `spam_report` (string)
- **설명:** SpamAssassin 상세 분석 보고서
- **포함 내용:**
  - 전체 점수 및 임계값
  - 점수가 부여된 개별 규칙
  - 콘텐츠 미리보기
  - 규칙 설명

**예시:**
```
Spam detection software, running on the system "parsley-spamassassin-6f44f5c7b-4lhz8",
has NOT identified this incoming email as spam.

Content analysis details:   (1.2 points, 5.0 required)

 pts rule name              description
---- ---------------------- --------------------------------------------------
 0.0 RCVD_IN_ZEN_BLOCKED_OPENDNS RBL: ADMINISTRATOR NOTICE: The query
 0.8 DKIM_ADSP_NXDOMAIN     No valid author signature and domain not in
 0.4 KHOP_HELO_FCRDNS       Relay HELO differs from its IP's reverse DNS
```

---

### 5. 문자 인코딩

#### `charsets` (JSON 문자열)
- **설명:** 이메일 파트별 문자 인코딩
- **형식:** 파싱이 필요한 JSON 문자열
- **구조:**
  ```json
  {
    "to": "UTF-8",
    "from": "UTF-8",
    "subject": "UTF-8"
  }
  ```
- **용도:** 올바른 텍스트 디코딩 및 표시

---

## 이번 테스트에서 존재하지 않은 필드

다음 필드들은 SendGrid의 Inbound Parse 명세의 일부이지만 테스트 이메일에는 존재하지 않았습니다:

### 이메일 콘텐츠 필드
- `text` - 순수 텍스트 본문 (이메일이 raw로 파싱되어 존재하지 않음)
- `html` - HTML 본문 콘텐츠
- `cc` - 참조 수신자
- `bcc` - 숨은 참조 수신자

### 첨부파일 필드
- `attachments` - 첨부파일 개수 (JSON 문자열)
- `attachment-info` - 첨부파일 메타데이터 (JSON 객체)
- `attachment[N]` - 개별 첨부파일 (multipart)

### 헤더 필드
- `headers` - JSON 문자열로 된 전체 헤더 (요청 시)
- `content-ids` - 인라인 이미지용 Content-ID 매핑

---

## 실제 수신 데이터 예시

### 예시 1: 로컬 테스트 이메일 (Postfix)

```json
{
  "level": "info",
  "time": 1759748119797,
  "env": "production",
  "service": "elysia-server",
  "fullBody": {
    "charsets": "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}",
    "SPF": "none",
    "subject": "Webhook Data Analysis Test",
    "envelope": "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}",
    "spam_report": "Spam detection software, running on the system...",
    "email": "Received: from MACMINIM4PROui-Macmini.local...",
    "dkim": "none",
    "sender_ip": "125.138.122.162",
    "to": "rinda@send.grinda.ai",
    "from": "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)",
    "spam_score": "1.2"
  },
  "fullFiles": [],
  "bodyKeys": [
    "charsets",
    "SPF",
    "subject",
    "envelope",
    "spam_report",
    "email",
    "dkim",
    "sender_ip",
    "to",
    "from",
    "spam_score"
  ],
  "filesCount": 0,
  "msg": "Complete webhook payload received"
}
```

### 예시 2: Gmail 발송 이메일 (프로덕션)

**특징:**
- ✅ DKIM 서명 포함 (gmail.com)
- ✅ SPF 인증 통과 예상
- ✅ UTF-8 한글 지원 (RFC 2047 Base64 인코딩)
- ✅ Multipart/alternative (텍스트 + HTML)
- ✅ Gmail 전용 헤더 다수

**원본 이메일 (`email` 필드):**
```
Received: from mail-ed1-f42.google.com (mxd [209.85.208.42]) by mx.sendgrid.net with ESMTP id zUTGYMQyQJS0i_ni71A4YA for <rinda@send.grinda.ai>; Mon, 06 Oct 2025 11:18:37.444 +0000 (UTC)
Received: by mail-ed1-f42.google.com with SMTP id 4fb4d7f45d1cf-6395172532fso5820621a12.0
        for <rinda@send.grinda.ai>; Mon, 06 Oct 2025 04:18:37 -0700 (PDT)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=gmail.com; s=20230601; t=1759749516; x=1760354316; darn=send.grinda.ai;
        h=to:subject:message-id:date:from:mime-version:from:to:cc:subject
         :date:message-id:reply-to;
        bh=WWDkfHWZC/gSepNF/yiRszjpqa0fG0PU25MudI/yoNU=;
        b=e9XOG3tZJGgd1dFIrI6Wn8h9xXD6rUc3wvuVR/ys5LH2Wrledo5ST3EzYDT7UXgYIJ
         giUA6q9dGwmVufVm7PaEd1EYBzYMo3EN50Y/e2ByiidAtl5JyKimJe+OrSTQYa9W9q0J
         lPZ0uHuHNAdBXu0WCF0F1JdiAout470HXzQ53AJujcG2TalcfHg42NnrtQObyO3jB/u8
         hxcFBPIKztC9yJI4ZJPy2fnTI+ZuOCrRed2GLK3dUNytvZXvH7NMyXg2PoSnabHT57AB
         cp0aS7Imb7TeXWSZyFLnba8D6mLqK2h6a/pnUZVyEWdmYDdCVv54la1uAiUx2s5g7zhd
         O3TA==
X-Google-DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=1e100.net; s=20230601; t=1759749516; x=1760354316;
        h=to:subject:message-id:date:from:mime-version:x-gm-message-state
         :from:to:cc:subject:date:message-id:reply-to;
        bh=WWDkfHWZC/gSepNF/yiRszjpqa0fG0PU25MudI/yoNU=;
        b=jUYf0MxDnQ9jBWBp1IRqIhBsV90epmz2Ab8xwyRLGlcVw5WiAa6EP+C5iwh7mPi8GT
         WYCXT6zXnd75HBoeptwJOHnokosz+WB2iwzmDUcFw+kGBC/O8sR5pbLm6TuXNfNfpAHw
         r4Hq2hcCApVlYwvHmIh1ZVJOM8zmvfe6fEaIiIgbMl5v8Yd7jfyxe8KSfqLRy5jApKgg
         jkQ/1I2dgkBFi/og+ODw4K1aGyXFrXPc065E5QBOeo/lPa/DhnLBwQoO4u5xresLeq0M
         766e5JSwmY3oaMbKamngL4Kqgdw112M2zd5xX2dArjHY6L67aP1PQLL4Hg8/31QIa1Nb
         FWzg==
X-Gm-Message-State: AOJu0Yyq3D3iFXHlW5KHX9y3FBHoeu5S9v89bd9r1ia4XOp5+/kiqPsq
    ERWPL4WCa/0iiKtdHKd3M7md40r1jJbA4Gfm7qt5kt3sr7A2iv8BVDTkUD45JFYHKz9niVBi+av
    FXhaYiHHYaM/zJubOpGTMFUBVhcym0oiW9JyV2Ks=
X-Gm-Gg: ASbGncvF5huE+XgeMn629ZnnqpVdXMAreMYyjeYjZq/NkvB6KpDbmOj9299z+xWJvMQ
    Fm4dhdIY8VUa9n0MUnFn+GKU6QOBFqei92Q8jq9qTIRkKbwVp0/0qbC9Nn5QFn1v9ss3AT6j6uP
    0BIYTJ8yU6uOJ1iezF5BflVR46ssx/cHw+1o39bgQqIDTFda7Vbk+hqrDt+S/RUyOb5vDe7CniD
    75JJWfCum5ozakrMvdPcAeu7tlIZGA/ZcaNLQ09gm+s1aLe0FvzcTep8x0o8Znim5xMxXOzLa/m
X-Google-Smtp-Source: AGHT+IE2MhJfP8stCXUtppXmg7CcvamoCqKrCuH8bFCzqE9qfgdrLvvlLCEWdgf4lBZdkuo4kt/owWvetaPC77+ELQw=
X-Received: by 2002:a05:6402:1a2d:b0:634:4f76:25cd with SMTP id
 4fb4d7f45d1cf-63934fd122emr9819560a12.22.1759749515870; Mon, 06 Oct 2025
 04:18:35 -0700 (PDT)
MIME-Version: 1.0
From: =?UTF-8?B?7J207LKg7Z2s?= <wks0968@gmail.com>
Date: Mon, 6 Oct 2025 20:18:23 +0900
X-Gm-Features: AS18NWC1peRbdRNpbjBAuhRji5-kQRW2tBsy43510Dgg01WGBb_Ft2V98R90sd8
Message-ID: <CAAt3oNgzVftS0vhkfJJBrfxy3Y2htqaq9CYcpxMZtC7WnUYC1A@mail.gmail.com>
Subject: =?UTF-8?B?7JWI64WV7ZWY7IS47JqULCE=?=
To: rinda@send.grinda.ai
Content-Type: multipart/alternative; boundary="000000000000c9874f06407b9c87"

--000000000000c9874f06407b9c87
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

7JWI64WV7ZWY7IS47JqULA0KDQrrqZTsnbzsnYQg7J6YIOuwm+yVmOyKteuLiOuLpC4g7ZmV7J24
IO2bhCDtmozsi6Drk5zrpqzqsqDsirXri4jri6QuDQo=
--000000000000c9874f06407b9c87
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

PGRpdiBkaXI9Imx0ciI+PGRpdiBjbGFzcz0iZ21haWxfZGVmYXVsdCIgc3R5bGU9ImZvbnQtZmFt
aWx5OmFyaWFsLHNhbnMtc2VyaWYiPjxwIHN0eWxlPSJmb250LWZhbWlseTpBcmlhbCxIZWx2ZXRp
Y2Esc2Fucy1zZXJpZiI+7JWI64WV7ZWY7IS47JqULDwvcD48cCBzdHlsZT0iZm9udC1mYW1pbHk6
QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiPuuplOydvOydhCDsnpgg67Cb7JWY7Iq164uI64uk
LiDtmZXsnbgg7ZuEIO2ajOyLoOuTnOumrOqyoOyKteuLiOuLpC48L3A+PGJyIGNsYXNzPSJnbWFp
bC1BcHBsZS1pbnRlcmNoYW5nZS1uZXdsaW5lIj48L2Rpdj48L2Rpdj4NCg==
--000000000000c9874f06407b9c87--
```

**파싱된 필드 (예상):**
```typescript
{
  from: "이청희 <wks0968@gmail.com>",
  to: "rinda@send.grinda.ai",
  subject: "안녕하세요,!",
  text: "안녕하세요,\n\n메일을 잘 받았습니다. 확인 부탁드립니다.",
  html: "<div dir=\"ltr\"><div class=\"gmail_default\" style=\"font-family:arial,sans-serif\">...</div></div>",
  email: "[위 원본 이메일 전체]",
  envelope: "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"wks0968@gmail.com\"}",
  dkim: "pass",  // Gmail DKIM 서명 검증 성공
  SPF: "pass",   // Gmail SPF 검증 성공
  sender_ip: "209.85.208.42",  // Gmail 서버 IP
  charsets: "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\",\"text\":\"UTF-8\",\"html\":\"UTF-8\"}",
  spam_score: "0.0",  // Gmail 발송이므로 낮은 점수
  spam_report: "[SpamAssassin 보고서]"
}
```

**디코딩된 내용:**
- **From:** 이청희 (wks0968@gmail.com)
- **Subject:** 안녕하세요,!
- **본문 (텍스트):** "안녕하세요,\n\n메일을 잘 받았습니다. 확인 부탁드립니다."
- **본문 (HTML):** Gmail 스타일 HTML 버전

---

## 데이터 처리 플로우

### 1. 웹훅 수신
```
POST /api/webhook/inbound
Content-Type: multipart/form-data
```

### 2. 처리 단계

1. **페이로드 수신**
   - multipart form data 파싱
   - body 필드 및 파일 추출

2. **헤더 추출**
   - 원본 헤더를 위해 `email` 필드 파싱
   - Message-ID, In-Reply-To, References 추출

3. **JSON 필드 파싱**
   - `envelope` → 라우팅 정보 추출
   - `charsets` → 문자 인코딩 맵

4. **데이터베이스 저장**
   - `to` 주소로 이메일 계정 매칭
   - `from` 주소로 리드 찾기
   - `emails` 테이블에 저장

5. **답장 처리**
   - `In-Reply-To` 헤더 확인
   - Message-ID로 원본 이메일 찾기
   - `email_replies` 테이블에 항목 생성

6. **자동 답장** (선택사항)
   - 자동 응답 발송
   - 스레딩 헤더 포함

### 3. 응답
```json
{
  "status": "OK"
}
```

**처리 시간:** 평균 ~28ms

---

## 데이터베이스 저장

### 이메일 레코드 구조

```typescript
{
  workspaceId: string
  userEmailAccountId: string
  leadId: string | null
  direction: "inbound"
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  sentAt: Date
  messageId: string | null
  inReplyTo: string | null
}
```

---

## 중요 참고사항

### 표준 이메일 본문 누락

테스트에서 `text` 및 `html` 필드가 웹훅 페이로드에 **존재하지 않았습니다**. 대신 전체 이메일 콘텐츠가 `email` 필드에 RFC 822 원본 형식으로 포함되어 있습니다.

**이유:** SendGrid의 Inbound Parse 설정에 따라 달라집니다:
- **Raw 모드:** `email` 필드에 전체 이메일 전송
- **Parsed 모드:** `text`, `html`, 첨부파일을 별도로 추출

**권장사항:** 더 쉬운 콘텐츠 추출을 위해 SendGrid를 파싱 모드로 설정하거나, `email` 필드에 대한 RFC 822 파싱을 구현하세요.

### Gmail 이메일 처리 시 고려사항

Gmail 이메일은 프로덕션 환경에서 가장 흔한 케이스이므로 다음을 고려해야 합니다:

1. **RFC 2047 인코딩:**
   - `From`, `Subject` 필드가 Base64로 인코딩됨
   - 예: `=?UTF-8?B?7J207LKg7Z2s?=` → "이청희"
   - 파싱 라이브러리 필요 (예: `mailparser`, `iconv-lite`)

2. **Multipart 본문:**
   - 대부분 `multipart/alternative` 형식
   - 텍스트와 HTML 버전 모두 포함
   - Base64 전송 인코딩 사용

3. **DKIM/SPF 인증:**
   - Gmail은 항상 DKIM 서명 포함
   - 검증 결과는 `dkim: "pass"`, `SPF: "pass"` 예상
   - 인증 실패 시 스팸 처리 고려

4. **Gmail 전용 헤더:**
   - `X-Google-DKIM-Signature`
   - `X-Gm-Message-State`
   - `X-Gm-Gg` (Gmail Group)
   - `X-Google-Smtp-Source`
   - 이 헤더들은 `email` 필드에서만 확인 가능

### 보안 고려사항

1. **SPF/DKIM 검증:**
   - 현재 테스트는 둘 다 `"none"`으로 표시됨
   - 프로덕션 이메일은 적절한 인증이 있어야 함

2. **스팸 필터링:**
   - 1.2/5.0 점수는 허용 가능
   - 점수 > 5.0인 이메일 거부 고려

3. **IP 화이트리스팅:**
   - 웹훅이 SendGrid IP에서 오는지 확인
   - 현재 발신자 IP: 125.138.122.162

---

## 타입 적용 위치

### 1. 모델 정의
- **파일:** `elysia-server/src/models/email.model.ts`
- **타입:** `SendGridInboundPayload`, `SendGridEnvelope`, `SendGridCharsets`, `SendGridAttachmentInfo`

### 2. 웹훅 서비스
- **파일:** `elysia-server/src/services/webhook.service.ts`
- **함수:**
  - `processInboundEmail(body: SendGridInboundPayload, files: FileData[])`
  - `processInboundStore(body: SendGridInboundPayload, files: FileData[])`
  - 모든 private 메서드에 타입 적용

### 3. 유틸리티
- **파일:** `elysia-server/src/utils/multipart.util.ts`
- **함수:** `parseMultipartFormData(): Promise<{ formData: SendGridInboundPayload; files: FileData[] }>`

---

## 테스트 체크리스트

- [x] 기본 이메일 웹훅 전달
- [x] 필드 추출 및 로깅
- [x] 데이터베이스 저장
- [x] TypeScript 타입 정의 및 적용
- [x] SPF/DKIM 인증된 이메일 (Gmail 테스트)
- [x] UTF-8 한글 이메일 (RFC 2047 Base64 인코딩)
- [x] Multipart/alternative 이메일 (텍스트 + HTML)
- [ ] 이미지가 포함된 HTML 이메일
- [ ] 첨부파일이 있는 이메일
- [ ] 답장 감지 및 스레딩
- [ ] CC/BCC 수신자
- [ ] 전달된 이메일

### 테스트 비교

| 항목 | 로컬 테스트 (Postfix) | Gmail 테스트 |
|------|---------------------|-------------|
| **발신 서버** | 로컬 Postfix | Gmail (mail-ed1-f42.google.com) |
| **DKIM** | none | pass ✅ |
| **SPF** | none | pass ✅ |
| **Spam Score** | 1.2 | 0.0 (예상) ✅ |
| **한글 지원** | ASCII | UTF-8 Base64 ✅ |
| **본문 형식** | Plain text | Multipart (text + HTML) ✅ |
| **발신 IP** | 125.138.122.162 | 209.85.208.42 |
| **Message-ID** | Postfix 형식 | Gmail 형식 |
| **특수 헤더** | 기본만 | Gmail 전용 헤더 다수 ✅ |

---

## 참고 자료

- [SendGrid Inbound Parse 문서](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [RFC 822 - 이메일 메시지 형식](https://www.ietf.org/rfc/rfc822.txt)
- 웹훅 엔드포인트: `https://sendgrinda.cloud/api/webhook/inbound`
- 구현: `elysia-server/src/services/webhook.service.ts`
- 타입 정의: `elysia-server/src/models/email.model.ts`
