# CI/CD 서비스 비교 분석

## 현재 프로젝트의 CI 기능

현재 `ci.sh` 스크립트가 제공하는 기능:

- ✅ **Lint**: 코드 스타일 검사
- ✅ **Type Check**: TypeScript 타입 검사
- ✅ **Build**: 프로젝트 빌드 (번들링)
- ✅ **Parallel Execution**: Admin과 Server 병렬 처리
- ✅ **Smart Detection**: 변경된 파일만 선택적 검사 (`--only-changed`)
- ✅ **Git Hooks**: pre-commit, pre-push 자동화
- ✅ **Fast/Full Mode**: 빠른 검사 vs 전체 빌드 선택
- ✅ **Error Logging**: 실패 시 상세 로그 출력

---

## 글로벌 TOP 10 CI/CD 서비스 (2025년)

### 시장 규모
- **2025년**: USD 1.73 billion
- **2030년 예상**: USD 4.53 billion
- **연평균 성장률 (CAGR)**: 21.18%

---

### 1. **GitHub Actions**
**제공사**: Microsoft (GitHub)
**사용자**: 1억+ (GitHub 사용자)
**특징**:
- GitHub와 완전 통합
- 마켓플레이스에서 수천 개의 액션 제공
- YAML 기반 워크플로우
- 무료 티어: 월 2,000분 (public repo는 무제한)

**우리 프로젝트와 비교**:
- ✅ 병렬 실행 지원
- ✅ 조건부 실행 (변경된 파일만)
- ⚠️ 설정 복잡도가 우리보다 높음

---

### 2. **GitLab CI/CD**
**제공사**: GitLab Inc.
**사용자**: 4천만+
**특징**:
- GitLab과 완전 통합
- Auto DevOps 자동화
- Kubernetes 네이티브
- 무료 티어: 월 400분

**우리 프로젝트와 비교**:
- ✅ `.gitlab-ci.yml`로 정의 (우리의 ci.sh와 유사)
- ✅ 병렬 실행, 캐싱 지원
- ➕ 추가로 보안 스캔, 컨테이너 스캔 제공

---

### 3. **CircleCI**
**제공사**: Circle Internet Services, Inc.
**시장 지위**: CI/CD 업계 리더
**특징**:
- 성능에 최적화 (GitHub Actions보다 빠름)
- Docker 레이어 캐싱
- SSH 디버깅 지원
- 무료 티어: 월 6,000분

**우리 프로젝트와 비교**:
- ✅ 병렬 실행 최적화
- ➕ 고급 캐싱 (우리보다 빠를 수 있음)
- ⚠️ 가격이 비쌈 (대규모 프로젝트)

---

### 4. **Azure DevOps (Pipelines)**
**제공사**: Microsoft
**매출**: Microsoft Cloud의 일부 (수십억 달러)
**특징**:
- 엔터프라이즈급 CI/CD
- Azure 클라우드와 완전 통합
- Windows, Linux, macOS 지원
- 무료 티어: 월 1,800분

**우리 프로젝트와 비교**:
- ✅ YAML 기반 파이프라인
- ➕ 엔터프라이즈 기능 (승인 게이트, 배포 전략)
- ⚠️ 복잡도 높음 (소규모 프로젝트에는 과함)

---

### 5. **AWS CodePipeline**
**제공사**: Amazon Web Services
**매출**: AWS의 일부 (연 900억 달러+)
**특징**:
- AWS 서비스와 완전 통합
- CodeBuild, CodeDeploy와 연계
- 인프라 as 코드 (CloudFormation)
- 종량제 요금

**우리 프로젝트와 비교**:
- ✅ 병렬 실행
- ➕ AWS 생태계 통합 (S3, Lambda, ECS 등)
- ⚠️ AWS 종속성

---

### 6. **Jenkins**
**제공사**: Open Source (CloudBees 상용화)
**사용자**: 가장 오래되고 널리 사용됨
**특징**:
- 완전 무료 오픈소스
- 플러그인 생태계 (1,800+)
- 자체 호스팅 가능
- 무제한 빌드

**우리 프로젝트와 비교**:
- ✅ Jenkinsfile (Groovy)로 파이프라인 정의
- ✅ 병렬 실행, 조건부 실행
- ⚠️ UI/UX가 구식, 관리 부담

---

### 7. **Bitbucket Pipelines**
**제공사**: Atlassian
**매출**: Atlassian 전체 연 34억 달러+
**특징**:
- Bitbucket과 완전 통합
- Jira, Confluence 연계
- Docker 기반 빌드
- 무료 티어: 월 50분

