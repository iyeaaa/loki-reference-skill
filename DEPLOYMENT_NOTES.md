# 배포 관련 중요 사항

## 환경변수 설정

원격 서버(Hana)에서 다음 환경변수를 설정해야 합니다:

### 1. 환경변수 파일 생성
```bash
# 원격 서버에 .env 파일 생성
cd ~/data/sw_package/send-grid-test
vi .env
```

### 2. 필수 환경변수
```env
# SendGrid API Key (필수)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# OpenAI API Key (선택사항)
OPENAI_API_KEY=your_openai_api_key_here
```

## Docker Compose 설정

`docker-compose.yml`이 Next.js 앱을 실행하도록 변경되었습니다:
- 서비스명: `nextjs-app`
- 컨테이너명: `nextjs-sendgrid-webhook`
- 빌드 컨텍스트: `./client`
- 포트: 3000

## API 엔드포인트

Next.js 앱에서 제공하는 엔드포인트:
- `POST /api/webhook/inbound` - SendGrid 인바운드 이메일 웹훅
- `POST /api/webhook/inbound-store` - 이메일 저장
- `GET /api/emails` - 저장된 이메일 목록 조회
- `GET /api/health` - 헬스체크

## 배포 스크립트 실행

```bash
# 로컬에서 실행
./up-hana.sh
```

## 배포 후 확인

```bash
# 원격 서버에서 컨테이너 상태 확인
ssh hana "cd ~/data/sw_package/send-grid-test && sudo docker compose ps"

# 로그 확인
ssh hana "cd ~/data/sw_package/send-grid-test && sudo docker compose logs -f nextjs-app"

# 헬스체크
curl http://서버IP:3000/api/health
```

## 주의사항

1. `.env` 파일은 git에 포함되지 않으므로 원격 서버에 직접 생성해야 합니다
2. SendGrid API Key는 필수입니다
3. 첫 배포 시 Node.js 패키지 설치로 시간이 걸릴 수 있습니다