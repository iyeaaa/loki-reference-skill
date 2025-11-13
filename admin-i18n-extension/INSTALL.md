# Admin i18n Helper 설치 가이드

## 설치 방법

### VSCode에서 설치

1. VSCode를 엽니다
2. `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)를 누릅니다
3. "Extensions: Install from VSIX..." 를 입력하고 선택합니다
4. `admin-i18n-helper-1.0.0.vsix` 파일을 선택합니다

### Cursor에서 설치

1. Cursor를 엽니다
2. `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)를 누릅니다
3. "Extensions: Install from VSIX..." 를 입력하고 선택합니다
4. `admin-i18n-helper-1.0.0.vsix` 파일을 선택합니다

## 사용 방법

1. admin 프로젝트를 VSCode/Cursor에서 엽니다
2. TypeScript/TSX 파일에서 `t("sequences.toast.noSequencesSelected")` 와 같은 번역 키 위에 마우스를 올립니다
3. 팝업이 나타나면서 다음 정보를 표시합니다:
   - 번역 키
   - 한국어 번역
   - 영어 번역
   - 한국어 번역을 사용한 예시 코드

## 예시

코드:
```typescript
t("sequences.toast.noSequencesSelected")
```

호버 시 표시되는 정보:
```
Translation: sequences.toast.noSequencesSelected

한국어 (ko): 선택된 캠페인이 없습니다.
English (en): No campaigns selected

t("선택된 캠페인이 없습니다.")
```

## 설정 (선택사항)

VSCode/Cursor 설정에서 다음을 변경할 수 있습니다:

```json
{
  "adminI18nHelper.adminPath": "admin",
  "adminI18nHelper.localesPath": "locales"
}
```

## 수동으로 번역 재로드

CSV 파일이 변경되면 자동으로 재로드되지만, 수동으로 재로드하려면:

1. `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
2. "Admin i18n Helper: Reload Translations" 입력

## 문제 해결

### 번역이 표시되지 않는 경우

1. `admin/locales/` 디렉토리가 존재하는지 확인
2. CSV 파일이 올바른 형식인지 확인 (key, ko, en 컬럼)
3. 확장이 활성화되었는지 확인 (VSCode 하단 상태바 확인)
4. 개발자 도구를 열어 콘솔 로그 확인 (`Help` > `Toggle Developer Tools`)

### CSV 파일 형식

```csv
key,ko,en
button.save,저장,Save
button.cancel,취소,Cancel
```

## 지원 파일 형식

- `.ts` (TypeScript)
- `.tsx` (TypeScript React)
