# 번들 사이즈 최적화 가이드

## 현재 상태

### 빌드 결과
- **메인 번들**: 1,071.44 kB (gzip: 307.30 kB)
- **CSS**: 97.77 kB (gzip: 17.61 kB)
- **경고**: 번들 사이즈가 500 kB를 초과함

### 사용하지 않는 패키지

#### Dependencies (제거 가능)
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

#### DevDependencies (제거 가능)
```json
{
  "autoprefixer": "^10.4.21",            // Tailwind v4에서 불필요
  "lint-staged": "^16.2.1",              // 사용되지 않음
  "postcss": "^8.5.6"                    // Tailwind v4에서 불필요
}
```

## 최적화 방법

### 1. 사용하지 않는 패키지 제거

```bash
# Dependencies 제거
yarn remove @prisma/client @tanstack/react-table date-fns elkjs jotai recharts tw-animate-css

# DevDependencies 제거
yarn remove autoprefixer lint-staged postcss
```

**예상 효과**: 번들 사이즈 약 100-200 kB 감소

### 2. 코드 스플리팅 (Code Splitting)

#### 2-1. 라우트 기반 스플리팅

`vite.config.ts`에 다음 설정 추가:

```typescript
export default defineConfig({
  // ... 기존 설정
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI 컴포넌트 라이브러리
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
          ],

          // 폼 관련
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // 데이터 페칭
          'query-vendor': ['@tanstack/react-query'],

          // 기타 대형 라이브러리
          'utils-vendor': ['clsx', 'class-variance-authority', 'tailwind-merge'],
        },
      },
    },
  },
});
```

**예상 효과**:
- 초기 로드 시간 개선
- 캐싱 효율성 향상
- 병렬 다운로드 가능

#### 2-2. 라우트 Lazy Loading

```typescript
// App.tsx 또는 라우터 설정 파일
import { lazy, Suspense } from 'react';

// Before
import CustomerGroupsPage from './pages/customer-groups/CustomerGroupsPage';
import LeadsPage from './pages/leads/LeadsPage';

// After - Lazy loading
const CustomerGroupsPage = lazy(() => import('./pages/customer-groups/CustomerGroupsPage'));
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'));

// 사용 시
<Suspense fallback={<LoadingSpinner />}>
  <CustomerGroupsPage />
</Suspense>
```

**예상 효과**: 각 페이지별로 청크 분리, 초기 번들 사이즈 50-60% 감소

### 3. Radix UI 컴포넌트 최적화

현재 모든 Radix UI 컴포넌트가 개별 패키지로 설치되어 있음. 사용하지 않는 컴포넌트 확인:

```bash
# 각 컴포넌트 사용 여부 확인
npx depcheck --ignores="@radix-ui/*"
```

사용하지 않는 Radix 컴포넌트 제거:
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

**예상 효과**: 번들 사이즈 약 50-80 kB 감소

### 4. Tree Shaking 최적화

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // Tree shaking 최적화
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // console.log 제거
        drop_debugger: true,
      },
    },
  },
});
```

### 5. 청크 사이즈 제한 조정 (임시방편)

경고를 숨기려면 (권장하지 않음):

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,  // 1000 kB로 증가
  },
});
```

## 우선순위별 실행 계획

### 높음 (즉시 적용)
1. ✅ 사용하지 않는 패키지 제거
2. ✅ 라우트 기반 코드 스플리팅 설정

### 중간 (점진적 적용)
3. ✅ 주요 페이지에 Lazy Loading 적용
4. ✅ 사용하지 않는 Radix UI 컴포넌트 제거

### 낮음 (선택적)
5. ⬜ Tree shaking 최적화 설정
6. ⬜ 청크 사이즈 제한 조정

## 측정 및 모니터링

### 빌드 사이즈 확인
```bash
yarn build
```

### 번들 분석
```bash
npx vite-bundle-visualizer
```

### 목표
- **메인 번들**: < 500 kB (현재: 1,071 kB)
- **Gzip 압축 후**: < 150 kB (현재: 307 kB)
- **초기 로드 시간**: < 2초

## 참고 자료

- [Vite 코드 스플리팅 문서](https://rollupjs.org/configuration-options/#output-manualchunks)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Radix UI 최적화](https://www.radix-ui.com/primitives/docs/overview/getting-started)
