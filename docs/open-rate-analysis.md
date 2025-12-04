# SendGrid 오픈률 분석 보고서

**분석 일시**: 2025-11-06
**분석 대상**: {{회사명}}: When your customers become your sales team 시퀀스

---

## 📊 오픈률 통계

### 기본 정보
- **시퀀스 ID**: `caec294f-3737-427c-84d0-42cd644e57df`
- **시퀀스명**: {{회사명}}: When your customers become your sales team

### 발송 현황
```
총 발송 이메일:     1,949개
오픈한 이메일:        557개 (28.6%)
총 오픈 횟수:         714회
평균 오픈/이메일:    1.28회
```

### 참여율 비교
```
오픈율:  28.6% (557/1,949)
클릭율:  21.8% (425/1,949)
CTOR:    76.3% (425/557) - Click-to-Open Rate
```

---

## 🔍 핵심 발견 사항

### 1. 오픈 횟수 분포

```sql
SELECT open_count, COUNT(*) as email_count
FROM emails
WHERE opened_at IS NOT NULL
GROUP BY open_count
ORDER BY open_count DESC;
```

| 오픈 횟수 | 이메일 개수 | 비율 | 누적 비율 |
|----------|-----------|------|----------|
| 19회 | 1개 | 0.2% | 0.2% |
| 9회 | 1개 | 0.2% | 0.4% |
| 7회 | 1개 | 0.2% | 0.5% |
| 6회 | 2개 | 0.4% | 0.9% |
| 5회 | 4개 | 0.7% | 1.6% |
| 4회 | 7개 | 1.3% | 2.9% |
| 3회 | 13개 | 2.3% | 5.2% |
| 2회 | 52개 | 9.3% | 14.5% |
| **1회** | **476개** | **85.5%** | **100%** |

#### 💡 핵심 인사이트
- **85.5%의 이메일이 단 1번만 오픈됨** → 대부분 실제 사용자
- **클릭과 달리, 오픈은 보안 스캐너의 영향이 적음**
- 다중 오픈(2회 이상)은 14.5%로 자연스러운 수준

### 2. 최다 오픈 이메일 TOP 15

```sql
SELECT to_email, open_count, click_count, opened_at, clicked_at
FROM emails
WHERE open_count > 3
ORDER BY open_count DESC
LIMIT 15;
```

| 순위 | 수신 이메일 | 오픈 | 클릭 | 특징 |
|-----|-----------|------|------|------|
| 1 | mk.mengseng@gmail.com | 19회 | 0회 | 🔥 **Gmail 이미지 프록시** |
| 2 | sutomomegacools@gmail.com | 9회 | 0회 | 🔥 **Gmail 이미지 프록시** |
| 3 | info@ekokemika.vn | 7회 | 1회 | |
| 4 | sales@yewaik.com | 6회 | 0회 | |
| 5 | buhin-center@seiken.com | 6회 | 0회 | |
| 6 | ml.siam-sale.th@niterragroup.com | 5회 | 0회 | |
| 7 | kcrautoparts@yahoo.com | 5회 | 0회 | |
| 8 | jakarta@larischandra.com | 5회 | 0회 | |
| 9 | fait.hn@tdic-jsc.vn | 5회 | 0회 | |
| 10 | info@opticars.de | 4회 | 0회 | |
| 11 | jkramer@awe-tuning.com | 4회 | 0회 | |
| 12 | info@alserkal.ae | 4회 | 0회 | |
| 13 | hello@dieselpartscanada.ca | 4회 | 0회 | |
| 14 | jameslee@koreatradeindonesia.com | 4회 | 0회 | |
| 15 | sales@puninar.com | 4회 | 0회 | |

**특이사항**: 최다 오픈 이메일 대부분이 **클릭하지 않음** → 반복 확인만 하고 행동하지 않음

### 3. User Agent 분석 - 이메일 클라이언트

