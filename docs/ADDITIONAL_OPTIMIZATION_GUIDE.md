# 추가 번들 최적화 상세 가이드

현재 react-vendor.js가 620.68 kB로 여전히 큽니다. 이 파일의 크기를 줄이기 위한 단계별 가이드입니다.

## 목차
1. [라우트 Lazy Loading 적용](#1-라우트-lazy-loading-적용)
2. [사용하지 않는 Radix UI 컴포넌트 제거](#2-사용하지-않는-radix-ui-컴포넌트-제거)
3. [React Router DOM 최적화](#3-react-router-dom-최적화)
4. [대형 라이브러리 지연 로딩](#4-대형-라이브러리-지연-로딩)
5. [Preloading 전략](#5-preloading-전략)

---

## 1. 라우트 Lazy Loading 적용

### 예상 효과
- 초기 번들 크기 **40-50% 추가 감소**
- 각 페이지별로 별도 청크 생성
- Time to Interactive (TTI) 개선

### 1.1. App.tsx 수정

현재 라우터 설정을 확인하고 lazy loading을 적용합니다.

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 공통 컴포넌트는 즉시 로드
import RootLayout from './layouts/RootLayout';
import ProtectedRoute from './components/ProtectedRoute';

// 페이지들은 Lazy Loading
const LoginPage = lazy(() => import('./pages/LoginPage'));
const CustomerGroupsPage = lazy(() => import('./pages/customer-groups/CustomerGroupsPage'));
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'));
const SequencesPage = lazy(() => import('./pages/sequences/SequencesPage'));
const EmailTemplatesPage = lazy(() => import('./pages/email-templates/EmailTemplatesPage'));
const EmailAccountsPage = lazy(() => import('./pages/email-accounts/EmailAccountsPage'));
const CampaignsPage = lazy(() => import('./pages/campaigns'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const DepartmentsPage = lazy(() => import('./pages/departments/DepartmentsPage'));
const WorkspacesPage = lazy(() => import('./pages/workspaces/WorkspacesPage'));

// Loading 컴포넌트
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

// 또는 더 나은 스켈레톤 UI
function PageSkeleton() {
  return (
    <div className="p-8 space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
      <div className="h-64 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<RootLayout />}>
              <Route path="/customer-groups" element={<CustomerGroupsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/sequences" element={<SequencesPage />} />
              <Route path="/email-templates" element={<EmailTemplatesPage />} />
              <Route path="/email-accounts" element={<EmailAccountsPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/workspaces" element={<WorkspacesPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
```

### 1.2. 세분화된 Suspense 적용 (선택적)

각 라우트별로 Suspense를 적용하면 더 나은 사용자 경험을 제공할 수 있습니다:

```typescript
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        } />

        <Route element={<ProtectedRoute />}>
          <Route element={<RootLayout />}>
            <Route path="/customer-groups" element={
              <Suspense fallback={<PageSkeleton />}>
                <CustomerGroupsPage />
              </Suspense>
            } />
            {/* 나머지 라우트들... */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 1.3. vite.config.ts 추가 설정

페이지별 청크를 더 세밀하게 제어:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 기존 설정...
          }

          // 페이지별 청크 분리
          if (id.includes('src/pages/customer-groups')) {
            return 'page-customer-groups';
          }
          if (id.includes('src/pages/leads')) {
            return 'page-leads';
          }
          if (id.includes('src/pages/sequences')) {
            return 'page-sequences';
          }
          // 필요한 경우 추가...
        },
      },
    },
  },
});
```

### 1.4. 빌드 및 확인

```bash
yarn build
```

**예상 결과**:
- index.js: 100-150 kB (대폭 감소)
- page-customer-groups.js: 30-50 kB
- page-leads.js: 30-50 kB
- 기타 페이지별 청크들...

---

## 2. 사용하지 않는 Radix UI 컴포넌트 제거

### 2.1. 현재 설치된 Radix UI 컴포넌트 확인

```bash
grep "@radix-ui" package.json
```

### 2.2. 실제 사용 여부 확인

각 컴포넌트를 프로젝트에서 검색:

```bash
# accordion 사용 여부
grep -r "from.*@radix-ui/react-accordion" src/

# aspect-ratio 사용 여부
grep -r "from.*@radix-ui/react-aspect-ratio" src/

# 기타 컴포넌트들도 동일하게 확인...
```

또는 자동화:

```bash
npx depcheck --json > unused-deps.json
```

### 2.3. 제거 가능한 컴포넌트 목록

프로젝트를 분석한 결과 잠재적으로 제거 가능한 컴포넌트:

#### 확실히 제거 가능 (UI 컴포넌트 파일에만 존재, 실제 사용 없음)
```bash
yarn remove @radix-ui/react-accordion \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-context-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-progress \
  @radix-ui/react-radio-group \
  @radix-ui/react-slider \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group
```

#### 사용 여부 확인 필요
- `@radix-ui/react-collapsible` - Sidebar에서 사용 가능성
- `@radix-ui/react-carousel` (embla-carousel-react)

### 2.4. 사용하지 않는 UI 컴포넌트 파일도 제거

```bash
# 사용하지 않는 UI 컴포넌트 파일 확인
ls src/components/ui/

# 제거 예시
rm src/components/ui/accordion.tsx
rm src/components/ui/aspect-ratio.tsx
rm src/components/ui/context-menu.tsx
rm src/components/ui/hover-card.tsx
rm src/components/ui/menubar.tsx
rm src/components/ui/navigation-menu.tsx
rm src/components/ui/progress.tsx
rm src/components/ui/radio-group.tsx
rm src/components/ui/slider.tsx
rm src/components/ui/toggle.tsx
rm src/components/ui/toggle-group.tsx
```

### 2.5. 빌드 및 확인

```bash
yarn build
```

**예상 효과**: ui-vendor 또는 react-vendor 크기 **50-100 kB 감소**

---

## 3. React Router DOM 최적화

### 3.1. 현재 사용 중인 기능 확인

```typescript
// 프로젝트에서 사용 중인 React Router 기능 확인
grep -r "from 'react-router-dom'" src/
```

### 3.2. 사용하지 않는 기능 제거

#### Data Router API 사용하지 않는 경우

```typescript
// ❌ 사용하지 않는 기능
import {
  createBrowserRouter,
  RouterProvider,
  defer,
  Await,
  useLoaderData,
  useActionData,
  Form
} from 'react-router-dom';

// ✅ 필요한 것만 import
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom';
```

### 3.3. 대안 라우터 고려 (선택적)

#### 옵션 A: TanStack Router (타입 안전성 + 작은 번들)

```bash
yarn add @tanstack/react-router
yarn remove react-router-dom
```

```typescript
// 기본 설정
import { Router, Route, RootRoute } from '@tanstack/react-router';

const rootRoute = new RootRoute();
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const router = new Router({ routeTree: rootRoute.addChildren([indexRoute]) });
```

#### 옵션 B: Wouter (매우 가벼움 - 2kB)

```bash
yarn add wouter
yarn remove react-router-dom
```

```typescript
import { Route, Switch } from 'wouter';

function App() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/about" component={AboutPage} />
    </Switch>
  );
}
```

**주의**: 라우터 교체는 큰 작업이므로 신중히 결정해야 합니다.

---

## 4. 대형 라이브러리 지연 로딩

### 4.1. OpenAI 라이브러리 최적화

OpenAI 클라이언트는 필요할 때만 로드:

```typescript
// src/lib/openai-client.ts

// ❌ Before - 즉시 로드
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// ✅ After - 지연 로드
let openaiInstance: OpenAI | null = null;

export async function getOpenAI() {
  if (!openaiInstance) {
    const { default: OpenAI } = await import('openai');
    openaiInstance = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }
  return openaiInstance;
}

// 사용
const openai = await getOpenAI();
const response = await openai.chat.completions.create(...);
```

### 4.2. @xyflow/react 최적화

Flow 차트는 특정 페이지에서만 사용:

```typescript
// ❌ Before
import { ReactFlow } from '@xyflow/react';

// ✅ After
const ReactFlow = lazy(() => import('@xyflow/react').then(mod => ({
  default: mod.ReactFlow
})));

function SequenceFlowChart() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <ReactFlow nodes={nodes} edges={edges} />
    </Suspense>
  );
}
```

### 4.3. 기타 대형 라이브러리

```typescript
// Chart 라이브러리가 필요한 경우
const Chart = lazy(() => import('recharts').then(mod => ({
  default: mod.LineChart
})));

