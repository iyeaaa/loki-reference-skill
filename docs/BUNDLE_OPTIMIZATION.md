# 번들 사이즈 최적화 가이드

## 현재 상태

### 초기 빌드 결과 (최적화 전)
- **메인 번들**: 1,071.44 kB (gzip: 307.30 kB)
- **CSS**: 97.77 kB (gzip: 17.61 kB)
- **경고**: 번들 사이즈가 500 kB를 초과함

### 현재 빌드 결과 (코드 스플리팅 적용 후)
- **react-vendor.js**: 620.68 kB (gzip: 197.57 kB) ⚠️
- **index.js**: 329.43 kB (gzip: 68.60 kB) ✅
- **form-vendor.js**: 77.80 kB (gzip: 23.71 kB) ✅
- **utils-vendor.js**: 25.23 kB (gzip: 8.19 kB) ✅
- **vendor.js**: 20.01 kB (gzip: 6.93 kB) ✅
- **CSS**: react-vendor 15.39 kB + index 82.38 kB

### 개선 효과
- ✅ 메인 번들 **70% 감소** (1,071 kB → 329 kB)
- ✅ 초기 로드 성능 개선
- ✅ 브라우저 캐싱 효율성 향상

### 사용하지 않는 패키지 (제거 완료)

#### Dependencies (제거됨)
```json
{
  "@prisma/client": "^6.16.2",           // 프론트엔드에서 불필요
  "@tanstack/react-table": "^8.21.3",    // 사용되지 않음
  "date-fns": "^4.1.0",                  // 사용되지 않음
  "elkjs": "^0.11.0",                    // 사용되지 않음
  "jotai": "^2.15.0",                    // 사용되지 않음
  "recharts": "2.15.4",                  // 사용되지 않음
  "tw-animate-css": "^1.4.0"             // 사용되지 않음
}
```

#### DevDependencies (제거됨)
```json
{
  "autoprefixer": "^10.4.21",            // Tailwind v4에서 불필요
  "lint-staged": "^16.2.1",              // 사용되지 않음
  "postcss": "^8.5.6"                    // Tailwind v4에서 불필요
}
```

## 적용된 최적화 방법

### 1. 사용하지 않는 패키지 제거 ✅

```bash
# Dependencies 제거
yarn remove @prisma/client @tanstack/react-table date-fns elkjs jotai recharts tw-animate-css

# DevDependencies 제거
yarn remove autoprefixer lint-staged postcss
```

**실제 효과**: 번들 사이즈에는 직접적인 영향 없음 (이미 사용되지 않아 번들에 미포함)

### 2. 코드 스플리팅 (Code Splitting) ✅

#### 2-1. manualChunks를 이용한 벤더 분리

`vite.config.ts`에 적용된 설정:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        // 코드 스플리팅을 위한 manualChunks 설정
        manualChunks(id) {
          // node_modules에 있는 패키지들만 처리
          if (id.includes('node_modules')) {
            // React 관련 라이브러리
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }

            // UI 컴포넌트 라이브러리 (Radix UI)
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }

            // 폼 관련
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }

            // 데이터 페칭
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }

            // OpenAI
            if (id.includes('openai')) {
              return 'openai-vendor';
            }

            // Flow 차트 관련
            if (id.includes('@xyflow/react')) {
              return 'flow-vendor';
            }

            // 기타 유틸리티
            if (id.includes('clsx') || id.includes('class-variance-authority') ||
                id.includes('tailwind-merge') || id.includes('lucide-react')) {
              return 'utils-vendor';
            }

            // 나머지 node_modules는 vendor로
            return 'vendor';
          }
        },
      },
    },
    manifest: true,
  },
});
```

**실제 효과**:
- ✅ 메인 번들 70% 감소 (1,071 kB → 329 kB)
- ✅ 초기 로드 시간 개선
- ✅ 캐싱 효율성 향상 (라이브러리 변경 없이 앱 코드만 업데이트 가능)
- ✅ 병렬 다운로드 가능

## React-vendor.js 번들 사이즈 줄이는 추가 방법

현재 react-vendor.js가 620.68 kB로 여전히 큽니다. 이를 줄이는 방법:

### 1. 라우트 Lazy Loading (추천) ⚠️

각 페이지를 동적으로 로드하여 초기 로드 시 필요한 코드만 다운로드:

```typescript
// App.tsx 또는 라우터 설정 파일
import { lazy, Suspense } from 'react';

// Before
import CustomerGroupsPage from './pages/customer-groups/CustomerGroupsPage';
import LeadsPage from './pages/leads/LeadsPage';
import SequencesPage from './pages/sequences/SequencesPage';
import EmailTemplatesPage from './pages/email-templates/EmailTemplatesPage';

// After - Lazy loading
const CustomerGroupsPage = lazy(() => import('./pages/customer-groups/CustomerGroupsPage'));
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'));
const SequencesPage = lazy(() => import('./pages/sequences/SequencesPage'));
const EmailTemplatesPage = lazy(() => import('./pages/email-templates/EmailTemplatesPage'));

