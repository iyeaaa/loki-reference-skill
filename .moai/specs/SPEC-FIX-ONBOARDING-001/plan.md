# SPEC-FIX-ONBOARDING-001: 구현 계획

## 메타데이터

| 필드 | 값 |
|------|-----|
| SPEC ID | SPEC-FIX-ONBOARDING-001 |
| 버전 | 1.0.0 |
| 상태 | Planned |

---

## 마일스톤

### Primary Goal: 로그아웃 리다이렉트 수정

**목표**: Trial 사용자 로그아웃 시 적절한 페이지로 리다이렉트

#### 태스크 1.1: auth-provider.tsx logout 함수 수정

**파일**: `/admin/src/lib/auth-provider.tsx`

**변경 내용**:
```typescript
// 변경 전 (line 94-110)
const logout = () => {
  localStorage.removeItem("authToken")
  localStorage.removeItem("user")
  // ... 기타 정리 로직
  setUser(null)
  window.location.href = "/auth"  // 문제: 모든 사용자를 /auth로
}

// 변경 후
const logout = () => {
  // 로그아웃 전에 사용자 역할 저장
  const currentUser = localStorage.getItem("user")
  let userRole: string | undefined
  try {
    const parsedUser = JSON.parse(currentUser || "{}")
    userRole = parsedUser.userRole
  } catch {
    userRole = undefined
  }

  localStorage.removeItem("authToken")
  localStorage.removeItem("user")
  localStorage.removeItem("rinda_survey_data")

  sessionStorage.removeItem("onboarding_sequence")
  sessionStorage.removeItem("onboarding_leads")
  sessionStorage.removeItem("onboarding_company_info")
  sessionStorage.removeItem("onboarding_customer_group_id")

  setUser(null)

  // 사용자 역할에 따른 리다이렉트
  if (userRole === "admin" || userRole === "super_admin") {
    window.location.href = "/auth"
  } else {
    window.location.href = "/trial?from=logout"
  }
}
```

**검증 포인트**:
- Trial 사용자 로그아웃 시 `/trial?from=logout` 확인
- Admin 사용자 로그아웃 시 `/auth` 확인
- localStorage 정리 완료 확인

---

### Secondary Goal: 온보딩 무한 루프 방지

**목표**: /dashboard와 /company 간 무한 루프 제거

#### 태스크 2.1: UnifiedDashboardPage.tsx 리다이렉트 로직 개선

**파일**: `/admin/src/pages/UnifiedDashboardPage.tsx`

**변경 내용**:
```typescript
// 변경 전 (line 44-53)
useEffect(() => {
  if (workspacesLoading || onboardingLoading) {
    return
  }
  if (!(workspaceId && isOnboardingComplete)) {
    navigate("/company", { replace: true })
  }
}, [workspaceId, isOnboardingComplete, workspacesLoading, onboardingLoading, navigate])

// 변경 후
useEffect(() => {
  // 로딩 중이면 리다이렉트하지 않음
  if (workspacesLoading || onboardingLoading) {
    console.log("[UnifiedDashboard] Still loading, skip redirect check")
    return
  }

  // 워크스페이스 조회 완료 후 상태 체크
  console.log("[UnifiedDashboard] Redirect check:", {
    workspaceId,
    isOnboardingComplete,
    userWorkspaces: userWorkspaces?.length || 0
  })

  // Case 1: 워크스페이스가 없는 경우 - /company로 리다이렉트
  if (!workspaceId) {
    console.log("[UnifiedDashboard] No workspace, redirecting to /company")
    navigate("/company", { replace: true })
    return
  }

  // Case 2: 워크스페이스는 있지만 온보딩 미완료
  if (!isOnboardingComplete) {
    console.log("[UnifiedDashboard] Onboarding not complete, redirecting to /company")
    navigate("/company", { replace: true })
    return
  }

  // Case 3: 정상 상태 - 대시보드 표시
  console.log("[UnifiedDashboard] All checks passed, showing dashboard")
}, [workspaceId, isOnboardingComplete, workspacesLoading, onboardingLoading, navigate, userWorkspaces])
```

#### 태스크 2.2: CompanyInformation.tsx 방어 로직 추가

**파일**: `/admin/src/pages/app/CompanyInformation.tsx`

**변경 내용**:
현재 CompanyInformation.tsx는 /dashboard로 리다이렉트하지 않지만, 방어적으로 무한 루프 감지 로직을 추가합니다.

