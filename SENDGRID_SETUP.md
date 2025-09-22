# SendGrid Inbound Parse 설정 가이드

## 웹훅 엔드포인트 URL
서버가 `15.165.2.108:3000`에서 실행 중일 때, SendGrid에 설정해야 할 웹훅 URL:

```
http://15.165.2.108:3000/webhook/inbound
```

## SendGrid Inbound Parse 설정 값

### 1. Receiving Domain 설정

**Subdomain (optional):**
```
parse
```
- 예시: `parse` 입력 시 `parse.grinda.ai`로 이메일을 받음
- 비워두면 `@grinda.ai`로 오는 모든 메일을 받음
- 권장: 특정 서브도메인 사용 (예: parse, inbound, mail 등)

**Domain:**
```
grinda.ai
```
- SendGrid에서 인증된 도메인이어야 함
- 이미 설정되어 있는 도메인 사용

### 2. Destination URL 설정

**URL:**
```
http://15.165.2.108:3000/webhook/inbound
```
- 공개 인터넷에서 접근 가능해야 함
- HTTP/HTTPS 모두 가능 (프로덕션에서는 HTTPS 권장)

### 3. Additional Options

**Check incoming emails for spam:**
- ✅ 체크 권장
- 스팸 점수와 리포트를 웹훅 데이터에 포함

**POST the raw, full MIME message:**
- ✅ 체크 권장
- 원본 이메일 전체 내용을 받을 수 있음
- 더 많은 메타데이터와 헤더 정보 포함

## DNS 설정 (MX 레코드)

서브도메인 `parse.grinda.ai` 사용 시:

```
Type: MX
Host: parse
Value: mx.sendgrid.net
Priority: 10
```

## 테스트 방법

1. 설정 완료 후 `parse@grinda.ai` 또는 `아무이름@parse.grinda.ai`로 테스트 이메일 발송
2. 서버 로그 확인:
   ```bash
   docker logs -f sendgrid-webhook
   ```
3. 수신된 이메일 목록 확인:
   ```
   http://15.165.2.108:3000/emails
   ```

## 주의사항

- 서버가 공개 인터넷에서 접근 가능해야 함
- 방화벽에서 3000 포트가 열려있어야 함
- AWS EC2 사용 시 보안그룹에서 3000 포트 인바운드 규칙 추가 필요
- 프로덕션에서는 HTTPS 사용 권장 (Let's Encrypt, Nginx 리버스 프록시 등)