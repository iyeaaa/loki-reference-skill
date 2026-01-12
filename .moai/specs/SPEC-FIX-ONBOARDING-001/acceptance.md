# SPEC-FIX-ONBOARDING-001: 인수 조건

## 메타데이터

| 필드 | 값 |
|------|-----|
| SPEC ID | SPEC-FIX-ONBOARDING-001 |
| 버전 | 1.0.0 |
| 상태 | Planned |

---

## 테스트 시나리오

### ACC-001: Trial 사용자 로그아웃 - Trial 페이지로 리다이렉트

**요구사항**: REQ-001

**Given** (전제조건)
- Trial 사용자가 Google OAuth로 로그인한 상태
- localStorage에 user 객체가 존재하고 userRole이 "user"
- 사용자가 대시보드 또는 /company 페이지에 있음

**When** (실행)
- 사용자가 로그아웃 버튼을 클릭

**Then** (기대결과)
- localStorage에서 authToken과 user가 삭제됨
- 브라우저가 `/trial?from=logout` 경로로 리다이렉트됨
- 라이선스 키 입력 모달이 표시되지 않음
- NewTrialPage 컴포넌트가 렌더링됨

**검증 방법**:
```javascript
// 개발자 도구 콘솔에서 확인
localStorage.getItem("authToken") === null
localStorage.getItem("user") === null
window.location.pathname === "/trial"
window.location.search.includes("from=logout")
```

---

### ACC-002: Trial 사용자 로그아웃 - 세션 데이터 정리

**요구사항**: REQ-001

**Given** (전제조건)
- Trial 사용자가 로그인한 상태
- sessionStorage에 온보딩 관련 데이터가 존재

**When** (실행)
- 사용자가 로그아웃 버튼을 클릭

**Then** (기대결과)
- sessionStorage의 다음 키들이 삭제됨:
  - `onboarding_sequence`
  - `onboarding_leads`
  - `onboarding_company_info`
  - `onboarding_customer_group_id`
- localStorage의 `rinda_survey_data`가 삭제됨

**검증 방법**:
```javascript
// 로그아웃 후 확인
sessionStorage.getItem("onboarding_sequence") === null
sessionStorage.getItem("onboarding_leads") === null
localStorage.getItem("rinda_survey_data") === null
```

---

### ACC-003: Admin 사용자 로그아웃 - Auth 페이지로 리다이렉트

**요구사항**: REQ-002

**Given** (전제조건)
- Admin 사용자가 라이선스 키로 로그인한 상태
- localStorage에 user 객체가 존재하고 userRole이 "admin" 또는 "super_admin"

**When** (실행)
- 관리자가 로그아웃 버튼을 클릭

**Then** (기대결과)
- 브라우저가 `/auth` 경로로 리다이렉트됨
- Production 환경에서 LicenseProtectedLoginPage가 렌더링됨

**검증 방법**:
```javascript
window.location.pathname === "/auth"
```

---

### ACC-004: 온보딩 미완료 사용자 - /company로 단일 리다이렉트

**요구사항**: REQ-003

**Given** (전제조건)
- Trial 사용자가 로그인한 상태
- 온보딩이 완료되지 않음 (completedAt === null)
- 워크스페이스는 존재함

**When** (실행)
- 사용자가 `/dashboard` 페이지에 직접 접근

**Then** (기대결과)
- `/company` 페이지로 단일 리다이렉트 발생
- 무한 루프가 발생하지 않음
- 브라우저 히스토리에 불필요한 엔트리가 쌓이지 않음
- 콘솔에 "[UnifiedDashboard] Onboarding not complete, redirecting to /company" 로그 출력

**검증 방법**:
```javascript
// Network 탭에서 리다이렉트 횟수 확인
// 1회의 리다이렉트만 발생해야 함
window.location.pathname === "/company"
```

---

### ACC-005: 무한 루프 감지 및 중단

**요구사항**: REQ-003

**Given** (전제조건)
- 비정상적인 상태로 인해 리다이렉트가 반복 발생하는 상황

**When** (실행)
- 3회 이상의 연속 리다이렉트가 감지됨

**Then** (기대결과)
- 추가 리다이렉트가 중단됨
- 콘솔에 "[CompanyInformation] Redirect loop detected, staying on page" 에러 로그 출력
- 사용자가 현재 페이지에 머무름
- sessionStorage의 리다이렉트 카운터가 초기화됨

