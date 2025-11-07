# OpenAI API 키 관리 기능 가이드

## 📋 개요

Workspace별로 여러 개의 OpenAI API 키를 관리하고, Round-robin 방식으로 순차적으로 사용하는 기능입니다.

## 🎯 주요 기능

### 1. 여러 개의 API 키 등록
- Workspace별로 여러 개의 OpenAI API 키를 등록할 수 있습니다
- 각 키에 이름을 지정하여 쉽게 구분할 수 있습니다

### 2. Round-robin 방식 자동 순환
- 등록된 키를 **순서대로 번갈아가며 사용**합니다
- 마지막으로 사용한 시간을 추적하여 가장 오래 사용하지 않은 키를 선택합니다
- 사용 횟수도 자동으로 기록됩니다

### 3. 활성/비활성 관리
- 각 키를 개별적으로 활성화/비활성화할 수 있습니다
- 비활성화된 키는 자동으로 건너뜁니다

### 4. 폴백 메커니즘
- Workspace에 등록된 키가 없거나 모두 비활성화된 경우
- 서버의 환경 변수 `OPENAI_API_KEY`를 자동으로 사용합니다

## 🔧 설치 방법

### 1. DB 마이그레이션 실행

```bash
cd elysia-server
bun run db:push
```

새로운 테이블 `openai_api_keys`가 생성됩니다:
- `id`: 고유 ID
- `workspace_id`: Workspace 식별자
- `name`: API 키 이름
- `api_key`: 암호화된 API 키
- `order_index`: 사용 순서
- `is_active`: 활성화 여부
- `last_used_at`: 마지막 사용 시간
- `usage_count`: 사용 횟수
- `created_at`, `updated_at`: 생성/수정 시간

### 2. 환경 변수 설정 (선택사항)

`.env` 파일에 암호화 키를 설정할 수 있습니다 (기본값이 있으므로 선택사항):

```env
API_KEY_ENCRYPTION_SECRET=your-custom-encryption-secret-change-this
```

⚠️ **보안 권고**: 프로덕션 환경에서는 반드시 강력한 암호화 키로 변경하세요.

### 3. 서버 재시작

```bash
bun run dev
```

## 📍 사용 방법

### 1. 설정 페이지에서 API 키 관리

1. **설정(Settings) 페이지 접속**
2. **"OpenAI API 키 관리"** 섹션 찾기
3. **"API 키 추가"** 버튼 클릭

### 2. API 키 추가

**필수 정보:**
- **키 이름**: 키를 구분하기 위한 이름 (예: "Main Key", "Backup Key 1")
- **API 키**: OpenAI에서 발급받은 API 키 (`sk-...`로 시작)

