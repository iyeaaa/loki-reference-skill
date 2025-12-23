# Web Extraction 버전 비교: v1.1 vs v1.2

> v1.1: 2025-11-18 (commit `aaf14336`) - Custom Search Option 추가
> v1.2: 2025-12-05 (commit `6c79d31c`) - Lead Discovery SSE 스트리밍

---

## 1. 파일 크기 비교

| 파일 | v1.1 | v1.2 | 차이 |
|------|------|------|------|
| `web-extraction.routes.ts` | 538줄 | 724줄 | +186줄 |
| `web-extraction.service.ts` | 656줄 | 996줄 | +340줄 |
| `web-extraction.types.ts` | 165줄 | 165줄 | 동일 |
| **총합** | **1,359줄** | **1,885줄** | **+526줄** |

---

## 2. API 엔드포인트 비교

### v1.1 엔드포인트
```
POST   /upload              # 대량 파일 업로드 분석
GET    /results/:jobId      # Excel 다운로드
GET    /results/:jobId/json # JSON 조회
DELETE /cleanup/:jobId      # 메모리 정리
```

### v1.2 엔드포인트 (추가됨)
```
POST   /analyze             # [NEW] 단일 웹사이트 SSE 스트리밍 분석
POST   /upload              # 대량 파일 업로드 분석
GET    /results/:jobId      # Excel 다운로드
GET    /results/:jobId/json # JSON 조회
DELETE /cleanup/:jobId      # 메모리 정리
```

### 새로운 `/analyze` 엔드포인트 상세

**v1.2에서 추가된 기능**:
- 단일 웹사이트 URL을 SSE로 실시간 분석
- GPT 응답을 청크 단위로 스트리밍
- 대화형 마크다운 응답 (토스 스타일)

**입력**:
```typescript
{
  websiteUrl: string   // 분석할 웹사이트 URL
  workspaceId: string  // 워크스페이스 ID
}
```

**SSE 이벤트**:
| 이벤트 | 설명 |
|--------|------|
| `connected` | 초기 연결 |
| `page_found` | 페이지 발견 시 |
| `progress` | 진행상황 |
| `chunk` | GPT 응답 청크 |
| `complete` | 분석 완료 |
| `error` | 오류 발생 |

---

## 3. 서비스 함수 비교

### v1.1 함수 목록
```typescript
fetchWebsiteContent()     // 단일 페이지 가져오기
fetchWithDepth()          // 깊이 크롤링
extractContactsWithGPT()  // GPT로 연락처 추출
processCompanyRecord()    // 단일 레코드 처리
processBatch()            // 일괄 처리
```

### v1.2 함수 목록 (추가됨)
```typescript
extractMetadata()              // [NEW] HTML 메타데이터 추출
fetchWebsiteContent()          // 단일 페이지 가져오기 (개선됨)
fetchWithDepth()               // 깊이 크롤링 (개선됨)
extractContactsWithGPT()       // GPT로 연락처 추출 (개선됨)
analyzeWebsiteWithStreaming()  // [NEW] GPT 스트리밍 분석
processCompanyRecord()         // 단일 레코드 처리
processBatch()                 // 일괄 처리
```

---

## 4. 주요 기능 차이

### 4.1 메타데이터 추출 (v1.2 신규)

**v1.1**: 메타데이터 추출 없음, 본문 텍스트만 사용

**v1.2**: `extractMetadata()` 함수 추가 (145줄)

추출 항목:
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

JSON-LD에서 추출:
- Organization, LocalBusiness, Company, Corporation 타입
- 회사명, 설명, 전화번호, 이메일, 설립일, 직원수
- 주소, 소셜 미디어 링크

---

### 4.2 `fetchWebsiteContent()` 비교

**v1.1**:
```typescript
// 본문 텍스트만 추출 (최대 50KB)
const bodyText = $("body").text()
  .replace(/\s+/g, " ")
  .trim()
  .substring(0, 50000)

return { content: bodyText, statusCode, finalUrl }
```