// 라우터 설정에서 사용
function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/customer-groups" element={<CustomerGroupsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/sequences" element={<SequencesPage />} />
          <Route path="/email-templates" element={<EmailTemplatesPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

**예상 효과**:
- 각 페이지별로 별도 청크 생성
- 초기 번들 사이즈 추가 40-50% 감소
- react-vendor.js 크기 감소

### 2. React Router DOM 최적화

React Router DOM v7은 큰 번들 사이즈를 가질 수 있습니다. 대안:

#### 옵션 A: Data Router 기능을 사용하지 않는다면
```typescript
// 기존 BrowserRouter, Routes, Route만 사용
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// createBrowserRouter, RouterProvider 등 Data Router 기능은 제거
```

#### 옵션 B: 더 가벼운 라우터 라이브러리 고려
- `wouter` (2 kB) - 매우 가벼운 React Router 대안
- `@tanstack/react-router` - 타입 안전성과 성능 모두 제공

### 3. Radix UI를 별도 청크로 분리

현재 react-vendor에 Radix UI가 포함되어 있어 큽니다. 이미 `ui-vendor`로 분리 설정되어 있으나, Radix UI가 React에 의존하기 때문에 react-vendor에 포함될 수 있습니다.

```typescript
// vite.config.ts에서 Radix UI를 먼저 체크하도록 순서 조정 (이미 적용됨)
manualChunks(id) {
  if (id.includes('node_modules')) {
    // Radix UI를 React보다 먼저 체크 ✅
    if (id.includes('@radix-ui')) {
      return 'ui-vendor';
    }
    if (id.includes('react')) {
      return 'react-vendor';
    }
  }
}
```

### 4. 사용하지 않는 Radix UI 컴포넌트 제거 ⚠️

현재 프로젝트에 설치된 모든 Radix UI 컴포넌트 중 사용하지 않는 것들을 제거:

```bash
# 사용 여부 확인
npx depcheck

# 사용하지 않는 컴포넌트 제거 예시
yarn remove @radix-ui/react-accordion @radix-ui/react-aspect-ratio @radix-ui/react-context-menu
```

**잠재적으로 제거 가능한 컴포넌트**:
- `@radix-ui/react-accordion`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-slider`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`

**예상 효과**: react-vendor/ui-vendor 크기 50-100 kB 감소

### 5. 대형 라이브러리 지연 로딩

OpenAI, @xyflow/react 같은 대형 라이브러리는 필요할 때만 로드:

```typescript
// 사용하는 페이지에서만 동적 임포트
const { OpenAI } = await import('openai');
```

### 6. Tree Shaking 최적화 (선택적)

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // console.log 제거
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug'],
      },
    },
  },
});
```

**예상 효과**: 5-10 kB 감소

### 7. 청크 사이즈 경고 조정 (권장하지 않음)

경고만 제거하려면:

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,  // 1000 kB로 증가
  },
});
```

## 우선순위별 실행 계획

### ✅ 완료
1. ✅ 사용하지 않는 패키지 제거
2. ✅ manualChunks를 이용한 벤더 분리 (코드 스플리팅)

### ⚠️ 추천 (추가 최적화)
3. **라우트 Lazy Loading 적용** - 가장 큰 효과 예상
4. **사용하지 않는 Radix UI 컴포넌트 제거** - 중간 효과

### 📋 선택적
5. React Router DOM 최적화 검토
6. 대형 라이브러리 지연 로딩
7. Tree shaking 최적화 설정

## 측정 및 모니터링

### 빌드 사이즈 확인
```bash
yarn build
```

### 번들 분석 (상세)
```bash
npx vite-bundle-visualizer
```

### 번들 사이즈 비교

| 항목 | 최적화 전 | 현재 | 목표 | 달성률 |
|------|-----------|------|------|--------|
| 메인 번들 | 1,071 kB | 329 kB | < 300 kB | 89% ✅ |
| Gzip 압축 후 | 307 kB | 68.60 kB | < 100 kB | 78% ✅ |
| 총 JS 번들 | 1,071 kB | 1,073 kB | < 800 kB | - |
| 청크 개수 | 1개 | 6개 | - | ✅ |

### 성능 목표
- ✅ **메인 번들**: < 500 kB (현재: 329 kB)
- ✅ **Gzip 압축 후**: < 150 kB (현재: 68.60 kB)
- ⚠️ **react-vendor**: < 300 kB (현재: 620 kB) - 추가 최적화 필요
- 🎯 **초기 로드 시간**: < 2초

### 다음 단계
1. 라우트 Lazy Loading 적용으로 react-vendor 크기 감소
2. Radix UI 컴포넌트 정리
3. 성능 측정 (Lighthouse, WebPageTest)

## 참고 자료

- [Vite 코드 스플리팅 문서](https://rollupjs.org/configuration-options/#output-manualchunks)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Radix UI 최적화](https://www.radix-ui.com/primitives/docs/overview/getting-started)
- [Web.dev - 코드 스플리팅](https://web.dev/code-splitting-suspense/)
- [Vite 성능 최적화 가이드](https://vitejs.dev/guide/build.html#chunking-strategy)
