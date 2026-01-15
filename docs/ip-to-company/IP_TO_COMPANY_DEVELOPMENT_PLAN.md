# IP to Company 기능 개발 분석 및 계획서

## 1. 기능 개요

### 1.1 목표
고객사 웹사이트 방문자의 IP 주소를 기반으로 회사 정보를 식별하고, 웹 데이터 추출을 통해 이메일 등 추가 정보를 수집하여 B2B 리드 인텔리전스를 제공하는 기능

### 1.2 핵심 흐름
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IP to Company 전체 흐름                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 고객사 웹사이트                    2. app.rinda.ai 백엔드               │
│  ┌─────────────────┐                  ┌─────────────────────────────────┐  │
│  │ <script>        │                  │                                 │  │
│  │ 린다 트래킹     │ ─────────────▶   │  POST /api/v1/tracking/visit    │  │
│  │ 스크립트 1줄    │   IP + 메타데이터│                                 │  │
│  └─────────────────┘                  │  ┌─────────────────────────┐   │  │
│                                       │  │  Snitcher API 호출      │   │  │
│  방문자 브라우저에서                  │  │  IP → 회사 정보 매핑    │   │  │
│  Request Header로                     │  └──────────┬──────────────┘   │  │
│  IP 자동 획득                         │             │                   │  │
│                                       │             ▼                   │  │
│                                       │  ┌─────────────────────────┐   │  │
│                                       │  │  웹데추 실행            │   │  │
│                                       │  │  이메일/연락처 추출     │   │  │
│                                       │  └──────────┬──────────────┘   │  │
│                                       │             │                   │  │
│                                       │             ▼                   │  │
│                                       │  ┌─────────────────────────┐   │  │
│                                       │  │  DB 저장                │   │  │
│                                       │  │  워크스페이스별 분류    │   │  │
│                                       │  └─────────────────────────┘   │  │
│                                       └─────────────────────────────────┘  │
│                                                                             │
│  3. 린다 대시보드 (프론트엔드)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 방문자 회사 목록 표시                                            │   │
│  │  • 통계: 총 방문, 회사 식별률, 업종별 분포                          │   │
│  │  • 리드 전환 기능                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 비즈니스 가치
- B2B 리드 자동 발굴
- 웹사이트 방문 기업 식별
- 잠재 고객 선제적 파악
- 영업 활동 효율화

---

## 2. 현재 시스템 분석

### 2.1 백엔드 아키텍처
| 항목 | 현재 구성 |
|------|----------|
| 프레임워크 | **Elysia.js** (Bun 런타임) |
| 언어 | TypeScript |
| DB | PostgreSQL + **Drizzle ORM** |
| 작업 큐 | BullMQ (Redis) |
| 외부 API 연동 | 17개 (Hunter.io, OpenAI, BigQuery 등) |
| 웹데추 | v1.1 (동기) + v2 (BullMQ 비동기) |

### 2.2 관련 기존 기능
- **웹 데이터 추출 서비스**: `elysia-server/src/services/web-extraction.service.ts`
  - GPT-4o-mini 기반 데이터 추출
  - 이메일, 연락처, 회사 정보 추출 가능
- **Lead Enrichment**: `elysia-server/src/services/lead-enrichment.service.ts`
  - 리드 정보 보강 기능
  - Hunter.io 폴백 지원
- **Activity Logs**: 활동 추적 테이블 존재

### 2.3 DB 스키마 현황
- **워크스페이스 테이블**: 고객사별 분리 구조 완비
- **리드 테이블**: 회사 정보 저장 구조 존재
- **방문자 추적 테이블**: ❌ **미존재** (신규 생성 필요)

### 2.4 프론트엔드 아키텍처
| 항목 | 현재 구성 |
|------|----------|
| 프레임워크 | React 19 + TypeScript |
| 라우팅 | React Router DOM 7 |
| 상태관리 | Jotai + TanStack Query |
| 차트 | **Recharts 3.3** |
| UI | Radix UI + Tailwind CSS |

---

## 3. 아키텍처 설계

