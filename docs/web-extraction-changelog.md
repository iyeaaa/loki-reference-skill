# 웹 데이터 추출(Web-Extraction) 변경 사항 분석

> 초기 도입 (2025-11-09) vs 현재 (2026-01-07) 비교

---

## 1. 설정 파라미터 변경

### DEFAULT_EXTRACTION_CONFIG 비교

| 파라미터 | 초기 (11/09) | 현재 | 변경 이유 |
|----------|-------------|------|----------|
| `maxConcurrent` | **20** | **2** | 메모리 최적화 (10배 감소) |
| `timeoutSeconds` | **120초** | **60초** | 타임아웃 단축 (50% 감소) |
| `gptTimeout` | **180초** | **120초** | GPT 타임아웃 단축 (33% 감소) |
| `crawlDepth` | 1 | 1 | 변경 없음 |
| `deduplicateByUrl` | true | true | 변경 없음 |
| `expandEmailsToRows` | true | true | 변경 없음 |
| `randomDelayMin` | **3000ms** | **2000ms** | 지연 시간 단축 (33% 감소) |
| `randomDelayMax` | **6000ms** | **4000ms** | 지연 시간 단축 (33% 감소) |

---

## 2. 메모리 최적화 상수 (신규 추가)

```typescript
// 현재 버전에만 존재
export const MEMORY_OPTIMIZATION = {
  MAX_BATCH_SIZE: 200,      // 한 번에 처리 가능한 최대 URL 수
  MAX_LOGS_IN_MEMORY: 50,   // 메모리에 유지할 최대 로그 수 (기존 500 → 50)
  CHUNK_SIZE: 10,           // 청크당 URL 수 (Promise.all 대신 청크 단위 처리)
  GC_INTERVAL_MS: 5000,     // 가비지 컬렉션 힌트 간격
}
```

---

## 3. 콘텐츠 크기 제한 변경

| 항목 | 초기 (11/09) | 현재 |
|------|-------------|------|
| 본문 텍스트 제한 | **50,000자 (50KB)** | **28,000자 (28KB)** |
| 메타데이터+본문 결합 | 없음 | **30,000자 (30KB)** |
| GPT 프롬프트 내 콘텐츠 | **15,000자** | **15,000자** |

---

## 4. 크롤링 로직 변경

### 4.1 메타데이터 추출 (신규 추가)

**현재 버전**에서 `extractMetadata()` 함수 추가:
- Title 태그
- Meta description
- Meta keywords
- Open Graph 태그 (og:site_name, og:title, og:type, og:locale)
- Twitter Card
- JSON-LD 구조화 데이터 (Organization, LocalBusiness, Company)
- Author, Copyright 메타 태그

### 4.2 페이지 필터링 패턴 (신규 추가)

**제외 패턴 (EXCLUDE_PATTERNS):**
```typescript
/privacy/i, /terms/i, /legal/i, /cookie/i, /policy/i,
/disclaimer/i, /login/i, /signup/i, /register/i,
/cart/i, /checkout/i, /sitemap/i, /feed/i, /rss/i,
/cdn/i, /static/i, /faq/i, /support/i, /help/i,
/blog\/\d/i, /news\/\d/i, // 개별 포스트/기사
/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json)$/i
```

**우선 순위 패턴 (PRIORITY_PATTERNS):**
```typescript
/about/i, /company/i, /contact/i, /products?/i,
/services?/i, /solutions?/i, /team/i,
/who-we-are/i, /what-we-do/i, /our-story/i
```

### 4.3 최대 페이지 수

| 항목 | 초기 | 현재 |
|------|------|------|
| 추가 크롤링 페이지 수 | **3개** | **4개** |

---

## 5. API 키 관리 변경

### 5.1 동시 처리 계산 방식

| 버전 | 계산 공식 |
|------|----------|
| 초기 | `activeApiKeyCount * 20` (최대 제한 없음) |
| 현재 (Legacy v1.1) | `Math.min(activeApiKeyCount, 2)` (최대 2개로 제한) |

### 5.2 API 키 Fallback

| 버전 | 동작 |
|------|------|
| 초기 | Workspace API 키만 사용 |
| 현재 | Workspace API 키 없으면 **환경변수 `OPENAI_API_KEY` fallback** |

---

## 6. 배치 처리 방식 변경

### 6.1 처리 방식

| 버전 | 방식 | 특징 |
|------|------|------|
| 초기 | `Promise.all()` | 전체 병렬 처리 |
| 현재 | **청크 단위 순차 처리** | 10개씩 청크로 분할 후 순차 처리 |

### 6.2 로그 관리

| 항목 | 초기 | 현재 |
|------|------|------|
| 최대 로그 수 | **500개** | **50개** |
| 로그 복사 방식 | 전체 복사 (`[...logs]`) | 슬라이스 (`logs.slice(-50)`) |

### 6.3 결과 저장 TTL (신규 추가)

```typescript
const RESULTS_TTL_MS = 30 * 60 * 1000  // 30분 후 자동 삭제
// 5분마다 정리 실행
setInterval(cleanupOldResults, 5 * 60 * 1000)
```

---

## 7. 서비스 분리 (신규)

### 7.1 파일 구조 변경

| 초기 (11/09) | 현재 |
|-------------|------|
| `web-extraction.service.ts` (단일) | `web-extraction.service.ts` (Lead Discovery용) |
| | `web-extraction-legacy.service.ts` (웹데추 v1.1) |

### 7.2 용도별 함수 분리

