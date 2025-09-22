# SendGrid 이메일 서비스

## 📋 프로젝트 개요

SendGrid API를 활용한 이메일 송수신 및 자동화 시스템입니다. 이메일 대량 발송, 웹훅을 통한 인바운드 이메일 처리, 자동 답장 기능을 제공합니다.

### 주요 기능
- 📤 **이메일 대량 발송**: SendGrid API를 통한 마케팅 이메일 발송
- 📥 **인바운드 이메일 처리**: SendGrid Inbound Parse 웹훅으로 수신 이메일 실시간 처리
- 🔄 **자동 답장**: admin@grinda.ai로 수신된 이메일에 자동 답장
- 🐳 **Docker 컨테이너화**: 배포 및 운영 간소화

## 🏗 프로젝트 구조

```
send-grid-test/
├── server.js              # 메인 웹훅 서버 (Express)
├── sendgrid_test.js       # 이메일 발송 테스트 스크립트
├── docker-compose.yml     # Docker 컨테이너 구성
├── Dockerfile            # Docker 이미지 빌드 설정
├── package.json          # Node.js 의존성 관리
├── .env                  # 환경 변수 (API 키 등)
├── .env.example          # 환경 변수 템플릿
├── SENDGRID_SETUP.md     # SendGrid 설정 가이드
├── up-hana.sh            # 서버 배포 스크립트
└── logs/                 # 로그 디렉토리
```

## 🚀 시작하기

### 필수 요구사항
- Node.js 18.0.0 이상
- Docker & Docker Compose (선택사항)
- SendGrid 계정 및 API 키

### 설치

1. **저장소 클론**
```bash
git clone <repository-url>
cd send-grid-test
```

2. **의존성 설치**
```bash
npm install
```

3. **환경 변수 설정**
```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
SENDGRID_API_KEY=your_sendgrid_api_key
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

### 실행 방법

#### 로컬 실행
```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start
```

#### Docker로 실행
```bash
# 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker logs -f sendgrid-webhook
```

## 📡 API 엔드포인트

### 1. 헬스체크
- **GET** `/health`
- 서버 상태 확인

**응답 예시:**
```json
{
  "status": "ok",
  "timestamp": "2024-09-22T06:00:00.000Z"
}
```

### 2. 인바운드 이메일 웹훅
- **POST** `/webhook/inbound`
- SendGrid Inbound Parse 웹훅 수신
- admin@grinda.ai로 수신 시 자동 답장 발송

**주요 처리 내용:**
- 발신자/수신자 정보 파싱
- 이메일 본문 (text/html) 처리
- Base64 인코딩된 내용 디코딩
- 첨부파일 정보 추출
- SPF/DKIM 검증 정보
- 스팸 점수 확인

### 3. 이메일 저장 웹훅
- **POST** `/webhook/inbound-store`
- 수신 이메일을 메모리에 저장

### 4. 이메일 목록 조회
- **GET** `/emails`
- 최근 수신된 이메일 50개 조회

**응답 예시:**
```json
{
  "count": 10,
  "emails": [
    {
      "id": 1234567890,
      "timestamp": "2024-09-22T06:00:00.000Z",
      "from": "sender@example.com",
      "to": "admin@grinda.ai",
      "subject": "문의 메일",
      "text": "본문 내용...",
      "attachments": []
    }
  ]
}
```

## 📧 이메일 발송 기능

### sendgrid_test.js
마케팅 이메일 대량 발송 스크립트

**주요 설정:**
- `TOTAL_EMAILS`: 발송할 이메일 개수
- `INTERVAL_SECONDS`: 발송 간격 (초)

**실행 방법:**
```bash
node sendgrid_test.js
```

**발송 내용:**
- 그린다에이아이(GRINDA AI) 서비스 소개
- Rinda (B2B 해외 영업 AI 에이전트) 홍보
- HTML 템플릿 기반 이메일

## 🔄 자동 답장 기능

admin@grinda.ai로 이메일 수신 시 자동으로 답장을 발송합니다.

### 자동 답장 내용
- 문의 접수 확인
- 주요 서비스 소개 (Rinda, FINGU, 맞춤형 LLM)
- 검증된 성과 안내
- 업무 시간 및 응답 시간 안내

### 조건
- 수신자가 `admin@grinda.ai`인 경우에만 작동
- 비동기 처리로 웹훅 응답 지연 방지

## 🔧 SendGrid 설정

### Inbound Parse 설정

1. **SendGrid 대시보드에서 Inbound Parse 설정**
   - Settings > Inbound Parse > Add Host & URL

2. **설정 값:**
   - **Subdomain**: `parse` (선택사항)
   - **Domain**: `grinda.ai`
   - **Destination URL**: `http://your-server:3000/webhook/inbound`

3. **DNS MX 레코드 설정:**
```
Type: MX
Host: parse
Value: mx.sendgrid.net
Priority: 10
```

4. **추가 옵션:**
   - ✅ Check incoming emails for spam
   - ✅ POST the raw, full MIME message

자세한 설정은 [SENDGRID_SETUP.md](./SENDGRID_SETUP.md) 참조

## 🚢 배포

### 서버 배포 스크립트
```bash
./up-hana.sh
```

**스크립트 기능:**
- 프로젝트 파일을 원격 서버로 동기화 (rsync)
- Docker Compose로 서비스 재시작
- node_modules, .git 등 불필요한 파일 제외

### 배포 환경
- 서버: 15.165.2.108 (AWS EC2)
- 포트: 3000
- 컨테이너: sendgrid-webhook

## 📝 로깅

- 모든 수신 이메일 정보를 콘솔에 상세히 출력
- 이메일 기본 정보 (발신자, 수신자, 제목)
- 보안 검증 정보 (SPF, DKIM, 스팸 점수)
- 본문 내용 (text/html)
- 첨부파일 정보
- 헤더 정보

## 🔒 보안 고려사항

- SendGrid API 키는 환경 변수로 관리
- .env 파일은 .gitignore에 포함
- 프로덕션 환경에서는 HTTPS 사용 권장
- 스팸 필터링 및 검증 기능 활성화

## 🛠 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 실행
npm start

# 테스트
npm test

# 린트
npm run lint
```

## 📦 주요 의존성

- **express**: ^4.18.2 - 웹 서버 프레임워크
- **@sendgrid/mail**: ^8.1.6 - SendGrid API 클라이언트
- **multer**: ^1.4.5 - 파일 업로드 처리
- **dotenv**: ^16.3.1 - 환경 변수 관리

## 👥 회사 정보

**그린다에이아이 (GRINDA AI)**
- 대표: 강호진
- 주소: 대전광역시 유성구 대학로 99 대전팁스타운 503호
- 사업자등록번호: 309-88-02709
- 이메일: admin@grinda.ai
- 슬로건: "AI와, 당신의 비즈니스로 미래를 함께 그립니다"

## 📄 라이선스

이 프로젝트는 그린다에이아이의 내부 프로젝트입니다.