### 3.1 시스템 구성도
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              시스템 아키텍처                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   고객사 웹사이트                     app.rinda.ai                          │
│   ┌──────────────┐                   ┌────────────────────────────────────┐ │
│   │              │                   │                                    │ │
│   │  트래킹      │    HTTPS POST     │   Elysia API Server                │ │
│   │  스크립트    │ ───────────────▶  │   ┌────────────────────────────┐  │ │
│   │  (1줄)       │                   │   │  /api/v1/tracking/visit    │  │ │
│   │              │                   │   │  (IP 수신 + 검증)          │  │ │
│   └──────────────┘                   │   └─────────────┬──────────────┘  │ │
│                                      │                 │                  │ │
│                                      │   ┌─────────────▼──────────────┐  │ │
│                                      │   │   Tracking Service         │  │ │
│                                      │   │   • IP 검증                │  │ │
│                                      │   │   • 중복 체크              │  │ │
│                                      │   │   • 큐 등록                │  │ │
│                                      │   └─────────────┬──────────────┘  │ │
│                                      │                 │                  │ │
│   ┌──────────────┐                   │   ┌─────────────▼──────────────┐  │ │
│   │              │    API Call       │   │   BullMQ Worker            │  │ │
│   │  Snitcher    │ ◀─────────────────│   │   (비동기 처리)            │  │ │
│   │  API         │ ──────────────────│   │   • Snitcher 호출          │  │ │
│   │              │   Company Data    │   │   • 웹데추 실행            │  │ │
│   └──────────────┘                   │   │   • DB 저장                │  │ │
│                                      │   └─────────────┬──────────────┘  │ │
│                                      │                 │                  │ │
│                                      │   ┌─────────────▼──────────────┐  │ │
│                                      │   │   PostgreSQL               │  │ │
│                                      │   │   • visitor_sessions       │  │ │
│                                      │   │   • identified_companies   │  │ │
│                                      │   │   • visitor_statistics     │  │ │
│                                      │   └────────────────────────────┘  │ │
│                                      │                                    │ │
│                                      └────────────────────────────────────┘ │
│                                                                             │
│   린다 대시보드                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │  React Dashboard                                                     │ │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │ │
│   │  │ 방문자 목록  │ │ 통계 차트    │ │ 리드 전환    │                │ │
│   │  │ 테이블       │ │ Recharts     │ │ 버튼         │                │ │
│   │  └──────────────┘ └──────────────┘ └──────────────┘                │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 트래킹 스크립트 배포 방식

#### 옵션 A: 단일 스크립트 (권장)
```html
<!-- 고객사 웹사이트에 추가할 1줄 -->
<script async src="https://app.rinda.ai/tracker.js" data-workspace="ws_xxxxx"></script>
```

**장점:**
- 설치 간편 (1줄)
- 버전 자동 업데이트
- CDN 캐싱 가능

#### 옵션 B: 인라인 스크립트
```html
<script>
(function(w,r,t){
  var d=document,s=d.createElement('script');
  s.src='https://app.rinda.ai/tracker.js';
  s.dataset.workspace=t;
  d.head.appendChild(s);
})(window,'rinda','ws_xxxxx');
</script>
```

### 3.3 IP 획득 방식

