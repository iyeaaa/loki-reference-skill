# Google Drive URL로 간단하게 리드 검색하기 🚀

## 🎯 핵심: API 인증 불필요!

Google Drive **공유 링크만** 복사하면 바로 사용 가능합니다.

---

## 📋 사용 방법 (3단계)

### 1단계: Google Drive에 파일 업로드 및 공유

1. Google Drive에 30MB 리드 데이터 (CSV) 업로드
2. 파일 우클릭 → **"공유"**
3. 공유 설정:
   ```
   ☑ 링크가 있는 모든 사용자
   □ (편집/댓글 아님) → 보기만 가능
   ```
4. **"링크 복사"** 클릭
5. URL 예시:
   ```
   https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J/view?usp=sharing
   ```

### 2단계: Gemini Search에서 가져오기

1. 프론트엔드 접속
2. 사이드바 → **"Gemini Search"**
3. **"Drive 가져오기"** 탭
4. Drive URL 붙여넣기
5. (선택) 메타데이터 입력:
   - 국가: South Korea
   - 지역: Asia
   - 업종: bedding / beauty
   - 출처: Lead-DB-2025
6. **"Drive에서 Gemini로 가져오기"** 클릭
7. 완료! 🎉

### 3단계: 리드 검색

1. **"검색"** 탭으로 이동
2. 자연어 쿼리:
   ```
   "서울에서 침구를 도매로 판매하는 업체"
   "부산의 화장품 수입 유통업체"
   ```
3. "검색" 클릭
4. 결과 확인 및 엑셀 다운로드

---

## ✅ 장점

| 기존 방식 (API 인증) | 새 방식 (URL만) |
|---------------------|-----------------|
| ❌ OAuth 2.0 설정 필요 | ✅ 인증 불필요 |
| ❌ Access Token 관리 | ✅ 관리 불필요 |
| ❌ 환경 변수 4개 설정 | ✅ 설정 불필요 |
| ❌ 토큰 만료 처리 | ✅ 만료 없음 |
| ✅ 파일 목록 조회 가능 | ❌ 목록 조회 불가 |
| 복잡도: ⭐⭐⭐⭐⭐ | 복잡도: ⭐ |

---

## 🔧 설치 (간단)

### 환경 변수

`.env` 파일에 **Gemini API 키만** 필요:

```env
# Gemini API Key (필수)
GEMINI_API_KEY=your-gemini-api-key-here

# Google Drive는 설정 불필요!
```

### 패키지 설치

```bash
cd elysia-server
bun add @google/generative-ai
```

완료! Drive API 관련 패키지 불필요 ✨

---

## 📊 지원하는 URL 형식

```javascript
// ✅ 지원
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
https://drive.google.com/open?id=FILE_ID
https://drive.google.com/uc?id=FILE_ID
FILE_ID (직접 입력)

// ❌ 미지원
https://drive.google.com/drive/folders/FOLDER_ID  (폴더 불가)
비공개 파일 (공유 설정 필요)
```

---

## ⚠️ 주의사항

### 1. 파일 공유 설정 필수

**반드시** 파일을 공개로 설정해야 합니다:

```
공유 → "링크가 있는 모든 사용자" → "보기 권한"
```

공개 설정 안 하면 403 에러:
```
Error: File is not publicly accessible. 
Please set sharing to 'Anyone with the link can view'
```

### 2. 파일 크기 제한

- ✅ 30MB: 문제없음
- ✅ 100MB 이하: OK
- ❌ 100MB 초과: 에러 (Gemini 제한)

### 3. 데이터 보안

- 공개 링크는 **누구나 접근 가능**
- 민감한 개인정보는 업로드하지 마세요
- 테스트 후 공유 설정 해제 권장

---

## 💡 실제 사용 예시

### 예시 1: 30MB 뷰티 리드 DB

```bash
# 1. Drive에 업로드
파일: beauty-leads-korea.csv (30MB)

# 2. 공유 설정
"링크가 있는 모든 사용자" → 복사

# 3. URL 붙여넣기
https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view

# 4. 메타데이터
국가: South Korea
지역: Asia
업종: beauty
출처: Beauty-DB-2025-Q1

# 5. 가져오기 클릭
✅ 성공! 15,234개 리드 등록
```

### 예시 2: 리드 검색

```bash
# 검색 쿼리
"서울 강남구에서 화장품을 수입하는 유통업체"

# 결과
- ABC Beauty: 강남구, 화장품 수입 전문
  신뢰도: 94% | 이유: 지역과 업종 정확히 일치

- XYZ Trading: 강남, 뷰티 제품 도매
  신뢰도: 89% | 이유: 유사 업종, 지역 일치
```

---

## 🛠️ 기술 상세

### 다운로드 프로세스

```
사용자가 URL 입력
    ↓
File ID 추출 (정규식)
    ↓
공개 다운로드 URL 생성:
https://drive.google.com/uc?export=download&id=FILE_ID
    ↓
fetch로 다운로드 (인증 헤더 불필요)
    ↓
Buffer로 변환
    ↓
Gemini File Search Store로 업로드
    ↓
자동 RAG 구축 (Google이 처리)
    ↓
검색 가능! 🎯
```

### API 엔드포인트

```http
POST /api/v1/admin/gemini-search/drive/import-url
Content-Type: application/json

{
  "workspaceId": "uuid",
  "driveUrl": "https://drive.google.com/file/d/FILE_ID/view",
  "metadata": {
    "country": "South Korea",
    "region": "Asia",
    "vertical": "beauty"
  }
}
```

응답:
```json
{
  "success": true,
  "data": {
    "fileName": "beauty-leads-korea.csv",
    "totalRows": 15234,
    "storeName": "stores/lead-db-workspace-id",
    "message": "CSV uploaded and indexed in File Search Store"
  }
}
```

---

## 💰 비용 (동일)

| 항목 | 비용 |
|------|------|
| **30MB 인덱싱 (1회)** | $1.13 |
| **검색 1회** | $0.001 (0.1센트) |
| **월 1만 건 검색** | $10 |

**Drive 다운로드**: 무료 ✅

---

## 🎉 결론

**Google Drive URL 방식이 훨씬 간단합니다!**

- ✅ API 인증 불필요
- ✅ 토큰 관리 불필요
- ✅ 환경 변수 1개만 (Gemini API Key)
- ✅ 3단계로 완료 (업로드 → URL 복사 → 가져오기)

**추천**: 프로덕션에서도 이 방식 사용 권장!

---

## 📝 체크리스트

- [ ] Gemini API 키 발급 및 설정
- [ ] Drive에 CSV 업로드
- [ ] 파일 공유 설정: "링크가 있는 모든 사용자"
- [ ] URL 복사
- [ ] Gemini Search에서 가져오기
- [ ] 검색 테스트
- [ ] 엑셀 다운로드

완료! 🚀

