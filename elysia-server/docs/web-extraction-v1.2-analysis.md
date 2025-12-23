# Web Extraction v1.2 로직 상세 분석

> 버전: v1.2 (2025-12-05, commit `6c79d31c`)
> 기능: Lead Discovery SSE 스트리밍

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                               │
│  WebExtractionProgress.tsx - 실시간 진행상황 UI                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ SSE (Server-Sent Events)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Backend (Elysia.js)                                 │
│  web-extraction.routes.ts - API 엔드포인트                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                    │
│  web-extraction.service.ts - 크롤링 + GPT 분석                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API 엔드포인트 (routes)

### 2.1 `POST /analyze` - 단일 웹사이트 분석 (SSE 스트리밍)

**위치**: `web-extraction.routes.ts:30-206`

**입력**:
```typescript
{
  websiteUrl: string   // 분석할 웹사이트 URL
  workspaceId: string  // 워크스페이스 ID
}
```

**처리 흐름**:
1. URL 유효성 검사 (최소 3자)
2. SSE 연결 생성
3. `fetchWithDepth()` 호출하여 웹사이트 크롤링
   - `depth: 1` (추가 페이지 1레벨까지)
   - `timeout: 30초`
4. `analyzeWebsiteWithStreaming()` 호출하여 GPT 스트리밍 분석
5. 청크 단위로 SSE 전송

**SSE 이벤트 종류**:
| 이벤트 | 설명 |
|--------|------|
| `connected` | 초기 연결 |
| `page_found` | 페이지 발견 시 |
| `progress` | 진행상황 (crawling/analyzing/streaming) |
| `chunk` | GPT 응답 청크 |
| `complete` | 분석 완료 |
| `error` | 오류 발생 |

---

### 2.2 `POST /upload` - 대량 파일 업로드 분석 (SSE 스트리밍)

**위치**: `web-extraction.routes.ts:212-544`

**입력**:
```typescript
{
  file: File              // Excel/CSV 파일 (최대 50MB)
  workspaceId: string     // 워크스페이스 ID
  searchCriteria?: string[] // 커스텀 검색 조건 (선택)
  config?: {              // 추출 설정 (선택)
    maxConcurrent?: number
    timeoutSeconds?: number
    gptTimeout?: number
    crawlDepth?: number
    deduplicateByUrl?: boolean
    expandEmailsToRows?: boolean
    randomDelayMin?: number
    randomDelayMax?: number
  }
}
```

**처리 흐름**:
1. 파일 확장자 검증 (.xlsx, .xls, .csv)
2. XLSX 라이브러리로 파싱
3. `website_url` / `websiteUrl` / `website` 컬럼 추출
4. API 키 개수에 따른 동시성 설정: `activeApiKeyCount * 20`
5. 중복 URL 제거 (설정에 따라)
6. `processBatch()` 호출하여 일괄 처리
7. 결과를 `resultsMap`에 저장 (다운로드용)

---

### 2.3 `GET /results/:jobId` - Excel 다운로드

**위치**: `web-extraction.routes.ts:550-641`

- `resultsMap`에서 결과 조회
- XLSX 형식으로 Excel 파일 생성
- `customSearchResults`가 있으면 별도 컬럼으로 분리

---

### 2.4 `GET /results/:jobId/json` - JSON 조회

**위치**: `web-extraction.routes.ts:647-699`

- `resultsMap`에서 결과 조회
- JSON 형식으로 반환

---

### 2.5 `DELETE /cleanup/:jobId` - 메모리 정리

**위치**: `web-extraction.routes.ts:705-724`

- `resultsMap`에서 해당 jobId 데이터 삭제

---

## 3. 서비스 레이어 (service)

### 3.1 `extractMetadata()` - HTML 메타데이터 추출

**위치**: `web-extraction.service.ts:27-171`