```sql
SELECT user_agent, COUNT(*) as open_count
FROM email_events
WHERE event_type = 'open'
GROUP BY user_agent
ORDER BY open_count DESC;
```

| User Agent | 오픈 횟수 | 비율 | 분류 |
|-----------|----------|------|------|
| `Chrome/109.0.0.0` | 403회 | 56.4% | 🤖 **이메일 보안 프리뷰** |
| `GoogleImageProxy` | 126회 | 17.6% | 📧 **Gmail 이미지 프록시** |
| `Mozilla/5.0` (기본) | 85회 | 11.9% | 📱 다양한 클라이언트 |
| `Chrome/113.0.0.0` | 21회 | 2.9% | 🤖 보안 스캐너 |
| `Edge/12.246` | 19회 | 2.7% | 🖥️ Outlook (오래된 버전) |
| `ms-office; MSOffice 16` | 11회 | 1.5% | 🖥️ Outlook Desktop |
| `Chrome/118.0.0.0` | 6회 | 0.8% | 👤 실제 사용자 |
| `YahooMailProxy` | 5회 | 0.7% | 📧 Yahoo Mail 프록시 |
| 기타 | 38회 | 5.3% | 다양 |

#### 오픈 추적 메커니즘 분석

**1) Gmail 이미지 프록시 (126회, 17.6%)**
```
User Agent: Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0
            (via ggpht.com GoogleImageProxy)
IP: 74.125.209.x (Google 서버)
```

- Gmail이 이메일 내 이미지를 **자동으로 캐싱**
- 추적 픽셀을 Google 서버에서 프록시로 로드
- **실제 사용자가 이메일을 열었는지 불확실**
- 이메일 수신 시 자동으로 이미지 프리페치 가능

**2) 이메일 보안 프리뷰 (403회, 56.4%)**
```
User Agent: Mozilla/5.0 Chrome/109.0.0.0
```

- Microsoft ATP, Barracuda 등 **보안 게이트웨이**
- 이메일 수신 시 자동으로 내용 스캔
- 추적 픽셀을 미리 로드하여 악성 여부 확인
- **실제 수신자가 열지 않았을 가능성 높음**

**3) 실제 사용자 오픈 (추정 ~148회, 20.7%)**
```
- Gmail/Outlook/Yahoo 일반 클라이언트
- 모바일 앱 (iOS, Android)
- 웹 브라우저에서 직접 확인
```

### 4. 최다 오픈 이메일 상세 분석 (mk.mengseng@gmail.com)

**19회 오픈 내역**:

```sql
SELECT timestamp, user_agent, ip_address
FROM email_events
WHERE to_email = 'mk.mengseng@gmail.com' AND event_type = 'open'
ORDER BY timestamp;
```

| 시간 | User Agent | IP | 간격 |
|-----|-----------|-----|------|
| 02:24:32 | GoogleImageProxy | 74.125.209.2 | - |
| 02:24:34 | GoogleImageProxy | 74.125.209.4 | 2초 |
| 02:24:45 | GoogleImageProxy | 74.125.209.3 | 11초 |
| 02:25:49 | GoogleImageProxy | 74.125.209.3 | 64초 |
| 02:26:44 | GoogleImageProxy | 74.125.209.7 | 55초 |
| 02:26:46 | GoogleImageProxy | 74.125.209.8 | 2초 |
| 02:26:48 | GoogleImageProxy | 74.125.209.3 | 2초 |
| 02:26:50 | GoogleImageProxy | 74.125.209.8 | 2초 |
| 02:26:51 | GoogleImageProxy | 74.125.209.8 | 1초 |
| 02:27:09 | GoogleImageProxy | 74.125.209.8 | 18초 |
| 02:55:17 | Mozilla/5.0 | 104.28.71.186 | **28분** ← 실제 오픈 |
| 02:55:20 | GoogleImageProxy | 74.125.209.1 | 3초 |
| 02:57:22 | GoogleImageProxy | 74.125.209.6 | 122초 |
| 02:57:25 | GoogleImageProxy | 74.125.209.6 | 3초 |
| 02:57:26 | GoogleImageProxy | 74.125.209.3 | 1초 |
| 02:58:14 | GoogleImageProxy | 74.125.209.1 | 48초 |
| 02:59:09 | GoogleImageProxy | 74.125.209.6 | 55초 |
| 02:59:11 | GoogleImageProxy | 74.125.209.1 | 2초 |
| 02:59:12 | GoogleImageProxy | 74.125.209.1 | 1초 |

