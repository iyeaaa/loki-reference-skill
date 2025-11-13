# Admin i18n Helper v2.0

VSCode/Cursor IDE extension for inline translation display and editing from `admin/locales/*.csv` files.

## 🎯 주요 기능

### 1. **인라인 번역 표시**
코드에서 `t("sequences.toast.noSequencesSelected")`가 자동으로 `t("선택된 캠페인이 없습니다.")`로 표시됩니다.

### 2. **원본 키 확인**
번역 위에 hover하면 나타나는 "🔑 원본 키 보기" 링크를 클릭하여 원본 translation key를 확인할 수 있습니다.

### 3. **번역 편집**
Hover 메뉴에서 "✏️ 번역 수정" 링크를 클릭하여 CSV 파일의 번역을 바로 수정할 수 있습니다.

### 4. **자동 리로드**
CSV 파일이 변경되면 자동으로 번역을 다시 로드합니다.

## 📦 설치 방법

### VSCode/Cursor에서 설치

1. 커맨드 팔레트 열기: `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
2. "Extensions: Install from VSIX..." 입력
3. `admin-i18n-helper-2.0.0.vsix` 파일 선택

## 🚀 사용 방법

### 기본 사용

1. TypeScript/TSX 파일에서 `t()` 함수를 사용한 번역 키를 작성합니다
2. 번역 키가 자동으로 한국어 번역으로 표시됩니다

**Before:**
```typescript
toast.error(t("sequences.toast.noSequencesSelected"));
```

**After (화면에 표시):**
```typescript
toast.error(t("선택된 캠페인이 없습니다."));
```

### 번역 정보 확인 및 편집

번역 위에 마우스를 올리면 다음 정보가 표시됩니다:

```
### 번역 정보

Key: sequences.toast.noSequencesSelected

한국어 (ko): 선택된 캠페인이 없습니다.
English (en): No campaigns selected

---
[✏️ 번역 수정] | [🔑 원본 키 보기]
```

#### 원본 키 보기
- "🔑 원본 키 보기" 클릭
- 팝업에서 원본 키, 한국어, 영어 번역 확인
- "클립보드에 복사" 버튼으로 원본 키 복사 가능

#### 번역 수정
1. "✏️ 번역 수정" 클릭
2. 수정할 언어 선택 (한국어/English)
3. 새로운 번역 입력
4. 엔터키 - CSV 파일이 자동으로 업데이트됩니다

### 자동 리로드

CSV 파일을 수정하면 자동으로 번역이 다시 로드되어 화면에 반영됩니다.

수동으로 리로드하려면:
- 커맨드 팔레트: `Admin i18n Helper: Reload Translations`

## ⚙️ 설정

VSCode/Cursor 설정 (`settings.json`):

```json
{
  "adminI18nHelper.adminPath": "admin",
  "adminI18nHelper.localesPath": "locales"
}
```

## 📋 요구사항

- VSCode 또는 Cursor IDE 1.74.0 이상
- TypeScript/TypeScript React 파일
- `admin/locales/` 디렉토리의 CSV 파일 (key, ko, en 컬럼)

## 📄 CSV 파일 형식

```csv
key,ko,en
title.sequenceManagement,캠페인 관리,Campaign Management
button.newSequence,새 캠페인,New Campaign
toast.noSequencesSelected,선택된 캠페인이 없습니다.,No campaigns selected
```

## 🛠️ 개발

### 빌드

```bash
pnpm install
pnpm run compile
```

### Watch 모드

```bash
pnpm run watch
```

### 패키징

```bash
npx @vscode/vsce package --allow-missing-repository --no-dependencies
```

## 🎨 지원 파일 타입

- TypeScript (`.ts`)
- TypeScript React (`.tsx`)

## 📝 커맨드

- `Admin i18n Helper: Reload Translations` - 번역 수동 리로드
- `Admin i18n Helper: Show Original Key` - 원본 키 표시
- `Admin i18n Helper: Edit Translation` - 번역 수정

## 🔄 변경 사항 (v2.0.0)

- ✨ 인라인 번역 표시 기능 추가
- ✨ 번역 편집 기능 추가
- ✨ 원본 키 확인 기능 추가
- ✨ CSV 파일 자동 watch 및 리로드
- 🔧 pnpm 패키지 매니저 지원

## 📜 라이선스

MIT

## 💡 문제 해결

### 번역이 표시되지 않는 경우

1. `admin/locales/` 디렉토리 확인
2. CSV 파일 형식 확인 (key, ko, en)
3. 확장 활성화 확인 (VSCode 하단 상태바)
4. 개발자 도구 콘솔 확인: `Help` > `Toggle Developer Tools`

### 번역 편집이 저장되지 않는 경우

1. CSV 파일 쓰기 권한 확인
2. 파일이 다른 프로그램에서 열려있지 않은지 확인
3. 개발자 도구 콘솔에서 에러 메시지 확인

## 🙏 지원

문제나 기능 요청은 개발팀에 문의해주세요.
