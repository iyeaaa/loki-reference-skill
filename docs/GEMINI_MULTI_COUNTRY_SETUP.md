# 🌍 Gemini 다국가 리드 데이터 업로드 가이드

> **목표**: 여러 국가의 리드 데이터를 Gemini File Search Store에 업로드하여 글로벌 리드 검색 시스템 구축

---

## 📋 목차

1. [개요](#개요)
2. [현재 상태](#현재-상태)
3. [다국가 데이터 업로드 전략](#다국가-데이터-업로드-전략)
4. [단계별 가이드](#단계별-가이드)
5. [검색 최적화 팁](#검색-최적화-팁)
6. [문제 해결](#문제-해결)

---

## 개요

### 왜 여러 국가 데이터가 필요한가?

- **검색 품질 향상**: 더 많은 데이터 = 더 정확한 AI 검색
- **글로벌 커버리지**: 다양한 시장의 리드 발굴 가능
- **테스트 다양성**: 여러 언어/형식의 데이터로 Gemini 성능 검증

### 시스템 특징

- ✅ **완전 관리형 RAG**: Google이 자동으로 임베딩/벡터화
- ✅ **자동 중복 제거**: 이메일 기반 중복 자동 제거
- ✅ **메타데이터 지원**: 국가/지역/업종별 분류 가능
- ✅ **대용량 지원**: Store당 최대 20GB

---

## 현재 상태

### ✅ 업로드 완료

| 국가 | 문서 | 리드 수 | 업로드 날짜 | Store Name |
|------|------|---------|-------------|------------|
| 🇮🇩 인도네시아 | Beauty-DB-Indonesia.csv | ~1,000 | 2025-01-XX | Lead DB - {workspaceId} |

### 📝 업로드 예정 추천

| 우선순위 | 국가 | 추천 이유 | 예상 리드 수 |
|---------|------|-----------|--------------|
| 🔥 High | 🇺🇸 미국 | 최대 시장, 영어 데이터로 테스트 용이 | 10,000+ |
| 🔥 High | 🇩🇪 독일 | 유럽 최대 시장, 비영어권 테스트 | 5,000+ |
| 🔥 High | 🇰🇷 한국 | 한국어 데이터, 로컬 시장 | 3,000+ |
| ⚡ Medium | 🇯🇵 일본 | 아시아 주요 시장 | 5,000+ |
| ⚡ Medium | 🇬🇧 영국 | 유럽 주요 영어권 | 3,000+ |
| ⚡ Medium | 🇫🇷 프랑스 | 유럽 주요 시장 | 2,000+ |
| 💡 Low | 🇦🇺 호주 | 오세아니아 시장 | 1,000+ |
| 💡 Low | 🇨🇦 캐나다 | 북미 추가 커버리지 | 1,000+ |

---

## 다국가 데이터 업로드 전략

### 전략 1: 단일 Store에 모든 국가 통합 (권장 ✅)

```
fileSearchStores/lead-db-workspace123
  ├── USA-Beauty-Leads.csv (10,000 rows)
  ├── Germany-Beauty-Leads.csv (5,000 rows)
  ├── Korea-Beauty-Leads.csv (3,000 rows)
  ├── Japan-Beauty-Leads.csv (5,000 rows)
  └── Indonesia-Beauty-Leads.csv (1,000 rows)
  
  Total: 24,000 leads in ONE Store
```

**장점**:
- ✅ 단일 검색으로 모든 국가 커버
- ✅ 국가 간 유사 리드 발견 가능
- ✅ 관리 단순화

**단점**:
- ⚠️ 특정 국가만 검색 시 필터링 필요
- ⚠️ 대용량 데이터 처리 시간 증가

**메타데이터 예시**:
```json
{
  "country": "USA",
  "region": "North America",
  "vertical": "beauty",
  "source": "Beauty-DB-2025",
  "language": "en"
}
```

---

### 전략 2: 국가별 별도 Store (선택적)

```
fileSearchStores/lead-db-usa-workspace123
  └── USA-Beauty-Leads.csv

fileSearchStores/lead-db-germany-workspace123
  └── Germany-Beauty-Leads.csv

fileSearchStores/lead-db-korea-workspace123
  └── Korea-Beauty-Leads.csv
```

**장점**:
- ✅ 국가별 독립적 관리
- ✅ 특정 국가 데이터만 업데이트 용이
- ✅ 검색 속도 최적화

**단점**:
- ⚠️ 검색 시 여러 Store 지정 필요
- ⚠️ 관리 복잡도 증가

**사용 시나리오**:
- 국가별 데이터 업데이트가 빈번한 경우
- 특정 국가만 집중 검색하는 경우
- 데이터 보안/격리가 필요한 경우

---

## 단계별 가이드

### Step 1: 데이터 준비

#### 1.1 CSV 파일 요구사항

```csv
Full name,Company Name,Company Industry,Company Size,Emails,Company Website,Job title,Location
John Doe,ABC Corp,Technology,51-200,john@abc.com,https://abc.com,CEO,"New York, USA"
Jane Smith,XYZ Inc,Manufacturing,201-500,jane@xyz.com,https://xyz.com,CTO,"Berlin, Germany"
```

**필수 컬럼**:
- `Company Name` 또는 `companyName`
- `Emails` 또는 `email`

**권장 컬럼**:
- `Company Industry` (검색 정확도 향상)
- `Location` 또는 `Country` (지역 필터링)
- `Company Website` (추가 검증)

#### 1.2 데이터 정제 체크리스트

```bash
# Python으로 CSV 정제 예시
import pandas as pd

df = pd.read_csv('raw-leads.csv')

# 1. 이메일 없는 행 제거
df = df[df['Emails'].notna()]

# 2. 중복 이메일 제거 (시스템이 자동으로 하지만 미리 하면 더 빠름)
df = df.drop_duplicates(subset=['Emails'])

# 3. 빈 컬럼 제거
df = df.dropna(axis=1, how='all')

# 4. 회사명 필수
df = df[df['Company Name'].notna()]

# 5. 국가 정보 추가 (없으면)
df['Country'] = 'USA'

# 6. 저장
df.to_csv('clean-leads.csv', index=False)
```

---

### Step 2: Google Drive 업로드 (권장)

#### 2.1 Google Drive 준비

1. **폴더 생성**
   ```
   My Drive/
   └── Lead-Database/
       ├── USA-Beauty-Leads-2025.csv
       ├── Germany-Beauty-Leads-2025.csv
       ├── Korea-Beauty-Leads-2025.csv
       └── Japan-Beauty-Leads-2025.csv
   ```

2. **공유 설정**
   - 파일 우클릭 → "공유"
   - "링크가 있는 모든 사용자" 선택
   - "뷰어" 권한으로 설정
   - 링크 복사

#### 2.2 프론트엔드에서 업로드

1. **Gemini Search 페이지 접속**
   ```
   http://your-domain/gemini-search
   ```

2. **"Google Drive 가져오기" 탭 선택**

3. **파일 정보 입력**
   ```
   Drive URL: https://drive.google.com/file/d/YOUR_FILE_ID/view
   
   메타데이터:
   - 국가: USA
   - 지역: North America
   - 업종: beauty
   - 출처: Beauty-DB-2025
   ```

4. **"Drive에서 가져오기" 클릭**

5. **진행 상황 확인**
   - 업로드: ~30초 (30MB 기준)
   - 인덱싱: ~2-3분
   - ✅ 완료 메시지 확인

---

### Step 3: 여러 국가 데이터 추가

#### 전략 A: 순차적 업로드 (안전 ✅)

```bash
# 1일차: 미국 데이터
USA-Beauty-Leads.csv → Upload → ✅ 성공 확인

# 2일차: 독일 데이터  
Germany-Beauty-Leads.csv → Upload → ✅ 성공 확인

# 3일차: 한국 데이터
Korea-Beauty-Leads.csv → Upload → ✅ 성공 확인
```

**장점**: 각 업로드 검증 가능, 문제 발생 시 롤백 용이

#### 전략 B: 일괄 업로드 (빠름 ⚡)

```bash
# 한 번에 여러 파일 업로드
for file in *.csv; do
  curl -X POST "http://api/gemini-search/upload" \
    -F "file=@$file" \
    -F "workspaceId=xxx" \
    -F "metadata={\"country\":\"...\"}"
done
```

**장점**: 시간 절약

---

### Step 4: 업로드 검증

#### 4.1 Store 목록 확인

```bash
GET /api/v1/admin/gemini-search/stores
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "name": "fileSearchStores/abc123",
        "displayName": "Lead DB - workspace123",
        "fileCount": 5,
        "createTime": "2025-01-15T10:00:00Z",
        "updateTime": "2025-01-15T15:30:00Z"
      }
    ],
    "total": 1
  }
}
```

#### 4.2 테스트 검색

```javascript
// 국가별 검색 테스트
const testQueries = [
  { query: "beauty retail companies in USA", expected: "USA 리드 반환" },
  { query: "German skincare manufacturers", expected: "독일 리드 반환" },
  { query: "한국의 화장품 도매업체", expected: "한국 리드 반환" },
]

for (const test of testQueries) {
  const result = await searchLeads(test.query)
  console.log(`✅ ${test.query}: ${result.totalResults} results`)
}
```

---

## 검색 최적화 팁

### 1. 메타데이터 활용

```javascript
// 검색 시 필터 사용
POST /api/v1/admin/gemini-search/search
{
  "workspaceId": "xxx",
  "query": "beauty retail companies",
  "filters": {
    "country": "USA",           // 🎯 미국만 검색
    "vertical": "beauty",       // 🎯 뷰티 업종만
    "region": "North America"   // 🎯 북미 지역만
  },
  "limit": 50
}
```

### 2. 쿼리 최적화

| ❌ 나쁜 쿼리 | ✅ 좋은 쿼리 | 이유 |
|------------|------------|------|
| "companies" | "beauty retail companies in Germany" | 구체적 |
| "email" | "German skincare manufacturers with email" | 명확한 의도 |
| "find leads" | "B2B beauty suppliers in Asia" | 검색 가능한 키워드 |

### 3. 다국어 검색

Gemini는 **다국어 자동 인식**을 지원합니다:

```javascript
// 영어로 검색해도 한국 데이터 찾음
query: "Korean beauty companies"  → 한국 리드 반환

// 한국어로 검색해도 가능
query: "독일 화장품 제조사"        → 독일 리드 반환

// 혼합 검색
query: "Japanese manufacturers with email in Tokyo"  → 일본 리드 반환
```

---

## 문제 해결

### 문제 1: 업로드 시간이 너무 오래 걸림

**원인**: 파일이 너무 크거나 중복 데이터가 많음

**해결**:
```bash
# 1. 파일 크기 확인
ls -lh your-file.csv

# 2. 행 수 확인
wc -l your-file.csv

# 3. 10만 행 이하로 분할
split -l 100000 your-file.csv part-
```

### 문제 2: 특정 국가 데이터가 검색 안 됨

**원인**: 메타데이터 누락 또는 오타

**해결**:
```javascript
// 업로드 시 메타데이터 확인
metadata: {
  country: "USA",          // ✅ 정확한 국가명
  region: "North America", // ✅ 올바른 지역
  vertical: "beauty"       // ✅ 일관된 업종 이름
}
```

### 문제 3: 검색 결과 품질 낮음

**원인**: 데이터 품질 문제

**체크리스트**:
- [ ] Company Industry 필드 있는가?
- [ ] Location/Country 필드 있는가?
- [ ] 이메일 형식이 올바른가?
- [ ] 회사명이 명확한가?

---

## 다음 단계

### 1. 추가 국가 업로드 계획

```markdown
### 2025년 Q1 업로드 계획

- [x] 🇮🇩 인도네시아 (완료)
- [ ] 🇺🇸 미국 (1월 말)
- [ ] 🇩🇪 독일 (2월 초)
- [ ] 🇰🇷 한국 (2월 중)
- [ ] 🇯🇵 일본 (2월 말)
- [ ] 🇬🇧 영국 (3월 초)
```

### 2. 검색 품질 모니터링

```sql
-- 검색 로그 분석 (추후 구현)
SELECT 
  query,
  COUNT(*) as search_count,
  AVG(total_results) as avg_results,
  AVG(processing_time) as avg_time
FROM gemini_search_logs
GROUP BY query
ORDER BY search_count DESC
LIMIT 20;
```

### 3. 자동화 (선택적)

```bash
# Cron job으로 주기적 업데이트
# 매주 월요일 오전 2시에 새 데이터 업로드
0 2 * * 1 /scripts/upload-weekly-leads.sh
```

---

## 📚 관련 문서

- [Gemini Drive Setup](./GEMINI_DRIVE_SETUP.md)
- [Gemini Search Quality Guide](./GEMINI_SEARCH_QUALITY_IMPROVEMENTS.md)
- [API Documentation](../elysia-server/README.md)

---

## 🆘 도움이 필요하신가요?

문제가 발생하면:

1. **로그 확인**: Elysia 서버 로그에서 에러 메시지 확인
2. **Store 상태 확인**: `/api/v1/admin/gemini-search/stores` 호출
3. **테스트 검색**: 간단한 쿼리로 시스템 정상 작동 확인

---

**마지막 업데이트**: 2025-01-15  
**작성자**: AI Assistant  
**버전**: 1.0