**추출 항목**:
| 항목 | 소스 |
|------|------|
| 페이지 제목 | `<title>` |
| 설명 | `<meta name="description">`, `og:description` |
| 키워드 | `<meta name="keywords">` |
| 사이트명 | `og:site_name` |
| 트위터 | `twitter:site` |
| JSON-LD | `<script type="application/ld+json">` |
| 작성자 | `<meta name="author">` |
| 저작권 | `<meta name="copyright">` |

**JSON-LD에서 추출하는 정보**:
- Organization, LocalBusiness, Company, Corporation 타입
- 회사명, 설명, 전화번호, 이메일, 설립일, 직원수
- 주소 (streetAddress, addressLocality 등)
- 소셜 미디어 (sameAs 배열)

---

### 3.2 `fetchWebsiteContent()` - 단일 페이지 가져오기

**위치**: `web-extraction.service.ts:176-238`

**처리**:
1. URL 정규화 (https:// 추가)
2. fetch 요청 (User-Agent 설정)
3. Cheerio로 HTML 파싱
4. 메타데이터 추출
5. script, style, noscript 제거
6. 본문 텍스트 추출 (최대 48KB)
7. 메타데이터 + 본문 결합 (최대 50KB)

---

### 3.3 `fetchWithDepth()` - 깊이 크롤링

**위치**: `web-extraction.service.ts:244-429`

**핵심 로직**:
```
1. 메인 페이지 fetch
2. 메타데이터 추출 (JSON-LD 포함)
3. 링크 추출 (최대 10개, 같은 도메인만)
4. depth > 0이면 추가 페이지 크롤링
   - 각 페이지마다 3.5초 지연
   - 타임아웃: 메인의 절반
```

**콜백 함수**:
- `onPageFound`: 페이지 발견 시 호출 (url, title, contentLength)
- `onProgress`: 진행상황 메시지 전달

**반환값**:
```typescript
{
  pagesContent: Map<string, string>  // URL → 콘텐츠
  httpStatus: number                 // 메인 페이지 HTTP 상태
}
```

---

### 3.4 `extractContactsWithGPT()` - GPT로 연락처 추출

**위치**: `web-extraction.service.ts:434-595`

**GPT 프롬프트 구조**:
```
웹사이트 콘텐츠: [최대 15000자]

추가 검색 조건: (있는 경우)
1. "조건1" - true/false + 근거 3가지
2. "조건2" - true/false + 근거 3가지

JSON 형식 요청:
{
  foundCompanyName, description, address, country, city, state,
  foundedYear, phoneNumber, email, facebookUrl, instagramUrl,
  twitterUrl, linkedinUrl, employeeCount, products, businessSectors,
  productCategories, industryTypes,
  customSearchResults: { "조건1": { result, reasons[] }, ... }
}
```

**API 키 처리**:
1. `getNextApiKey(workspaceId)` 호출 (라운드로빈)
2. 없으면 환경변수 `OPENAI_API_KEY` 사용

**JSON 파싱 전략**:
1. 백틱 제거 (```json ... ```)
2. JSON 객체 추출 ({...})

---

### 3.5 `analyzeWebsiteWithStreaming()` - GPT 스트리밍 분석

**위치**: `web-extraction.service.ts:600-684`

**용도**: 단일 웹사이트 분석 (대화형 응답)

**프롬프트 스타일**: 토스 스타일 (친근하고 자연스러운 설명)

**응답 형식**: 마크다운
- 이 회사는 뭐 하는 곳인가요?
- 기본 정보
- 특징과 강점

---

### 3.6 `processCompanyRecord()` - 단일 레코드 처리

**위치**: `web-extraction.service.ts:689-764`

**처리 흐름**:
```
1. URL 유효성 검사
2. 랜덤 지연 (봇 탐지 회피): randomDelayMin ~ randomDelayMax
3. fetchWithDepth() 호출
4. extractContactsWithGPT() 호출
5. 결과 병합
```

**반환값**:
```typescript
CompanyRecord {
  websiteUrl, finalUrl, httpStatus,
  foundCompanyName, description, address, ...
  customSearchResults,
  crawlTimeSeconds, gptTimeSeconds,
  collectedAt, errorMessage
}
```

---

### 3.7 `processBatch()` - 일괄 처리

**위치**: `web-extraction.service.ts:769-996`

**동시성 제어**: `p-limit` 라이브러리 사용

**진행상황 추적**:
| 필드 | 설명 |
|------|------|
| processed | 처리 완료 수 |
| success | 성공 수 |
| errors | 실패 수 |
| emailFound | 이메일 발견 수 |
| phoneFound | 전화번호 발견 수 |
| addressFound | 주소 발견 수 |
| socialFound | SNS 발견 수 |
| gptRequests | GPT 요청 수 |
| estimatedCost | 예상 비용 (USD) |

**로그 관리**:
- 최대 500개 유지 (메모리 절약)
- 타입: info, success, warning, error

**에러 처리**:
- 에러 발생 시 결과 배열에 포함하지 않음 (null 반환)
- 에러 로그만 기록

---

## 4. 타입 정의 (types)

### 4.1 주요 인터페이스

```typescript
// 검색 조건 결과
interface SearchCriteriaResult {
  result: string       // "true" | "false"
  reasons: string[]    // 근거 3가지
}

// 회사 레코드
interface CompanyRecord {
  websiteUrl: string
  finalUrl?: string
  httpStatus?: number
  foundCompanyName?: string
  description?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: string
  phoneNumber?: string
  email?: string
  facebookUrl?: string
  instagramUrl?: string
  twitterUrl?: string
  linkedinUrl?: string
  employeeCount?: string
  products?: string
  businessSectors?: string
  productCategories?: string
  industryTypes?: string
  customSearchResults?: Record<string, SearchCriteriaResult>
  crawlTimeSeconds?: number
  gptTimeSeconds?: number
  collectedAt?: string
  errorMessage?: string
}

// 진행상황
interface ExtractionProgress {
  type?: "init" | "progress" | "complete" | "error"
  status: "processing" | "completed" | "error"
  total: number
  processed: number
  success: number
  errors: number
  emailFound: number
  phoneFound: number
  addressFound: number
  socialFound: number
  gptRequests: number
  percentage: number
  currentCompany?: string
  elapsedTime: number
  estimatedTimeRemaining: number
  itemsPerSecond: number
  message?: string
  logs?: ProgressLog[]
  latestResult?: CompanyRecord
  estimatedCost?: number
}
```

### 4.2 기본 설정값

```typescript
DEFAULT_EXTRACTION_CONFIG = {
  maxConcurrent: 20,       // 동시 처리 수 (API 키 개수 * 20)
  timeoutSeconds: 120,     // 웹사이트 타임아웃 (2분)
  gptTimeout: 180,         // GPT 타임아웃 (3분)
  crawlDepth: 1,           // 크롤링 깊이
  deduplicateByUrl: true,  // URL 중복 제거
  expandEmailsToRows: true,// 이메일 분리
  randomDelayMin: 3000,    // 최소 랜덤 지연 (3초)
  randomDelayMax: 6000,    // 최대 랜덤 지연 (6초)
}
```

### 4.3 GPT 비용 계산

```typescript
GPT_COST_PER_REQUEST = {
  INPUT_TOKENS: 8000,              // 입력 토큰 (웹콘텐츠 7000 + 프롬프트 1000)
  OUTPUT_TOKENS: 800,              // 출력 토큰 (JSON 응답)
  INPUT_PRICE_PER_MILLION: 0.15,   // $0.15/1M 입력 토큰
  OUTPUT_PRICE_PER_MILLION: 0.6,   // $0.60/1M 출력 토큰
}

// 요청당 예상 비용 = (8000/1M * $0.15) + (800/1M * $0.60) = $0.0012 + $0.00048 = $0.00168
```

---

## 5. 프론트엔드 (WebExtractionProgress.tsx)

### 5.1 표시 정보

| 섹션 | 내용 |
|------|------|
| API 키 속도 배너 | API 키 개수, 동시 처리 수 |
| 진행률 바 | 퍼센트, 처리수/전체수 |
| 현재 처리 중 | 처리 중인 회사명 |
| 통계 | 성공, 실패, 이메일, 전화, 주소, SNS, GPT, 속도 |
| 예상 비용 | 원화 환산 (USD * 1300) |
| 시간 정보 | 경과 시간, 남은 시간 |
| 시간 절약 배너 | 절약 시간, 절약 비용 (최저시급 기준) |
| 로그 | 처리 로그 (자동 스크롤) |
| 랜덤 팁 | 속도 팁, 휴식 제안 등 |

### 5.2 시간 절약 계산

```typescript
MANUAL_TIME_PER_ITEM = 900초 (15분)  // 사람이 수동으로 걸리는 시간
MINIMUM_WAGE_PER_HOUR = 9860원       // 2024년 최저시급

절약 시간 = (성공 수 * 15분) - 실제 소요 시간
절약 비용 = 절약 시간(시간) * 9860원
```

---

## 6. 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Excel/CSV 파일 업로드                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. 파일 파싱 (XLSX)                                                      │
│    - website_url 컬럼 추출                                               │
│    - 중복 URL 제거                                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. 동시성 설정                                                           │
│    - API 키 개수 조회                                                    │
│    - maxConcurrent = 키 개수 * 20                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. processBatch() - p-limit으로 동시성 제어                              │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │ for each record:                                                 │  │
│    │   ├─ 랜덤 지연 (3~6초)                                           │  │
│    │   ├─ fetchWithDepth()                                           │  │
│    │   │   ├─ 메인 페이지 fetch                                       │  │
│    │   │   ├─ 메타데이터 추출 (JSON-LD 포함)                          │  │
│    │   │   ├─ 링크 추출 (최대 10개)                                   │  │
│    │   │   └─ 추가 페이지 fetch (3.5초 간격)                          │  │
│    │   ├─ extractContactsWithGPT()                                   │  │
│    │   │   ├─ 콘텐츠 합치기 (최대 15000자)                            │  │
│    │   │   ├─ GPT-4o-mini 호출                                        │  │
│    │   │   └─ JSON 파싱                                               │  │
│    │   └─ 결과 반환                                                    │  │
│    └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. 결과 저장                                                             │
│    - resultsMap.set(jobId, results)                                     │
│    - SSE로 완료 이벤트 전송                                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Excel 다운로드                                                        │
│    - GET /results/:jobId                                                │
│    - customSearchResults → 별도 컬럼                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. 주요 특징 요약

| 특징 | 값 |
|------|-----|
| 동시 처리 | API 키 개수 * 20 (기본 20) |
| 웹사이트 타임아웃 | 120초 |
| GPT 타임아웃 | 180초 |
| 크롤링 깊이 | 1 (메인 + 추가 페이지) |
| 추가 페이지 지연 | 3.5초 |
| 랜덤 지연 | 3~6초 |
| 콘텐츠 제한 | 50KB (메타데이터 포함) |
| GPT 입력 제한 | 15000자 |
| 추가 링크 제한 | 최대 10개 |
| 로그 보관 | 최대 500개 |
| GPT 모델 | gpt-4o-mini |
| Keep-alive | 15초 간격 |

---

## 8. 파일 구조

```
elysia-server/
├── src/
│   ├── routes/
│   │   └── web-extraction.routes.ts    # API 엔드포인트 (724줄)
│   ├── services/
│   │   └── web-extraction.service.ts   # 비즈니스 로직 (996줄)
│   └── types/
│       └── web-extraction.types.ts     # 타입 정의 (165줄)
└── docs/
    └── web-extraction-v1.2-analysis.md # 이 문서

admin/
└── src/
    └── components/
        └── web-extraction/
            └── WebExtractionProgress.tsx  # 진행상황 UI (481줄)
```
