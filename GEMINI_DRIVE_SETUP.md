# Gemini Lead Search + Google Drive 통합 가이드 (구 버전 - API 인증)

> **⚠️ 주의**: 이 문서는 OAuth 인증이 필요한 구 버전입니다.
> 
> **추천**: [GEMINI_DRIVE_URL_SIMPLE.md](./GEMINI_DRIVE_URL_SIMPLE.md) - URL만으로 간단하게 사용!

## 📋 개요

Google Drive API를 사용하여 30MB 리드 데이터를 Gemini File Search Store로 가져와서 AI 기반 시맨틱 검색을 수행하는 기능입니다.

**참고**: 이 방식은 복잡하므로 URL 방식을 권장합니다.

**핵심 특징:**
- ✅ **완전 관리형 RAG**: Google이 자동으로 파싱, 청킹, 임베딩, 벡터 저장
- ✅ **Google Drive 직접 연동**: Drive에서 파일을 가져와 바로 검색 가능
- ✅ **시맨틱 검색**: 키워드가 아닌 의미 기반 검색
- ✅ **메타데이터 필터링**: 국가, 지역, 업종 등으로 사전 필터링

---

## 🔧 설치 방법

### 1. 패키지 설치

```bash
cd elysia-server
bun add @google/generative-ai
```

### 2. 환경 변수 설정

`elysia-server/.env` 파일에 다음을 추가:

```env
# Gemini API Key (필수)
GEMINI_API_KEY=your-gemini-api-key-here

# Google Drive API (선택사항 - Drive 연동 시 필요)
GOOGLE_DRIVE_ACCESS_TOKEN=your-access-token
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
```

#### Gemini API 키 발급
1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "Get API Key" 클릭
3. API 키 복사하여 `.env`에 추가

#### Google Drive API 설정 (Drive 연동 시)
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 선택
3. "API 및 서비스" → "라이브러리" → "Google Drive API" 검색 및 사용 설정
4. "사용자 인증 정보" → "OAuth 2.0 클라이언트 ID" 생성
5. Access Token 발급 (OAuth Playground 또는 직접 구현)

**간단한 테스트용**:
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)에서 Drive API v3 선택
- Authorize APIs → Exchange authorization code for tokens
- Access Token 복사

### 3. 서버 재시작

```bash
cd elysia-server
bun run dev
```

### 4. 프론트엔드 확인

```bash
cd admin
npm run dev
```

---

## 📊 사용 방법

### 방법 1: Google Drive에서 가져오기 (추천)

1. **"Drive 가져오기"** 탭으로 이동
2. (선택) Drive Folder ID 입력
   - Drive 폴더 URL: `https://drive.google.com/drive/folders/YOUR_FOLDER_ID`
   - `YOUR_FOLDER_ID` 부분을 복사하여 입력
3. **"파일 검색"** 클릭
4. 목록에서 30MB 리드 데이터 파일 선택
5. 메타데이터 입력 (선택사항):
   - 국가 (예: South Korea)
   - 지역 (예: Asia)
   - 업종 (예: bedding, beauty)
   - 출처 (예: Lead-DB-2025-Q1)
6. **"Drive에서 Gemini로 가져오기"** 클릭
7. 자동으로 Gemini File Search Store에 업로드 및 인덱싱 완료!

### 방법 2: 로컬 파일 업로드

1. **"로컬 업로드"** 탭으로 이동
2. 파일 선택 (드래그 앤 드롭 또는 클릭)
3. 메타데이터 입력 (선택사항)
4. **"Gemini에 업로드"** 클릭

### 리드 검색

1. **"검색"** 탭으로 이동
2. 자연어 쿼리 입력:
   ```
   예시 쿼리:
   - "서울에서 침구를 도매로 판매하는 업체"
   - "부산의 화장품 수입 유통업체"
   - "한국에서 호텔에 납품하는 침구 제조업체"
   ```
3. (선택) 필터 설정:
   - 국가, 지역, 업종
4. **"검색"** 클릭
5. 결과 확인:
   - 회사명, 웹사이트, 이메일, 전화번호
   - 신뢰도 점수 (0-100%)
   - AI가 설명하는 매칭 이유
6. **"엑셀 다운로드"**로 결과 저장

---

## 🎯 File Search Store의 장점

### ❌ 일반 File API (구현 X)
```
파일 업로드
  ↓
검색 시 전체 파일 내용을 프롬프트에 포함
  ↓
토큰 제한, 느린 속도, 비효율적
```

### ✅ File Search Store (현재 구현)
```
파일 업로드
  ↓
Google이 자동 처리:
  - 문서 파싱
  - 청킹 (적절한 크기로 분할)
  - 임베딩 (벡터화)
  - 벡터 DB에 저장
  ↓
검색 시:
  - 시맨틱 검색 (의미 기반)
  - 관련 청크만 Gemini에 주입
  - 빠르고 정확한 결과
```

**결과:**
- ✅ 100GB 리드 DB도 처리 가능
- ✅ 시맨틱 검색 (의미 기반)
- ✅ 메타데이터 필터링
- ✅ 빠른 응답 속도
- ✅ 낮은 비용

---

## 💰 비용 정보

### Gemini 2.0 Flash (사용 모델)

