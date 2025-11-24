# Gemini Lead Search - 빠른 시작 가이드 ⚡

## 🎯 목표

Google Drive에 있는 30MB 리드 데이터를 **3단계**로 AI 검색 가능하게 만들기!

---

## ⏱️ 5분 설치

### 1. 패키지 설치 (30초)

```bash
cd elysia-server
bun add @google/generative-ai
```

### 2. API 키 설정 (1분)

`.env` 파일에 추가:
```env
GEMINI_API_KEY=your-key-here
```

**API 키 발급**: https://aistudio.google.com/app/apikey

### 3. 서버 시작 (30초)

```bash
cd elysia-server
bun run dev

# 다른 터미널
cd admin
npm run dev
```

완료! 🎉

---

## 🚀 사용 방법 (3단계)

### Step 1: Google Drive에 파일 공유

1. Drive에 CSV 업로드 (30MB)
2. 우클릭 → **공유**
3. **"링크가 있는 모든 사용자"** 선택
4. **"링크 복사"**

### Step 2: Gemini로 가져오기

1. 브라우저: `http://localhost:5173`
2. 사이드바 → **"Gemini Search"**
3. **"Drive 가져오기"** 탭
4. URL 붙여넣기
5. 메타데이터 입력 (선택):
   - 국가: South Korea
   - 업종: bedding / beauty
6. **"가져오기"** 클릭

### Step 3: 검색!

1. **"검색"** 탭
2. 쿼리 입력:
   ```
   "서울에서 침구를 도매로 판매하는 업체"
   ```
3. **"검색"** 클릭
4. 결과 확인 + 엑셀 다운로드

끝! 🎊

---

## 💡 핵심 특징

| 특징 | 설명 |
|------|------|
| **완전 관리형 RAG** | Google이 자동으로 벡터 DB 구축 |
| **시맨틱 검색** | 의미 기반 검색 (키워드 X) |
| **API 인증 불필요** | Drive URL만 복사하면 OK |
| **저렴한 비용** | 30MB 인덱싱 $1.13, 검색 1회 0.1센트 |

---

## 📊 비용

| 항목 | 비용 |
|------|------|
| 30MB 인덱싱 (1회) | $1.13 |
| 검색 1만 건/월 | $10 |
| **총** | **$11.13 / 월** |

매우 저렴! 💰

---

## ⚠️ 주의사항

### ✅ 반드시 해야 할 것

1. Drive 파일을 **"링크가 있는 모든 사용자"**로 공유
2. Gemini API 키 설정
3. 워크스페이스 선택 (All 말고 특정 워크스페이스)

### ❌ 하지 말아야 할 것

1. 비공개 파일 업로드 시도 (403 에러)
2. 100MB 초과 파일 (에러)
3. 민감한 개인정보 업로드

---

## 🎯 검색 예시

### 지역 검색
```
"서울 강남구에서 침구를 판매하는 업체"
```

### 업종 검색
```
"부산의 화장품 수입 유통업체"
```

### 비즈니스 모델 검색
```
"호텔에 납품하는 B2B 침구 제조업체"
```

### 복합 조건
```
"온라인으로도 판매하고 있는 경기도의 뷰티 유통업체"
```

---

## 📚 자세한 문서

| 문서 | 용도 |
|------|------|
| **GEMINI_DRIVE_URL_SIMPLE.md** | Drive URL 방식 (추천!) |
| GEMINI_SEARCH_SETUP.md | 기본 사용 가이드 |
| GEMINI_DRIVE_SETUP.md | API 인증 방식 (복잡) |

---

## 🆘 문제 해결

### "Invalid Drive URL"
→ URL 형식 확인: `/file/d/FILE_ID/view`

### "File is not publicly accessible"
→ Drive 공유 설정: "링크가 있는 모든 사용자"

### "Gemini API key is not configured"
→ `.env`에 `GEMINI_API_KEY` 추가 후 서버 재시작

### 검색 결과가 없음
→ 쿼리를 더 구체적으로, 메타데이터 필터 추가

---

## 🎉 완료!

이제 30MB 리드 데이터를 AI로 스마트하게 검색할 수 있습니다!

**다음 단계**:
1. 더 많은 파일 업로드 (최대 20GB per store)
2. 다양한 검색 쿼리 테스트
3. 검색 결과 엑셀 다운로드
4. 팀과 공유! 🚀

---

**문의**: 개발팀 📧

