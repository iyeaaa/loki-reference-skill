# Admin 디렉토리 정리 권장사항

## 요약
Admin 프로젝트 분석 결과, 정리 가능한 파일들을 다음과 같이 분류했습니다.

## 1. 🗑️ 즉시 삭제 가능한 파일

### 기본 템플릿 파일
- `admin/src/assets/react.svg` - React 기본 로고 (사용 안 함)
- `admin/public/vite.svg` - Vite 기본 로고 (사용 안 함)

### 중복 설정 파일
- `admin/eslint.config.js` - Biome를 사용 중이므로 ESLint 설정 불필요

## 2. ⚠️ 검토 후 삭제 고려

### 중복 린터/포맷터 패키지
현재 Biome를 사용 중이므로 ESLint 관련 패키지 제거 가능:
- `@eslint/js`
- `eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `typescript-eslint`
- `globals` (ESLint 전용)

**package.json에서 제거:**
```json
"@eslint/js": "^9.36.0",
"eslint": "^9.36.0",
"eslint-plugin-react-hooks": "^5.2.0",
"eslint-plugin-react-refresh": "^0.4.20",
"globals": "^16.4.0",
"typescript-eslint": "^8.44.0"
```

### 사용하지 않는 UI 컴포넌트
다음 UI 컴포넌트들이 import되지 않고 있음을 확인:
- 실제 사용 여부 검토 필요한 컴포넌트들이 많음 (aspect-ratio, collapsible 등)
- 사용하지 않는 컴포넌트는 삭제하여 번들 크기 감소 가능

## 3. 📦 빌드 아티팩트 (이미 .gitignore에 포함)

### dist 폴더
- `admin/dist/` - 빌드 결과물 (이미 gitignore됨)

### node_modules
- `admin/node_modules/` - 의존성 패키지 (이미 gitignore됨)

### yarn 캐시
- `admin/.yarn/install-state.gz` - Yarn 설치 상태 (이미 gitignore됨)

## 4. 🔧 정리 명령어

### 1단계: 불필요한 파일 삭제
```bash
# 템플릿 파일 삭제
rm admin/src/assets/react.svg
rm admin/public/vite.svg

# ESLint 설정 파일 삭제
rm admin/eslint.config.js
```

### 2단계: package.json 정리 후 재설치
```bash
# package.json에서 ESLint 관련 패키지 제거 후
cd admin
yarn install
```

### 3단계: 사용하지 않는 컴포넌트 확인
```bash
# 각 UI 컴포넌트의 사용 여부 확인
grep -r "from.*aspect-ratio" admin/src --exclude-dir=node_modules
grep -r "from.*collapsible" admin/src --exclude-dir=node_modules
# ... 각 컴포넌트별로 확인
```

## 5. 💡 추가 권장사항

### TypeScript 설정 통합
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` 3개 파일 존재
- 필요시 단일 파일로 통합 고려

### 환경변수 파일 보안
- `.env` 파일이 git에 포함되어 있음
- `.gitignore`에 추가하고 `.env.example` 생성 권장

### 테스트 파일 구조
- 현재 테스트 파일이 없음
- 향후 테스트 추가 시 `__tests__` 또는 `.test.tsx` 구조 채택 권장

## 6. 📊 정리 후 예상 효과

- **코드베이스 간소화**: 중복 린터 제거로 설정 파일 감소
- **의존성 감소**: 6개의 불필요한 dev 의존성 제거
- **빌드 속도 향상**: 불필요한 패키지 제거로 설치 시간 단축
- **유지보수성 향상**: 단일 린터/포맷터(Biome) 사용으로 일관성 증가

## 7. ⚡ 즉시 실행 가능한 스크립트

```bash
#!/bin/bash
# cleanup-admin.sh

echo "Admin 디렉토리 정리 시작..."

# 1. 템플릿 파일 삭제
echo "템플릿 파일 삭제 중..."
rm -f admin/src/assets/react.svg
rm -f admin/public/vite.svg
rm -f admin/eslint.config.js

# 2. package.json 백업
echo "package.json 백업 중..."
cp admin/package.json admin/package.json.backup

# 3. ESLint 패키지 제거
echo "ESLint 패키지 제거 중..."
cd admin
yarn remove @eslint/js eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals typescript-eslint

echo "정리 완료!"
echo "변경사항을 확인하고 테스트를 실행하세요: yarn dev"
```

---

**주의사항**:
- 정리 작업 전 반드시 백업을 생성하세요
- 각 단계별로 애플리케이션 동작을 확인하세요
- 팀원들과 변경사항을 공유하세요