| 항목 | 가격 |
|------|------|
| **인덱싱** (1회) | $0.15 / 1M 토큰 |
| **검색 입력** | $0.10 / 1M 토큰 |
| **검색 출력** | $0.40 / 1M 토큰 |

### 30MB 리드 데이터 비용 예상

**인덱싱 (1회)**:
- 30MB ≈ 7.5M 토큰
- 비용: $0.15 × 7.5 = **$1.13 (1회성)**

**검색 (1회당)**:
- 입력 6,000 토큰 + 출력 1,000 토큰
- 비용: **약 $0.001** (0.1센트)

**월 1만 건 검색**:
- 비용: **약 $10 / 월**

### Google Drive API 비용
- ✅ **무료!** (일일 할당량 내)
- 할당량: 10,000 requests / day / user
- 30MB 파일 1개 다운로드: 1 request

---

## 🔍 검색 예시

### 예시 1: 지역 기반 검색
```
쿼리: "서울 강남구에서 침구를 판매하는 업체"

결과:
- ABC 침구 - 강남구 위치, 침대 매트리스 전문
  신뢰도: 95% | 이유: 지역과 업종 정확히 일치
```

### 예시 2: 비즈니스 모델 검색
```
쿼리: "호텔에 납품하는 B2B 침구 제조업체"

결과:
- XYZ Manufacturing - 호텔 납품 전문 OEM
  신뢰도: 92% | 이유: B2B 비즈니스 모델, 호텔 납품 경험 있음
```

### 예시 3: 복합 조건 검색
```
쿼리: "부산에서 온라인으로도 판매하고 있는 화장품 유통업체"

결과:
- 뷰티코리아 - 부산 본사, 오프라인+온라인 채널
  신뢰도: 88% | 이유: 부산 위치, 온라인 쇼핑몰 운영 중
```

---

## 🛠️ 기술 상세

### 아키텍처

```
Google Drive
    ↓
Drive API (파일 다운로드)
    ↓
Elysia Backend
    ↓
Gemini File Search Store API
    ↓
Google 자동 처리:
  - 문서 파싱
  - 청킹
  - 임베딩 (벡터화)
  - 벡터 저장
    ↓
Gemini 2.0 Flash (검색)
    ↓
시맨틱 검색 결과
    ↓
프론트엔드 (React)
```

### API 엔드포인트

#### 1. Drive 파일 목록 조회
```http
GET /api/v1/admin/gemini-search/drive/files?folderId={optional}
Authorization: Bearer {token}
```

#### 2. Drive 파일 가져오기
```http
POST /api/v1/admin/gemini-search/drive/import
Content-Type: application/json

{
  "workspaceId": "uuid",
  "driveFileId": "drive-file-id",
  "metadata": {
    "country": "South Korea",
    "region": "Asia",
    "vertical": "bedding"
  }
}
```

#### 3. 리드 검색
```http
POST /api/v1/admin/gemini-search/search
Content-Type: application/json

{
  "workspaceId": "uuid",
  "query": "서울의 침구 도매업체",
  "filters": {
    "country": "South Korea",
    "vertical": "bedding"
  },
  "limit": 50
}
```

---

## ⚠️ 주의사항

### 1. Google Drive 인증
- Access Token은 **1시간 후 만료**됩니다
- Refresh Token으로 자동 갱신 구현 필요 (프로덕션)
- 테스트용으로는 OAuth Playground에서 새로 발급

### 2. 파일 크기 제한
- **최대 100MB per file**
- 30MB는 문제없음 ✅

### 3. 데이터 보안
- Drive Access Token은 **매우 민감한 정보**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- 프로덕션에서는 Secret Manager 사용 권장

### 4. 할당량
- **Drive API**: 10,000 requests/day/user
- **Gemini API**: 15 RPM (무료), 360 RPM (유료)

---

## 🚀 프로덕션 체크리스트

- [ ] OAuth 2.0 Refresh Token 자동 갱신 구현
- [ ] API 키/토큰 Secret Manager로 이동
- [ ] 에러 핸들링 강화
- [ ] 로깅 및 모니터링
- [ ] 비용 추적 시스템
- [ ] 사용자별 할당량 관리
- [ ] Rate Limiting

---

## 🔗 관련 링크

- [Gemini File Search 문서](https://ai.google.dev/docs/file_search)
- [Google Drive API 문서](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google AI Studio](https://aistudio.google.com/)

---

## 📝 FAQ

### Q: Drive 없이도 사용 가능한가요?
**A:** 네! "로컬 업로드" 탭에서 직접 CSV 업로드 가능합니다.

### Q: 여러 파일을 한 번에 업로드할 수 있나요?
**A:** 현재는 파일을 하나씩 업로드해야 합니다. 모든 파일은 동일한 File Search Store에 저장되어 통합 검색 가능합니다.

### Q: 검색 결과가 부정확해요.
**A:** 
1. 쿼리를 더 구체적으로 작성하세요
2. 메타데이터 필터를 추가하세요
3. CSV 파일에 회사 설명이 충분히 포함되어 있는지 확인하세요

### Q: 비용이 얼마나 나올까요?
**A:**
- 30MB 인덱싱: **$1.13 (1회)**
- 월 1만 건 검색: **$10**
- 총: **$11.13 / 월** (매우 저렴!)

---

**구현 완료! 🎉** 이제 Drive에서 리드 데이터를 가져와 AI 검색을 사용할 수 있습니다.

