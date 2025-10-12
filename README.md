# SendGrid 이메일 서비스 플랫폼

## 프로젝트 개요

SendGrid API를 활용한 종합 이메일 관리 시스템입니다. 이메일 송수신, AI 자동 답장, 주소록 관리, 사용자 인증 등의 기능을 제공합니다.

## 주요 기능

### 이메일 서비스
- **대량 이메일 발송**: SendGrid API를 통한 마케팅 이메일 발송
- **인바운드 이메일 처리**: SendGrid Inbound Parse 웹훅을 통한 실시간 이메일 수신
- **AI 자동 답장**: OpenAI GPT를 활용한 지능형 자동 답장 시스템
- **이메일 스레드 관리**: Message-ID 기반 이메일 대화 추적

### 사용자 관리
- **JWT 기반 인증**: 안전한 사용자 인증 시스템
- **부서 관리**: 조직 구조 및 부서별 권한 관리
- **주소록**: 연락처 CRUD 및 그룹 관리

### 관리 대시보드
- **React 기반 UI**: 최신 React 19 및 Vite로 구축된 반응형 대시보드
- **실시간 모니터링**: 이메일 발송 상태 및 시스템 상태 확인
- **데이터 시각화**: Recharts를 활용한 통계 차트

## 기술 스택

### Backend (Elysia Server)
- **Runtime**: Bun 1.2+
- **Framework**: Elysia.js 1.4+
- **Database**: PostgreSQL 17.2 + Drizzle ORM
- **Cache**: Redis 7.4
- **AI**: OpenAI API
- **Email**: SendGrid API
- **Authentication**: JWT

### Frontend (Admin Dashboard)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7 (Rolldown)
- **Styling**: TailwindCSS v4 + shadcn/ui
- **State Management**: Jotai + React Query
- **UI Components**: Radix UI
- **Code Quality**: Biome + Husky

### DevOps
- **Container**: Docker + Docker Compose
- **Proxy**: Nginx
- **Monitoring**: Uptime Kuma
- **Redis GUI**: RedisInsight

## 프로젝트 구조

```
send-grid-test/
├── admin/                      # React 관리자 대시보드
│   ├── src/
│   │   ├── components/        # React 컴포넌트
│   │   ├── pages/            # 페이지 컴포넌트
│   │   ├── hooks/            # Custom React Hooks
│   │   ├── lib/              # 유틸리티 함수
│   │   └── router/           # React Router 설정
│   ├── package.json
│   └── Dockerfile
│
├── elysia-server/             # Bun + Elysia 백엔드 서버
│   ├── src/
│   │   ├── index.ts          # 메인 서버
│   │   ├── config/           # 설정 파일
│   │   ├── db/               # 데이터베이스 (Drizzle)
│   │   ├── routes/           # API 라우트
│   │   ├── services/         # 비즈니스 로직
│   │   ├── plugins/          # Elysia 플러그인
│   │   └── lib/              # 유틸리티
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml         # Docker 오케스트레이션
├── nginx.conf                # Nginx 설정
├── deploy-hana.sh            # 배포 스크립트
└── up-hana.sh                # 서버 시작 스크립트
```

## API 엔드포인트

### 헬스체크
- `GET /health` - 서버 상태 확인
- `GET /api/health` - API 서버 상태

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 이메일
- `GET /api/emails` - 이메일 목록 조회
- `POST /api/emails/send` - 이메일 발송
- `POST /api/emails/send-bulk` - 대량 이메일 발송

### SendGrid 웹훅
- `POST /api/webhook/inbound` - 인바운드 이메일 처리 & AI 자동 답장
- `POST /api/webhook/inbound-store` - 이메일 저장 전용

### AI
- `POST /api/ai/generate-reply` - AI 답장 생성
- `POST /api/ai/analyze` - 이메일 내용 분석

### 주소록
- `GET /api/address-book` - 주소록 조회
- `POST /api/address-book` - 연락처 추가
- `PUT /api/address-book/:id` - 연락처 수정
- `DELETE /api/address-book/:id` - 연락처 삭제

### 사용자 관리
- `GET /api/users` - 사용자 목록
- `GET /api/users/:id` - 사용자 상세
- `PUT /api/users/:id` - 사용자 정보 수정
- `DELETE /api/users/:id` - 사용자 삭제

### 부서 관리
- `GET /api/departments` - 부서 목록
- `POST /api/departments` - 부서 생성
- `PUT /api/departments/:id` - 부서 수정
- `DELETE /api/departments/:id` - 부서 삭제

## 시작하기

### 필수 요구사항
- Docker & Docker Compose
- Node.js 20+
- Bun 1.2+
- SendGrid 계정 및 API 키
- OpenAI API 키 (AI 기능용)

### 빠른 시작

#### 1. 저장소 클론
```bash
git clone git@github.com:CheolheeLee0/send-grid-test.git
cd send-grid-test
```

