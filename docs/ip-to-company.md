# IP-to-Company 방문자 추적 시스템

방문자 IP를 기반으로 회사 정보를 식별하는 B2B 리드 추적 시스템입니다.

## 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│  방문자 브라우저 (IP: 203.xxx.xxx.xxx)                           │
│  rinda.ai 랜딩페이지 접속                                        │
└────────────────────────────────────────────────────────────────┘
                         │
                         ▼  fetch() 직접 요청
┌────────────────────────────────────────────────────────────────┐
│  Nginx (app.rinda.ai:443)                                      │
│  $remote_addr = 203.xxx.xxx.xxx                                │
│  proxy_set_header X-Real-IP $remote_addr;                      │
└────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Elysia Server                                                 │
│  X-Real-IP 헤더에서 방문자 IP 추출                               │
│  → ipapi.is API 조회 → companyName 식별                         │
└────────────────────────────────────────────────────────────────┘
```

## API 엔드포인트

### 1. 방문자 추적 (Public)

```
POST /api/v1/visitors/track
```

**Request Body:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|-----|------|
| `workspaceId` | string (UUID) | ✅ | 워크스페이스 ID |
| `ipAddress` | string | ❌ | IP 주소 (미제공시 X-Real-IP에서 자동 추출) |
| `landingPage` | string | ❌ | 방문 페이지 URL |
| `referrer` | string | ❌ | 유입 경로 (미제공시 Referer 헤더에서 추출) |
| `userAgent` | string | ❌ | 브라우저 정보 (미제공시 헤더에서 추출) |

**Response:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "New visitor tracked",
  "data": {
    "tracked": true,
    "isNewVisitor": true,
    "visitorId": "550e8400-e29b-41d4-a716-446655440000",
    "country": "South Korea",
    "company": "삼성전자",
    "ipSource": "x-real-ip"
  }
}
```

**ipSource 값:**

| 값 | 설명 |
|----|------|
| `x-real-ip` | Nginx에서 설정 (권장) |
| `x-forwarded-for` | 프록시 체인에서 추출 |
| `cf-connecting-ip` | Cloudflare에서 설정 |
| `body` | 클라이언트가 직접 전송 |

### 2. 방문자 목록 조회 (Protected)

```
GET /api/v1/workspaces/:workspaceId/visitors
```

**Query Parameters:**

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `limit` | 50 | 조회 개수 (최대 100) |
| `offset` | 0 | 시작 위치 |

### 3. 방문자 통계 조회 (Protected)

```
GET /api/v1/workspaces/:workspaceId/visitors/stats
```

**Query Parameters:**

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `days` | 30 | 분석 기간 (최대 365일) |

**Response:**

```json
{
  "success": true,
  "data": {
    "totalVisitors": 150,
    "uniqueCountries": 5,
    "companyVisitors": 45,
    "vpnVisitors": 12,
    "topCountries": [
      { "country": "South Korea", "count": 120 },
      { "country": "United States", "count": 15 }
    ],
    "topCompanies": [
      { "company": "삼성전자", "count": 8 },
      { "company": "네이버", "count": 5 }
    ],
    "recentVisitors": [...]
  }
}
```

### 4. 방문자 상세 조회 (Protected)

```
GET /api/v1/workspaces/:workspaceId/visitors/:visitorId
```

### 5. 오래된 세션 삭제 (Protected)

```
DELETE /api/v1/workspaces/:workspaceId/visitors/cleanup
```

**Query Parameters:**

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `daysOld` | 90 | N일 이상 된 세션 삭제 (최소 30일) |

---

## 연동 가이드

### 기본 JavaScript

```javascript
async function trackVisitor() {
  try {
    const response = await fetch('https://app.rinda.ai/api/v1/visitors/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: 'YOUR_WORKSPACE_UUID',
        landingPage: window.location.href,
      }),
    })

    const data = await response.json()
    console.log('Visitor tracked:', data)
  } catch (error) {
    console.error('Track failed:', error)
  }
}

document.addEventListener('DOMContentLoaded', trackVisitor)
```

### React/Next.js Hook

```tsx
// hooks/useVisitorTracking.ts
import { useEffect } from 'react'

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID

export function useVisitorTracking() {
  useEffect(() => {
    const track = async () => {
      try {
        await fetch('https://app.rinda.ai/api/v1/visitors/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            landingPage: window.location.href,
          }),
        })
      } catch (e) {
        // Silent fail
      }
    }
    track()
  }, [])
}
```

```tsx
// pages/index.tsx
export default function LandingPage() {
  useVisitorTracking()
  return <div>...</div>
}
```

### Google Tag Manager