**우리 프로젝트와 비교**:
- ✅ YAML 기반, 병렬 실행
- ➕ Atlassian 생태계 통합
- ⚠️ 무료 티어가 매우 적음

---

### 8. **Travis CI**
**제공사**: Travis CI GmbH
**특징**:
- 오픈소스 프로젝트에 무료
- GitHub와 통합
- `.travis.yml` 설정
- 무료 티어: 오픈소스만

**우리 프로젝트와 비교**:
- ✅ 간단한 설정
- ⚠️ 최근 인기 하락 (GitHub Actions에 밀림)
- ⚠️ 무료 정책 변경으로 논란

---

### 9. **TeamCity**
**제공사**: JetBrains
**매출**: JetBrains 전체 연 5억 달러+
**특징**:
- 강력한 IDE 통합 (IntelliJ 등)
- 자체 호스팅 가능
- 무료 티어: 100 빌드 설정, 3 에이전트
- 엔터프라이즈급 기능

**우리 프로젝트와 비교**:
- ✅ 병렬 실행, 고급 캐싱
- ➕ IDE 통합 (개발자 경험 우수)
- ⚠️ 설정 복잡도 높음

---

### 10. **Buddy**
**제공사**: Buddy Works
**특징**:
- 개발자 친화적 UI
- 15분 안에 설정 가능
- Docker 레이어 캐싱
- 무료 티어: 월 120 빌드, 5 프로젝트

**우리 프로젝트와 비교**:
- ✅ 빠른 실행 속도
- ✅ 시각적 파이프라인 빌더
- ⚠️ 소규모 팀 위주

---

## 비교 요약표

| 서비스 | 제공사 | 무료 티어 | 강점 | 약점 |
|--------|--------|-----------|------|------|
| **GitHub Actions** | Microsoft | 2,000분/월 | GitHub 통합, 마켓플레이스 | 복잡한 설정 |
| **GitLab CI/CD** | GitLab | 400분/월 | All-in-one DevOps | 러닝 커브 |
| **CircleCI** | CircleCI | 6,000분/월 | 빠른 성능 | 비싼 가격 |
| **Azure DevOps** | Microsoft | 1,800분/월 | 엔터프라이즈급 | 복잡도 |
| **AWS CodePipeline** | AWS | 1 파이프라인 무료 | AWS 통합 | AWS 종속 |
| **Jenkins** | Open Source | 무제한 | 완전 무료 | 구식 UI, 관리 부담 |
| **Bitbucket Pipelines** | Atlassian | 50분/월 | Jira 통합 | 적은 무료 티어 |
| **Travis CI** | Travis CI | 오픈소스만 | 간단한 설정 | 인기 하락 |
| **TeamCity** | JetBrains | 100 빌드 설정 | IDE 통합 | 복잡한 설정 |
| **Buddy** | Buddy Works | 120 빌드/월 | 빠른 설정 | 소규모 팀 위주 |

---

## 현재 프로젝트에 적합한 서비스 추천

### 1순위: **GitHub Actions**
- ✅ 이미 GitHub 사용 중
- ✅ 현재 ci.sh 로직을 쉽게 마이그레이션 가능
- ✅ 무료 티어가 충분함
- ✅ 병렬 실행, 조건부 실행 모두 지원

### 2순위: **CircleCI**
- ✅ 성능이 가장 빠름
- ✅ 6,000분 무료 (GitHub Actions의 3배)
- ✅ Docker 캐싱으로 빌드 속도 향상

### 3순위: **GitLab CI/CD**
- ✅ All-in-one DevOps 플랫폼
- ✅ 보안 스캔 내장
- ⚠️ GitHub에서 마이그레이션 필요

---

## 현재 ci.sh의 장점

우리의 로컬 CI 스크립트는:

1. **완전 무료**: 클라우드 CI 비용 없음
2. **빠른 피드백**: 로컬에서 즉시 실행
3. **오프라인 가능**: 인터넷 없이도 검사 가능
4. **커스터마이징**: 프로젝트에 최적화된 로직
5. **학습 불필요**: 새로운 YAML 문법 배울 필요 없음

하지만 클라우드 CI는:
- ✅ 팀 협업 시 자동화
- ✅ PR마다 자동 검사
- ✅ 다양한 환경 테스트 (OS, 버전)
- ✅ 배포 자동화

**권장**: 로컬 ci.sh는 유지하되, GitHub Actions를 추가해서 PR 검사를 자동화하는 **하이브리드 전략**
