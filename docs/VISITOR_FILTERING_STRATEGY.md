# Visitor Analytics 필터링 전략 제안서

**작성일**: 2026-01-19
**목적**: 진짜 관심있는 잠재 고객만 정확히 식별하기 위한 필터링 전략

---

## 1. 현재 트래픽 분석 결과

### 1.1 트래픽 품질 분류

| 카테고리 | 세션 수 | 비율 | 의미 |
|----------|---------|------|------|
| ISP (일반 사용자) | 155 | 66.52% | 개인 인터넷 사용자 (KT, SK, LG 등) |
| 데이터센터/클라우드 | 34 | 14.59% | 봇/크롤러 가능성 높음 |
| Abuser/Proxy | 21 | 9.01% | 의심스러운 트래픽 |
| **Business (잠재 고객)** | **13** | **5.58%** | **진짜 B2B 리드 후보** |
| Government | 2 | 0.86% | 정부 기관 |
| Education | 2 | 0.86% | 교육 기관 |

### 1.2 핵심 발견사항

**문제 1: ACEVILLE PTE.LTD. (싱가포르) - 확실한 크롤러**
- 22개 세션, 22개 다른 IP (43.173.x.x 대역)
- 모든 Chrome 버전이 다름 (105~133) → User-Agent 조작
- 14개가 Proxy/Abuser 플래그
- 내부 rinda.ai에서만 유입 → 사이트 전체 스크래핑

**문제 2: 클라우드/호스팅 트래픽**
- NAVER Cloud, AWS, Google Cloud 등에서 12+6+3 = 21건
- 대부분 봇, SEO 도구, 또는 자동화된 접근

**문제 3: SEO 도구 트래픽**
- Dataforseo OU (hetzner.com)
- IPXO 관련 트래픽
- BuyVM (저렴한 VPS, 봇에 자주 사용)

---

## 2. 제외 전략 제안

### 2.1 즉시 제외해야 할 도메인 (수동 등록)

```
aceville.net        # 크롤러 확정 (싱가포르)
buyvm.net           # 저가 VPS, 봇 트래픽
ipxo.com            # IP 임대 서비스
hetzner.com         # SEO 도구 서버
datalix.de          # 데이터 수집 업체
artikel10.org       # Proxy 서비스
abuseradar.com      # 악성 트래픽
gateway.wiki        # VPS 호스팅
code200.io          # 호스팅 서비스
acedatacenters.com  # 데이터센터
```

### 2.2 자동 제외 조건 (백엔드 로직)

현재 `visitor.service.ts`에 추가 권장:

```typescript
// 자동 제외 조건
interface AutoExcludeConditions {
  // 1. visitor_type 기반
  excludeVisitorTypes: ['hosting'],  // 호스팅은 기본 제외

  // 2. 플래그 기반
  excludeFlags: {
    is_datacenter: true,   // 데이터센터 IP
    is_abuser: true,       // 악성 IP
    is_proxy: true,        // 프록시 사용
    is_tor: true,          // 토르 네트워크
  },

  // 3. 패턴 기반 (크롤러 탐지)
  excludePatterns: {
    sameCompanyDifferentIPs: 5,  // 같은 회사에서 5개 이상 다른 IP → 봇
    internalReferrerOnly: true,   // 내부에서만 유입 + 데이터센터 = 크롤러
  }
}
```

### 2.3 프론트엔드 필터 UI 제안

```
┌─────────────────────────────────────────────────┐
│ 🔍 방문자 필터                                   │
├─────────────────────────────────────────────────┤
│ ☑️ ISP 트래픽 제외 (일반 개인 사용자)            │
│ ☑️ 호스팅/클라우드 제외 (봇 가능성)              │  ← 추가 필요
│ ☑️ 의심 트래픽 제외 (Proxy/VPN/Abuser)          │  ← 추가 필요
│ ☐ 내 회사 도메인 제외                           │
├─────────────────────────────────────────────────┤
│ 📊 결과: 17개 잠재 리드 (Business + Gov + Edu)   │
└─────────────────────────────────────────────────┘
```

---

## 3. 구현 전략

### 3.1 Phase 1: 즉시 적용 (수동)

**visitor_excluded_companies 테이블에 추가할 도메인:**

| 도메인 | 사유 |
|--------|------|
| aceville.net | 크롤러 (22 IPs, proxy/abuser 플래그) |
| buyvm.net | 저가 VPS (봇 트래픽 소스) |
| ipxo.com | IP 임대 서비스 |
| hetzner.com | SEO 도구 호스팅 |
| datalix.de | 데이터 수집 업체 |

### 3.2 Phase 2: 백엔드 로직 추가

**Option A: visitor_type = 'hosting' 기본 제외**

```typescript
// visitor.service.ts의 listVisitorSessions에서
const HOSTING_EXCLUSION = sql`(${visitorSessions.visitorType} != 'hosting' OR ${visitorSessions.visitorType} IS NULL)`

// 필터에 추가
if (filters?.excludeHosting !== false) {
  conditions.push(HOSTING_EXCLUSION)
}
```

**Option B: 복합 조건 제외**

```typescript
// 데이터센터 + 호스팅 + Abuser/Proxy 제외
const NOISE_EXCLUSION = sql`
  NOT (
    ${visitorSessions.visitorType} = 'hosting'
    OR ${visitorSessions.isDatacenter} = true
    OR ${visitorSessions.isAbuser} = true
    OR ${visitorSessions.isProxy} = true
    OR ${visitorSessions.isTor} = true
  )
