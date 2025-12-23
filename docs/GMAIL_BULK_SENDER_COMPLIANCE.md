# Gmail Bulk Sender Compliance Guide (2024)

Gmail의 대량 발송자 가이드라인(2024)을 준수하기 위한 설정 가이드입니다.
하루에 5,000건 이상의 이메일을 Gmail 수신자에게 발송하는 경우 필수로 설정해야 합니다.

**참고**: [Google Gmail Sender Guidelines](https://support.google.com/a/answer/81126)

---

## 목차

1. [필수 요구사항 개요](#1-필수-요구사항-개요)
2. [SPF 설정](#2-spf-설정)
3. [DKIM 설정](#3-dkim-설정)
4. [DMARC 설정](#4-dmarc-설정)
5. [List-Unsubscribe 헤더](#5-list-unsubscribe-헤더)
6. [검증 도구](#6-검증-도구)
7. [문제 해결](#7-문제-해결)

---

## 1. 필수 요구사항 개요

### Gmail 대량 발송자 요구사항 (2024년 2월부터 시행)

| 요구사항 | 설명 | 우리 시스템 구현 상태 |
|---------|------|---------------------|
| SPF | 발신 도메인의 이메일 서버 인증 | DNS 설정 필요 |
| DKIM | 이메일 콘텐츠 무결성 검증 서명 | SendGrid/Google에서 자동 처리 |
| DMARC | SPF와 DKIM 정책 정의 | DNS 설정 필요 |
| List-Unsubscribe | One-click 수신 거부 헤더 | ✅ 코드 구현 완료 |
| 낮은 스팸 신고율 | 0.3% 미만 유지 필요 | 모니터링 필요 |

---

## 2. SPF 설정

### SPF (Sender Policy Framework)란?

SPF는 발신 도메인에서 어떤 메일 서버가 이메일을 보낼 수 있는지 지정하는 DNS 레코드입니다.

### 설정 방법

1. **DNS 관리 콘솔 접속** (예: Cloudflare, Route53, GoDaddy 등)

2. **TXT 레코드 추가**:

```
Host/Name: @
Type: TXT
Value: v=spf1 include:sendgrid.net include:_spf.google.com ~all
TTL: 3600 (1시간)
```

### 서비스별 SPF include 값

| 이메일 서비스 | SPF include 값 |
|-------------|---------------|
| SendGrid | `include:sendgrid.net` |
| Google Workspace | `include:_spf.google.com` |
| Nylas (Gmail OAuth) | 별도 설정 불필요 (사용자 Gmail 계정 사용) |
| Unipile (Gmail OAuth) | 별도 설정 불필요 (사용자 Gmail 계정 사용) |

### 예시: Grinda AI 도메인 설정

```
# grinda.ai 도메인 SPF 레코드
v=spf1 include:sendgrid.net include:_spf.google.com ~all
```

### 주의사항

- SPF 조회 횟수는 **10회 이내**로 유지해야 합니다
- 여러 include가 있으면 조회 횟수가 누적됩니다
- `~all` (softfail)과 `-all` (hardfail) 중 선택
  - 초기 설정: `~all` (모니터링)
  - 안정화 후: `-all` (엄격 적용)

---

## 3. DKIM 설정

### DKIM (DomainKeys Identified Mail)이란?

DKIM은 이메일에 디지털 서명을 추가하여 이메일이 전송 중에 변조되지 않았음을 증명합니다.

### SendGrid DKIM 설정

1. **SendGrid 대시보드 접속**: Settings → Sender Authentication

2. **Domain Authentication 클릭**

3. **도메인 입력** (예: grinda.ai)

4. **DNS 레코드 생성**: SendGrid가 제공하는 CNAME 레코드 추가

```
# 예시 (SendGrid 제공 값으로 대체)
Record 1:
Host: s1._domainkey.grinda.ai
Type: CNAME
Value: s1.domainkey.u12345678.wl12345.sendgrid.net

Record 2:
Host: s2._domainkey.grinda.ai
Type: CNAME
Value: s2.domainkey.u12345678.wl12345.sendgrid.net
```

5. **Verify 클릭**: DNS 전파 후 인증 확인 (최대 48시간 소요)

### Google Workspace DKIM 설정

1. **Google Admin Console 접속**: Apps → Google Workspace → Gmail

2. **Authenticate email 선택**

3. **Generate New Record 클릭**

4. **생성된 TXT 레코드를 DNS에 추가**:

```
Host: google._domainkey.grinda.ai
Type: TXT
Value: v=DKIM1; k=rsa; p=MIIBIjANBg... (Google 제공 값)
```

5. **Start Authentication 클릭**

---

## 4. DMARC 설정

### DMARC (Domain-based Message Authentication)란?

DMARC는 SPF와 DKIM 검증 결과에 따라 이메일 처리 방법을 정의합니다.

### 설정 방법

1. **DNS TXT 레코드 추가**:

```
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@grinda.ai; pct=100
```

### DMARC 정책 옵션

| 정책 | 설명 | 권장 시기 |
|-----|------|----------|
| `p=none` | 모니터링만 (차단 없음) | 초기 설정 |
| `p=quarantine` | 스팸 폴더로 이동 | SPF/DKIM 안정화 후 |
| `p=reject` | 완전 차단 | 완전 안정화 후 |

### 권장 DMARC 설정 단계

**Phase 1 (1-2주): 모니터링**
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@grinda.ai; pct=100
```

**Phase 2 (2-4주): 부분 적용**
```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc-reports@grinda.ai
```

**Phase 3 (안정화 후): 완전 적용**
```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@grinda.ai
```

### DMARC 태그 설명

| 태그 | 설명 | 예시 |
|-----|------|-----|
| `v` | 버전 (필수) | `v=DMARC1` |
| `p` | 정책 (필수) | `p=quarantine` |
| `rua` | 집계 보고서 수신 이메일 | `rua=mailto:dmarc@example.com` |
| `ruf` | 포렌식 보고서 수신 이메일 | `ruf=mailto:forensic@example.com` |
| `pct` | 정책 적용 비율 (%) | `pct=100` |
| `aspf` | SPF 정렬 모드 | `aspf=r` (relaxed) |
| `adkim` | DKIM 정렬 모드 | `adkim=r` (relaxed) |

---

## 5. List-Unsubscribe 헤더

### 구현 상태: ✅ 완료

List-Unsubscribe 헤더는 RFC 8058을 준수하여 구현되었습니다.

### 코드 위치

```
elysia-server/src/utils/gmail-compliance.util.ts
```

### 작동 방식

1. **헤더 생성**: 이메일 발송 시 자동으로 List-Unsubscribe 헤더 추가

```typescript
// email.service.ts에서 자동 추가
{
  "List-Unsubscribe": "<https://api.grinda.ai/api/v1/unsubscribe?token=xxx>",
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
}
```

2. **Unsubscribe 엔드포인트**: `/api/v1/unsubscribe`

- **GET**: 브라우저에서 수신거부 페이지 표시
- **POST**: 이메일 클라이언트의 one-click 수신거부 처리

### 사용 방법

이메일 발송 시 다음 파라미터를 전달하면 자동으로 List-Unsubscribe 헤더가 추가됩니다:

```typescript
await emailService.sendEmail({
  // ... 기존 파라미터
  workspaceId: "ws_123",     // 필수: List-Unsubscribe 활성화
  leadId: "lead_456",        // 선택: 수신거부 추적
  sequenceId: "seq_789",     // 선택: 시퀀스 추적
  includeUnsubscribe: true,  // 기본값: true
})
```

---

## 6. 검증 도구

### DNS 레코드 검증

1. **Google Admin Toolbox**: https://toolbox.googleapps.com/apps/checkmx/
2. **MXToolbox**: https://mxtoolbox.com/
3. **DMARC Analyzer**: https://dmarcanalyzer.com/

### SPF 검증

```bash
# 터미널에서 확인
dig TXT grinda.ai | grep spf

# 또는 온라인 도구
https://mxtoolbox.com/spf.aspx
```

### DKIM 검증

```bash
# SendGrid selector 확인
dig TXT s1._domainkey.grinda.ai

# Google selector 확인
dig TXT google._domainkey.grinda.ai
```

### DMARC 검증

```bash
dig TXT _dmarc.grinda.ai

# 또는 온라인 도구
https://mxtoolbox.com/dmarc.aspx
```

### 이메일 헤더 확인

발송된 이메일의 원본 보기에서 다음을 확인:

```
Authentication-Results: mx.google.com;
       dkim=pass header.i=@grinda.ai header.s=s1 header.b=xxxxx;
       spf=pass (google.com: domain of sender@grinda.ai designates 149.72.xxx.xxx as permitted sender);
       dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=grinda.ai
```

---

## 7. 문제 해결

### SPF 문제

**증상**: `spf=fail` 또는 `spf=softfail`

**해결 방법**:
1. SPF 레코드에 발신 서버 포함 확인
2. SPF 조회 횟수 10회 이내 확인
3. DNS 전파 대기 (최대 48시간)

### DKIM 문제

**증상**: `dkim=fail` 또는 서명 없음

**해결 방법**:
1. SendGrid/Google에서 DKIM 활성화 확인
2. DNS CNAME 레코드 정확성 확인
3. 도메인 인증 상태 확인

### DMARC 문제

**증상**: `dmarc=fail`

**해결 방법**:
1. SPF와 DKIM 둘 다 통과하는지 확인
2. From 도메인과 SPF/DKIM 도메인 일치 확인
3. DMARC 정책을 `p=none`으로 시작

### List-Unsubscribe 문제

**증상**: Gmail에서 수신거부 버튼이 표시되지 않음

**해결 방법**:
1. `List-Unsubscribe` 헤더 포함 확인
2. `List-Unsubscribe-Post` 헤더 포함 확인
3. HTTPS URL 사용 확인
4. POST 엔드포인트가 200 OK 반환하는지 확인

---

## 체크리스트

### 발송 전 필수 확인사항

- [ ] SPF 레코드 설정 완료
- [ ] DKIM 서명 활성화 및 DNS 설정 완료
- [ ] DMARC 레코드 설정 완료
- [ ] List-Unsubscribe 헤더 포함 확인
- [ ] 테스트 이메일 발송 후 인증 결과 확인
- [ ] 스팸 신고율 모니터링 설정

### 정기 모니터링

- [ ] DMARC 보고서 검토 (주간)
- [ ] 스팸 신고율 확인 (0.3% 미만 유지)
- [ ] 반송률 확인 (3% 미만 유지)
- [ ] 발신자 평판 점수 확인

---

## 관련 파일

| 파일 | 설명 |
|-----|------|
| `elysia-server/src/utils/gmail-compliance.util.ts` | Gmail 정책 준수 유틸리티 |
| `elysia-server/src/services/email.service.ts` | 이메일 서비스 (List-Unsubscribe 헤더 추가) |
| `elysia-server/src/routes/unsubscribe.routes.ts` | 수신거부 API 엔드포인트 |

---

## 참고 자료

- [Google Gmail Sender Guidelines](https://support.google.com/a/answer/81126)
- [RFC 8058 - One-Click Unsubscribe](https://tools.ietf.org/html/rfc8058)
- [RFC 7489 - DMARC](https://tools.ietf.org/html/rfc7489)
- [SendGrid Email Authentication](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication)