```
┌─────────────────────────────────────────────────────────────────┐
│                      IP 획득 전략                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  클라이언트 측 (트래킹 스크립트)                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ❌ 직접 IP 획득 불가능 (브라우저 보안 제약)            │   │
│  │  ✅ 서버로 요청 전송 → 서버에서 IP 추출                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  서버 측 (Elysia API)                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. X-Forwarded-For 헤더 (프록시/로드밸런서 뒤)         │   │
│  │  2. X-Real-IP 헤더                                      │   │
│  │  3. CF-Connecting-IP (Cloudflare 사용 시)               │   │
│  │  4. request.ip (Elysia 기본)                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  IP 추출 우선순위 코드:                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  const ip =                                             │   │
│  │    headers['cf-connecting-ip'] ||                       │   │
│  │    headers['x-real-ip'] ||                              │   │
│  │    headers['x-forwarded-for']?.split(',')[0] ||         │   │
│  │    request.ip;                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 스키마 설계

### 4.1 신규 테이블

#### `visitor_sessions` - 방문 세션
```sql
CREATE TABLE visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- IP 및 위치 정보
  ip_address VARCHAR(45) NOT NULL,  -- IPv6 지원
  country VARCHAR(100),
  city VARCHAR(100),
  region VARCHAR(100),

  -- 방문 정보
  page_url TEXT,
  referrer_url TEXT,
  user_agent TEXT,

  -- 디바이스 정보 (파싱된)
  device_type VARCHAR(50),  -- desktop, mobile, tablet
  browser VARCHAR(100),
  os VARCHAR(100),

  -- 회사 식별 상태
  identification_status VARCHAR(50) DEFAULT 'pending',
    -- pending: 식별 대기
    -- identified: 회사 식별됨
    -- isp: ISP (개인 사용자)
    -- failed: 식별 실패
  identified_company_id UUID REFERENCES identified_companies(id),

  -- 세션 추적
  session_id VARCHAR(100),  -- 클라이언트에서 생성한 세션 ID
  page_views INTEGER DEFAULT 1,
  session_duration INTEGER,  -- 초 단위

  -- 타임스탬프
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_visitor_sessions_workspace ON visitor_sessions(workspace_id);
CREATE INDEX idx_visitor_sessions_ip ON visitor_sessions(ip_address);
CREATE INDEX idx_visitor_sessions_status ON visitor_sessions(identification_status);
CREATE INDEX idx_visitor_sessions_visited_at ON visitor_sessions(visited_at);
CREATE INDEX idx_visitor_sessions_company ON visitor_sessions(identified_company_id);
```

#### `identified_companies` - 식별된 회사
```sql
CREATE TABLE identified_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Snitcher API 응답 데이터
  snitcher_domain VARCHAR(255),

  -- 회사 기본 정보
  company_name VARCHAR(255),
  website_url VARCHAR(500),
  industry VARCHAR(255),
  employee_range VARCHAR(100),  -- e.g., "51-200"
  founded_year INTEGER,

  -- 위치 정보
  headquarters_country VARCHAR(100),
  headquarters_city VARCHAR(100),
  headquarters_address TEXT,

  -- 소셜 프로필
  linkedin_url VARCHAR(500),
  twitter_url VARCHAR(500),
  facebook_url VARCHAR(500),

  -- 웹데추 결과 (Lead Enrichment)
  enrichment_status VARCHAR(50) DEFAULT 'pending',
    -- pending: 보강 대기
    -- processing: 보강 중
    -- completed: 보강 완료
    -- failed: 보강 실패
  enrichment_data JSONB,  -- 웹데추 전체 결과

  -- 추출된 연락처 정보
  primary_email VARCHAR(255),
  phone_number VARCHAR(100),
  contact_emails TEXT[],  -- 배열

  -- 리드 전환
  converted_to_lead BOOLEAN DEFAULT FALSE,
  lead_id UUID REFERENCES leads(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_by UUID REFERENCES users(id),

  -- 방문 통계 (집계)
  total_visits INTEGER DEFAULT 1,
  unique_sessions INTEGER DEFAULT 1,
  first_visit_at TIMESTAMP WITH TIME ZONE,
  last_visit_at TIMESTAMP WITH TIME ZONE,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_identified_companies_workspace ON identified_companies(workspace_id);
CREATE INDEX idx_identified_companies_domain ON identified_companies(snitcher_domain);
CREATE INDEX idx_identified_companies_name ON identified_companies(company_name);
CREATE INDEX idx_identified_companies_converted ON identified_companies(converted_to_lead);
CREATE UNIQUE INDEX idx_identified_companies_unique ON identified_companies(workspace_id, snitcher_domain);
```

#### `workspace_tracking_settings` - 워크스페이스별 트래킹 설정
```sql
CREATE TABLE workspace_tracking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- 트래킹 활성화
  tracking_enabled BOOLEAN DEFAULT TRUE,
  tracking_token VARCHAR(100) UNIQUE NOT NULL,  -- 공개 토큰 (ws_xxxxx)

  -- 허용 도메인 (화이트리스트)
  allowed_domains TEXT[],  -- e.g., ['example.com', 'www.example.com']

  -- 자동 웹데추 설정
  auto_enrichment_enabled BOOLEAN DEFAULT TRUE,
  enrichment_delay_minutes INTEGER DEFAULT 5,  -- 방문 후 대기 시간

  -- 필터링 설정
  exclude_isp BOOLEAN DEFAULT TRUE,  -- ISP IP 제외
  exclude_countries TEXT[],  -- 제외할 국가
  min_page_views INTEGER DEFAULT 1,  -- 최소 페이지뷰

  -- 알림 설정
  notification_enabled BOOLEAN DEFAULT FALSE,
  notification_email VARCHAR(255),
  notification_threshold INTEGER DEFAULT 1,  -- 알림 임계값 (방문 횟수)

  -- API 사용량
  monthly_api_calls INTEGER DEFAULT 0,
  api_calls_reset_at TIMESTAMP WITH TIME ZONE,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_workspace_tracking_token ON workspace_tracking_settings(tracking_token);
```

### 4.2 Drizzle ORM 스키마 파일

```typescript
// elysia-server/src/db/schema/visitor-tracking.ts

import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { leads } from "./leads";

// 방문 세션 테이블
export const visitorSessions = pgTable("visitor_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  // IP 및 위치
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),

  // 방문 정보
  pageUrl: text("page_url"),
  referrerUrl: text("referrer_url"),
  userAgent: text("user_agent"),

  // 디바이스
  deviceType: varchar("device_type", { length: 50 }),
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),

  // 식별 상태
  identificationStatus: varchar("identification_status", { length: 50 }).default("pending"),
  identifiedCompanyId: uuid("identified_company_id").references(() => identifiedCompanies.id),

  // 세션 추적
  sessionId: varchar("session_id", { length: 100 }),
  pageViews: integer("page_views").default(1),
  sessionDuration: integer("session_duration"),

  // 타임스탬프
  visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  workspaceIdx: index("idx_visitor_sessions_workspace").on(table.workspaceId),
  ipIdx: index("idx_visitor_sessions_ip").on(table.ipAddress),
  statusIdx: index("idx_visitor_sessions_status").on(table.identificationStatus),
  visitedAtIdx: index("idx_visitor_sessions_visited_at").on(table.visitedAt),
}));

// 식별된 회사 테이블
export const identifiedCompanies = pgTable("identified_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  // Snitcher 데이터
  snitcherDomain: varchar("snitcher_domain", { length: 255 }),

  // 회사 정보
  companyName: varchar("company_name", { length: 255 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  industry: varchar("industry", { length: 255 }),
  employeeRange: varchar("employee_range", { length: 100 }),
  foundedYear: integer("founded_year"),

  // 위치
  headquartersCountry: varchar("headquarters_country", { length: 100 }),
  headquartersCity: varchar("headquarters_city", { length: 100 }),
  headquartersAddress: text("headquarters_address"),

  // 소셜
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  twitterUrl: varchar("twitter_url", { length: 500 }),
  facebookUrl: varchar("facebook_url", { length: 500 }),

  // 웹데추
  enrichmentStatus: varchar("enrichment_status", { length: 50 }).default("pending"),
  enrichmentData: jsonb("enrichment_data"),

  // 연락처
  primaryEmail: varchar("primary_email", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 100 }),
  contactEmails: text("contact_emails").array(),

  // 리드 전환
  convertedToLead: boolean("converted_to_lead").default(false),
  leadId: uuid("lead_id").references(() => leads.id),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  convertedBy: uuid("converted_by").references(() => users.id),

  // 방문 통계
  totalVisits: integer("total_visits").default(1),
  uniqueSessions: integer("unique_sessions").default(1),
  firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
  lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),

  // 타임스탬프
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  workspaceIdx: index("idx_identified_companies_workspace").on(table.workspaceId),
  domainIdx: index("idx_identified_companies_domain").on(table.snitcherDomain),
  uniqueDomainIdx: uniqueIndex("idx_identified_companies_unique").on(table.workspaceId, table.snitcherDomain),
}));

