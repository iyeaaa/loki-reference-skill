# 시퀀스 워크플로우 디자이너

팔로우업 시퀀스 관리에 React Flow 기반 노드 편집 기능이 추가되었습니다.

## 기능 개요

### 노드 종류

1. **시작 노드**
   - 모든 워크플로우의 시작점
   - 디자이너 페이지 진입 시 기본으로 존재
   - 이메일 초안 노드를 추가할 수 있음
   - 삭제 불가

2. **이메일 초안 노드**
   - **일괄 발송**: 시퀀스에 등록된 모든 연락처에게 개별적으로 이메일 생성 및 발송
   - **두 가지 작성 방식**:
     - 🤖 **AI 자동 생성**: 프롬프트 입력 → AI가 각 고객사별 맞춤 이메일 생성
     - ✍️ **수동 작성**: 템플릿 작성 또는 각 고객사에 대해 직접 작성
   - 변수 지원: `{{이름}}`, `{{회사명}}`, `{{업종}}`, `{{이메일}}` 등
   - 이메일 관리 기능으로 모든 이메일 확인/수정 가능
   - 타이머 노드를 추가할 수 있음
   - 편집 및 삭제 가능

3. **타이머 노드**
   - 일(day) 단위로 대기 시간 설정
   - 설정된 시간 동안 답장이 오지 않으면 다음 노드 실행
   - 답장이 온 경우 해당 메일의 시퀀스 종료
   - **실시간 통계 표시**:
     - 📧 발송: 발송된 이메일 개수
     - ✅ 답장: 답장 온 이메일 개수 (시퀀스 종료)
     - ⏱️ 대기: 답장 대기 중인 이메일 개수
   - 이메일 초안 노드를 추가할 수 있음
   - 편집 및 삭제 가능

## 사용 방법

### 1. 워크플로우 디자이너 접근

시퀀스 관리 페이지 (`/sequences`)에서:
- 각 시퀀스 행의 "작업" 컬럼에 두 개의 버튼 표시
- 🔀 (Workflow) 버튼: 노드 편집 - 워크플로우 디자이너로 이동
- ✏️ (Edit) 버튼: 시퀀스 기본 정보 편집 (이름, 설명, 상태만)

### 2. 노드 추가

각 노드 하단의 "노드 추가" 버튼 클릭:
- **시작 노드**: "이메일 초안 추가" 옵션만 표시
- **이메일 초안 노드**: "타이머 추가" 옵션만 표시
- **타이머 노드**: "이메일 초안 추가" 옵션만 표시

### 3. 노드 편집

각 노드의 "편집" 버튼 클릭하여:
- **이메일 초안**: 제목과 본문 입력
- **타이머**: 대기 시간(일) 설정

### 4. 노드 삭제

시작 노드를 제외한 모든 노드 우측 상단의 휴지통 아이콘 클릭

### 5. 저장

- 워크플로우 변경 후 상단의 "저장" 버튼 클릭
- 변경사항이 있는 경우 버튼에 "(변경됨)" 표시

## 데이터베이스 마이그레이션

`sequences` 테이블에 `workflow_data` 컬럼이 추가되었습니다:

```sql
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS workflow_data TEXT;
```

마이그레이션 적용 방법:

### Option 1: Drizzle Push (권장)
```bash
cd elysia-server
bun run drizzle-kit push
```

### Option 2: 수동 SQL 실행
```bash
psql -U your_username -d your_database -f elysia-server/migrations/add_workflow_data_to_sequences.sql
```

## 기술 스택

- **React Flow**: 노드 기반 워크플로우 UI
- **워크플로우 데이터**: JSON 형식으로 `sequences.workflow_data`에 저장
- **노드 타입**: 커스텀 React 컴포넌트로 구현

## 로직 처리

- **프론트엔드**: 워크플로우 정보 등록 및 시각화
- **백엔드**: 실제 이메일 발송, 타이머 처리, 답장 감지 로직
- **답장 처리**: 
  - 답장이 온 경우 해당 enrollment의 시퀀스 종료
  - 각 메일은 독립적으로 처리됨 (enrollment 단위)
  - 답장은 `replied-emails` 페이지에 표시

## 파일 구조

