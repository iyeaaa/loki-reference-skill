# IP → 회사 식별이 어려운 이유 (다각적 분석)

## 목차
1. [네트워크 인프라 구조적 관점](#1-네트워크-인프라-구조적-관점)
2. [IP 주소 할당 체계 관점](#2-ip-주소-할당-체계-관점)
3. [한국 특수 상황 분석](#3-한국-특수-상황-분석)
4. [IP → 회사 매핑의 기술적 한계](#4-ip--회사-매핑의-기술적-한계)
5. [B2B IP Intelligence 서비스가 가능한 이유](#5-b2b-ip-intelligence-서비스가-가능한-이유)
6. [실제 예시](#6-실제-예시-같은-빌딩-다른-결과)
7. [결론](#결론-왜-모두-isp로-나오는가)
8. [해결책](#해결책)
9. [IP → 회사 웹사이트 URL 찾는 모든 방법](#ip--회사-웹사이트-url-찾는-모든-방법)
10. [실제 테스트 결과](#실제-테스트-결과-2026-01-16)
11. [ISP IP 활용 전략](#isp-ip-활용-전략-회사명-없이도-가능한-것들)

---

## 현재 상황

모든 방문자가 **ISP**(SK Broadband, Korea Telecom, LG DACOM 등)로 나오는 것은 정상적인 결과입니다.

한국의 대부분 회사는 **자체 ASN(Autonomous System Number)을 보유하지 않습니다**. ISP(KT, SK, LG 등)로부터 IP를 할당받아 사용하기 때문에:
- ASN 조회 → ISP 정보만 반환
- ipapi.is 같은 서비스는 ASN 레벨 정보만 제공

---

## 1. 네트워크 인프라 구조적 관점

### 미국/유럽 vs 한국의 차이

**미국/유럽 대기업:**
```
대기업 (Google, Microsoft 등)
    ↓
자체 ASN 보유 (AS15169 = Google)
    ↓
자체 IP 블록 할당받음 (ARIN/RIPE에서)
    ↓
IP 조회시 → "Google LLC" 반환
```

**한국 대부분 기업:**
```
한국 기업 (삼성전자 본사 제외 대부분)
    ↓
ISP와 기업 인터넷 계약
    ↓
ISP가 보유한 IP 대역에서 할당
    ↓
IP 조회시 → "SK Broadband" 반환
```

### 왜 한국 기업은 자체 ASN이 없나?

| 요인 | 설명 |
|------|------|
| **비용** | ASN 등록/유지 비용 (연간 수백만원) + 전용선 비용 |
| **필요성 부재** | 일반 기업은 ISP 회선으로 충분 |
| **기술 인력** | BGP 라우팅 관리 전문가 필요 |
| **한국 인터넷 환경** | ISP 품질이 좋아서 자체 구축 동기 낮음 |

---

## 2. IP 주소 할당 체계 관점

### 글로벌 IP 할당 구조

```
IANA (전세계 IP 총괄)
    ↓
RIR (지역 인터넷 등록 기관)
├── ARIN (북미)
├── RIPE (유럽)
├── APNIC (아시아태평양) ← 한국 포함
├── LACNIC (남미)
└── AFRINIC (아프리카)
    ↓
NIR (국가 인터넷 등록 기관)
└── KRNIC/KISA (한국)
    ↓
ISP (KT, SK, LG 등)
    ↓
최종 사용자 (기업, 가정)
```

### WHOIS 조회 결과 예시

**SK Broadband IP (211.58.236.53):**
```
inetnum:        211.58.0.0 - 211.58.255.255
netname:        broadNnet
descr:          SK Broadband Co Ltd
country:        KR
status:         ALLOCATED PORTABLE
```

**Korea Telecom IP (220.124.109.133):**
```
inetnum:        220.120.0.0 - 220.127.255.255
netname:        KORNET
descr:          Korea Telecom
country:        KR
status:         ALLOCATED PORTABLE
```

→ IP 블록이 ISP에 직접 할당되어 있어 **실제 사용 기업 정보는 없음**

---

## 3. 한국 특수 상황 분석

### 한국 ISP 시장 구조

```
┌────────────────────────────────────────────────┐
│  KT (약 40%)  │  SK (약 30%)  │  LG (약 20%)   │
├────────────────────────────────────────────────┤
│         전국 광케이블 인프라 보유               │
│         기업용 전용회선 서비스 제공             │
│         IP 대역 직접 관리                      │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│  일반 기업들                                   │
│  - ISP의 "기업 인터넷" 상품 사용               │
│  - 고정 IP 1~16개 할당받음                     │
│  - IP 소유권은 ISP에 있음                      │
└────────────────────────────────────────────────┘
```

### 자체 ASN을 가진 한국 기업 (극소수)

| 기업 | ASN | 이유 |
|------|-----|------|
| 삼성SDS | AS9619 | 글로벌 네트워크, 데이터센터 운영 |
| 네이버 | AS23576 | 대규모 서비스, CDN 필요 |
| 카카오 | AS38099 | 대규모 트래픽 처리 |
| LG CNS | AS9316 | IT 인프라 사업 |

### 자체 ASN이 없는 기업 (대다수)

- 중소기업 99%
- 대기업 영업/지사
- 스타트업
- 일반 사무실

---

## 4. IP → 회사 매핑의 기술적 한계

### IP 조회 API가 알 수 있는 것

| 가능 | 불가능 |
|------|--------|
| ASN 소유자 (ISP) | 실제 사용 기업 |
| 지리적 위치 (대략적) | 회사명 |
| ISP 유형 (residential/business) | 산업 분류 |

### ipapi.is 데이터 흐름

```
IP: 211.58.236.53
       ↓
[WHOIS 조회] → netname: broadNnet, descr: SK Broadband
       ↓
[BGP 라우팅 테이블] → AS9318 (SK Broadband)
       ↓
[결과] → asn_org: "SK Broadband", asn_type: "isp"
```

이 과정에서 **"이 IP를 실제로 어떤 회사가 사용하는가"**는 알 수 없습니다.

---

## 5. B2B IP Intelligence 서비스가 가능한 이유

Clearbit Reveal, Demandbase 등의 서비스가 회사를 식별할 수 있는 이유:

### 데이터 수집 방법

#### 1. 자발적 데이터 제공
- 파트너 웹사이트에 설치된 트래킹 코드
- 사용자가 로그인한 상태에서 IP 수집
- "회사 A의 직원이 IP X에서 접속" 패턴 학습

#### 2. 공개 데이터 크롤링
- 회사 웹사이트의 메일 서버 IP (MX 레코드)
- SPF 레코드에 명시된 IP 대역
- 회사 공식 문서에 나온 IP 정보

#### 3. 데이터 구매
- ISP로부터 기업 고객 IP 대역 정보
- 기업 네트워크 관리 업체로부터 정보

#### 4. 역방향 DNS
```
mail.company.com → 203.x.x.x
vpn.company.com → 203.x.x.y
```

---

## 6. 실제 예시: 같은 빌딩, 다른 결과

```
[강남 오피스 빌딩 예시]

A회사 (자체 ASN 있음 - 드묾)
├── IP: 203.100.x.x
├── ASN: AS12345 (A회사)
└── 조회결과: "A회사" ✓

B회사 (일반 기업 - 대부분)
├── IP: 211.58.x.x
├── ASN: AS9318 (SK Broadband)
└── 조회결과: "SK Broadband" ✗

C회사 (같은 빌딩, 다른 ISP)
├── IP: 220.124.x.x
├── ASN: AS4766 (Korea Telecom)
└── 조회결과: "Korea Telecom" ✗
```

---

## 결론: 왜 모두 ISP로 나오는가

| 원인 | 상세 |
|------|------|
| **IP 소유 구조** | 한국 기업 99%는 ISP로부터 IP를 "대여"받아 사용 |
| **ASN 비용/복잡성** | 자체 ASN 운영은 비용과 기술력 필요 |
| **공개 데이터 한계** | WHOIS/BGP는 ISP 레벨 정보만 제공 |
| **한국 ISP 과점** | KT/SK/LG 3사가 거의 모든 IP 보유 |

---

## 해결책

### 유료 B2B IP Intelligence 서비스

| 서비스 | 특징 | 가격대 |
|--------|------|--------|
| **Clearbit Reveal** | 가장 유명, IP→회사 매핑 DB 보유 | $99~$500+/월 |
| **Demandbase** | B2B 마케팅 특화 | 문의 필요 |
| **Leadfeeder** | 웹사이트 방문자 추적 | $99+/월 |
| **6sense** | 구매 의도 분석 포함 | 문의 필요 |
| **ZoomInfo** | 회사 데이터베이스 방대 | $10,000+/년 |

### 무료 대안 (제한적)

```bash
# Reverse DNS 조회로 회사 도메인 확인 시도
dig -x 211.58.236.53 +short

# WHOIS에서 네트워크 할당 정보 확인
whois 211.58.236.53
```

> **주의:** 무료 방법은 정확도가 낮고 대부분 ISP 정보만 반환됩니다.

---

## IP → 회사 웹사이트 URL 찾는 모든 방법

### 1. DNS 기반 방법

#### 1-1. Reverse DNS (PTR 레코드)
```bash
dig -x 203.104.123.45 +short
host 203.104.123.45
nslookup 203.104.123.45
```

#### 1-2. 동일 IP를 가리키는 도메인 검색 (Reverse IP Lookup)
```bash
# ViewDNS API
curl "https://api.viewdns.info/reverseip/?host=203.104.123.45&apikey=YOUR_KEY&output=json"

# HackerTarget (무료 제한)
curl "https://api.hackertarget.com/reverseiplookup/?q=203.104.123.45"
```

### 2. SSL/TLS 인증서 기반

#### 2-1. 직접 SSL 인증서 조회
```bash
# 인증서의 Subject Alternative Name (SAN) 추출
echo | openssl s_client -connect [IP]:443 2>/dev/null | \
  openssl x509 -noout -text | grep -A1 "Subject Alternative Name"

# Common Name 추출
echo | openssl s_client -connect [IP]:443 2>/dev/null | \
  openssl x509 -noout -subject
```

#### 2-2. Certificate Transparency 로그 검색
```bash
# crt.sh - 특정 조직의 모든 인증서 조회
curl "https://crt.sh/?q=%.company.com&output=json"
```

### 3. HTTP/HTTPS 요청 기반

#### 3-1. HTTP 헤더 분석
```bash
# Server, X-Powered-By 등 헤더 확인
curl -sI http://[IP] | grep -iE "(server|location|x-powered|x-redirect)"

# HTTPS
curl -skI https://[IP]
```

#### 3-2. HTML 내용 분석
```bash
# 페이지 내 도메인 참조 추출
curl -s http://[IP] | grep -oE 'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

# title 태그 추출
curl -s http://[IP] | grep -oP '<title>\K[^<]+'
```

### 4. 포트 스캔 + 배너 그래빙

```bash
# 일반적인 웹 포트
nmap -p 80,443,8080,8443,8000,3000 [IP]

# 서비스 버전 탐지
nmap -sV -p 80,443 [IP]
```

### 5. 외부 데이터베이스 / API 활용

#### 5-1. Shodan
```bash
# CLI
shodan host [IP]

# InternetDB (무료, API 키 불필요)
curl "https://internetdb.shodan.io/[IP]"
```

#### 5-2. SecurityTrails
```bash
# IP로 연결된 도메인 검색
curl "https://api.securitytrails.com/v1/domains/list?ipv4=[IP]" \
  -H "APIKEY: YOUR_KEY"
```

#### 5-3. VirusTotal
```bash
curl "https://www.virustotal.com/api/v3/ip_addresses/[IP]" \
  -H "x-apikey: YOUR_KEY"
```

### 6. 검색 엔진 활용

```
# Google Dork
"203.104.123.45"
site:203.104.123.45

# Bing IP 검색
ip:203.104.123.45

# Shodan 웹 검색
https://www.shodan.io/host/203.104.123.45
```

### 방법별 효과 비교

| 방법 | 무료 | 성공률 | 적합한 대상 |
|------|------|--------|------------|
| Reverse DNS | O | 10% | 대기업, 서버 호스팅 |
| SSL 인증서 | O | 30% | 웹서버 운영 회사 |
| Reverse IP Lookup | O | 40% | 웹호스팅/서버 IP |
| HTTP 헤더 분석 | O | 20% | 웹서버 운영 회사 |
| Shodan | △ | 60% | 인터넷 노출 서버 |
| SecurityTrails | △ | 50% | 도메인-IP 매핑 |
| WHOIS | O | 15% | 자체 IP 보유 기업 |
| B2B Intelligence | X | 80%+ | 일반 사무실 포함 |

---

## 실제 테스트 결과 (2026-01-16)

현재 DB의 ISP IP들에 대해 모든 방법을 테스트한 결과:

| 방법 | 결과 |
|------|------|
| **Reverse DNS** | 모든 IP - PTR 레코드 없음 |
| **SSL 인증서** | 모든 IP - 443 포트 닫힘 |
| **HTTP 헤더** | 모든 IP - 80 포트 닫힘 |
| **WHOIS** | ISP 정보만 (SK Broadband, LG POWERCOMM 등) |
| **ipinfo.io** | ISP 정보만, hostname 없음 |
| **nmap 포트 스캔** | 모든 IP - 열린 포트 없음 (80, 443, 8080, 22 등) |
| **Shodan InternetDB** | 모든 IP - "No information available" |

### 결론

```
┌─────────────────────────────────────────────────────────────┐
│  현재 DB의 모든 ISP IP는 "일반 사무실/가정 IP"             │
│                                                             │
│  특징:                                                      │
│  - 웹서버 운영 안 함 (포트 80, 443 닫힘)                   │
│  - 외부에서 접근 가능한 서비스 없음                        │
│  - PTR 레코드 미설정                                       │
│  - Shodan/Censys에도 스캔 기록 없음                        │
│                                                             │
│  → 무료 방법으로는 회사 식별 불가능                        │
└─────────────────────────────────────────────────────────────┘
```

---

## ISP IP 활용 전략: 회사명 없이도 가능한 것들

### 핵심 개념: 같은 IP = 같은 조직

ISP여도 **IP 자체는 고유**합니다. 회사명은 모르지만 "같은 장소"임을 알 수 있습니다.

```
┌─────────────────────────────────────────────────────────────┐
│  IP: 115.91.133.187                                        │
│  방문 횟수: 10회                                            │
│  ISP: LG DACOM                                              │
│                                                             │
│  → 회사명은 모르지만, "같은 장소에서 10번 방문"이라는 것은  │
│     확실함. 이것만으로도 "잠재 고객"으로 분류 가능          │
└─────────────────────────────────────────────────────────────┘
```

### 기업용 vs 가정용 IP 구분

| 구분 | 기업용 IP | 가정용 IP | 모바일 IP |
|------|-----------|-----------|-----------|
| **IP 유형** | 고정 IP | 동적 IP (DHCP) | CGNAT (공유) |
| **IP 변경** | 거의 안 바뀜 | 주기적 변경 | 수시 변경 |
| **반복 방문** | 같은 IP 유지 | IP 바뀔 수 있음 | 같은 IP에 여러 사용자 |
| **식별 가능성** | 높음 | 중간 | 낮음 |

### 반복 방문 패턴으로 잠재 고객 식별

```sql
-- 반복 방문 IP 분석 (잠재적 기업 고객)
SELECT
  ip_address,
  visit_count,
  asn_org,
  city,
  CASE
    WHEN visit_count >= 5 THEN '높은 관심 (기업 가능성 높음)'
    WHEN visit_count >= 2 THEN '관심 있음'
    ELSE '일회성'
  END as lead_potential
FROM visitor_sessions
WHERE asn_type = 'isp'
ORDER BY visit_count DESC;
```

### 실제 데이터 분석 결과

| IP | 방문 횟수 | ISP | 위치 | 잠재 고객 등급 |
|----|-----------|-----|------|---------------|
| 115.91.133.187 | **10회** | LG DACOM | Seoul | 높은 관심 |
| 222.118.139.56 | **5회** | Korea Telecom | Seoul | 높은 관심 |
| 58.237.4.150 | 4회 | SK Broadband | Seoul | 관심 있음 |
| 114.200.140.116 | 3회 | SK Broadband | Seoul | 관심 있음 |
| 58.79.106.162 | 3회 | LG DACOM | Seoul | 관심 있음 |

### 회사명을 알아내는 자체 데이터 축적 방식

```
[데이터 축적 전략]

1. 방문자가 이메일 구독 시
   - 이메일 도메인에서 회사 추출 (user@company.com)
   - 해당 IP와 회사 매핑 저장

2. 방문자가 문의/가입 시
   - 입력한 회사명과 IP 매핑

3. 시간이 지나면
   - "115.91.133.187 = ABC회사" 데이터 축적
   - 같은 IP의 다른 방문자도 같은 회사로 식별
```

### 구현 제안: IP↔회사 매핑 테이블

```sql
-- 이메일 구독 시 IP↔회사 매핑 테이블
CREATE TABLE ip_company_mapping (
  ip_address VARCHAR(50) PRIMARY KEY,
  company_name VARCHAR(255),
  company_domain VARCHAR(255),
  source VARCHAR(50),  -- 'email_signup', 'form_submit', 'manual'
  confidence FLOAT,    -- 신뢰도
  created_at TIMESTAMP DEFAULT NOW()
);

-- 이메일 도메인에서 회사 추출 예시
-- user@samsung.com → samsung.com → 삼성
```

### 활용 가능한 것 요약

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ 같은 IP = 같은 조직 (회사명은 모르지만 구분 가능)        │
│  ✓ 반복 방문 횟수로 관심도 측정                            │
│  ✓ 도시/지역 정보로 지역 기반 분석                         │
│  ✓ 나중에 이메일 구독 시 IP↔회사 매핑 가능                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 참고 자료

- [APNIC WHOIS Database](https://wq.apnic.net/)
- [KRNIC (한국인터넷진흥원)](https://krnic.or.kr/)
- [BGP Toolkit](https://bgp.he.net/)
- [Shodan InternetDB](https://internetdb.shodan.io/)
- [SecurityTrails](https://securitytrails.com/)
- [crt.sh (Certificate Transparency)](https://crt.sh/)
