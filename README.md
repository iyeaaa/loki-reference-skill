# SendGrid 이메일 서비스 & 관리 시스템

## 📋 프로젝트 개요

SendGrid API를 활용한 이메일 송수신 자동화 시스템과 관리 대시보드입니다. 이메일 대량 발송, 웹훅을 통한 인바운드 이메일 처리, AI 기반 자동 답장, 그리고 실시간 모니터링 기능을 제공합니다.

### 주요 기능
- 📤 **이메일 대량 발송**: SendGrid API를 통한 마케팅 이메일 발송
- 📥 **인바운드 이메일 처리**: SendGrid Inbound Parse 웹훅으로 수신 이메일 실시간 처리
- 🤖 **AI 자동 답장**: OpenAI를 활용한 지능형 자동 답장 시스템
- 📊 **관리 대시보드**: React 기반 이메일 관리 인터페이스
- 🎯 **게시판 CRUD**: PostgreSQL 기반 게시판 시스템
- 🐳 **완전한 컨테이너화**: Docker Compose를 통한 원클릭 배포

## 🏗 프로젝트 구조

```
send-grid-test/
├── admin/                 # React 관리 대시보드 (Vite)
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── admin-next/           # Next.js 관리 대시보드
│   ├── src/
│   │   └── app/api/     # API 라우트
│   ├── package.json
│   └── Dockerfile
├── elysia-server/        # Bun + Elysia 백엔드 서버
│   ├── src/
│   │   ├── index.ts     # 메인 서버
│   │   ├── lib/         # 유틸리티 모듈
│   │   ├── db/          # 데이터베이스 설정
│   │   └── services/    # 비즈니스 로직
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml    # Docker 오케스트레이션
├── .env                  # 환경 변수
└── deploy-hana.sh       # 배포 스크립트
```

## 🚀 시작하기

### 필수 요구사항
- Docker & Docker Compose
- Node.js 20+ (로컬 개발용)
- Bun 1.2+ (Elysia 서버용)
- SendGrid 계정 및 API 키
- OpenAI API 키 (AI 답장용)

### 빠른 시작 (Docker Compose)

1. **저장소 클론**
```bash
git clone <repository-url>
cd send-grid-test
```

2. **환경 변수 설정**
```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
SENDGRID_API_KEY=your_sendgrid_api_key
OPENAI_API_KEY=your_openai_api_key
```

3. **전체 스택 실행**
```bash
# 모든 서비스 시작
docker-compose up -d

# 특정 서비스만 시작
docker-compose up -d postgres redis elysia-server admin
```

## 🎯 서비스 구성

### 핵심 서비스

| 서비스 | 포트 | 설명 | 기술 스택 |
|--------|------|------|-----------|
| admin | 3000 | React 관리 대시보드 | Vite + React + TypeScript |
| elysia-server | 3001 | 백엔드 API 서버 | Bun + Elysia + TypeScript |
| postgres | 5432 | 데이터베이스 | PostgreSQL 17.2 |
| redis | 6379 | 캐시 & 세션 스토어 | Redis 7.4 |
| redisinsight | 5540 | Redis 관리 도구 | RedisInsight |
| uptime-kuma | 3002 | 서비스 모니터링 | Uptime Kuma |

## 📡 API 엔드포인트

### Elysia Server (포트 3001)

#### 1. 헬스체크
- **GET** `/health`, `/api/health`
```json
{
  "status": "ok",
  "timestamp": "2025-09-25T17:02:39.838Z"
}
```

#### 2. 이메일 관리
- **GET** `/api/emails` - 이메일 목록 조회
```json
{
  "count": 10,
  "emails": [...]
}
```

#### 3. SendGrid 웹훅
- **POST** `/api/webhook/inbound` - 인바운드 이메일 처리 & AI 자동 답장
- **POST** `/api/webhook/inbound-store` - 이메일 저장 전용

#### 4. 게시판 CRUD
- **GET** `/api/posts` - 게시글 목록
- **POST** `/api/posts` - 게시글 생성
- **PUT** `/api/posts/:id` - 게시글 수정
- **DELETE** `/api/posts/:id` - 게시글 삭제

## 🤖 AI 자동 답장 시스템

