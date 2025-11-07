# 웹 데이터 추출 기능 설치 및 사용 가이드

## 📋 개요

웹사이트 URL에서 회사 정보 및 연락처(이메일, 전화번호, SNS 등)를 자동으로 추출하는 기능입니다.

## 🔧 설치 방법

### 1. DB 마이그레이션 실행

```bash
cd elysia-server
bun run db:push
```

새로운 `openai_api_keys` 테이블이 생성됩니다.

### 2. 환경 변수 확인 (선택사항)

`elysia-server/.env` 파일에 OpenAI API 키 설정 (선택사항):

```env
# 기본 폴백용 API 키 (Workspace에 키가 없을 때 사용)
OPENAI_API_KEY=sk-your-api-key-here

# API 키 암호화 시크릿 (선택사항, 기본값 있음)
API_KEY_ENCRYPTION_SECRET=your-custom-secret
```

### 3. 서버 재시작

```bash
cd elysia-server
bun run dev
```

### 4. 프론트엔드 확인

프론트엔드는 이미 모든 필요한 패키지가 설치되어 있습니다.

```bash
cd admin
npm run dev
```

### 📦 필요한 패키지

다음 패키지들이 이미 설치되어 있어야 합니다 (설치되어 있을 것입니다):

**백엔드:**
- `@ai-sdk/openai` - OpenAI API 클라이언트 (Vercel AI SDK)
- `ai` - AI 텍스트 생성 헬퍼
- `cheerio` - HTML 파싱 및 웹 스크래핑

**프론트엔드:**
- 추가 패키지 설치 불필요 (기본 React, TanStack Query 등 사용)

## 📍 접근 방법

### OpenAI API 키 관리

1. 애플리케이션에 로그인
2. **설정(Settings)** 페이지로 이동
3. **"OpenAI API 키 관리"** 섹션에서 키 추가/관리
4. 자세한 내용은 [OPENAI_API_KEY_MANAGEMENT.md](./OPENAI_API_KEY_MANAGEMENT.md) 참고

### 웹 데이터 추출

1. 설정(Settings) 페이지로 이동
2. "시스템 관리" 섹션에서 **"웹 데이터 추출"** 클릭
3. 또는 직접 URL로 접근: `/settings/web-extraction`

## 📊 사용 방법

### 1. 입력 파일 준비

Excel (.xlsx, .xls) 또는 CSV 파일을 준비합니다. 파일에는 반드시 다음 컬럼이 있어야 합니다:

**필수 컬럼:**
- `website_url`: 회사 웹사이트 URL

**선택 컬럼:**
- `business_type`: 비즈니스 타입 (예: "제조업", "유통업")
- `company_name`: 회사명

**입력 예시 (Excel/CSV):**
```
website_url,business_type,company_name
https://example.com,제조업,Example Corp
example2.com,유통업,Example2 Inc
```

### 2. 파일 업로드

1. "파일 선택" 버튼을 클릭하여 파일 선택
2. "추출 시작" 버튼 클릭
3. 실시간 진행 상황 확인

### 3. 결과 다운로드

처리가 완료되면 "결과 다운로드" 버튼이 표시됩니다. 클릭하여 Excel 파일로 결과를 다운로드할 수 있습니다.

## 📤 출력 결과

추출되는 정보:

### 기본 정보
- `website_url`: 입력한 웹사이트 URL
- `business_type`: 비즈니스 타입
- `company_name`: 회사명
- `final_url`: 최종 리다이렉트 URL
- `http_status`: HTTP 상태 코드

### 회사 정보
- `found_company_name`: 웹사이트에서 발견한 회사명
- `name_url_match`: URL과 회사명 일치 여부 (yes/no/partial)
- `is_business_type_matched`: 비즈니스 타입 일치 여부
- `description`: 회사 설명 (100자 이내)
- `founded_year`: 설립년도
- `employee_count`: 직원 수
- `products`: 주요 제품/서비스
- `business_sectors`: 비즈니스 섹터
- `product_categories`: 제품 카테고리
- `industry_types`: 산업 유형

### 연락처 정보
- `email`: 이메일 주소 (여러 개면 쉼표로 구분)
- `phone_number`: 전화번호 (여러 개면 쉼표로 구분)
- `address`: 주소
- `country`: 국가
- `city`: 도시
- `state`: 주/도

### SNS 정보
- `facebook_url`: 페이스북 URL
- `instagram_url`: 인스타그램 URL
- `twitter_url`: 트위터/X URL
- `linkedin_url`: 링크드인 URL

### 메타 정보
- `crawl_time_seconds`: 크롤링 소요 시간 (초)
- `gpt_time_seconds`: GPT 처리 시간 (초)
- `collected_at`: 수집 시각
- `error_message`: 오류 메시지 (있는 경우)

## ⚙️ 설정 옵션

기본 설정 (코드에서 수정 가능):

```typescript
{
  maxConcurrent: 10,          // 동시 처리 수
  timeoutSeconds: 120,        // 웹사이트 가져오기 타임아웃
  gptTimeout: 180,            // GPT API 타임아웃
  crawlDepth: 1,              // 크롤링 깊이 (0 = 첫 페이지만, 1 = Contact/About 페이지 포함)
  deduplicateByUrl: true,     // URL 기준 중복 제거
  expandEmailsToRows: true,   // 여러 이메일을 별도 행으로 분리
  randomDelayMin: 1000,       // 최소 랜덤 지연 (ms)
  randomDelayMax: 3000,       // 최대 랜덤 지연 (ms)
}
```