// 트래킹 설정 테이블
export const workspaceTrackingSettings = pgTable("workspace_tracking_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").unique().notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  trackingEnabled: boolean("tracking_enabled").default(true),
  trackingToken: varchar("tracking_token", { length: 100 }).unique().notNull(),

  allowedDomains: text("allowed_domains").array(),

  autoEnrichmentEnabled: boolean("auto_enrichment_enabled").default(true),
  enrichmentDelayMinutes: integer("enrichment_delay_minutes").default(5),

  excludeIsp: boolean("exclude_isp").default(true),
  excludeCountries: text("exclude_countries").array(),
  minPageViews: integer("min_page_views").default(1),

  notificationEnabled: boolean("notification_enabled").default(false),
  notificationEmail: varchar("notification_email", { length: 255 }),
  notificationThreshold: integer("notification_threshold").default(1),

  monthlyApiCalls: integer("monthly_api_calls").default(0),
  apiCallsResetAt: timestamp("api_calls_reset_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_workspace_tracking_token").on(table.trackingToken),
}));
```

---

## 5. 백엔드 API 설계

### 5.1 API 엔드포인트 목록

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/api/v1/tracking/visit` | 방문 기록 (트래킹 스크립트용) | 토큰 |
| POST | `/api/v1/tracking/pageview` | 페이지뷰 업데이트 | 토큰 |
| POST | `/api/v1/tracking/session-end` | 세션 종료 | 토큰 |
| GET | `/api/v1/admin/visitors` | 방문자 목록 | JWT |
| GET | `/api/v1/admin/visitors/:id` | 방문자 상세 | JWT |
| GET | `/api/v1/admin/visitors/companies` | 식별된 회사 목록 | JWT |
| GET | `/api/v1/admin/visitors/companies/:id` | 회사 상세 | JWT |
| POST | `/api/v1/admin/visitors/companies/:id/convert` | 리드로 전환 | JWT |
| POST | `/api/v1/admin/visitors/companies/:id/enrich` | 웹데추 실행 | JWT |
| GET | `/api/v1/admin/visitors/statistics` | 방문 통계 | JWT |
| GET | `/api/v1/admin/tracking/settings` | 트래킹 설정 조회 | JWT |
| PUT | `/api/v1/admin/tracking/settings` | 트래킹 설정 수정 | JWT |
| POST | `/api/v1/admin/tracking/generate-token` | 트래킹 토큰 재생성 | JWT |

### 5.2 핵심 API 상세

#### 5.2.1 방문 기록 API
```typescript
// POST /api/v1/tracking/visit
// 인증: tracking_token (쿼리 파라미터 또는 헤더)

// Request
interface TrackingVisitRequest {
  sessionId: string;       // 클라이언트 생성 세션 ID
  pageUrl: string;
  referrerUrl?: string;
  userAgent?: string;      // 서버에서 헤더로도 수집
}

// Response (200)
interface TrackingVisitResponse {
  success: true;
  sessionId: string;
}

// 서버 처리 로직
// 1. tracking_token 검증 → 워크스페이스 식별
// 2. Referer/Origin 헤더로 도메인 화이트리스트 검증
// 3. Request에서 IP 추출 (X-Forwarded-For 우선)
// 4. visitor_sessions 테이블에 INSERT
// 5. BullMQ에 IP→회사 식별 작업 추가
```

#### 5.2.2 방문자 목록 API
```typescript
// GET /api/v1/admin/visitors
// 인증: JWT Bearer Token

// Query Parameters
interface VisitorsListQuery {
  workspaceId: string;
  page?: number;           // 기본값: 1
  limit?: number;          // 기본값: 20
  status?: 'all' | 'identified' | 'isp' | 'pending';
  startDate?: string;      // ISO 8601
  endDate?: string;
  sortBy?: 'visitedAt' | 'pageViews' | 'companyName';
  sortOrder?: 'asc' | 'desc';
}

// Response
interface VisitorsListResponse {
  visitors: VisitorSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### 5.2.3 식별된 회사 목록 API
```typescript
// GET /api/v1/admin/visitors/companies
// 인증: JWT Bearer Token

// Query Parameters
interface CompaniesListQuery {
  workspaceId: string;
  page?: number;
  limit?: number;
  industry?: string;
  employeeRange?: string;
  converted?: boolean;
  enrichmentStatus?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'totalVisits' | 'lastVisitAt' | 'companyName';
  sortOrder?: 'asc' | 'desc';
}