```typescript
// 컴포넌트 상단에 무한 루프 방지 상수 추가
const REDIRECT_COUNT_KEY = "onboarding_redirect_count"
const MAX_REDIRECTS = 3

// useEffect 내부에 추가
useEffect(() => {
  // 무한 루프 감지
  const redirectCount = parseInt(sessionStorage.getItem(REDIRECT_COUNT_KEY) || "0", 10)

  if (redirectCount >= MAX_REDIRECTS) {
    console.error("[CompanyInformation] Redirect loop detected, staying on page")
    sessionStorage.removeItem(REDIRECT_COUNT_KEY)
    // 사용자에게 에러 상태 표시하거나 로그아웃 유도
    return
  }

  // 리다이렉트 발생 시 카운트 증가
  // (실제 리다이렉트 로직이 있는 경우에만)
}, [])

// 컴포넌트 마운트 시 리다이렉트 카운트 초기화
useEffect(() => {
  // 정상적으로 페이지에 도달하면 카운트 초기화
  const timer = setTimeout(() => {
    sessionStorage.removeItem(REDIRECT_COUNT_KEY)
  }, 2000) // 2초 후 초기화 (무한 루프는 이보다 빠르게 발생)

  return () => clearTimeout(timer)
}, [])
```

---

### Tertiary Goal: 에러 처리 개선

**목표**: 온보딩 상태 불일치 시 graceful 처리

#### 태스크 3.1: onboarding API 에러 처리 개선

**파일**: `/admin/src/lib/api/hooks/onboarding.ts`

**변경 내용**:
- API 에러 발생 시 기본값 반환
- 에러 상태에서도 UI가 정상 동작하도록 처리

#### 태스크 3.2: UserProtectedRoute 개선

**파일**: `/admin/src/components/ProtectedRoute.tsx`

**변경 내용**:
```typescript
// 현재 (line 52-68)
export function UserProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!user?.id) {
    return <Navigate replace to="/trial?from=logout" />
  }

  return <>{children}</>
}

// 개선안: 추가 상태 체크
export function UserProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!user?.id) {
    // 현재 경로 정보와 함께 리다이렉트
    console.log("[UserProtectedRoute] No user, redirecting from:", location.pathname)
    return <Navigate replace to="/trial?from=logout" />
  }

  return <>{children}</>
}
```

---

## 기술적 접근 방식

### 아키텍처 설계 방향

1. **사용자 역할 기반 분기**
   - logout 시점에 localStorage에서 역할 확인
   - 역할에 따른 리다이렉트 경로 결정

2. **방어적 리다이렉트 로직**
   - 리다이렉트 발생 전 상태 로깅
   - 무한 루프 감지 및 중단 메커니즘
   - sessionStorage 기반 리다이렉트 카운터

3. **상태 일관성 보장**
   - API 로딩 완료 후에만 리다이렉트 결정
   - 불완전한 상태에서의 동작 정의

### 의존성

| 의존성 | 유형 | 설명 |
|--------|-----|------|
| react-router-dom | 외부 | 라우팅 및 네비게이션 |
| localStorage/sessionStorage | 브라우저 API | 상태 저장 |
| useAuth 훅 | 내부 | 인증 상태 관리 |
| onboarding API | 내부 | 온보딩 진행 상태 조회 |

---

## 리스크 및 대응 방안

### 리스크 1: 기존 사용자 세션 영향

**위험도**: Medium

**설명**: 변경 배포 시 기존 로그인 사용자의 세션에 영향 가능

**대응**:
- localStorage 데이터 구조 변경 없음
- 점진적 배포 및 모니터링
- 롤백 계획 수립

### 리스크 2: 엣지 케이스 미처리

**위험도**: Medium

**설명**: 특수한 상황(네트워크 에러, 부분 로딩 등)에서 예상치 못한 동작

**대응**:
- 상세한 로깅 추가
- 타임아웃 처리
- 기본값 동작 정의

### 리스크 3: 테스트 커버리지

**위험도**: Low

**설명**: 수동 테스트만으로는 모든 시나리오 검증 어려움

**대응**:
- E2E 테스트 시나리오 추가 (Playwright)
- 스테이징 환경에서 충분한 테스트
- QA 체크리스트 작성

---

## 추적성 (Traceability)

| 태스크 | 요구사항 | 테스트 시나리오 |
|--------|---------|---------------|
| 1.1 | REQ-001, REQ-002 | ACC-001, ACC-002, ACC-003 |
| 2.1 | REQ-003, REQ-004 | ACC-004, ACC-005, ACC-006 |
| 2.2 | REQ-003 | ACC-004 |
| 3.1 | REQ-005 | ACC-007, ACC-008 |
| 3.2 | REQ-001 | ACC-001, ACC-002 |