## 🚀 성능 및 비용

### 처리 시간
- **평균**: 10-30초/건
- **총 처리 시간**: (레코드 수 / 동시 처리 수) × 평균 처리 시간
- **예시**: 100개 레코드, 동시 10개 처리 → 약 10-30분

### OpenAI API 비용
- **모델**: GPT-4o-mini
- **비용**: 건당 약 $0.01~0.05
- **예시**: 100개 레코드 → 약 $1~5

### 동시성 제어
- 서버 부하를 고려하여 기본값 10으로 설정
- 필요시 `maxConcurrent` 값을 조정 (5~20 권장)

## 📊 진행 상황 모니터링

실시간으로 다음 정보를 확인할 수 있습니다:

- **진행률**: 처리된 레코드 수 / 전체 레코드 수
- **성공/실패 개수**
- **발견된 정보 통계**: 이메일, 전화번호, 주소, SNS 개수
- **처리 속도**: 초당 처리 건수
- **경과 시간 및 예상 남은 시간**
- **GPT API 요청 횟수**

## ⚠️ 주의사항

### 1. API 키 필수
- OpenAI API 키가 서버 환경 변수에 설정되어 있어야 합니다
- API 키가 없으면 추출이 실패합니다

### 2. 처리 시간
- 웹사이트 응답 속도에 따라 처리 시간이 달라집니다
- 느린 웹사이트는 타임아웃(120초)까지 대기합니다

### 3. 봇 탐지 회피
- 1~3초의 랜덤 지연이 자동으로 추가됩니다
- 너무 빠른 처리는 웹사이트에서 차단될 수 있습니다

### 4. 비용 관리
- GPT API 사용 비용이 발생합니다
- 대량 처리 전에 소량으로 테스트하세요

### 5. 정확도
- GPT가 추출한 정보의 정확도는 100%가 아닙니다
- 중요한 정보는 수동으로 확인하세요

### 6. 법적 고려사항
- 웹 크롤링은 웹사이트의 이용약관을 준수해야 합니다
- robots.txt 파일을 확인하고 존중하세요
- 개인정보 보호 법규를 준수하세요

## 🔧 문제 해결

### 1. "웹사이트 콘텐츠를 가져오는데 실패했습니다"
- 웹사이트가 다운되었거나 차단되었을 수 있습니다
- URL이 올바른지 확인하세요
- 타임아웃 시간을 늘려보세요

### 2. "GPT 응답을 파싱하는데 실패했습니다"
- GPT API에 일시적인 문제가 있을 수 있습니다
- 나중에 다시 시도하세요

### 3. 처리 속도가 너무 느림
- `maxConcurrent` 값을 늘려보세요 (주의: 서버 부하 증가)
- 크롤링 깊이를 0으로 줄여보세요 (첫 페이지만 크롤링)

### 4. 429 Too Many Requests 오류
- API 요청이 너무 많습니다
- `maxConcurrent` 값을 줄이세요
- `randomDelayMin/Max` 값을 늘리세요

## 📝 API 엔드포인트

### POST /api/v1/admin/web-extraction/upload
파일 업로드 및 추출 시작

**Request:**
```typescript
FormData {
  file: File
  workspaceId: string
  config?: {
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

**Response:**
```typescript
{
  success: boolean
  jobId: string
  message: string
  totalRecords: number
}
```

### GET /api/v1/admin/web-extraction/progress/:jobId
진행 상황 조회 (SSE)

**Response (SSE):**
```typescript
{
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
}
```

### GET /api/v1/admin/web-extraction/results/:jobId
결과 다운로드 (Excel)

**Response:**
Excel 파일 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

### DELETE /api/v1/admin/web-extraction/cleanup/:jobId
작업 데이터 정리

**Response:**
```typescript
{
  success: boolean
  message: string
}
```

## 🔗 관련 파일

### 백엔드
- `/elysia-server/src/types/web-extraction.types.ts` - 타입 정의
- `/elysia-server/src/services/web-extraction.service.ts` - 추출 로직
- `/elysia-server/src/routes/web-extraction.routes.ts` - API 라우트

### 프론트엔드
- `/admin/src/pages/settings/WebDataExtraction.tsx` - UI 페이지
- `/admin/src/router/index.tsx` - 라우터 설정
- `/admin/src/pages/settings.tsx` - 설정 메뉴

## 📚 참고 자료

- [csv-tools 로직 분석 문서](./csv-tools/EXTRACT_EMAILS_LOGIC_ANALYSIS.md)
- [OpenAI API 문서](https://platform.openai.com/docs/api-reference)
- [Cheerio 문서](https://cheerio.js.org/)

## 🆘 지원

문제가 발생하면 다음을 확인하세요:

1. 백엔드 로그: `elysia-server/logs/`
2. 브라우저 콘솔 (F12)
3. 네트워크 탭에서 API 응답 확인

추가 도움이 필요하면 개발팀에 문의하세요.