### 특징
- OpenAI GPT 모델을 활용한 지능형 응답 생성
- 이메일 스레드 추적 (Message-ID, In-Reply-To, References)
- 한국어/영어 자동 감지 및 응답
- Fallback 템플릿 지원 (AI 실패 시)

### 작동 조건
- admin@grinda.ai 또는 rinda@partners.grinda.ai로 수신된 이메일
- 자동으로 발신자에게 맞춤형 답장 발송

## 🔧 로컬 개발

### Elysia 서버
```bash
cd elysia-server
bun install
bun run dev  # 개발 모드 (watch)
```

### Admin 대시보드
```bash
cd admin
yarn install
yarn dev     # Vite 개발 서버
```

### Admin-Next
```bash
cd admin-next
npm install
npm run dev  # Next.js 개발 서버
```

## 📧 SendGrid 설정

### Inbound Parse 설정

1. **SendGrid 대시보드 설정**
   - Settings > Inbound Parse > Add Host & URL
   - Domain: `grinda.ai`
   - URL: `http://your-server:3001/api/webhook/inbound`

2. **DNS MX 레코드**
```
Type: MX
Host: parse
Value: mx.sendgrid.net
Priority: 10
```

3. **옵션 활성화**
   - ✅ Check incoming emails for spam
   - ✅ POST the raw, full MIME message

## 🚢 프로덕션 배포

### Docker Compose 배포
```bash
# 이미지 빌드
docker-compose build

# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f elysia-server
```

### 서버 배포 스크립트
```bash
./deploy-hana.sh
```

배포 서버: 15.165.2.108 (AWS EC2)

## 📊 모니터링

### Uptime Kuma
- URL: http://localhost:3002
- 모든 서비스 상태 실시간 모니터링
- 알림 설정 가능

### RedisInsight
- URL: http://localhost:5540
- Redis 데이터 시각화
- 실시간 명령어 실행

## 🔒 보안 고려사항

- API 키는 환경 변수로 관리 (.env)
- .env 파일은 절대 커밋하지 않음
- 프로덕션에서 HTTPS 필수
- PostgreSQL 비밀번호 강화 필요
- Redis 비밀번호 설정됨

## 📦 기술 스택

### Backend
- **Bun**: 1.2+ - JavaScript 런타임
- **Elysia**: 1.4+ - 웹 프레임워크
- **PostgreSQL**: 17.2 - 데이터베이스
- **Redis**: 7.4 - 캐싱
- **SendGrid**: 이메일 서비스
- **OpenAI**: AI 응답 생성

### Frontend
- **React**: 18+ - UI 라이브러리
- **Vite**: 5+ - 빌드 도구
- **TypeScript**: 5+ - 타입 안정성
- **TailwindCSS**: 스타일링

### DevOps
- **Docker**: 컨테이너화
- **Docker Compose**: 오케스트레이션
- **Nginx**: 리버스 프록시

## 🛠 유용한 명령어

```bash
# Docker 관련
docker-compose ps              # 서비스 상태 확인
docker-compose logs -f [서비스명]  # 로그 확인
docker-compose restart [서비스명]  # 서비스 재시작
docker-compose down            # 전체 중지
docker-compose up -d --build   # 재빌드 및 시작

# 데이터베이스 접속
docker exec -it send-grid-test-postgres-1 psql -U postgres

# Redis CLI
docker exec -it send-grid-test-redis-1 redis-cli -a sendgrid_redis_password_2024
```

## 📝 환경 변수

```env
# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DB_HOST=localhost  # Docker: postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres

# Server
NODE_ENV=development
PORT=3001
```

## 👥 회사 정보

**그린다에이아이 (GRINDA AI)**
- 대표: 강호진
- 주소: 대전광역시 유성구 대학로 99 대전팁스타운 503호
- 사업자등록번호: 309-88-02709
- 이메일: admin@grinda.ai
- 웹사이트: https://grinda.ai
- 슬로건: "AI와, 당신의 비즈니스로 미래를 함께 그립니다"

## 📄 라이선스

이 프로젝트는 그린다에이아이의 내부 프로젝트입니다.

---

**Last Updated**: 2025-09-26
**Version**: 2.0.0