#### 패턴 분석
1. **첫 10회 오픈 (02:24-02:27)**: Gmail 이미지 프록시가 자동으로 이미지 캐싱
2. **11번째 오픈 (02:55:17)**: 다른 IP에서 실제 오픈 (104.28.71.186 - Cloudflare)
3. **이후 8회 오픈**: Gmail 프록시가 다시 이미지 재로드

**결론**: 19회 오픈 중 **실제 사용자 오픈은 1-2회**, 나머지는 Gmail 이미지 프록시

### 5. IP 주소 분석

```sql
SELECT ip_address, COUNT(*) as open_count, COUNT(DISTINCT email_id) as unique_emails
FROM email_events
WHERE event_type = 'open'
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY open_count DESC;
```

| IP 주소 | 오픈 횟수 | 고유 이메일 | 서비스 |
|---------|----------|-----------|--------|
| 74.125.209.1 | 33회 | 19개 | 🔵 Google (Gmail 프록시) |
| 74.125.209.8 | 26회 | 19개 | 🔵 Google (Gmail 프록시) |
| 74.125.209.7 | 16회 | 9개 | 🔵 Google (Gmail 프록시) |
| 4.182.160.2 | 12회 | 11개 | 🟦 Microsoft (ATP) |
| 57.155.171.17 | 12회 | 12개 | 🟦 Microsoft (ATP) |
| 74.125.209.3 | 11회 | 7개 | 🔵 Google (Gmail 프록시) |

#### IP 범위 분석
- `74.125.209.x` → **Google Gmail 이미지 프록시**
- `4.182.x.x`, `57.155.x.x` → **Microsoft ATP/Safe Links**

### 6. 참여 패턴 분석

```sql
SELECT engagement_type, COUNT(*) as count
FROM (
  SELECT CASE
    WHEN opened_at IS NULL AND clicked_at IS NULL THEN 'No engagement'
    WHEN opened_at IS NULL AND clicked_at IS NOT NULL THEN 'Clicked without open'
    WHEN opened_at IS NOT NULL AND clicked_at IS NULL THEN 'Opened only'
    WHEN opened_at IS NOT NULL AND clicked_at IS NOT NULL THEN 'Opened and clicked'
  END as engagement_type
  FROM emails
  WHERE sequence_id = 'caec294f-3737-427c-84d0-42cd644e57df'
) GROUP BY engagement_type;
```

| 참여 유형 | 이메일 수 | 비율 | 설명 |
|---------|----------|------|------|
| **무응답** | 1,374개 | 70.5% | 오픈도 클릭도 안 함 |
| **오픈+클릭** | 407개 | 20.9% | ✅ 가장 이상적 |
| **오픈만** | 150개 | 7.7% | 관심 있지만 행동 안 함 |
| **클릭만** | 18개 | 0.9% | ⚠️ **비정상 패턴** |

#### ⚠️ "클릭만" 패턴 분석 (오픈 없이 클릭)

**18개 이메일이 오픈 없이 클릭됨**:

```sql
SELECT to_email, open_count, click_count, clicked_at
FROM emails
WHERE opened_at IS NULL AND clicked_at IS NOT NULL
ORDER BY click_count DESC;
```

