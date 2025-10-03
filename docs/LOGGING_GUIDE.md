# 로그 관리 가이드

## 📍 현재 로그 저장 위치

### 1. 로컬 개발 환경 (개발자 PC)

#### 현재 상태
```typescript
// src/utils/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: !isProduction ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
    }
  } : undefined,
})
```

**로그 출력 위치:**
- ✅ **표준 출력 (stdout)** - 터미널에 실시간 출력
- ✅ **표준 에러 (stderr)** - 에러 로그
- ❌ **파일 저장 없음** - 기본적으로 파일에 저장되지 않음

**확인 방법:**
```bash
# 개발 서버 실행 시 터미널에서 확인
cd elysia-server
bun run dev

# 출력 예시:
# 12:34:56 INFO: Elysia server started at http://localhost:3001
# 12:34:57 INFO: Processing email job
```

---

### 2. Docker 컨테이너 환경 (프로덕션/스테이징)

#### 현재 상태
```yaml
# docker-compose.yml
elysia-server:
  build:
    context: ./elysia-server
  environment:
    - NODE_ENV=production
  # ⚠️ 로그 설정 없음
```

**로그 출력 위치:**
- ✅ **Docker 컨테이너 stdout** - Docker 로그 시스템이 수집
- ✅ **Docker 기본 로그 드라이버** - `json-file` (기본값)
- 📍 **실제 저장 위치**: `/var/lib/docker/containers/<container-id>/<container-id>-json.log`

**확인 방법:**
```bash
# 실시간 로그 확인
docker compose logs -f elysia-server

# 최근 100줄 확인
docker compose logs --tail=100 elysia-server

# 특정 시간 이후 로그
docker compose logs --since 2024-01-01T00:00:00 elysia-server

# 컨테이너 로그 파일 직접 확인 (EC2 서버에서)
sudo ls -lh /var/lib/docker/containers/

# 로그 파일 크기 확인
docker inspect elysia-server | grep -A 10 LogPath
```

---

## 🚨 현재 문제점

### 1. 로그 파일 관리 부재
- ❌ 컨테이너 삭제 시 로그 소실
- ❌ 로그 로테이션 설정 없음
- ❌ 로그 크기 제한 없음 → 디스크 풀 위험

### 2. 로그 검색 및 분석 어려움
- ❌ 구조화되지 않은 로그
- ❌ 중앙 집중식 로그 관리 시스템 없음
- ❌ 로그 필터링/검색 기능 부족

### 3. 장기 보관 불가능
- ❌ 히스토리 추적 어려움
- ❌ 감사(Audit) 로그 부재
- ❌ 규정 준수 어려움

---

## ✅ 개선 방안

### Phase 1: 로컬 파일 로그 (즉시 적용 가능)

#### 1-1. Pino 파일 로그 설정

```typescript
// src/utils/logger.ts
import pino from 'pino'
import { join } from 'path'
import { mkdirSync } from 'fs'

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// 로그 디렉토리 생성
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs')
try {
  mkdirSync(LOG_DIR, { recursive: true })
} catch (error) {
  console.error('Failed to create log directory:', error)
}

// 로그 스트림 설정
const streams: pino.StreamEntry[] = []

// 1. 콘솔 출력 (개발 환경)
if (isDevelopment) {
  streams.push({
    level: 'debug',
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }),
  })
}

// 2. 파일 출력 (모든 환경)
if (isProduction || isDevelopment) {
  // 일반 로그 파일
  streams.push({
    level: 'info',
    stream: pino.destination({
      dest: join(LOG_DIR, 'app.log'),
      sync: false, // 비동기 쓰기 (성능 향상)
    }),
  })

  // 에러 로그 파일 (별도)
  streams.push({
    level: 'error',
    stream: pino.destination({
      dest: join(LOG_DIR, 'error.log'),
      sync: true, // 에러는 동기 쓰기 (데이터 손실 방지)
    }),
  })
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      env: process.env.NODE_ENV,
      service: 'elysia-server',
      version: process.env.APP_VERSION || '1.0.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: ['password', 'passwordHash', 'apiKey', 'token', '*.password', '*.apiKey'],
      censor: '[REDACTED]',
    },
  },
  pino.multistream(streams)
)

export default logger
```