**검증 방법**:
```javascript
// 무한 루프 발생 시나리오 재현 후 확인
// 페이지가 안정적으로 로딩되어야 함
```

---

### ACC-006: 워크스페이스 미존재 시 처리

**요구사항**: REQ-004

**Given** (전제조건)
- Trial 사용자가 로그인한 상태
- 사용자에게 할당된 워크스페이스가 없음 (userWorkspaces가 빈 배열)

**When** (실행)
- 사용자가 `/dashboard` 페이지에 접근

**Then** (기대결과)
- `/company` 페이지로 리다이렉트됨
- 콘솔에 "[UnifiedDashboard] No workspace, redirecting to /company" 로그 출력
- /company 페이지에서 무한 루프 없이 온보딩 UI 표시

**검증 방법**:
```javascript
// 워크스페이스 없는 사용자로 테스트
window.location.pathname === "/company"
// CompanyInformation 컴포넌트가 정상 렌더링
```

---

### ACC-007: 온보딩 상태 불일치 - Graceful 처리

**요구사항**: REQ-005

**Given** (전제조건)
- 온보딩 진행 상태 API가 에러를 반환하는 상황
- 또는 onboardingProgress가 null인 상황

**When** (실행)
- /company 페이지가 로딩됨

**Then** (기대결과)
- 에러가 발생해도 페이지가 크래시하지 않음
- 사용자에게 기본 온보딩 UI가 표시됨
- 콘솔에 적절한 에러 로그가 출력됨

**검증 방법**:
```javascript
// API 에러 시뮬레이션 후 확인
// React Error Boundary가 트리거되지 않아야 함
```

---

### ACC-008: 온보딩 재시작 안내

**요구사항**: REQ-005

**Given** (전제조건)
- 온보딩 데이터가 불완전한 상태
- surveyData가 없거나 부분적으로만 존재

**When** (실행)
- /company 페이지가 로딩됨

**Then** (기대결과)
- StepCompanyInfo 컴포넌트가 기본 표시됨
- 사용자가 처음부터 온보딩을 진행할 수 있음
- 기존 부분 데이터로 인한 충돌이 발생하지 않음

---

## 품질 게이트 (Quality Gate)

### 기능 완성도

| 항목 | 기준 | 검증 방법 |
|-----|-----|---------|
| 모든 테스트 시나리오 통과 | 8/8 시나리오 | 수동 테스트 |
| 콘솔 에러 없음 | 0 에러 | 브라우저 개발자 도구 |
| 무한 루프 없음 | 리다이렉트 <= 2회 | Network 탭 확인 |

### 코드 품질

| 항목 | 기준 | 검증 방법 |
|-----|-----|---------|
| TypeScript 에러 없음 | 0 에러 | `bun run typecheck` |
| ESLint 경고 없음 | 0 경고 | `bun run lint` |
| 빌드 성공 | 빌드 완료 | `bun run build` |

### 성능

| 항목 | 기준 | 검증 방법 |
|-----|-----|---------|
| 리다이렉트 응답 시간 | < 100ms | 브라우저 Performance |
| 추가 번들 크기 | < 1KB | 빌드 분석 |

---

## Definition of Done (완료 정의)

- [ ] 모든 인수 조건(ACC-001 ~ ACC-008) 통과
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고 없음
- [ ] Production 빌드 성공
- [ ] 스테이징 환경 배포 및 검증 완료
- [ ] QA 승인
- [ ] 코드 리뷰 완료
- [ ] PR 머지 및 Production 배포

---

## 추적성 (Traceability)

| 인수 조건 | 요구사항 | 구현 태스크 |
|----------|---------|-----------|
| ACC-001 | REQ-001 | Task 1.1 |
| ACC-002 | REQ-001 | Task 1.1 |
| ACC-003 | REQ-002 | Task 1.1 |
| ACC-004 | REQ-003 | Task 2.1 |
| ACC-005 | REQ-003 | Task 2.2 |
| ACC-006 | REQ-004 | Task 2.1 |
| ACC-007 | REQ-005 | Task 3.1 |
| ACC-008 | REQ-005 | Task 2.2, 3.1 |