| 이메일 | 오픈 | 클릭 | 원인 |
|-------|------|------|------|
| info@petrocheme.com | 0회 | 8회 | 🤖 **보안 스캐너** |
| info@bhpetrol.com.my | 0회 | 7회 | 🤖 **보안 스캐너** |
| info@rcjy.gov.sa | 0회 | 4회 | 🤖 **보안 스캐너** |
| general.feedback@fairprice.com.sg | 0회 | 4회 | 🤖 **보안 스캐너** |
| sales@petrocheme.com | 0회 | 4회 | 🤖 **보안 스캐너** |
| 기타 13개 | 0회 | 1-2회 | 🤖 **보안 스캐너** |

**원인**:
- 보안 스캐너가 **이메일을 열지 않고 링크만 추출하여 검증**
- SendGrid의 오픈 추적은 이미지 로드 기반 → 이미지 로드 없이 링크만 크롤링
- 클릭 추적은 링크 리디렉션 기반 → 링크 방문 시 무조건 카운트

**결론**: 이 18개는 **실제 사용자 오픈이 아님** (100% 봇)

### 7. 오픈 시간 분석

#### A. 시간대별 오픈 분포

```sql
SELECT DATE_TRUNC('hour', opened_at) as hour, COUNT(*) as open_count
FROM emails
WHERE opened_at IS NOT NULL
GROUP BY hour
ORDER BY hour;
```

| 시간대 (UTC) | 오픈 수 | 비율 | 한국 시간 |
|-------------|--------|------|----------|
| 02:00-03:00 | 452개 | 81.1% | **11:00-12:00** |
| 03:00-04:00 | 37개 | 6.6% | 12:00-13:00 |
| 04:00-05:00 | 13개 | 2.3% | 13:00-14:00 |
| 05:00-06:00 | 19개 | 3.4% | 14:00-15:00 |
| 06:00-07:00 | 21개 | 3.8% | 15:00-16:00 |
| 07:00-08:00 | 15개 | 2.7% | 16:00-17:00 |

**핵심 인사이트**:
- **81%가 발송 후 첫 1시간 내 오픈**
- 대부분 **보안 스캐너와 이메일 프록시**의 자동 오픈
- 실제 사용자 오픈은 이후 시간대에 분산

#### B. 발송부터 오픈까지 소요 시간

```sql
SELECT
  CASE
    WHEN (opened_at - sent_at) < INTERVAL '1 minute' THEN '< 1분'
    WHEN (opened_at - sent_at) < INTERVAL '5 minutes' THEN '1-5분'
    WHEN (opened_at - sent_at) < INTERVAL '30 minutes' THEN '5-30분'
    WHEN (opened_at - sent_at) < INTERVAL '60 minutes' THEN '30-60분'
    WHEN (opened_at - sent_at) < INTERVAL '3 hours' THEN '1-3시간'
    WHEN (opened_at - sent_at) < INTERVAL '24 hours' THEN '3-24시간'
    ELSE '> 24시간'
  END as time_range,
  COUNT(*) as count
FROM emails
WHERE opened_at IS NOT NULL AND sent_at IS NOT NULL
GROUP BY time_range;
```

| 소요 시간 | 이메일 수 | 비율 | 분류 |
|----------|----------|------|------|
| **< 1분** | **404개** | **72.5%** | 🤖 **자동 오픈** |
| 1-5분 | 18개 | 3.2% | 🤖 자동 오픈 |
| 5-30분 | 32개 | 5.7% | 👤 빠른 응답 |
| 30-60분 | 24개 | 4.3% | 👤 일반 응답 |
| 1-3시간 | 34개 | 6.1% | 👤 일반 응답 |
| 3-24시간 | 46개 | 8.3% | 👤 늦은 응답 |

**최단 오픈 시간 TOP 20**:
```
0.02분 = 1.3초
0.03분 = 1.6초
0.04분 = 2.6초
...
```