#### 1-2. 로그 로테이션 (pino-roll)

```bash
# 패키지 설치
bun add pino-roll
```

```typescript
// src/utils/logger.ts (로테이션 추가)
import pino from 'pino'
import { join } from 'path'

const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs')

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    // ... 기존 설정
  },
  pino.transport({
    targets: [
      // 개발 환경: 콘솔
      {
        target: 'pino-pretty',
        level: 'debug',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
        },
      },
      // 프로덕션: 파일 (일별 로테이션)
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: join(LOG_DIR, 'app'),
          frequency: 'daily', // 일별 로테이션
          extension: '.log',
          mkdir: true,
          // 파일명 형식: app-2024-01-01.log
        },
      },
      // 에러 로그 별도
      {
        target: 'pino-roll',
        level: 'error',
        options: {
          file: join(LOG_DIR, 'error'),
          frequency: 'daily',
          extension: '.log',
          mkdir: true,
        },
      },
    ],
  })
)
```

#### 1-3. Docker Volume 마운트

```yaml
# docker-compose.yml
services:
  elysia-server:
    build:
      context: ./elysia-server
    volumes:
      # 로그 디렉토리 마운트 (호스트에 저장)
      - ./logs/elysia-server:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_DIR=/app/logs
      - LOG_LEVEL=info
```

**로그 저장 위치:**
```
프로젝트_루트/
  ├── logs/
  │   └── elysia-server/
  │       ├── app-2024-01-01.log
  │       ├── app-2024-01-02.log
  │       ├── error-2024-01-01.log
  │       └── error-2024-01-02.log
```

**로그 확인:**
```bash
# 최신 로그 확인
tail -f logs/elysia-server/app-$(date +%Y-%m-%d).log

# 에러 로그만 확인
tail -f logs/elysia-server/error-$(date +%Y-%m-%d).log

# 특정 키워드 검색
grep "email sent" logs/elysia-server/app-*.log

# 최근 에러 100줄
tail -100 logs/elysia-server/error-$(date +%Y-%m-%d).log
```

---

### Phase 2: Docker 로그 드라이버 설정 (권장)

#### 2-1. Docker 로그 로테이션

```yaml
# docker-compose.yml
services:
  elysia-server:
    build:
      context: ./elysia-server
    logging:
      driver: "json-file"
      options:
        max-size: "10m"       # 파일당 최대 10MB
        max-file: "10"        # 최대 10개 파일 보관
        compress: "true"      # 압축 저장
        labels: "service,env"
        tag: "{{.Name}}/{{.ID}}"
    labels:
      - "service=elysia-server"
      - "env=production"
```

**효과:**
- 로그 파일이 10MB를 초과하면 자동 로테이션
- 최대 10개 파일 보관 (총 100MB)
- 오래된 파일 자동 삭제

#### 2-2. Syslog 드라이버 (중앙 집중식)

```yaml
# docker-compose.yml
services:
  elysia-server:
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://localhost:514"
        tag: "elysia-server"
```

---

### Phase 3: 클라우드 로그 관리 (프로덕션 권장)

#### 옵션 1: AWS CloudWatch (AWS 사용 시)

```bash
# CloudWatch Logs Agent 설치 (EC2)
sudo yum install amazon-cloudwatch-agent -y

# Docker 로그를 CloudWatch로 전송
```

```yaml
# docker-compose.yml
services:
  elysia-server:
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "ap-northeast-2"
        awslogs-group: "/ecs/elysia-server"
        awslogs-stream: "production"
        awslogs-create-group: "true"
```

**장점:**
- ✅ 중앙 집중식 로그 관리
- ✅ 실시간 검색/필터링
- ✅ 알림 설정 가능
- ✅ 장기 보관 (S3 아카이빙)

**비용:**
- 처음 5GB: 무료
- 이후 $0.50/GB

#### 옵션 2: Datadog (추천)

```bash
# Datadog Agent 설치
DD_API_KEY=<your-api-key> DD_SITE="datadoghq.com" bash -c "$(curl -L https://s.datadoghq.com/scripts/install_script_agent7.sh)"
```