// Response
interface CompaniesListResponse {
  companies: IdentifiedCompany[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### 5.2.4 리드 전환 API
```typescript
// POST /api/v1/admin/visitors/companies/:id/convert
// 인증: JWT Bearer Token

// Request
interface ConvertToLeadRequest {
  workspaceId: string;
  customerGroupId?: string;  // 선택적 그룹 지정
}

// Response
interface ConvertToLeadResponse {
  success: true;
  lead: Lead;
}

// 처리 로직
// 1. identified_companies에서 회사 정보 조회
// 2. leads 테이블에 INSERT (기존 리드 스키마 활용)
// 3. lead_contacts에 이메일/전화번호 INSERT
// 4. lead_social_media에 소셜 링크 INSERT
// 5. identified_companies.converted_to_lead = true 업데이트
```

#### 5.2.5 통계 API
```typescript
// GET /api/v1/admin/visitors/statistics
// 인증: JWT Bearer Token

// Query Parameters
interface StatisticsQuery {
  workspaceId: string;
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
}

// Response
interface StatisticsResponse {
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    identifiedCompanies: number;
    identificationRate: number;  // 퍼센트
    convertedToLeads: number;
    topIndustries: { industry: string; count: number }[];
  };
  timeline: {
    date: string;
    visits: number;
    identified: number;
    isp: number;
  }[];
  byCountry: { country: string; visits: number }[];
  byIndustry: { industry: string; visits: number }[];
}
```

### 5.3 서비스 레이어 설계

```typescript
// elysia-server/src/services/visitor-tracking.service.ts

export class VisitorTrackingService {
  // 방문 기록
  async recordVisit(data: RecordVisitData): Promise<VisitorSession>;

  // 세션 업데이트 (페이지뷰 추가)
  async updateSession(sessionId: string, data: UpdateSessionData): Promise<void>;

  // IP → 회사 식별 (Snitcher API)
  async identifyCompany(ip: string, workspaceId: string): Promise<IdentifiedCompany | null>;

  // 웹데추 실행
  async enrichCompany(companyId: string): Promise<EnrichmentResult>;

  // 리드 전환
  async convertToLead(companyId: string, userId: string, options?: ConvertOptions): Promise<Lead>;

  // 통계 조회
  async getStatistics(workspaceId: string, dateRange: DateRange): Promise<Statistics>;

  // 트래킹 설정
  async getTrackingSettings(workspaceId: string): Promise<TrackingSettings>;
  async updateTrackingSettings(workspaceId: string, settings: Partial<TrackingSettings>): Promise<TrackingSettings>;
  async generateTrackingToken(workspaceId: string): Promise<string>;
}
```

```typescript
// elysia-server/src/services/snitcher.service.ts

export class SnitcherService {
  private apiKey: string;
  private baseUrl = 'https://api.snitcher.com';

  // 회사 조회
  async findCompany(ip: string): Promise<SnitcherResponse>;

  // 사용량 확인
  async getUsage(): Promise<SnitcherUsage>;
}

// 응답 타입
interface SnitcherResponse {
  ip: string;
  type: 'business' | 'isp';
  domain?: string;
  company?: {
    name: string;
    domain: string;
    industry: string;
    employee_count: string;
    founded_year?: number;
    location: {
      country: string;
      city: string;
      address?: string;
    };
    social_profiles?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
    };
  };
  geoIP?: {
    country: string;
    state: string;
    city: string;
  };
}
```

### 5.4 BullMQ Worker 설계

```typescript
// elysia-server/src/workers/bullmq/visitor-identification.worker.ts

import { Worker, Queue } from 'bullmq';

// 큐 정의
export const visitorIdentificationQueue = new Queue('visitor-identification', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

// 워커 정의
export const visitorIdentificationWorker = new Worker(
  'visitor-identification',
  async (job) => {
    const { sessionId, ip, workspaceId } = job.data;

    // 1. Snitcher API 호출
    const snitcherResult = await snitcherService.findCompany(ip);

    if (snitcherResult.type === 'isp') {
      // ISP는 개인 사용자로 표시
      await updateSessionStatus(sessionId, 'isp');
      return { status: 'isp' };
    }

    // 2. 기존 회사 확인 또는 신규 생성
    const company = await findOrCreateCompany(workspaceId, snitcherResult);

    // 3. 세션에 회사 연결
    await linkSessionToCompany(sessionId, company.id);

    // 4. 자동 웹데추 설정 확인 및 실행
    const settings = await getTrackingSettings(workspaceId);
    if (settings.autoEnrichmentEnabled && company.enrichmentStatus === 'pending') {
      // 딜레이 후 웹데추 큐에 추가
      await webExtractionQueue.add('enrich-company', {
        companyId: company.id,
      }, {
        delay: settings.enrichmentDelayMinutes * 60 * 1000,
      });
    }

    return { status: 'identified', companyId: company.id };
  },
  {
    concurrency: 10,
    limiter: {
      max: 600,  // Snitcher 분당 제한
      duration: 60000,
    },
  }
);
```

---

## 6. 프론트엔드 UI 설계

### 6.1 신규 페이지 구조

```
admin/src/pages/
├── visitors/                          # IP to Company 메뉴
│   ├── VisitorsPage.tsx              # 방문자 목록 페이지
│   ├── VisitorCompaniesPage.tsx      # 식별된 회사 목록
│   ├── VisitorStatisticsPage.tsx     # 방문 통계/분석
│   ├── TrackingSettingsPage.tsx      # 트래킹 설정
│   └── components/
│       ├── VisitorsTable.tsx         # 방문자 테이블
│       ├── CompaniesTable.tsx        # 회사 테이블
│       ├── ConvertToLeadModal.tsx    # 리드 전환 모달
│       ├── EnrichmentStatusBadge.tsx # 웹데추 상태 배지
│       ├── VisitorFilters.tsx        # 필터 컴포넌트
│       ├── StatisticsCards.tsx       # 통계 카드
│       ├── VisitorChart.tsx          # 방문 추이 차트
│       ├── IndustryPieChart.tsx      # 업종 분포 차트
│       └── TrackingCodeSnippet.tsx   # 설치 코드 표시
```

### 6.2 주요 화면 목업

#### 6.2.1 방문자 대시보드 (메인)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  IP to Company                                            [설정] [새로고침] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ 총 방문    │  │ 회사 식별  │  │ 식별률     │  │ 리드 전환  │             │
│  │   1,234    │  │    567     │  │   45.9%    │  │    89      │             │
│  │ ↑12% (7일) │  │ ↑8% (7일) │  │ ↑2.3%     │  │ ↑15%      │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        방문 추이 (지난 30일)                            ││
│  │   ▲                                                                     ││
│  │   │    ╱╲                                                              ││
│  │   │   ╱  ╲      ╱╲                           식별된 회사              ││
│  │   │  ╱    ╲    ╱  ╲     ╱╲                   ─────                   ││
│  │   │ ╱      ╲  ╱    ╲   ╱  ╲                  ISP                     ││
│  │   │╱        ╲╱      ╲ ╱    ╲                 -----                   ││
│  │   └──────────────────────────────────────────▶                        ││
│  │     1/1    1/8    1/15    1/22    1/29                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │    업종별 분포                   │  │    최근 식별된 회사              │ │
│  │  ┌──────────────────────────┐   │  │  ┌────────────────────────────┐ │ │
│  │  │       IT/소프트웨어 35% │   │  │  │ Acme Corp    제조업        │ │ │
│  │  │       제조업 25%        │   │  │  │ 3시간 전    5회 방문       │ │ │
│  │  │       금융 15%          │   │  │  ├────────────────────────────┤ │ │
│  │  │       기타 25%          │   │  │  │ TechStart   IT서비스      │ │ │
│  │  └──────────────────────────┘   │  │  │ 5시간 전    2회 방문       │ │ │
│  │                                  │  │  ├────────────────────────────┤ │ │
│  │                                  │  │  │ GlobalTrade 무역          │ │ │
│  │                                  │  │  │ 어제        8회 방문       │ │ │
│  └──────────────────────────────────┘  └──────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 식별된 회사 목록
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  식별된 회사                                     [필터] [내보내기] [새로고침]│
├──────────────────────────────────────────────────────────────────────────────┤
│  [검색: 회사명, 도메인...]           업종: [전체 ▼]  상태: [전체 ▼]         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ □ │ 회사명          │ 도메인         │ 업종     │ 방문  │ 상태   │ 액션││
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ □ │ Acme Corp       │ acme.com       │ 제조업   │ 12회  │ ●보강됨│ ... ││
│  │   │ 서울, 대한민국  │ 51-200명       │          │       │        │     ││
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ □ │ TechStart Inc   │ techstart.io   │ IT서비스 │ 5회   │ ○대기중│ ... ││
│  │   │ 미국, 캘리포니아│ 11-50명        │          │       │        │     ││
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ □ │ GlobalTrade     │ globaltrade.kr │ 무역     │ 8회   │ ●보강됨│ ... ││
│  │   │ 부산, 대한민국  │ 201-500명      │          │       │ ✓리드  │     ││
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [◀ 이전] [1] [2] [3] ... [10] [다음 ▶]           20개씩 보기 ▼              │
│                                                                              │
│  선택된 항목: 0개    [일괄 리드 전환] [일괄 웹데추]                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 6.2.3 트래킹 설정 페이지
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  트래킹 설정                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  설치 코드                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  아래 코드를 웹사이트 </head> 태그 앞에 추가하세요:                    │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ <script async src="https://app.rinda.ai/tracker.js"             │ │ │
│  │  │         data-workspace="ws_abc123def456"></script>              │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                      [코드 복사]      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  기본 설정                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  트래킹 활성화                           [ON ●───────]                 │ │
│  │                                                                        │ │
│  │  허용 도메인                                                          │ │
│  │  [example.com          ] [www.example.com     ] [+ 추가]              │ │
│  │                                                                        │ │
│  │  ISP 트래픽 제외                         [ON ●───────]                 │ │
│  │  (개인 인터넷 사용자 제외)                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  자동 웹데추 설정                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  자동 웹 데이터 추출                     [ON ●───────]                 │ │
│  │                                                                        │ │
│  │  추출 대기 시간                          [5  ] 분                      │ │
│  │  (방문 후 이 시간이 지나면 자동으로 웹데추 실행)                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  알림 설정                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  새 회사 식별 시 알림                    [OFF ───────●]               │ │
│  │                                                                        │ │
│  │  알림 이메일                             [admin@company.com      ]    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│                                              [취소]  [저장]                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 라우터 추가

```typescript
// admin/src/router/index.tsx에 추가

// 새 라우트
{
  path: "visitors",
  element: <VisitorsPage />,
  handle: { title: "방문자" },
},
{
  path: "visitors/companies",
  element: <VisitorCompaniesPage />,
  handle: { title: "식별된 회사" },
},
{
  path: "visitors/statistics",
  element: <VisitorStatisticsPage />,
  handle: { title: "방문 통계" },
},
{
  path: "visitors/settings",
  element: <TrackingSettingsPage />,
  handle: { title: "트래킹 설정" },
},
```

---

## 7. 클라이언트 트래킹 스크립트

### 7.1 스크립트 설계

```typescript
// public/tracker.js (빌드 후 CDN 배포)

(function() {
  'use strict';

  // 설정 추출
  const script = document.currentScript;
  const workspaceToken = script?.dataset?.workspace;

  if (!workspaceToken) {
    console.warn('[Rinda] Missing workspace token');
    return;
  }

  const API_ENDPOINT = 'https://app.rinda.ai/api/v1/tracking';

  // 세션 ID 생성 (브라우저 세션 동안 유지)
  function getSessionId() {
    let sessionId = sessionStorage.getItem('rinda_session_id');
    if (!sessionId) {
      sessionId = 'rs_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('rinda_session_id', sessionId);
    }
    return sessionId;
  }

  // 페이지 정보 수집
  function getPageInfo() {
    return {
      sessionId: getSessionId(),
      pageUrl: window.location.href,
      referrerUrl: document.referrer || null,
      title: document.title,
      timestamp: new Date().toISOString(),
    };
  }

  // API 호출
  async function sendBeacon(endpoint, data) {
    const url = `${API_ENDPOINT}${endpoint}?token=${workspaceToken}`;

    // Navigator.sendBeacon 우선 사용 (페이지 언로드 시에도 안정적)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      // Fallback: fetch
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {});
    }
  }

  // 방문 기록
  function trackVisit() {
    sendBeacon('/visit', getPageInfo());
  }

  // 페이지뷰 (SPA 지원)
  function trackPageview() {
    sendBeacon('/pageview', getPageInfo());
  }

  // 세션 종료
  function trackSessionEnd() {
    const sessionStart = sessionStorage.getItem('rinda_session_start');
    const duration = sessionStart ? Math.round((Date.now() - parseInt(sessionStart)) / 1000) : 0;

    sendBeacon('/session-end', {
      sessionId: getSessionId(),
      duration,
    });
  }

  // 초기화
  function init() {
    // 세션 시작 시간 기록
    if (!sessionStorage.getItem('rinda_session_start')) {
      sessionStorage.setItem('rinda_session_start', Date.now().toString());
    }

    // 첫 방문 기록
    trackVisit();

    // SPA 라우트 변경 감지 (History API)
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      trackPageview();
    };

    window.addEventListener('popstate', trackPageview);

    // 페이지 종료 시 세션 기록
    window.addEventListener('beforeunload', trackSessionEnd);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        trackSessionEnd();
      }
    });
  }

  // DOM 로드 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### 7.2 스크립트 특징

| 기능 | 설명 |
|------|------|
| **경량화** | ~2KB (gzip 후) |
| **비동기** | 페이지 로딩 차단 없음 |
| **SPA 지원** | History API 감지 |
| **세션 추적** | sessionStorage 기반 |
| **안정적 전송** | sendBeacon 우선 사용 |
| **프라이버시** | 개인정보 미수집 (IP만 서버에서 추출) |

---

## 8. Snitcher API 연동

### 8.1 API 정보

| 항목 | 값 |
|------|-----|
| Base URL | `https://api.snitcher.com` |
| 인증 | Bearer Token |
| Rate Limit | 600 req/min |
| 응답 코드 | 200 (식별됨), 202 (큐잉), 404 (ISP), 429 (제한) |

### 8.2 연동 서비스 구현

```typescript
// elysia-server/src/services/snitcher.service.ts

import { config } from '../config';

interface SnitcherCompanyResponse {
  ip: string;
  type: 'business' | 'isp';
  domain?: string;
  company?: {
    name: string;
    domain: string;
    industry: string;
    employee_count: string;
    founded_year?: number;
    location: {
      country: string;
      state?: string;
      city: string;
      address?: string;
    };
    social_profiles?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
    };
  };
  geoIP?: {
    country: string;
    state: string;
    city: string;
  };
}

interface SnitcherUsageResponse {
  credit_status: string;
  total: number;
  used: number;
  remaining: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
}

export class SnitcherService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.snitcher.com';

  constructor() {
    this.apiKey = config.snitcher?.apiKey || '';
    if (!this.apiKey) {
      console.warn('[SnitcherService] API key not configured');
    }
  }

  async findCompany(ip: string): Promise<SnitcherCompanyResponse | null> {
    if (!this.apiKey) {
      throw new Error('Snitcher API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/company/find?ip=${encodeURIComponent(ip)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.status === 200) {
        return await response.json();
      }

      if (response.status === 202) {
        // 큐잉됨 - 나중에 재시도
        return null;
      }

      if (response.status === 404) {
        // ISP (개인 사용자)
        const data = await response.json();
        return { ...data, type: 'isp' };
      }

      if (response.status === 429) {
        throw new Error('Snitcher rate limit exceeded');
      }

      if (response.status === 403) {
        throw new Error('Snitcher quota exceeded');
      }

      throw new Error(`Snitcher API error: ${response.status}`);
    } catch (error) {
      console.error('[SnitcherService] findCompany error:', error);
      throw error;
    }
  }

  async getUsage(): Promise<SnitcherUsageResponse> {
    if (!this.apiKey) {
      throw new Error('Snitcher API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/company/usage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Snitcher usage API error: ${response.status}`);
    }

    return response.json();
  }
}

