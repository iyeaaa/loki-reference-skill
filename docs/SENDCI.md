# SendCI - Continuous Integration Script

**SendCI**는 Grinda AI에서 개발한 경량 CI 스크립트로, Git hooks를 통해 자동으로 코드 품질 검사와 빌드를 수행합니다.

## 📋 목차

- [개요](#개요)
- [설치 및 설정](#설치-및-설정)
- [사용법](#사용법)
- [동작 과정](#동작-과정)
- [Git Hooks 통합](#git-hooks-통합)
- [출력 형식](#출력-형식)

---

## 개요

SendCI는 다음과 같은 특징을 가진 로컬 CI 도구입니다:

- **Docker 스타일 로그**: 프로젝트별 색상 구분 및 실시간 로그 출력
- **병렬 실행**: 여러 프로젝트를 동시에 검사하여 시간 절약
- **선택적 검사**: 변경된 파일만 검사하여 효율성 극대화
- **두 가지 모드**: 빠른 검사(fast)와 전체 빌드(full)

### 지원 프로젝트

- **admin**: Vite + React 기반 관리자 대시보드
- **elysia-server**: Bun + Elysia 기반 백엔드 서버

---

## 설치 및 설정

### 필수 요구사항

- Git
- Bash shell
- Yarn (admin 프로젝트용)
- Bun (elysia-server 프로젝트용)

### Husky 설정

프로젝트에는 두 개의 Git hooks가 설정되어 있습니다:

```bash
# .husky/pre-commit
./send-ci.sh fast --only-changed

# .husky/pre-push
./send-ci.sh full --only-changed
```

---

## 사용법

### 기본 명령어

```bash
# 전체 빌드 (기본값)
./send-ci.sh
./send-ci.sh full

# 빠른 검사 (lint + type-check만)
./send-ci.sh fast

# 변경된 프로젝트만 검사
./send-ci.sh fast --only-changed
./send-ci.sh full --only-changed

# 최소 출력 모드
./send-ci.sh fast --quiet
```

### 옵션 설명

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `fast` | lint + type-check만 실행 (5-10초) | - |
| `full` | lint + type-check + build 실행 (1-2분) | ✓ |
| `--only-changed` | 변경된 프로젝트만 검사 | false |
| `--quiet` | 최소 출력 (결과만 표시) | false |

---

## 동작 과정

### 1. 변경 감지 단계

`--only-changed` 플래그 사용 시:

#### Pre-commit (staged 파일)
```bash
git diff --cached --name-only
```
- git add된 파일만 확인
- 해당 디렉토리가 있으면 검사 실행

#### Pre-push (원격 비교)
```bash
git diff origin/branch --name-only
```
- 원격 브랜치와 비교하여 변경 감지
- 원격이 없으면 HEAD와 비교

### 2. 검사 실행 단계

#### Fast 모드 (병렬 실행)

**Admin 프로젝트:**
```bash
cd admin
yarn lint          # Biome 린트 검사
yarn type-check    # TypeScript 타입 검사
```

**Elysia-server 프로젝트:**
```bash
cd elysia-server
bun lint          # Biome 린트 검사
bun type-check    # TypeScript 타입 검사
```

#### Full 모드 (병렬 실행)

**Admin 프로젝트:**
```bash
cd admin
yarn build        # Vite 프로덕션 빌드
                  # (내부적으로 lint + type-check 포함)
```

**Elysia-server 프로젝트:**
```bash
cd elysia-server
bun run build     # Bun 빌드
                  # (내부적으로 lint + type-check 포함)
```

### 3. 결과 처리

- **성공 (Exit code 0)**: 모든 검사 통과
- **실패 (Exit code 1)**: 하나 이상의 프로젝트 실패

실패 시 Git hook이 중단되어 commit 또는 push가 취소됩니다.

---

## Git Hooks 통합

### Pre-commit Hook

커밋 전에 변경된 파일만 빠르게 검사:

```bash
#!/bin/sh
./send-ci.sh fast --only-changed
```

**동작:**
- Staged 파일 확인
- 해당 프로젝트만 lint + type-check
- 약 3-5초 소요

**예시:**
```
[sendci]     | Starting SendCI v1.0
[sendci]     | Mode: fast (lint + type-check)
[sendci]     | Scope: changed files only

[admin]      | Detected 3 changed files
[admin]      | Running yarn lint...
[admin]      | Checked 170 files in 87ms. No fixes applied.
[admin]      | Running yarn type-check...

[admin]      | Exited with code 0
[elysia-server] | Skipped (no changes)

[sendci]     | All services completed successfully (3s)
```

### Pre-push Hook

푸시 전에 변경된 프로젝트만 전체 빌드:

```bash
#!/bin/sh
./send-ci.sh full --only-changed
```

**동작:**
- 원격과 비교하여 변경 감지
- 해당 프로젝트만 전체 빌드
- 약 3-5초 소요 (변경된 프로젝트만)

**예시:**
```
[sendci]     | Starting SendCI v1.0
[sendci]     | Mode: full (lint + type-check + build)
[sendci]     | Scope: changed files only

[admin]      | Detected 5 changed files
[admin]      | Running yarn build...
[admin]      | rolldown-vite v7.1.12 building for production...
[admin]      | ✓ built in 390ms

[admin]      | Exited with code 0
[elysia-server] | Skipped (no changes)

[sendci]     | All services completed successfully (4s)
```

---

## 출력 형식

### Docker 스타일 로그

각 프로젝트는 고유한 색상으로 구분됩니다:

```
[sendci]        | 시스템 메시지 (노란색)
[admin]         | Admin 프로젝트 로그 (청록색)
[elysia-server] | Server 프로젝트 로그 (자홍색)
```

### 로그 구성

```
[프로젝트명]    | 로그 메시지
^            ^   ^
색상 prefix  구분자  실제 출력
```

### 상태 메시지

- `Starting SendCI v1.0` - 시작
- `Detected N changed files` - 변경 파일 감지
- `Running [command]...` - 명령 실행 중
- `Exited with code N` - 종료 코드
- `Skipped (no changes)` - 변경사항 없음
- `All services completed successfully` - 성공
- `Failed: [projects]` - 실패

---

## 최적화 팁

### 1. 개발 중 (빠른 피드백)

```bash
# 현재 작업 중인 프로젝트만 빠르게 검사
./send-ci.sh fast --only-changed
```

### 2. 커밋 전 (자동 실행)

Pre-commit hook이 자동으로 실행됩니다:
- 변경된 파일만 검사
- 3-5초 내 완료

### 3. 푸시 전 (최종 검증)

Pre-push hook이 자동으로 실행됩니다:
- 변경된 프로젝트만 빌드
- 3-5초 내 완료 (변경사항 있을 때만)

### 4. 전체 검증 (수동)

```bash
# 모든 프로젝트 전체 빌드 (CI 시뮬레이션)
./send-ci.sh full
```

---

## 문제 해결

### Lint 오류

```
[admin] | Exited with code 1
```

**해결:**
```bash
cd admin
yarn lint --write  # 자동 수정
```

### Type 오류

```
[elysia-server] | error TS2345: Argument of type 'string' is not assignable...
```

**해결:**
- 코드에서 타입 오류 수정
- `bun type-check`로 재확인

### 빌드 오류

```
[admin] | ✗ Build failed
```

**해결:**
- 에러 메시지 확인
- `yarn build` 직접 실행하여 디버깅

---

## 성능 특징

### 병렬 실행

두 프로젝트가 동시에 실행되어 시간 절약:

```
Admin:  [====== 3초 ======]
Server: [====== 3초 ======]
━━━━━━━━━━━━━━━━━━━━━━━━━
Total:  3초 (순차 실행 시 6초)
```

### 스마트 감지

변경되지 않은 프로젝트는 자동 스킵:

```
[admin]         | Detected 5 changed files  (실행)
[elysia-server] | Skipped (no changes)      (스킵)
```

---

## 버전 정보

- **버전**: 1.0
- **릴리스 날짜**: 2025.10.04
- **개발**: Grinda AI
- **라이선스**: MIT

---

## 관련 문서

- [CI Services Comparison](./CI_SERVICES_COMPARISON.md)
- [Bundle Optimization](./BUNDLE_OPTIMIZATION.md)
- [Code Splitting Guide](./CODE_SPLITTING.md)
