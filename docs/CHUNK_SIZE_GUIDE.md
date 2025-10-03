# 청크 크기 경고 설정 가이드

## 기본값

Vite의 기본 청크 크기 경고 제한: **500 KB**

## 권장 설정

### 1. 일반적인 웹 애플리케이션
```typescript
chunkSizeWarningLimit: 500  // 기본값 사용
```

**적용 대상:**
- 블로그, 랜딩 페이지
- 간단한 대시보드
- 가벼운 SPA

**이유:**
- 대부분의 사용자가 3G/4G 환경에서 빠른 로딩 경험
- 초기 로딩 시간 최소화
- 모바일 데이터 사용량 절감

### 2. 중간 규모 애플리케이션
```typescript
chunkSizeWarningLimit: 1000  // 1 MB
```

**적용 대상:**
- 어드민 대시보드 (현재 프로젝트)
- CMS 시스템
- 복잡한 데이터 시각화가 필요한 애플리케이션

**이유:**
- 큰 라이브러리(차트, 에디터 등)가 필요한 경우
- 주로 데스크톱 환경에서 사용
- 청크를 너무 잘게 쪼개면 HTTP 요청이 많아져 오히려 느려질 수 있음

### 3. 엔터프라이즈 애플리케이션
```typescript
chunkSizeWarningLimit: 1500  // 1.5 MB
```

**적용 대상:**
- 대규모 엔터프라이즈 솔루션
- IDE, 디자인 툴 등 무거운 애플리케이션
- 내부망에서만 사용하는 시스템

**이유:**
- 기능이 매우 복잡하고 많은 의존성 필요
- 안정적인 네트워크 환경 보장
- 개발 생산성과 유지보수성 우선

### 4. 경고 완전히 비활성화 (권장하지 않음)
```typescript
chunkSizeWarningLimit: Infinity
```

**주의:** 번들 크기를 모니터링하지 않으면 성능 문제 발견이 어려워집니다.

## 네트워크별 다운로드 시간 참고

| 청크 크기 | 3G (1 Mbps) | 4G (10 Mbps) | 5G (100 Mbps) | WiFi (50 Mbps) |
|-----------|-------------|--------------|---------------|----------------|
| 500 KB    | 4초         | 0.4초        | 0.04초        | 0.08초         |
| 1 MB      | 8초         | 0.8초        | 0.08초        | 0.16초         |
| 1.5 MB    | 12초        | 1.2초        | 0.12초        | 0.24초         |
| 2 MB      | 16초        | 1.6초        | 0.16초        | 0.32초         |

*실제 다운로드 시간은 gzip 압축, 지연시간, 서버 성능 등에 따라 달라집니다.*

## 최적화 전략

### 1. 청크 크기를 줄이는 방법

#### A. 동적 임포트 (Lazy Loading)
```typescript
// 좋은 예
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// 나쁜 예
import HeavyComponent from './HeavyComponent'
```

#### B. 큰 라이브러리 분리
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    // 큰 라이브러리는 별도 청크로
    if (id.includes('@monaco-editor')) {
      return 'monaco-vendor'
    }
    if (id.includes('@uiw/react-md-editor')) {
      return 'md-editor-vendor'
    }
  }
}
```

#### C. Tree Shaking 활성화
```typescript
// 좋은 예: 필요한 것만 임포트
import { Button } from '@/components/ui/button'

// 나쁜 예: 전체 임포트
import * as UI from '@/components/ui'
```

### 2. 경고 제한을 높이는 것이 합리적인 경우

다음 조건을 **모두** 만족할 때:

1. ✅ 큰 라이브러리가 **별도 청크로 분리**되어 있음
2. ✅ 해당 청크가 **지연 로딩**됨 (필요할 때만 로드)
3. ✅ 주 사용자가 **안정적인 네트워크 환경**에서 접속
4. ✅ 모바일보다 **데스크톱 사용이 주**
5. ✅ 더 이상 분리할 수 없는 라이브러리 (예: Monaco Editor, PDF 렌더러)

## 현재 프로젝트 설정

```typescript
// admin/vite.config.ts
chunkSizeWarningLimit: 1100  // 1.1 MB
```

**설정 이유:**
- `md-editor-vendor` (1,097 KB)가 별도 청크로 분리됨
- email-templates 페이지 방문 시에만 로드됨 (lazy loading)
- 어드민 대시보드는 주로 데스크톱에서 사용
- 더 이상 MDEditor를 분리할 수 없음 (외부 라이브러리)

## 체크리스트

청크 크기 경고 제한을 높이기 전에 확인하세요:

- [ ] 코드 스플리팅이 제대로 적용되었는가?
- [ ] 큰 라이브러리들이 별도 청크로 분리되었는가?
- [ ] 동적 임포트(lazy loading)를 사용하고 있는가?
- [ ] Tree shaking이 제대로 동작하는가?
- [ ] 불필요한 의존성은 없는가?
- [ ] 사용자의 네트워크 환경을 고려했는가?
- [ ] gzip 압축이 활성화되어 있는가?

## 참고 자료

- [Vite Build Options](https://vitejs.dev/config/build-options.html#build-chunksizewarninglimit)
- [Web.dev: Code Splitting](https://web.dev/code-splitting/)
- [Rollup: Output.manualChunks](https://rollupjs.org/configuration-options/#output-manualchunks)

## 결론

**기본 원칙:**
- 가능한 한 **500 KB 이하** 유지
- 불가피한 경우에만 **1000 KB까지** 허용
- **1500 KB 이상**은 매우 특수한 경우에만
- 경고를 없애기 위해 설정만 높이는 것은 좋지 않음
- **최적화가 우선**, 설정 변경은 최후의 수단
