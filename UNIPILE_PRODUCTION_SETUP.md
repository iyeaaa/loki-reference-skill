# Unipile Webhook 프로덕션 설정 완료 ✅

## 📊 **현재 배포 구조 (EC2)**

```
app.rinda.ai (Nginx)
├── / → admin:3000 (프론트엔드)
├── /api/ → elysia-server:3001 (백엔드) ✅
└── /api/v1/unipile/webhook → Unipile webhook endpoint ✅
```

---

## ✅ **완료된 설정**

### **1. Nginx 프록시 (이미 설정됨)**

```nginx
# Elysia server API routes
location ^~ /api/ {
    proxy_pass http://sendgrid-elysia-upstream;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    ...
}

upstream sendgrid-elysia-upstream {
    server elysia-server:3001;
}
```
✅ **이미 설정되어 동작 중**

---

### **2. 백엔드 환경 변수**

```bash
# elysia-server/.env
APP_URL=https://app.rinda.ai  ✅ 추가됨
```

---

### **3. 프론트엔드 API 클라이언트**

```typescript
// admin/src/lib/env.ts
export const API_BASE_URL = window.location.origin  // https://app.rinda.ai
```
✅ **이미 설정되어 동작 중**

---

### **4. Webhook 자동 등록 로직**

```typescript
// elysia-server/src/routes/unipile.routes.ts
// 첫 Unipile 계정 연동 시 자동으로 webhook 등록
const webhooksResult = await unipileService.listWebhooks()
const webhookUrl = `${config.appUrl}/api/v1/unipile/webhook`

if (!existingWebhook) {
  await unipileService.registerEmailWebhook(webhookUrl)
}
```
✅ **이미 구현됨**

---

### **5. Webhook 정리 로직**

```typescript
// elysia-server/src/services/email-account.service.ts
// 마지막 Unipile 계정 삭제 시 webhook도 자동 정리
if (remainingAccounts.length === 0) {
  const webhooks = await unipileService.listWebhooks()
  for (const webhook of webhooks.webhooks || []) {
    await unipileService.deleteWebhook(webhook.id)
  }
}
```
✅ **이미 구현됨**

---

## 🚀 **다음 단계**

### **1. 백엔드 서버 재시작 (필수)**

```bash
# Docker Compose 환경이면
docker-compose restart elysia-server

# 또는 PM2 환경이면
pm2 restart elysia-server

# 또는 systemd 환경이면
sudo systemctl restart elysia-server
```

**이유:** `APP_URL` 환경 변수를 새로 추가했으므로 재시작 필요

---

### **2. Webhook 확인**

서버 재시작 후 다음 방법 중 하나로 webhook이 등록되는지 확인:

#### **Option A: 새로운 Unipile 계정 연동**

1. Settings → Unipile Email Test
2. "Connect Email Account" 클릭
3. 이메일 계정 연동
4. 자동으로 webhook 등록됨 ✅

#### **Option B: 기존 계정이 있다면**

백엔드 로그에서 webhook 등록 확인:

```bash
# Docker logs
docker-compose logs -f elysia-server | grep webhook

# 또는 PM2 logs
pm2 logs elysia-server | grep webhook
```

**기대 로그:**
```
✅ Unipile webhook registered successfully
Webhook URL: https://app.rinda.ai/api/v1/unipile/webhook
```

---

### **3. Unipile Dashboard 확인 (선택 사항)**

https://developer.unipile.com/dashboard

1. **Webhooks** 탭 이동
2. 다음 webhook이 자동 등록되었는지 확인:
   - **URL:** `https://app.rinda.ai/api/v1/unipile/webhook`
   - **Events:** `mail_received`
   - **Status:** Active

**참고:** 코드가 자동으로 등록하므로 수동 등록 불필요

---

### **4. 테스트**

#### **Step 1: 이메일 발송**

1. Settings → Unipile Email Test
2. 테스트 이메일 발송

#### **Step 2: 답장 보내기**

받은 이메일에 답장

#### **Step 3: 확인**

Email Replies 페이지에서 답장 확인 ✅

---

## 🧪 **테스트 명령어**

### **Webhook Endpoint 테스트**

```bash
# 외부에서 테스트
curl -X POST https://app.rinda.ai/api/v1/unipile/webhook \
  -H "Content-Type: application/json" \
  -d '{}'

# 기대 응답: 200 OK
```

### **API 프록시 테스트**

```bash
# Health check
curl https://app.rinda.ai/api/v1/health

# 기대 응답: {"status":"ok"}
```

---

## 📋 **체크리스트**

```bash
✅ Nginx 프록시 설정 확인 (이미 완료)
✅ APP_URL 환경 변수 추가
□ 백엔드 서버 재시작 (필수!)
□ Webhook 자동 등록 확인
□ 실제 이메일 답장 테스트
```

---

## 🎯 **요약**

### **추가 작업 필요 없음! 다만:**

1. **백엔드 재시작** (환경 변수 반영)
2. **테스트** (이메일 발송 → 답장 → 확인)

### **자동으로 동작:**

- ✅ Nginx가 `/api/` 요청을 백엔드로 프록시
- ✅ 첫 계정 연동 시 webhook 자동 등록
- ✅ 마지막 계정 삭제 시 webhook 자동 정리
- ✅ 중복 등록 방지
- ✅ 답장만 저장 (사적 이메일 제외)

---

## 🔧 **트러블슈팅**

### **Webhook이 동작하지 않으면:**

```bash
# 1. 백엔드 로그 확인
docker-compose logs -f elysia-server

# 2. Webhook 등록 상태 확인
# Unipile Dashboard → Webhooks

# 3. APP_URL 환경 변수 확인
docker-compose exec elysia-server env | grep APP_URL

# 4. Nginx 설정 확인
docker-compose exec nginx nginx -t
```

---

**모든 준비가 완료되었습니다! 백엔드를 재시작하고 테스트하세요.** 🚀