```yaml
# docker-compose.yml
services:
  datadog-agent:
    image: gcr.io/datadoghq/agent:latest
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=datadoghq.com
      - DD_LOGS_ENABLED=true
      - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
      - DD_CONTAINER_EXCLUDE_LOGS="name:datadog-agent"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro

  elysia-server:
    labels:
      com.datadoghq.ad.logs: '[{"source": "nodejs", "service": "elysia-server"}]'
```

**장점:**
- ✅ 통합 모니터링 (로그 + 메트릭 + APM)
- ✅ 강력한 검색/분석
- ✅ 알림 및 대시보드
- ✅ 로그 패턴 자동 분석

**비용:**
- 무료 플랜: 제한적
- Pro: $15/호스트/월

#### 옵션 3: Grafana Loki (무료 오픈소스)

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3003:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

  elysia-server:
    # ... 기존 설정
    logging:
      driver: "json-file"

volumes:
  loki_data:
  grafana_data:
```

```yaml
# promtail-config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'logstream'
```

**장점:**
- ✅ 완전 무료 오픈소스
- ✅ Grafana와 통합
- ✅ 효율적인 스토리지 (압축)
- ✅ 셀프 호스팅 가능

---

### Phase 4: ELK Stack (대규모 엔터프라이즈)

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.11.0
    user: root
    volumes:
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - elasticsearch
      - logstash

volumes:
  elasticsearch_data:
```

**장점:**
- ✅ 강력한 검색 엔진 (Elasticsearch)
- ✅ 풍부한 시각화 (Kibana)
- ✅ 확장성 뛰어남

**단점:**
- ❌ 높은 리소스 사용량 (메모리 4GB+ 권장)
- ❌ 복잡한 설정
- ❌ 2명 팀에는 과한 스펙

---

## 🎯 2명 팀 권장 솔루션

### 초기 단계 (현재 → 1주)
```yaml
# 추천: Phase 1 + Docker 로그 로테이션
docker-compose.yml:
  elysia-server:
    volumes:
      - ./logs/elysia-server:/app/logs
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
        compress: "true"
```

**비용:** 무료
**장점:** 간단, 빠른 적용
**단점:** 수동 관리 필요

### 성장 단계 (1개월 후)
```yaml
# 추천: Grafana Loki (무료) 또는 Datadog (유료)

# 옵션 1: Loki (무료, 셀프 호스팅)
- 비용: 무료 (서버 리소스만)
- 학습 곡선: 중간
- 유지보수: 직접 관리

# 옵션 2: Datadog (유료, 관리형)
- 비용: $15/월
- 학습 곡선: 낮음
- 유지보수: 자동
```

### 스케일업 단계 (투자 유치 후)
```yaml
# 추천: AWS CloudWatch 또는 Datadog
- 중앙 집중식 로그 관리
- 알림 및 모니터링 통합
- 팀 규모 확장에 대응
```

---

## 📊 각 환경별 로그 저장 위치 요약

| 환경 | 현재 저장 위치 | 권장 저장 위치 | 접근 방법 |
|------|---------------|---------------|----------|
| **로컬 개발** | stdout (터미널) | `logs/app.log` | `tail -f logs/app.log` |
| **Docker 개발** | Docker 컨테이너 로그 | Volume 마운트 (`./logs`) | `docker compose logs -f` |
| **프로덕션 (EC2)** | `/var/lib/docker/containers/` | CloudWatch / Datadog / Loki | Web 대시보드 |
| **프로덕션 (백업)** | 없음 | S3 / Glacier | AWS CLI |

---

## 🛠️ 실용적인 로그 관리 명령어

### 로컬 파일 로그
```bash
# 실시간 로그 모니터링
tail -f logs/app-$(date +%Y-%m-%d).log

# 에러만 필터링
tail -f logs/app.log | grep ERROR

# 특정 사용자 로그 추적
grep "userId:12345" logs/app-*.log

# 로그 파일 압축 (수동 아카이브)
tar -czf logs-$(date +%Y%m%d).tar.gz logs/
```