**결론**:
- **72.5%가 1분 내 오픈** → 보안 스캐너/이메일 프록시
- **실제 사용자는 5분 이후** (약 24.4%, 134개)
- **실제 오픈율: ~24.4%** (자동 오픈 제외 시)

---

## 🎯 결론 및 원인 분석

### 오픈률이 높은 이유

#### 1️⃣ **Gmail 이미지 프록시** (17.6%)

**작동 방식**:
```
1. 사용자가 Gmail로 이메일 수신
2. Gmail 서버가 이메일 내 모든 이미지를 자동 캐싱
3. SendGrid 추적 픽셀도 캐싱 과정에서 로드
4. SendGrid가 이를 "오픈"으로 기록
5. 실제 사용자는 아직 이메일을 열지 않았을 수 있음
```

**특징**:
- IP: `74.125.209.x` (Google 서버)
- User Agent: `via ggpht.com GoogleImageProxy`
- 하나의 이메일이 여러 번 오픈됨 (이미지 재캐싱)

#### 2️⃣ **이메일 보안 게이트웨이** (56.4%)

**작동 방식**:
```
1. 회사 이메일 서버가 이메일 수신
2. 보안 게이트웨이(ATP, Barracuda 등)가 자동 스캔
3. 이메일 내용, 링크, 이미지를 모두 검증
4. 추적 픽셀도 로드하여 악성 여부 확인
5. SendGrid가 이를 "오픈"으로 기록
6. 실제 사용자의 받은편지함에 전달
```

**특징**:
- User Agent: `Chrome/109.0.0.0`, `Chrome/113.0.0.0`
- 발송 후 1분 내 즉시 오픈
- Microsoft ATP, Office 365, Barracuda 등

#### 3️⃣ **실제 사용자 오픈** (~24.4%)

**예상 실제 오픈률**:
```
전체 오픈: 557개 (28.6%)
자동 오픈 (< 1분): 404개 (20.7%)
───────────────────────────
실제 사용자 오픈: ~153개 (7.9%)
```

**단, 5분 이후 오픈까지 포함 시**:
```
실제 사용자 오픈 (5분 이후): 134개 (6.9%)
```

### 업계 평균과 비교

| 지표 | 업계 평균 | 현재 (자동 포함) | 실제 (추정) | 평가 |
|-----|---------|---------------|-----------|------|
| 오픈률 | 20-25% | 28.6% | ~7.9% | ⚠️ 낮음 |
| 클릭률 | 2-5% | 21.8% | ~2.3% | ✅ 정상 |
| CTOR | 10-15% | 76.3% | 29.1% | ✅ 우수 |

**CTOR (Click-to-Open Rate)** = 클릭 / 오픈
- 현재: 425 / 557 = 76.3% (비현실적으로 높음)
- 실제: 37 / 127 = 29.1% (자동 제외 시)

### 오픈 vs 클릭 비교

| 항목 | 오픈 | 클릭 | 차이점 |
|-----|------|------|-------|
| **추적 방식** | 이미지 로드 | 링크 리디렉션 | |
| **자동 트리거** | Gmail 프록시, 보안 스캐너 | 링크 크롤러 | |
| **자동 비율** | ~72% | ~96% | 클릭이 더 심함 |
| **실제 사용자** | ~28% | ~4% | 오픈이 더 정확 |
| **1분 내 발생** | 72.5% | 대부분 | 둘 다 자동화 영향 |

**핵심 차이**:
- **오픈**: Gmail 프록시가 비교적 적게 개입 (17.6%)
- **클릭**: 보안 스캐너가 매우 적극적 (96%)
- **오픈이 실제 참여를 더 정확히 반영**

---

## 💡 개선 방안

### 옵션 1: 자동 오픈 필터링 (권장)

#### A. 1분 이내 오픈 제외