**OpenAI API 키 발급:**
1. [OpenAI 플랫폼](https://platform.openai.com/api-keys) 접속
2. "Create new secret key" 클릭
3. 키 이름 입력 후 생성
4. 생성된 키를 복사 (한 번만 표시됩니다!)

### 3. API 키 순서 및 사용

등록된 순서대로 번호가 부여됩니다:
- **1번 키** → **2번 키** → **3번 키** → **1번 키** (반복)

**예시:**
```
1. Main Key          (활성)
2. Backup Key 1      (활성)
3. Backup Key 2      (비활성) ← 건너뜀
4. Emergency Key     (활성)
```

**사용 순서:**
```
요청 1 → Main Key
요청 2 → Backup Key 1
요청 3 → Emergency Key (3번 건너뜀)
요청 4 → Main Key (순환)
```

### 4. API 키 관리 기능

#### 활성화/비활성화
- 각 키 옆의 **"활성화"** 또는 **"비활성화"** 버튼 클릭
- 비활성화된 키는 자동으로 건너뜁니다

#### 삭제
- 휴지통 아이콘 클릭
- 확인 후 영구 삭제

#### 통계 확인
- **마지막 사용 시간**: 언제 마지막으로 사용되었는지
- **사용 횟수**: 총 몇 번 사용되었는지

## 🚀 Web Data Extraction에서 사용

### 자동 적용

웹 데이터 추출 기능에서 자동으로 등록된 API 키를 사용합니다:

1. **파일 업로드 시**
   - Workspace에 등록된 활성 API 키가 있으면 Round-robin으로 사용
   - 없으면 서버의 기본 키 사용

2. **API 키 상태 표시**
   - 웹 데이터 추출 페이지 상단에 현재 등록된 키 개수 표시
   - 등록된 키가 없으면 경고 메시지 표시

### 예시

**API 키 3개 등록 시:**
```
회사 1 → Main Key (1번째 요청)
회사 2 → Backup Key 1 (2번째 요청)
회사 3 → Backup Key 2 (3번째 요청)
회사 4 → Main Key (4번째 요청, 순환)
...
```

## 💡 사용 시나리오

### 시나리오 1: 단일 키 사용
```
키 등록: Main Key (활성)
결과: 모든 요청이 Main Key 사용
```

### 시나리오 2: 부하 분산
```
키 등록:
- Key 1 (활성)
- Key 2 (활성)
- Key 3 (활성)

결과: 3개 키를 순환하며 사용 → 각 키의 Rate Limit 부담 감소
```

### 시나리오 3: 백업 키
```
키 등록:
- Production Key (활성)
- Backup Key (비활성)

평소: Production Key만 사용
긴급 시: Production Key 비활성화 → Backup Key 활성화
```

### 시나리오 4: 키 없음 (폴백)
```
키 등록: 없음
결과: 서버 환경 변수의 OPENAI_API_KEY 사용
```

## 🔒 보안

### API 키 암호화

- 모든 API 키는 DB에 암호화되어 저장됩니다
- XOR 기반 암호화 사용 (간단한 방식)
- 프로덕션에서는 더 강력한 암호화 권장

### 키 마스킹

- UI에서는 키의 일부만 표시됩니다: `sk-proj...x8K9`
- 전체 키는 서버에서만 복호화되어 사용됩니다

### 환경 변수

```env
# .env 파일
API_KEY_ENCRYPTION_SECRET=strong-secret-key-for-production
```

⚠️ **주의**: 프로덕션 환경에서는 반드시 강력한 시크릿 키로 변경하세요!

## 📊 통계 및 모니터링

### 각 키별 통계

- **마지막 사용 시간**: `last_used_at`
- **총 사용 횟수**: `usage_count`

### 로그

서버 로그에서 API 키 사용 내역 확인:

```log
INFO: Selected API key for use {
  workspaceId: "xxx",
  keyId: "yyy",
  keyName: "Main Key",
  usageCount: 42
}
```

## 🔧 API 엔드포인트

### GET /api/v1/admin/openai-api-keys/:workspaceId
Workspace의 모든 API 키 조회

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workspaceId": "uuid",
      "name": "Main Key",
      "apiKey": "sk-proj...x8K9",
      "orderIndex": 0,
      "isActive": true,
      "lastUsedAt": "2025-01-07T10:30:00Z",
      "usageCount": 42,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-07T10:30:00Z"
    }
  ]
}
```

### POST /api/v1/admin/openai-api-keys
API 키 생성

**Request:**
```json
{
  "workspaceId": "uuid",
  "name": "Main Key",
  "apiKey": "sk-proj-..."
}
```

### PUT /api/v1/admin/openai-api-keys/:id
API 키 수정

**Request:**
```json
{
  "workspaceId": "uuid",
  "name": "Updated Name",
  "isActive": false
}
```

### DELETE /api/v1/admin/openai-api-keys/:id?workspaceId=uuid
API 키 삭제

## ❓ FAQ

### Q1: 키가 없으면 어떻게 되나요?
**A:** 서버의 환경 변수 `OPENAI_API_KEY`가 자동으로 사용됩니다.

### Q2: 모든 키가 비활성화되면?
**A:** 서버의 기본 키로 폴백됩니다.

### Q3: 키 순서를 변경할 수 있나요?
**A:** 현재 버전에서는 추가된 순서대로 사용됩니다. 향후 드래그 앤 드롭 기능 추가 예정입니다.

### Q4: Rate Limit에 걸리면?
**A:** OpenAI의 Rate Limit 오류 시, 자동으로 다음 키로 넘어가지 않습니다. 수동으로 해당 키를 비활성화해야 합니다.

### Q5: 키를 잘못 입력했어요
**A:** 수정 기능을 사용하거나 삭제 후 다시 추가하세요.

### Q6: 여러 Workspace에서 같은 키를 사용할 수 있나요?
**A:** 네, 가능합니다. 각 Workspace에서 같은 키를 개별적으로 등록할 수 있습니다.

## 🔗 관련 파일

### 백엔드
- `/elysia-server/src/db/schema/openai-api-keys.ts` - DB 스키마
- `/elysia-server/src/services/openai-api-key.service.ts` - 키 관리 로직
- `/elysia-server/src/routes/openai-api-keys.routes.ts` - API 라우트
- `/elysia-server/src/services/web-extraction.service.ts` - 웹 추출에서 사용

### 프론트엔드
- `/admin/src/pages/settings/OpenAIApiKeyManagement.tsx` - API 키 관리 UI
- `/admin/src/pages/settings/WebDataExtraction.tsx` - 웹 데이터 추출 UI
- `/admin/src/pages/settings.tsx` - 설정 페이지

### 마이그레이션
- `/elysia-server/drizzle/0013_burly_jimmy_woo.sql` - DB 마이그레이션

## 🆘 문제 해결

### "API 키를 불러오는데 실패했습니다"
- 서버가 실행 중인지 확인
- 네트워크 연결 확인
- 브라우저 콘솔에서 에러 확인

### "OpenAI API 키가 설정되지 않았습니다"
- 설정 페이지에서 API 키 추가
- 또는 서버 `.env`에 `OPENAI_API_KEY` 설정

### 키가 사용되지 않는 것 같아요
- 키가 활성화되어 있는지 확인
- 서버 로그에서 어떤 키가 사용되는지 확인
- 여러 키가 있으면 Round-robin으로 순환 사용됩니다

## 📚 참고 자료

- [OpenAI API 문서](https://platform.openai.com/docs/api-reference)
- [OpenAI API Keys 관리](https://platform.openai.com/api-keys)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

---

**Version:** 1.0.0
**Last Updated:** 2025-01-07