### Docker 로그
```bash
# 실시간 로그 스트림
docker compose logs -f elysia-server

# 최근 100줄
docker compose logs --tail=100 elysia-server

# 타임스탬프 포함
docker compose logs -f --timestamps elysia-server

# 에러만 필터링
docker compose logs elysia-server 2>&1 | grep ERROR

# 특정 시간 이후 로그
docker compose logs --since "2024-01-01T00:00:00" elysia-server

# 로그 파일 크기 확인
docker system df -v | grep LOG
```

### 로그 아카이브 자동화
```bash
# scripts/archive-logs.sh
#!/bin/bash

LOG_DIR="./logs/elysia-server"
ARCHIVE_DIR="./logs/archive"
DAYS_TO_KEEP=7

# 7일 이상 된 로그 압축
find $LOG_DIR -name "*.log" -mtime +$DAYS_TO_KEEP -exec gzip {} \;

# 압축 파일 아카이브로 이동
mkdir -p $ARCHIVE_DIR
find $LOG_DIR -name "*.gz" -exec mv {} $ARCHIVE_DIR \;

# 30일 이상 된 아카이브 삭제
find $ARCHIVE_DIR -name "*.gz" -mtime +30 -delete

echo "Log archive completed at $(date)"
```

```bash
# crontab 등록 (매일 새벽 3시 실행)
crontab -e
# 추가:
0 3 * * * /path/to/scripts/archive-logs.sh
```

---

## 🔍 로그 검색 및 분석

### JSON 로그 파싱 (jq 사용)
```bash
# 설치
brew install jq  # macOS
apt install jq   # Ubuntu

# 특정 레벨만 필터링
cat logs/app.log | jq 'select(.level == "error")'

# 특정 사용자 로그만 추출
cat logs/app.log | jq 'select(.userId == "12345")'

# 시간 범위 필터링
cat logs/app.log | jq 'select(.time >= "2024-01-01T00:00:00Z")'

# 에러 메시지만 추출
cat logs/app.log | jq -r 'select(.level == "error") | .msg'

# 통계 (에러 개수)
cat logs/app.log | jq -s 'map(select(.level == "error")) | length'
```

---

## 📈 로그 모니터링 대시보드 구축

### Grafana + Loki (무료 추천)

#### 1. docker-compose.yml에 추가
```yaml
services:
  # ... 기존 서비스

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    networks:
      - app-network

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./logs:/logs:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    networks:
      - app-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3003:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - app-network

volumes:
  loki_data:
  grafana_data:
```

#### 2. Grafana 접속
```
URL: http://localhost:3003
ID: admin
PW: admin
```

#### 3. Loki 데이터 소스 추가
- Settings → Data Sources → Add Loki
- URL: `http://loki:3100`

#### 4. 로그 쿼리 예시
```logql
# 모든 로그
{job="elysia-server"}

# 에러만
{job="elysia-server"} |= "error"

# 특정 사용자
{job="elysia-server"} | json | userId="12345"

# 시간당 에러 개수
rate({job="elysia-server"} |= "error" [1h])
```

---

## 🚀 즉시 적용 가능한 설정

### 1단계: 기본 파일 로그 (5분 소요)

```bash
# 1. 패키지 설치
cd elysia-server
bun add pino-roll

# 2. logger.ts 업데이트 (위 코드 참고)

# 3. docker-compose.yml에 볼륨 추가
# 수정 후 재시작
docker compose down
docker compose up -d

# 4. 로그 확인
tail -f logs/elysia-server/app-$(date +%Y-%m-%d).log
```

### 2단계: Docker 로그 로테이션 (3분 소요)

```yaml
# docker-compose.yml 수정
services:
  elysia-server:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
        compress: "true"

# 적용
docker compose up -d
```

이제 로그가 자동으로 관리됩니다! 🎉

---

## 📚 추가 참고 자료

- [Pino Documentation](https://getpino.io/)
- [Docker Logging Best Practices](https://docs.docker.com/config/containers/logging/)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [AWS CloudWatch Logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [Datadog Log Management](https://docs.datadoghq.com/logs/)