```
admin/src/pages/sequences/
├── designer/
│   ├── SequenceDesigner.tsx          # 메인 디자이너 페이지
│   └── nodes/
│       ├── StartNode.tsx              # 시작 노드 컴포넌트
│       ├── EmailDraftNode.tsx         # 이메일 초안 노드
│       └── TimerNode.tsx              # 타이머 노드
├── SequencesPage.tsx                  # 시퀀스 목록 (편집 모달 간소화)
├── SequencesTableWithPagination.tsx   # 노드 편집 버튼 추가
├── SequenceForm.tsx                   # 기본 정보 편집 폼
├── SequenceFilters.tsx                # 필터 컴포넌트
├── BulkActionModal.tsx                # 일괄 작업 모달
└── SequenceEnrollmentsTable.tsx       # 등록 현황 (향후 사용 예정)

admin/src/router/index.tsx             # 라우트 추가
admin/src/lib/api/types/sequence.ts    # 타입 정의 업데이트

elysia-server/src/db/schema/sequences.ts        # DB 스키마 업데이트
elysia-server/src/services/sequence.service.ts  # 서비스 업데이트
elysia-server/src/routes/sequences.routes.ts    # API 라우트 업데이트
```

### 제거된 파일 (노드 디자이너로 대체)
- ~~SequenceDetailTabs.tsx~~ - 시퀀스 상세 탭 (스탭/등록)
- ~~SequenceStepsList.tsx~~ - 시퀀스 스탭 리스트
- ~~SequenceStepForm.tsx~~ - 시퀀스 스탭 폼

## 변경 내역

### v1.4 - AI 통합 완료 🎉
- ✅ AI 워크플로우 이메일 생성 서비스 구현
  - OpenAI API 연동 (GPT-3.5-turbo, GPT-4 지원)
  - 프롬프트 변수 치환 엔진 (한글/영문)
  - 제목/본문 자동 파싱
  - AI 실패 시 폴백 로직
- ✅ 백엔드 API 완전 구현
  - 일괄 생성 API (AI/수동 모두 지원)
  - 개별 재생성 API (AI 전용)
  - CRUD API 전체
- ✅ 프론트엔드 API 연동 완료
  - React Query 훅 구현
  - 실시간 로딩 상태 표시
  - 에러 처리

### v1.3 - AI/수동 하이브리드 모드
- ✅ 이메일 초안 노드: AI 자동 생성 & 수동 작성 모드 추가
  - 작성 방식 선택 UI (Radio Group)
  - AI 모드: 프롬프트 입력
  - 수동 모드: 템플릿 입력
  - 생성 모드 표시 배지 (🤖 AI 생성 / ✍️ 수동 작성)
  - "이메일 관리" 버튼 추가
- ✅ AI 이메일 생성 명세 문서 작성 (`ai-email-generation.md`)
- ✅ workflow_generated_emails 테이블 마이그레이션 SQL 작성

### v1.2 - 일괄 발송 및 통계 기능
- ✅ 이메일 초안 노드: 일괄 발송 개념 명확화
  - 모든 연락처에게 개별 발송됨을 UI에 표시
  - 템플릿 변수 지원 안내 추가
- ✅ 타이머 노드: 실시간 통계 표시 UI 추가
  - 발송/답장/대기 개수 표시
  - 백엔드 API 연동 준비 완료
- ✅ 통계 API 명세 문서 작성 (`workflow-statistics-api.md`)
- ✅ NodeStatistics 타입 추가

### v1.1 - UI 간소화
- ✅ 기존 시퀀스 스탭 UI 제거 (SequenceDetailTabs, SequenceStepsList, SequenceStepForm)
- ✅ 편집 모달을 기본 정보만 수정하도록 간소화
- ✅ 워크플로우는 노드 디자이너에서만 관리

### v1.0 - 초기 구현
- ✅ React Flow 기반 노드 디자이너
- ✅ 3가지 노드 타입 (시작, 이메일 초안, 타이머)
- ✅ workflow_data JSON 저장

## 관련 문서

- [워크플로우 통계 API 명세](./workflow-statistics-api.md) - 타이머 노드 실시간 통계 구현

## 향후 개선 사항

### 백엔드 (우선순위 높음)
- [ ] 워크플로우 파싱 및 실행 로직 구현
- [ ] 노드 통계 API 구현 (`GET /api/v1/sequences/:id/nodes/:nodeId/stats`)
- [ ] 타이머 기반 스케줄링 (cron job)
- [ ] 답장 감지 및 시퀀스 자동 종료
- [ ] 템플릿 변수 치환 기능 ({{이름}}, {{회사명}} 등)

### 프론트엔드
- [ ] 실시간 통계 자동 갱신 (polling 또는 WebSocket)
- [ ] 워크플로우 실행 이력 시각화
- [ ] 노드 복사/붙여넣기 기능
- [ ] 워크플로우 템플릿 라이브러리

### 고급 기능
- [ ] 분기 노드 추가 (조건부 분기)
- [ ] A/B 테스팅 노드
- [ ] 시간대별 발송 스케줄링
- [ ] 이메일 오픈/클릭 추적
