# SPEC-FIX-ONBOARDING-001: 온보딩/트라이얼 프로세스 버그 수정

## 메타데이터

| 필드 | 값 |
|------|-----|
| SPEC ID | SPEC-FIX-ONBOARDING-001 |
| 버전 | 1.0.0 |
| 상태 | Planned |
| 우선순위 | High |
| 생성일 | 2026-01-12 |
| 담당 | expert-frontend |
| 관련 파일 | auth-provider.tsx, UnifiedDashboardPage.tsx, ProtectedRoute.tsx |

---

## 환경 (Environment)

### 기술 스택
- **프론트엔드**: React 19, TypeScript 5.x, Vite 6.x
- **상태 관리**: Zustand, Jotai
- **라우팅**: React Router DOM
- **UI**: TailwindCSS, Radix UI
- **백엔드**: Elysia.js (Bun Runtime), Drizzle ORM, PostgreSQL 17

### 영향 범위
- `/admin/src/lib/auth-provider.tsx` - 인증 컨텍스트 및 로그아웃 로직
- `/admin/src/pages/UnifiedDashboardPage.tsx` - 통합 대시보드 페이지
- `/admin/src/components/ProtectedRoute.tsx` - 라우트 보호 컴포넌트
- `/admin/src/router/index.tsx` - 라우터 설정

### 사용자 유형
- **Trial User**: Google OAuth로 가입한 트라이얼 사용자 (userRole: "user")
- **Admin User**: 라이선스 키로 로그인하는 관리자 (userRole: "admin" | "super_admin")

---

## 가정 (Assumptions)

### 기술적 가정
1. 사용자 역할(userRole)은 localStorage의 user 객체에 저장됨
2. 트라이얼 사용자는 항상 userRole이 "user"로 설정됨
3. 관리자는 userRole이 "admin" 또는 "super_admin"으로 설정됨
4. 온보딩 진행 상태는 서버의 onboarding_progress 테이블에 저장됨
5. workspaceId가 없는 사용자는 온보딩이 완료되지 않은 것으로 간주됨

### 비즈니스 가정
1. 트라이얼 사용자는 /trial 페이지를 통해 재로그인해야 함
2. 관리자만 /auth (라이선스 키 페이지)를 통해 로그인 가능
3. 온보딩 미완료 사용자는 /company 페이지로 안내되어야 함
4. 무한 루프는 사용자 경험을 심각하게 저해함

---

## 요구사항 (Requirements)

### REQ-001: 트라이얼 사용자 로그아웃 리다이렉트

**EARS 패턴**: Event-Driven (WHEN-THEN)

**WHEN** 트라이얼 사용자(userRole === "user")가 로그아웃 버튼을 클릭하면
**THEN** 시스템은 `/trial?from=logout` 경로로 리다이렉트해야 한다

**상세 요구사항**:
- 현재: 모든 사용자가 `/auth`로 리다이렉트됨
- 변경: userRole이 "user"인 경우 `/trial?from=logout`으로 리다이렉트
- userRole이 "admin" 또는 "super_admin"인 경우 기존대로 `/auth`로 리다이렉트

### REQ-002: 관리자 로그아웃 리다이렉트 유지

**EARS 패턴**: Event-Driven (WHEN-THEN)

**WHEN** 관리자(userRole === "admin" | "super_admin")가 로그아웃하면
**THEN** 시스템은 기존대로 `/auth` 경로로 리다이렉트해야 한다

### REQ-003: 온보딩 CTA 클릭 시 무한 루프 방지

**EARS 패턴**: Unwanted (SHALL NOT)

시스템은 `/dashboard`와 `/company` 간의 리다이렉트 무한 루프를 **발생시키지 않아야 한다**

**상세 요구사항**:
- 현재: 온보딩 미완료 시 `/company`로 리다이렉트하나, 특정 조건에서 무한 루프 발생
- 변경: workspaceId가 없거나 온보딩 미완료 상태의 분기 처리 개선
- 리다이렉트 발생 시 명확한 상태 체크 및 방어 로직 추가

### REQ-004: 워크스페이스 미존재 시 처리

**EARS 패턴**: State-Driven (IF-THEN)

**IF** 사용자의 workspaceId가 존재하지 않는 경우
**THEN** 시스템은 `/company` 페이지로 리다이렉트하되, 해당 페이지에서 추가 리다이렉트가 발생하지 않아야 한다

### REQ-005: 온보딩 상태 불일치 처리

**EARS 패턴**: Event-Driven (WHEN-THEN)

**WHEN** 온보딩 진행 상태가 불완전하거나 불일치하는 경우
**THEN** 시스템은 graceful하게 /company 페이지에 머무르며, 사용자에게 온보딩 재시작을 안내해야 한다

---

## 제약사항 (Specifications)

### 기술적 제약
1. localStorage 기반 사용자 상태 관리 유지
2. React Router DOM의 programmatic navigation 활용
3. 기존 AuthProvider 컨텍스트 구조 유지
4. 백엔드 API 변경 최소화

### 성능 제약
1. 리다이렉트 로직은 동기적으로 처리되어야 함
2. 불필요한 API 호출 방지
3. 무한 루프 감지 시 즉시 중단

### 보안 제약
1. 사용자 역할 검증은 서버 측에서도 이루어져야 함
2. localStorage 데이터 조작 방지를 위한 서버 검증 유지

---

## 근본 원인 분석 (Root Cause Analysis)

### Bug #1: 라이선스 키 화면 표시 (로그아웃 후)

**문제 경로**:
1. Trial 사용자가 Google 로그인 완료
2. 로그아웃 버튼 클릭
3. `auth-provider.tsx` line 109: `window.location.href = "/auth"`
4. Production 환경에서 `/auth` -> `LicenseProtectedLoginPage` 렌더링
5. 라이선스 키 입력 모달 표시 (Trial 사용자에게 부적절)

**근본 원인**:
- logout 함수에서 사용자 역할을 확인하지 않고 일괄적으로 `/auth`로 리다이렉트

### Bug #2: 온보딩 CTA 클릭 시 무한 루프

**문제 경로**:
1. 온보딩 미완료 사용자가 대시보드 접근
2. `UnifiedDashboardPage.tsx` line 50: `navigate("/company", { replace: true })`
3. `/company` 페이지에서 특정 조건 발생 시 다시 `/dashboard`로 리다이렉트 시도
4. 무한 루프 발생

**근본 원인**:
- workspaceId가 없거나 onboardingProgress가 null인 경우의 처리 미흡
- 리다이렉트 조건이 양방향으로 충돌할 수 있는 상태 존재

---

## 추적성 (Traceability)

| 요구사항 | 수정 파일 | 테스트 시나리오 |
|---------|----------|---------------|
| REQ-001 | auth-provider.tsx | ACC-001, ACC-002 |
| REQ-002 | auth-provider.tsx | ACC-003 |
| REQ-003 | UnifiedDashboardPage.tsx | ACC-004, ACC-005 |
| REQ-004 | UnifiedDashboardPage.tsx | ACC-006 |
| REQ-005 | CompanyInformation.tsx | ACC-007, ACC-008 |