`
```

### 3.3 Phase 3: 크롤러 자동 탐지

```typescript
// 같은 회사에서 다수의 IP로 접근 시 자동 플래그
async function detectCrawlerPatterns(workspaceId: string) {
  const suspiciousCompanies = await db.execute(sql`
    SELECT
      company_domain,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(*) as sessions
    FROM visitor_sessions
    WHERE workspace_id = ${workspaceId}
      AND company_domain IS NOT NULL
    GROUP BY company_domain
    HAVING COUNT(DISTINCT ip_address) >= 5
      AND COUNT(DISTINCT ip_address) = COUNT(*)  -- 모든 세션이 다른 IP
  `)

  // 자동으로 제외 목록에 추가
  for (const company of suspiciousCompanies) {
    await addExcludedCompany({
      workspaceId,
      companyDomain: company.company_domain,
      reason: `Auto-detected crawler: ${company.unique_ips} unique IPs`,
      excludedBy: 'system'
    })
  }
}
```

---

## 4. 권장 필터 설정

### 4.1 기본 뷰 (Default)

```
✅ ISP 제외
✅ Hosting 제외
✅ Datacenter 제외
✅ Proxy/VPN/Tor 제외
✅ Abuser 제외
```

**결과**: Business + Government + Education만 표시
**예상 잔여**: ~17개 세션 (전체의 7.3%)

### 4.2 넓은 뷰 (All Potential Leads)

```
✅ ISP 제외
☐ Hosting 제외 (일부 SaaS 기업 포함 가능)
✅ Datacenter 제외
✅ Proxy/VPN/Tor 제외
✅ Abuser 제외
```

### 4.3 디버그 뷰 (모든 트래픽)

```
☐ 모든 필터 해제
```

---

## 5. 진짜 잠재 고객 (현재 데이터 기준)

외부 소스에서 유입된 순수 B2B 리드:

| 회사명 | 도메인 | 유형 | 국가 | 유입 경로 | 리드 스코어 |
|--------|--------|------|------|-----------|-------------|
| CMB 대전방송 | cmb.co.kr | Business | 한국 | Facebook | 90 |
| 충남대학교 | cnu.ac.kr | Education | 한국 | Google | 80 |
| 한양대학교 | hanyang.ac.kr | Education | 한국 | Google | 80 |
| 아프간 정부통신망 | afghantelecom.af | Government | 아프간 | Google | 80 |
| Perfect People | - | Business | 한국 | Google | 80 |

---

## 6. 즉시 실행 액션 아이템

### 6.1 DB에 제외 도메인 추가 (SQL)

```sql
INSERT INTO visitor_excluded_companies
  (workspace_id, company_domain, company_name, excluded_by, reason)
SELECT
  'YOUR_WORKSPACE_ID',
  domain,
  name,
  'YOUR_USER_ID',
  reason
FROM (VALUES
  ('aceville.net', 'ACEVILLE PTE.LTD.', 'Confirmed crawler - 22 unique IPs with rotating UA'),
  ('buyvm.net', 'BuyVM', 'Low-cost VPS - common bot source'),
  ('ipxo.com', 'IPXO', 'IP lease service - proxy traffic'),
  ('hetzner.com', 'Hetzner', 'Hosting used by SEO tools'),
  ('datalix.de', 'Datalix', 'Data collection service'),
  ('navercloudcorp.com', 'NAVER Cloud', 'Cloud hosting - bot traffic'),
  ('google.com', 'Google LLC', 'Googlebot and cloud services'),
  ('amazon.com', 'Amazon', 'AWS - bot/automation traffic'),
  ('amazonaws.com', 'AWS', 'AWS - bot/automation traffic')
) AS t(domain, name, reason);
```

### 6.2 백엔드 수정 (visitor.service.ts)

`VisitorFilters` 인터페이스에 추가:

```typescript
interface VisitorFilters {
  // ... existing fields
  excludeHosting?: boolean      // 호스팅 제외 (default: true)
  excludeDatacenter?: boolean   // 데이터센터 제외 (default: true)
  excludeSuspicious?: boolean   // Abuser/Proxy/Tor 제외 (default: true)
}
```

### 6.3 프론트엔드 (VisitorAnalyticsPage.tsx)

필터 UI에 체크박스 추가:

```tsx
<Checkbox
  label="호스팅/클라우드 제외"
  defaultChecked
  onChange={(e) => setFilters({...filters, excludeHosting: e.target.checked})}
/>
<Checkbox
  label="의심 트래픽 제외 (Proxy/Abuser)"
  defaultChecked
  onChange={(e) => setFilters({...filters, excludeSuspicious: e.target.checked})}
/>
```

---

## 7. 결론

### 현재 상태
- 전체 233개 세션 중 **진짜 잠재 고객은 약 17개 (7.3%)**
- 나머지 93%는 ISP(66%) + 봇/크롤러(27%)

### 권장 조치
1. **즉시**: aceville.net 등 확인된 크롤러 도메인 제외
2. **단기**: hosting/datacenter 자동 제외 로직 추가
3. **중기**: 크롤러 패턴 자동 탐지 기능 구현
4. **장기**: Lead Scoring 고도화 (행동 기반 점수)

### 기대 효과
- 노이즈 93% 제거 → 실제 리드만 집중 분석
- 고객 식별 정확도 향상
- 불필요한 리드 추적 비용 절감