export const snitcherService = new SnitcherService();
```

### 8.3 환경변수 추가

```env
# .env
SNITCHER_API_KEY=your_snitcher_api_key_here
```

```typescript
// config.ts에 추가
snitcher: {
  apiKey: getEnvOrDefault("SNITCHER_API_KEY", ""),
},
```

---

## 9. 웹데추 연동

### 9.1 기존 웹데추 서비스 활용

IP to Company에서 식별된 회사의 웹사이트를 기존 `web-extraction.service.ts`로 처리

```typescript
// elysia-server/src/services/visitor-enrichment.service.ts

import { extractContactsWithGPT, fetchWithDepth } from './web-extraction.service';
import { db } from '../db';
import { identifiedCompanies } from '../db/schema/visitor-tracking';
import { eq } from 'drizzle-orm';

export class VisitorEnrichmentService {
  async enrichCompany(companyId: string, workspaceId: string): Promise<void> {
    // 1. 회사 정보 조회
    const company = await db.query.identifiedCompanies.findFirst({
      where: eq(identifiedCompanies.id, companyId),
    });

    if (!company || !company.websiteUrl) {
      throw new Error('Company or website URL not found');
    }

    // 2. 웹사이트 크롤링
    const crawlResult = await fetchWithDepth(
      company.websiteUrl,
      1,  // depth: 메인 + 서브페이지
      30, // timeout: 30초
    );

    if (crawlResult.httpStatus !== 200) {
      await db.update(identifiedCompanies)
        .set({
          enrichmentStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(identifiedCompanies.id, companyId));
      return;
    }

    // 3. GPT로 데이터 추출
    const extractedData = await extractContactsWithGPT(
      crawlResult.pagesContent,
      60,  // GPT timeout
      workspaceId,
    );

    // 4. DB 업데이트
    await db.update(identifiedCompanies)
      .set({
        enrichmentStatus: 'completed',
        enrichmentData: extractedData,
        primaryEmail: extractedData.emails?.[0] || null,
        phoneNumber: extractedData.phoneNumbers?.[0] || null,
        contactEmails: extractedData.emails || [],
        updatedAt: new Date(),
      })
      .where(eq(identifiedCompanies.id, companyId));
  }
}

export const visitorEnrichmentService = new VisitorEnrichmentService();
```

---

## 10. 구현 단계

### Phase 1: 기반 구축 (DB + 기본 API)
1. Drizzle 스키마 파일 생성
2. 마이그레이션 실행
3. 기본 CRUD API 구현
4. 트래킹 토큰 생성 로직

### Phase 2: Snitcher 연동 + 트래킹
1. Snitcher 서비스 구현
2. 트래킹 스크립트 개발
3. 방문 기록 API 구현
4. BullMQ 워커 구현

### Phase 3: 웹데추 연동
1. VisitorEnrichmentService 구현
2. 자동 웹데추 워커 구현
3. 수동 웹데추 API 구현

### Phase 4: 프론트엔드 UI
1. 방문자/회사 목록 페이지
2. 통계 대시보드
3. 트래킹 설정 페이지
4. 리드 전환 기능

### Phase 5: 통합 테스트 + 최적화
1. E2E 테스트
2. 성능 최적화
3. 모니터링 설정

---

## 11. 고려사항 및 제약사항

### 11.1 Snitcher API 제약
- **별도 계약 필요**: 기본 플랜에 포함되지 않음
- **Rate Limit**: 분당 600건
- **ISP 식별률**: 개인 사용자는 회사로 식별 불가

### 11.2 GDPR/개인정보 준수
- IP 주소는 개인정보에 해당할 수 있음
- 회사 IP는 공개 정보 (Snitcher GDPR 준수)
- 트래킹 동의 배너 고려 필요

### 11.3 비용 고려
- Snitcher API 호출당 비용 발생
- 중복 IP 체크로 API 호출 최소화
- 캐싱 전략 필요 (Redis)

### 11.4 기술적 제약
- 클라이언트에서 직접 IP 획득 불가
- VPN/프록시 사용자는 정확도 저하
- 모바일 사용자 식별률 낮음

---

## 12. 참고 자료

- [Snitcher API 문서](https://docs.snitcher.com/ip2company)
- [Snitcher Spotter API](https://docs.snitcher.com/spotter-api/)
- [Snitcher 제품 페이지](https://www.snitcher.com/product/powered-by-snitcher)