#### 2. 환경 변수 설정
```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DB_HOST=postgres  # Docker 사용시
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres

# Redis
REDIS_HOST=redis  # Docker 사용시
REDIS_PORT=6379
REDIS_PASSWORD=sendgrid_redis_password_2024

# JWT
JWT_SECRET=your_jwt_secret_key

# Server
NODE_ENV=production
PORT=3001
```

#### 3. Docker Compose로 실행
```bash
# 모든 서비스 시작
docker-compose up -d

# 특정 서비스만 시작
docker-compose up -d postgres redis elysia-server admin
```

## 로컬 개발

### 개발 환경 설정

```bash
# 루트에서 한 번에 설치 (권장)
yarn install  # Husky pre-commit hook 자동 설치

# 또는 개별 설치
cd admin && yarn install
cd ../elysia-server && bun install
```

**Git Hook 자동 적용**: 루트 또는 admin에서 의존성 설치 시 Husky pre-commit hook이 자동으로 활성화됩니다. 이후 모든 커밋 시 admin과 elysia-server 양쪽에서 Biome lint가 자동 실행되어 코드 품질이 강제됩니다.

### Backend 개발
```bash
cd elysia-server
bun run dev  # 개발 서버 시작 (watch 모드)
```

### Frontend 개발
```bash
cd admin
yarn dev     # Vite 개발 서버 시작
```

### 데이터베이스 마이그레이션
```bash
cd elysia-server
bun run db:generate  # 마이그레이션 파일 생성
bun run db:migrate   # 마이그레이션 실행
bun run db:studio    # Drizzle Studio 실행
```

## 서비스 포트

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Admin Dashboard | 3000 | React 관리자 대시보드 |
| Elysia Server | 3001 | 백엔드 API 서버 |
| PostgreSQL | 5432 | 메인 데이터베이스 |
| Redis | 6379 | 캐시 & 세션 스토어 |
| RedisInsight | 5540 | Redis 관리 도구 |
| Uptime Kuma | 3002 | 서비스 모니터링 |

## SendGrid 설정

### Inbound Parse 웹훅 설정

1. **SendGrid 대시보드**
   - Settings > Inbound Parse > Add Host & URL
   - Domain: `grinda.ai`
   - URL: `https://your-domain.com/api/webhook/inbound`

2. **DNS MX 레코드 설정**
   ```
   Type: MX
   Host: parse
   Value: mx.sendgrid.net
   Priority: 10
   ```

3. **옵션 설정**
   - ✅ Check incoming emails for spam
   - ✅ POST the raw, full MIME message

## 배포

### 프로덕션 배포
```bash
# 배포 스크립트 실행
./deploy-hana.sh

# 또는 수동으로
docker-compose build
docker-compose up -d
```

### 서버 정보
- Production URL: https://sendgrinda.cloud
- Server IP: 43.200.230.4 (AWS EC2)

## 유용한 명령어

```bash
# Docker 관리
docker-compose ps                    # 서비스 상태 확인
docker-compose logs -f [서비스명]    # 로그 확인
docker-compose restart [서비스명]    # 서비스 재시작
docker-compose down                  # 전체 중지
docker-compose up -d --build         # 재빌드 및 시작

# 데이터베이스 접속
docker exec -it send-grid-test-postgres-1 psql -U postgres

# Redis CLI
docker exec -it send-grid-test-redis-1 redis-cli -a sendgrid_redis_password_2024

# 로그 확인
docker-compose logs -f elysia-server
docker-compose logs -f admin
```

## 코드 품질

### Linting & Formatting
```bash
# Backend
cd elysia-server
bun run lint       # Biome 린트 실행
bun run format     # Biome 포맷팅

# Frontend
cd admin
yarn lint          # Biome 린트 실행
yarn format        # Biome 포맷팅
yarn check         # 린트 + 타입 체크
```

### Git Hooks
프로젝트는 Husky를 사용하여 커밋 전 자동으로 코드 품질을 검사합니다.

## 모니터링

### Uptime Kuma
- URL: http://localhost:3002
- 모든 서비스의 상태를 실시간으로 모니터링
- 알림 설정 가능 (Email, Slack, Discord 등)

### RedisInsight
- URL: http://localhost:5540
- Redis 데이터 시각화
- 실시간 명령어 실행 및 모니터링

## 보안 고려사항

- 모든 API 키는 환경 변수로 관리
- JWT 기반 인증 시스템
- HTTPS 강제 적용 (프로덕션)
- Redis 비밀번호 설정
- PostgreSQL 접근 제한
- CORS 정책 적용

## 회사 정보

**그린다에이아이 (GRINDA AI)**
- 대표: 강호진
- 주소: 대전광역시 유성구 대학로 99 대전팁스타운 503호
- 사업자등록번호: 309-88-02709
- 이메일: admin@grinda.ai
- 웹사이트: https://grinda.ai

## 라이선스

이 프로젝트는 그린다에이아이의 내부 프로젝트입니다.

---

**Version**: 2.1.0
**Last Updated**: 2025-09-30