**v1.2**:
```typescript
// 메타데이터 추출 (script 제거 전에 수행)
const metadata = extractMetadata($)

// 본문 텍스트 추출 (최대 48KB - 메타데이터 공간 확보)
const bodyText = $("body").text()
  .replace(/\s+/g, " ")
  .trim()
  .substring(0, 48000)

// 메타데이터 + 본문 결합 (최대 50KB)
const content = metadata + bodyText
return { content: content.substring(0, 50000), statusCode, finalUrl }
```

---

### 4.3 `fetchWithDepth()` 비교

**v1.1**:
```typescript
export async function fetchWithDepth(
  baseUrl: string,
  depth: number,
  timeoutSeconds: number,
): Promise<{ pagesContent: Map<string, string>; httpStatus: number }>

// 특징:
// - 콜백 없음
// - Contact, About 관련 링크만 찾음 (targetKeywords)
// - 최대 3개 링크만 크롤링
// - 로깅 없음
```

**v1.2**:
```typescript
export async function fetchWithDepth(
  baseUrl: string,
  depth: number,
  timeoutSeconds: number,
  onPageFound?: (info: { url: string; title?: string; contentLength: number }) => void,
  onProgress?: (message: string) => void,
): Promise<{ pagesContent: Map<string, string>; httpStatus: number }>

// 특징:
// - onPageFound 콜백: 페이지 발견 시 호출
// - onProgress 콜백: 진행상황 메시지 전달
// - 모든 같은 도메인 링크 수집 (최대 10개)
// - 상세 로깅 추가
// - 메타데이터 추출 통합
```

**링크 수집 로직 차이**:

| 항목 | v1.1 | v1.2 |
|------|------|------|
| 링크 필터 | contact, about, company, team 키워드 포함 | 같은 도메인 모든 링크 |
| 최대 링크 수 | 3개 | 10개 |
| 콜백 지원 | 없음 | onPageFound, onProgress |

---

### 4.4 `extractContactsWithGPT()` 비교

**v1.1**:
```typescript
// API 키 처리
const apiKey = workspaceId ? await getNextApiKey(workspaceId) : null

if (!apiKey) {
  return { errorMessage: "워크스페이스에 OpenAI API 키가 등록되어 있지 않습니다..." }
}
```

**v1.2**:
```typescript
// API 키 처리 (환경변수 폴백 추가)
let apiKey = workspaceId ? await getNextApiKey(workspaceId) : null

// Workspace API 키가 없으면 환경변수 사용 (단일 웹사이트 분석용)
if (!apiKey) {
  apiKey = process.env.OPENAI_API_KEY || null
  if (apiKey) {
    logger.info("Using OPENAI_API_KEY from environment variable")
  }
}

if (!apiKey) {
  return { errorMessage: "워크스페이스에 OpenAI API 키가 등록되어 있지 않습니다..." }
}
```

---

### 4.5 `analyzeWebsiteWithStreaming()` (v1.2 신규)

**v1.1**: 함수 없음

**v1.2**: 단일 웹사이트 분석을 위한 GPT 스트리밍 함수 추가 (85줄)

```typescript
export async function analyzeWebsiteWithStreaming(
  pagesContent: Map<string, string>,
  gptTimeout: number,
  _workspaceId?: string,
)
```

특징:
- `streamText()` 사용 (generateText가 아닌 스트리밍)
- 토스 스타일 대화형 프롬프트
- 마크다운 형식 응답
- 환경변수 `OPENAI_API_KEY` 사용

---

## 5. 코드 구조 차이

### v1.1 import 구문
```typescript
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import * as cheerio from "cheerio"
import pLimit from "p-limit"
```

### v1.2 import 구문 (추가됨)
```typescript
import { createOpenAI } from "@ai-sdk/openai"
import { generateText, streamText } from "ai"  // streamText 추가
import type { CheerioAPI } from "cheerio"      // 타입 추가
import * as cheerio from "cheerio"
import type { AnyNode, Element } from "domhandler"  // DOM 타입 추가
import pLimit from "p-limit"
```