// PDF Viewer 등
const PDFViewer = lazy(() => import('react-pdf'));

// Rich Text Editor
const Editor = lazy(() => import('@tiptap/react'));
```

**예상 효과**: 각 라이브러리당 50-200 kB 감소

---

## 5. Preloading 전략

### 5.1. 중요한 라우트 Preload

사용자가 특정 페이지로 이동할 가능성이 높은 경우 미리 로드:

```typescript
// src/utils/preload.ts
export function preloadPage(importFunc: () => Promise<any>) {
  importFunc();
}

// 사용 예시
import { preloadPage } from './utils/preload';

function Navigation() {
  return (
    <nav>
      <Link
        to="/leads"
        onMouseEnter={() => preloadPage(() => import('./pages/leads/LeadsPage'))}
      >
        Leads
      </Link>
    </nav>
  );
}
```

### 5.2. Prefetch Link 컴포넌트

```typescript
// src/components/PrefetchLink.tsx
import { Link, LinkProps } from 'react-router-dom';
import { useEffect, useRef } from 'react';

interface PrefetchLinkProps extends LinkProps {
  prefetch?: 'hover' | 'visible' | 'none';
  importFunc?: () => Promise<any>;
}

export function PrefetchLink({
  prefetch = 'hover',
  importFunc,
  onMouseEnter,
  children,
  ...props
}: PrefetchLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (prefetch === 'visible' && importFunc) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          importFunc();
        }
      });

      if (linkRef.current) {
        observer.observe(linkRef.current);
      }

      return () => observer.disconnect();
    }
  }, [prefetch, importFunc]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefetch === 'hover' && importFunc) {
      importFunc();
    }
    onMouseEnter?.(e);
  };

  return (
    <Link
      ref={linkRef}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Link>
  );
}
```

### 5.3. Idle Time Preloading

네트워크가 유휴 상태일 때 미리 로드:

```typescript
// src/utils/idle-preload.ts
export function preloadOnIdle(importFuncs: Array<() => Promise<any>>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      importFuncs.forEach(fn => fn());
    });
  } else {
    // Fallback for Safari
    setTimeout(() => {
      importFuncs.forEach(fn => fn());
    }, 1000);
  }
}

