# Gemini Lead Search 설치 및 사용 가이드

## 📋 개요

Google Gemini File Search API를 활용하여 전세계 리드 데이터를 시맨틱 검색으로 찾는 기능입니다.

- **백엔드**: Elysia.js + Google Generative AI SDK
- **프론트엔드**: React + Vite + TanStack Query
- **AI 모델**: Gemini 2.0 Flash (빠르고 저렴한 모델)

---

## 🔧 설치 방법

### 1. 백엔드 패키지 설치

```bash
cd elysia-server
bun add @google/generative-ai
```

### 2. 환경 변수 설정

`elysia-server/.env` 파일에 Gemini API 키를 추가하세요:

```env
# Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here
```

**API 키 발급 방법:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey)에 접속
2. "Get API Key" 클릭
3. 새 API 키 생성
4. `.env` 파일에 추가

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

브라우저에서 **사이드바 → Gemini Search** 메뉴를 확인하세요.

---

## 📊 사용 방법

### 1️⃣ CSV 업로드

1. **"CSV 업로드"** 탭으로 이동
2. 리드 데이터가 포함된 CSV 파일 선택 (최대 100MB)
3. 메타데이터 입력 (선택사항):
   - 국가 (예: Germany)
   - 지역 (예: Europe)
   - 업종 (예: bedding, beauty)
   - 출처 (예: Beauty-DB-2025)
4. **"Gemini에 업로드"** 클릭
5. 업로드 완료 후 "업로드된 파일" 탭에서 확인 가능

### 2️⃣ 리드 검색

1. **"검색"** 탭으로 이동
2. 자연어로 검색 쿼리 입력:
   - 예: "독일에서 호텔에 침구를 공급하는 도매업체"
   - 예: "한국 화장품을 수입하는 미국 유통업체"
   - 예: "침대 매트리스를 제조하는 중국 OEM 업체"
3. 필터 설정 (선택사항):
   - 국가, 지역, 업종 등
4. **"검색"** 클릭
5. 결과를 테이블로 확인
6. **"엑셀 다운로드"** 버튼으로 결과 저장

### 3️⃣ 업로드된 파일 관리

1. **"업로드된 파일"** 탭으로 이동
2. 업로드된 파일 목록 확인
3. 불필요한 파일은 삭제 가능 (휴지통 아이콘 클릭)

---

## 💰 비용 정보

### Gemini API 가격 (2025년 기준)

#### Gemini 2.0 Flash (기본 모델)
- **인덱싱**: $0.15 / 1M 토큰
- **입력**: $0.10 / 1M 토큰
- **출력**: $0.40 / 1M 토큰

#### 예상 비용

**100GB 리드 DB 인덱싱 (1회)**:
- 약 25B 토큰 → **$1,500 ~ $3,750** (일회성)

**리드 검색 (1회당)**:
- 평균 입력: 6,000 토큰
- 평균 출력: 1,000 토큰
- 비용: **약 $0.001 ~ $0.002** (0.1~0.2센트)

**월 1만 건 검색**: 약 **$10 ~ $20 / 월**

---

## 🎯 사용 사례

### 1. 국가/지역별 리드 발굴
```
"일본 오사카 지역의 스파 및 에스테틱 업체"
```

### 2. 업종/카테고리 검색
```
"미국에서 K-beauty 제품을 취급하는 리테일러"
```

### 3. 특정 비즈니스 모델 검색
```
"독일에서 Amazon에도 판매하고 있는 침구 유통업체"
```

### 4. 복합 조건 검색
```
"유럽에서 B2B 호텔 납품 경험이 있는 침구 도매업체"
```

---

## 🔍 주요 기능

### ✅ 시맨틱 검색
- 키워드 매칭이 아닌 **의미 기반 검색**
- 자연어 쿼리 지원
- 다국어 검색 가능

### ✅ 메타데이터 필터링
- 국가, 지역, 업종 등으로 사전 필터링
- 빠른 검색 결과

### ✅ 신뢰도 점수
- 각 리드별 **Confidence Score** (0-1)
- 매칭 이유 자동 생성

### ✅ 엑셀 다운로드
- 검색 결과를 즉시 Excel로 다운로드
- 회사명, 웹사이트, 이메일, 전화번호 등 포함

---

## ⚙️ 기술 스택

### 백엔드
- **Google Generative AI SDK**: Gemini API 통합
- **Elysia.js**: 고성능 TypeScript 웹 프레임워크
- **XLSX**: Excel 파싱 및 생성

### 프론트엔드
- **React + Vite**: 빠른 개발 환경
- **Tailwind CSS**: 스타일링
- **Framer Motion**: 애니메이션
- **Shadcn/ui**: UI 컴포넌트

### AI
- **Gemini 2.0 Flash**: 빠르고 저렴한 LLM
- **File API**: 파일 업로드 및 관리
- **Semantic Search**: 의미 기반 검색

---

## 🚨 주의사항

### 1. API 키 필수
- Gemini API 키가 없으면 기능이 작동하지 않습니다
- [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료로 발급 가능

### 2. 파일 크기 제한
- **최대 100MB per file**
- 대용량 파일은 여러 개로 분할하여 업로드하세요

### 3. 비용 관리
- 인덱싱 비용은 **1회만** 발생
- 검색 비용은 **매우 저렴** (1회당 0.1~0.2센트)
- 대량 검색 전에 소규모 테스트 권장

### 4. 검색 품질
- GPT가 생성한 결과이므로 **100% 정확도를 보장하지 않습니다**
- 중요한 리드는 수동으로 검증하세요

### 5. 데이터 보안
- 업로드된 데이터는 Google 서버에 저장됩니다
- 민감한 개인정보는 업로드하지 마세요
- Google의 데이터 정책을 확인하세요

---

## 🔗 관련 링크

- [Google Gemini API 문서](https://ai.google.dev/docs)
- [Gemini File API](https://ai.google.dev/api/files)
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini Pricing](https://ai.google.dev/pricing)

---

## 📝 참고

이 기능은 **POC (Proof of Concept)** 버전입니다. 프로덕션 사용 전에:

1. ✅ API 키 보안 (환경 변수, 암호화)
2. ✅ 에러 핸들링 강화
3. ✅ 로딩 상태 UX 개선
4. ✅ 비용 모니터링 시스템 추가
5. ✅ 로그 및 분석 추가

---

## 🆘 문제 해결

### "Gemini API key is not configured" 에러
→ `.env` 파일에 `GEMINI_API_KEY` 추가 후 서버 재시작

### "Failed to upload CSV to Gemini" 에러
→ 파일 크기 확인 (100MB 이하), CSV 형식 확인

### "Failed to search leads" 에러
→ 업로드된 파일이 있는지 확인, API 키 유효성 확인

### 검색 결과가 없음
→ 쿼리를 더 구체적으로 작성, 필터 조건 완화

---

**추가 문의**: 개발팀에 문의하세요 📧