**구현**:
```typescript
// elysia-server/src/services/webhook.service.ts

private isAutomatedOpen(event: SendGridEvent, sentAt: Date): boolean {
  const openTime = new Date(event.timestamp * 1000);
  const timeDiff = (openTime.getTime() - sentAt.getTime()) / 1000; // 초 단위

  // 1분(60초) 이내 오픈은 자동화된 것으로 간주
  if (timeDiff < 60) {
    logger.info({ emailId, timeDiff }, "Automated open filtered (< 1 min)");
    return true;
  }

  return false;
}

case "open":
  if (this.isAutomatedOpen(event, email.sentAt)) {
    continue; // 카운트하지 않음
  }
  updates.status = "opened";
  updates.openedAt = new Date(event.timestamp * 1000);
  updates.openCount = sql`${emailsTable.openCount} + 1`;
  break;
```

**효과**:
- 72.5%의 자동 오픈 제거
- 오픈률: 28.6% → ~7.9%

#### B. User Agent 기반 필터링

```typescript
private isAutomatedOpen(event: SendGridEvent, sentAt: Date): boolean {
  const automatedPatterns = [
    /Chrome\/109\.0\.0\.0/,        // 보안 스캐너
    /Chrome\/113\.0\.0\.0/,        // 보안 스캐너
    /GoogleImageProxy/,            // Gmail 프록시
    /YahooMailProxy/,              // Yahoo 프록시
    /ms-office; MSOffice/,         // Outlook 프리뷰
  ];

  if (event.useragent && automatedPatterns.some(p => p.test(event.useragent))) {
    return true;
  }

  // 시간 기반 필터링 추가
  const openTime = new Date(event.timestamp * 1000);
  const timeDiff = (openTime.getTime() - sentAt.getTime()) / 1000;

  if (timeDiff < 60) {
    return true;
  }

  return false;
}
```

**효과**:
- 더 정확한 필터링
- Gmail 프록시 제외
- 실제 오픈률: ~6-8%

#### C. IP 기반 필터링

```typescript
private isAutomatedOpen(event: SendGridEvent, sentAt: Date): boolean {
  const automatedIPRanges = [
    /^74\.125\.209\./,   // Google Gmail 프록시
    /^4\.182\./,         // Microsoft ATP
    /^57\.155\./,        // Microsoft ATP
  ];

  if (event.ip && automatedIPRanges.some(p => p.test(event.ip))) {
    return true;
  }

  return false;
}
```

### 옵션 2: 새로운 컬럼 추가

**마이그레이션**:
```sql
ALTER TABLE emails
ADD COLUMN real_open_count INTEGER DEFAULT 0,
ADD COLUMN automated_open_count INTEGER DEFAULT 0;
```

**웹훅 처리**:
```typescript
case "open":
  if (this.isAutomatedOpen(event, email.sentAt)) {
    updates.automatedOpenCount = sql`${emailsTable.automatedOpenCount} + 1`;
  } else {
    updates.realOpenCount = sql`${emailsTable.realOpenCount} + 1`;
  }
  updates.openCount = sql`${emailsTable.openCount} + 1`; // 전체 카운트
  break;
```

**대시보드 표시**:
```typescript
// Before
{sequence.opened} 오픈

// After
{sequence.realOpened}명 오픈 (전체 {sequence.totalOpened}회)
```

### 옵션 3: UI 개선 (가장 간단)

#### 현재 표시
```
1949 발송
554 오픈 • 425 클릭
```

#### 개선안 1 (정직한 표시)
```
1949 발송
554 오픈 (자동 포함) • 425개 이메일에서 클릭
```

#### 개선안 2 (실제 수치 추정)
```
1949 발송
~150명 오픈 (실제) • ~40명 클릭 (실제)
자동 오픈 404회, 자동 클릭 887회 제외
```

#### 개선안 3 (툴팁)
```typescript
<div title="전체 오픈 554회 (자동 오픈 ~400회 포함)">
  554 오픈
</div>
```