// main.tsx에서 사용
import { preloadOnIdle } from './utils/idle-preload';

preloadOnIdle([
  () => import('./pages/leads/LeadsPage'),
  () => import('./pages/sequences/SequencesPage'),
  // 자주 사용되는 페이지들...
]);
```

---

## 6. 고급 최적화 기법

### 6.1. Dynamic Import with Webpack Magic Comments

```typescript
const LeadsPage = lazy(() =>
  import(
    /* webpackChunkName: "leads-page" */
    /* webpackPrefetch: true */
    './pages/leads/LeadsPage'
  )
);
```

### 6.2. Component Splitting

큰 컴포넌트를 여러 개로 분리:

```typescript
// ❌ Before - 하나의 큰 컴포넌트
import { DataTable } from './components/DataTable';
import { Filters } from './components/Filters';
import { Actions } from './components/Actions';

// ✅ After - 각각 Lazy Load
const DataTable = lazy(() => import('./components/DataTable'));
const Filters = lazy(() => import('./components/Filters'));
const Actions = lazy(() => import('./components/Actions'));

function LeadsPage() {
  return (
    <div>
      <Suspense fallback={<FiltersSkeleton />}>
        <Filters />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <DataTable />
      </Suspense>

      <Suspense fallback={<div />}>
        <Actions />
      </Suspense>
    </div>
  );
}
```

### 6.3. CSS Code Splitting

CSS도 페이지별로 분리:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[ext]/[name]-[hash][extname]';
        },
      },
    },
    cssCodeSplit: true, // CSS 코드 스플리팅 활성화
  },
});
```

---

## 실행 체크리스트

### Phase 1: Quick Wins (1-2시간)
- [ ] 사용하지 않는 Radix UI 컴포넌트 제거
- [ ] 사용하지 않는 UI 파일 삭제
- [ ] 빌드 및 테스트

### Phase 2: Lazy Loading (2-4시간)
- [ ] App.tsx에 lazy loading 적용
- [ ] Loading/Skeleton 컴포넌트 작성
- [ ] 각 페이지별 테스트
- [ ] 빌드 크기 확인

### Phase 3: Library Optimization (2-3시간)
- [ ] OpenAI 지연 로딩
- [ ] @xyflow/react 지연 로딩
- [ ] 기타 대형 라이브러리 확인

### Phase 4: Advanced (선택적)
- [ ] Preloading 전략 구현
- [ ] Component splitting
- [ ] CSS code splitting
- [ ] Performance 측정 (Lighthouse)

---

## 성능 측정

### Before/After 비교

최적화 전후를 비교하기 위한 메트릭:

```bash
# 번들 크기
yarn build | grep "kB"

# Lighthouse 점수
npx lighthouse http://localhost:5173 --view

# Bundle analyzer
npx vite-bundle-visualizer
```

### 목표 메트릭

| 항목 | 현재 | 목표 | 방법 |
|------|------|------|------|
| react-vendor | 620 kB | < 300 kB | Lazy loading + Radix 정리 |
| index.js | 329 kB | < 150 kB | Lazy loading |
| FCP | ? | < 1.8s | Lighthouse 측정 |
| LCP | ? | < 2.5s | Lighthouse 측정 |
| TTI | ? | < 3.8s | Lighthouse 측정 |

---

## 문제 해결

### 1. Lazy Loading 시 타입 에러

```typescript
// 에러: Type 'LazyExoticComponent<...>' is not assignable to type 'ComponentType'
// 해결: Suspense로 감싸기
<Suspense fallback={<div>Loading...</div>}>
  <LazyComponent />
</Suspense>
```

### 2. Dynamic Import 실패

```typescript
// 에러: Failed to load module
// 해결: 경로 확인 및 fallback 추가
const Component = lazy(() =>
  import('./Component').catch(() => ({
    default: () => <div>Error loading component</div>
  }))
);
```

### 3. Preloading이 작동하지 않음

```typescript
// Vite는 특정 magic comments를 지원하지 않음
// 대신 명시적으로 import 호출
const preload = () => import('./Component');
```

---

## 참고 자료

- [React Lazy Loading 공식 문서](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Web.dev - Code Splitting](https://web.dev/code-splitting-suspense/)
- [Bundle Size Optimization](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