| 기능 | 함수명 | API 키 사용 |
|------|--------|------------|
| **Lead Discovery** | `extractContactsForLeadDiscovery()` | 환경변수만 |
| **Web Extraction** | `extractContactsWithGPT()` | Workspace 키 (환경변수 fallback) |
| **단일 분석 (스트리밍)** | `analyzeWebsiteWithStreaming()` | 환경변수만 |

---

## 8. 신규 API 엔드포인트

### 8.1 추가된 엔드포인트

| 엔드포인트 | 추가 시점 | 용도 |
|-----------|----------|------|
| `POST /lead-discovery/analyze` | 12-05 | SSE 스트리밍 분석 |
| `POST /analyze` | 12-05 | 정형화된 JSON 응답 |
| `POST /enrich-lead` | 12-19 | Lead Enrichment (Hunter.io 폴백) |
| `POST /extract-email-quick` | 12-19 | 이메일만 빠른 추출 |

### 8.2 Lead Discovery 분석 타임아웃

```typescript
// lead-discovery/analyze
const { pagesContent } = await fetchWithDepth(
  websiteUrl.trim(),
  1,      // depth
  30,     // timeout (30초)
)
// GPT 스트리밍: 60초
await analyzeWebsiteWithStreaming(pagesContent, 60, workspaceId)
```

---

## 9. GPT 프롬프트 변경

### 9.1 커스텀 검색 조건 근거 강화 (현재)

**초기 (11/09):**
```
"근거가 되는 구체적인 사실 3가지를 제시해주세요"
```

**현재:**
```
"근거는 반드시 웹사이트 콘텐츠에서 실제로 발견된 구체적인 텍스트, 데이터, 또는 정보를 인용하여 작성해주세요."

예시:
- "홈페이지에 '기업 고객 대상 솔루션 제공'이라는 문구가 있음"
- "제품 목록에 산업용 장비 3종(A-100, B-200, C-300)이 나열됨"
- "회사 소개에 '1987년 설립된 대한민국 대표 기업'이라고 명시됨"
```

### 9.2 회사 유형 필드 추가

**현재 버전에 추가:**
```typescript
"companyType": "업체 유형 (제조업체, 브랜드사, 유통업체, 수입업체, 대리점, 소매업체 등)"
```

### 9.3 Lead Discovery 스트리밍 프롬프트 (신규)

```markdown
**이 회사는 뭐 하는 곳인가요?**
- 회사명과 간단한 소개를 자연스럽게 써주세요
- 어떤 제품이나 서비스를 만드는지 설명해주세요
- 어떤 업종이고, 누구를 위한 비즈니스인지 알려주세요

**기본 정보**
**특징과 강점**

작성 가이드:
- 마크다운 형식으로 깔끔하게 정리
- 이모지 사용하지 않음
- 친근하고 쉬운 말로 설명
- 한국어로 작성
```

---

## 10. iframe 임베딩 감지 (신규)

**현재 버전에 추가:**
```typescript
// X-Frame-Options 헤더 확인
const xFrameOptions = response.headers.get("X-Frame-Options")?.toUpperCase()
const contentSecurityPolicy = response.headers.get("Content-Security-Policy")

// CSP frame-ancestors 지시어 확인
const hasFrameAncestors = contentSecurityPolicy?.includes("frame-ancestors")
  && !contentSecurityPolicy?.includes("frame-ancestors *")

// iframe 임베딩 가능 여부 판단
const canEmbed = !xFrameOptions?.includes("DENY")
  && !xFrameOptions?.includes("SAMEORIGIN")
  && !hasFrameAncestors
```

---

## 11. 페이지 정보 확장 (PageInfo)

### 초기 버전
```typescript
// 없음 - 단순 Map<string, string>만 사용
```

### 현재 버전
```typescript
export interface PageInfo {
  url: string
  title?: string
  favicon?: string
  contentLength: number
  canEmbed?: boolean  // iframe 임베딩 가능 여부
}
```

---

## 12. Favicon 추출 (신규)

```typescript
const faviconSelectors = [
  'link[rel="icon"]',
  'link[rel="shortcut icon"]',
  'link[rel="apple-touch-icon"]',
  'link[rel="apple-touch-icon-precomposed"]',
]
// Fallback: /favicon.ico
// Mixed Content 방지: http:// → https:// 변환
```

---

## 13. 파일 크기 제한

| 항목 | 초기 | 현재 |
|------|------|------|
| 업로드 파일 최대 크기 | **50MB** | **50MB** |
| 배치 최대 URL 수 | 제한 없음 | **10,000개** (Legacy v1.1) |

---

## 14. SSE Keep-Alive 설정

| 항목 | 초기 | 현재 |
|------|------|------|
| `keepAlive` | true | true |
| `keepAliveInterval` | 미설정 | **15,000ms (15초)** |

---

## 요약: 주요 변경 방향

1. **메모리 최적화**: 동시 처리 20 → 2, 로그 500 → 50, 콘텐츠 50KB → 30KB
2. **타임아웃 단축**: 크롤링 120초 → 60초, GPT 180초 → 120초
3. **서비스 분리**: Lead Discovery와 웹데추 분리 (API 키 사용 방식 차별화)
4. **청크 단위 처리**: Promise.all 대신 10개씩 순차 처리
5. **메타데이터 강화**: JSON-LD, Open Graph 등 구조화 데이터 추출
6. **TTL 기반 자동 정리**: 결과 30분 후 자동 삭제