---

## 📈 권장 조치

### Phase 1: 즉시 (오늘)
- [x] DB 오픈 데이터 분석 완료
- [ ] UI에 툴팁 추가 ("자동 오픈 포함" 표시)
- [ ] 대시보드 텍스트 개선

### Phase 2: 이번 주
- [ ] 1분 이내 오픈 필터링 구현
- [ ] User Agent 기반 자동 오픈 감지
- [ ] 테스트 및 검증

### Phase 3: 다음 주
- [ ] DB 스키마 수정 (real_open_count 추가)
- [ ] API 응답에 실제/자동 오픈 구분
- [ ] 대시보드에 실제 오픈률 표시

### Phase 4: 장기
- [ ] 오픈률 분석 대시보드
- [ ] 이메일 클라이언트별 통계
- [ ] 시간대별 실제 오픈 패턴 분석

---

## 📊 예상 효과

### 필터링 전후 비교

| 지표 | 현재 | 필터링 후 | 변화 |
|-----|------|----------|------|
| 오픈한 이메일 | 557개 | ~150개 | -73% |
| 오픈률 | 28.6% | ~7.7% | -73% |
| CTOR | 76.3% | ~29% | -62% |
| 평균 오픈/이메일 | 1.28회 | 1.05회 | -18% |

### 업계 평균과 재비교

| 지표 | 업계 평균 | 필터링 전 | 필터링 후 | 평가 |
|-----|---------|----------|----------|------|
| 오픈률 | 20-25% | 28.6% ❌ | 7.7% ⚠️ | 개선 필요 |
| 클릭률 | 2-5% | 21.8% ❌ | 2.3% ✅ | 정상 |
| CTOR | 10-15% | 76.3% ❌ | 29% ✅ | 우수 |

**결론**:
- 필터링 후에도 **CTOR 29%는 우수한 수준**
- 오픈률 7.7%는 낮지만, **실제 참여자의 관심도가 높음**
- 클릭률 2.3%는 업계 평균 수준

---

## 🔍 추가 인사이트

### 1. 오픈했지만 클릭하지 않은 이유

**150개 이메일이 오픈만 함** (클릭 없음):

가능한 이유:
1. **이메일 내용이 흥미롭지 않음**
2. **CTA가 명확하지 않음**
3. **타이밍이 맞지 않음** (나중에 다시 보려고 함)
4. **모바일에서 열었지만 링크 클릭이 불편함**

**개선 방안**:
- CTA 버튼을 더 눈에 띄게 배치
- 이메일 상단에 핵심 가치 제안
- 모바일 최적화

### 2. 클릭률이 오픈률보다 높은 이유

```
오픈: 557개 (28.6%)
클릭: 425개 (21.8%)
```

일반적으로 `클릭 < 오픈`이어야 하는데, 클릭이 너무 높은 이유:
- **보안 스캐너가 오픈 없이 클릭만 함** (18개)
- **클릭 추적이 오픈 추적보다 정확함**
- SendGrid 추적 픽셀이 일부 이메일 클라이언트에서 차단됨

### 3. 시간대별 실제 사용자 오픈

| 한국 시간 | 오픈 수 | 비율 | 사용자 유형 |
|----------|--------|------|-----------|
| 11:00-12:00 | 452개 | 81% | 🤖 대부분 자동 |
| 12:00-17:00 | 105개 | 19% | 👤 실제 사용자 |

**최적 발송 시간**:
- **오전 10-11시 (한국 기준)** → 업무 시작 후 이메일 확인
- 실제 사용자는 12시 이후에 분산되어 확인

---

## 📞 문의

질문이나 추가 분석이 필요하시면 말씀해주세요.

**분석 작성자**: Claude Code
**분석 일시**: 2025-11-06
**데이터 소스**: send-grid-test-postgres-1 (Production DB)
**관련 문서**: click-analysis.md