---

## 6. 설정값 비교

| 설정 | v1.1 | v1.2 | 비고 |
|------|------|------|------|
| maxConcurrent | 20 | 20 | 동일 |
| timeoutSeconds | 120 | 120 | 동일 |
| gptTimeout | 180 | 180 | 동일 |
| crawlDepth | 1 | 1 | 동일 |
| randomDelayMin | 3000 | 3000 | 동일 |
| randomDelayMax | 6000 | 6000 | 동일 |
| 추가 링크 최대 수 | 3개 | 10개 | v1.2 증가 |
| 메타데이터 추출 | 없음 | 있음 | v1.2 추가 |
| 환경변수 API 키 폴백 | 없음 | 있음 | v1.2 추가 |

---

## 7. 로깅 비교

### v1.1 로깅
```typescript
// 기본적인 에러 로깅만
logger.error({ error, url }, "Failed to fetch website content")
logger.error({ error, baseUrl }, "Failed to fetch with depth")
logger.debug({ error, link }, "Failed to fetch additional page")
```

### v1.2 로깅 (상세 로깅 추가)
```typescript
// 크롤링 시작
logger.info({ url, depth, timeout }, "[fetchWithDepth] Starting crawl")

// 메인 페이지 성공
logger.info({ status, url }, "[fetchWithDepth] Successfully fetched main page")

// 콘텐츠 추출
logger.info({ contentLength, metadataLength, url, title },
  "[fetchWithDepth] Extracted content with metadata from main page")

// 추가 링크 발견
logger.info({ linksFound }, "[fetchWithDepth] Found additional links to crawl")

// 추가 페이지 크롤링
logger.info({ link, index, total }, "[fetchWithDepth] Fetching additional page")

// 완료
logger.info({ totalPages }, "[fetchWithDepth] Completed crawling")

// 스트리밍 분석
logger.info("[analyzeWebsiteWithStreaming] Using OPENAI_API_KEY from environment variable")
logger.info("[analyzeWebsiteWithStreaming] Starting GPT streaming analysis")
logger.info("[analyzeWebsiteWithStreaming] GPT streaming initialized successfully")
```

---

## 8. 요약: v1.2 주요 개선사항

### 신규 기능
1. **`/analyze` 엔드포인트**: 단일 웹사이트 SSE 스트리밍 분석
2. **`extractMetadata()` 함수**: JSON-LD, Open Graph 등 메타데이터 추출
3. **`analyzeWebsiteWithStreaming()` 함수**: GPT 스트리밍 응답
4. **환경변수 API 키 폴백**: 워크스페이스 키 없을 때 `OPENAI_API_KEY` 사용

### 개선된 기능
1. **`fetchWithDepth()` 콜백**: `onPageFound`, `onProgress` 지원
2. **링크 수집 확장**: 3개 → 10개, 키워드 필터 → 도메인 필터
3. **콘텐츠 구성**: 메타데이터 + 본문 결합
4. **상세 로깅**: 크롤링 각 단계별 로그

### 변경 없음
- 설정값 (타임아웃, 동시성, 지연 등)
- 타입 정의
- GPT 프롬프트 구조
- 일괄 처리 로직

---

## 9. 마이그레이션 가이드

### v1.1 → v1.2 업그레이드 시

**호환성**: 완전 호환 (하위 호환)

**새로운 기능 활용**:
1. 단일 웹사이트 분석이 필요한 경우 `/analyze` 엔드포인트 사용
2. 크롤링 진행상황 표시가 필요한 경우 `onPageFound`, `onProgress` 콜백 활용
3. 워크스페이스 API 키 없이 테스트 시 `OPENAI_API_KEY` 환경변수 설정

### v1.2 → v1.1 다운그레이드 시

**제거되는 기능**:
1. `/analyze` 엔드포인트 사용 불가
2. 메타데이터 추출 없음 (JSON-LD, Open Graph 등)
3. 환경변수 API 키 폴백 없음
4. 크롤링 콜백 없음