```html
<script>
(function() {
  fetch('https://app.rinda.ai/api/v1/visitors/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: 'YOUR_WORKSPACE_UUID',
      landingPage: window.location.href,
      referrer: document.referrer
    })
  }).catch(function() {});
})();
</script>
```

---

## 데이터 필드 설명

### 회사 식별 (핵심)

| 필드 | 설명 | 예시 |
|------|------|------|
| `companyName` | 회사명 | "삼성전자", "네이버" |
| `companyDomain` | 회사 도메인 | "samsung.com" |
| `companyType` | 회사 유형 | "business", "isp" |
| `asnOrg` | ASN 소유 조직 | "Samsung SDS Co., Ltd." |
| `asnType` | 네트워크 유형 | "business" (회사), "isp" (개인) |

### 위치 정보

| 필드 | 설명 | 예시 |
|------|------|------|
| `country` | 국가 | "South Korea" |
| `countryCode` | ISO 코드 | "KR" |
| `city` | 도시 | "Seoul", "Seongnam" |
| `region` | 지역 | "Gyeonggi-do" |
| `timezone` | 시간대 | "Asia/Seoul" |

### 보안 플래그

| 필드 | 의미 | 활용 |
|------|------|------|
| `isVpn` | VPN 사용 | true면 회사 식별 불가 |
| `isProxy` | 프록시 사용 | 회사 판별 어려움 |
| `isMobile` | 모바일 네트워크 | 통신사 IP (개인) |
| `isDatacenter` | 데이터센터 | AWS, GCP 등 |
| `isCrawler` | 봇/크롤러 | 제외 대상 |

### 회사 방문자 판별 조건

```
✅ asnType = "business"
✅ companyName 존재
✅ isVpn = false
✅ isProxy = false
✅ isMobile = false
✅ isDatacenter = false
```

---

## IP 추출 우선순위

Nginx → Elysia 구조에서 IP 추출 순서:

1. **X-Real-IP** (Nginx가 $remote_addr에서 설정) ✅ 최적
2. **X-Forwarded-For** (첫번째 IP)
3. **CF-Connecting-IP** (Cloudflare 사용시)

```typescript
// elysia-server/src/routes/visitor.routes.ts
function getClientIp(request: Request): string | null {
  const headers = request.headers

  // 1. X-Real-IP (Nginx - $remote_addr에서 직접 설정)
  const xRealIp = headers.get("x-real-ip")
  if (xRealIp) return xRealIp.trim()

  // 2. X-Forwarded-For (fallback)
  const xff = headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || null

  // 3. CF-Connecting-IP (Cloudflare)
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp) return cfIp.trim()

  return null
}
```

---

## 관리 페이지

- **URL**: `https://app.rinda.ai/settings/visitor-analytics`
- 방문자 목록, 국가별/회사별 통계, 상세 정보 확인

---

## 성능 최적화

### 쿼리 최적화

통계 조회시 PostgreSQL `FILTER` 절을 사용하여 4개 count 쿼리를 1개로 통합:

```sql
-- 최적화된 단일 쿼리
SELECT
  count(*) as total_visitors,
  count(distinct country) as unique_countries,
  count(*) FILTER (WHERE company_name IS NOT NULL) as company_visitors,
  count(*) FILTER (WHERE is_vpn = true) as vpn_visitors
FROM visitor_sessions
WHERE workspace_id = $1 AND first_visit_at >= $2;
```

**결과: 7개 쿼리 → 4개 쿼리 (병렬 실행)**

### DB 인덱스

```sql
-- 성능을 위한 인덱스
CREATE INDEX visitor_sessions_workspace_id_idx ON visitor_sessions(workspace_id);
CREATE INDEX visitor_sessions_ip_address_idx ON visitor_sessions(ip_address);
CREATE INDEX visitor_sessions_workspace_ip_idx ON visitor_sessions(workspace_id, ip_address);
CREATE INDEX visitor_sessions_country_idx ON visitor_sessions(country);
CREATE INDEX visitor_sessions_company_name_idx ON visitor_sessions(company_name);
CREATE INDEX visitor_sessions_first_visit_idx ON visitor_sessions(first_visit_at);
CREATE INDEX visitor_sessions_last_visit_idx ON visitor_sessions(last_visit_at);
```

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `elysia-server/src/routes/visitor.routes.ts` | API 라우트 |
| `elysia-server/src/services/visitor.service.ts` | 비즈니스 로직 |
| `elysia-server/src/db/schema/visitor-sessions.ts` | DB 스키마 |
| `admin/src/pages/settings/VisitorAnalyticsPage.tsx` | 관리 페이지 |
| `admin/src/lib/api/hooks/visitor-analytics.ts` | React Query 훅 |
