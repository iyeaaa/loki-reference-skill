# 사이드바 메뉴 가시성 기준

## 권한 타입

| 타입 | 설명 |
|------|------|
| `"public"` | 모든 인증된 사용자에게 표시 |
| `"admin-only"` | 시스템 관리자만 표시 |
| `{ resource, action }` | IAM 권한 체크 후 표시 |
| `undefined` | 메인: Admin-only / 설정: public |

## 가시성 판단 흐름

```
1. 로딩 중 → 빈 배열 반환 (깜빡임 방지)
2. Admin인가? → 모든 메뉴 표시
3. permission="public"? → 표시
4. permission="admin-only"? → 숨김
5. permission={resource,action}? → hasPermission() 체크
6. undefined? → 메인 사이드바: 숨김 / 설정 사이드바: 표시
```

## 메인 사이드바 (AppSidebar)

**파일:** `src/components/AppSidebar.tsx:219-242`

| 메뉴 | 권한 |
|------|------|
| Home | `public` |
| Analytics | `analytics:read` |
| Lead Discovery | `leads:discovery:read` |
| Customer Management | `leads:list` |
| Campaign | `sequences:list` |
| Reply/Inbox | `emails:list` |
| AI Sales Automation | `ai:chatbot:execute` |
| Settings | 항상 표시 (Footer에서 별도 렌더링) |

## 설정 사이드바 (SettingsSidebar)

**파일:** `src/pages/settings.tsx:321-381`

### 개인 설정
| 메뉴 | 권한 |
|------|------|
| Profile | `settings:profile:read` |
| Signature | `settings:profile:read` |

### 워크스페이스
| 메뉴 | 권한 |
|------|------|
| Workspace | `public` |
| Email Templates | `public` |
| Company Setup | `public` (온보딩 미완료시만) |

### 시스템 관리
| 메뉴 | 권한 |
|------|------|
| Users | `admin-only` |
| Bulk Lead Import | `leads:import` |
| Web Extraction | `admin-only` |
| Nylas Email Test | `admin-only` |

### 결제
| 메뉴 | 권한 |
|------|------|
| 상품/요금제/구독/고객 | `admin-only` |

### 권한 및 보안
| 메뉴 | 권한 |
|------|------|
| 정책/역할/등급 경계/감사 로그/활동 로그 | `admin-only` |

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/permission/PermissionProvider.tsx` | 권한 상태 관리 Context |
| `lib/permission/constants.ts` | 라우트/사이드바 권한 매핑 |
| `lib/constants/iam-resources.ts` | IAM 리소스/액션 정의 |

## 프론트엔드 권한 체크

```typescript
const { isAdmin, hasPermission, isLoading } = usePermissions()

hasPermission(resource, action)  // 동기 체크 (캐시된 데이터)
isAdmin                          // Admin 여부
```

---

# 백엔드 권한 시스템

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `elysia-server/src/plugins/iam-auth.plugin.ts` | IAM 인증/권한 플러그인 |
| `elysia-server/src/services/iam.service.ts` | 권한 체크 핵심 로직 |

## 권한 체크 흐름

```
1. iamAuth 플러그인
   - Authorization 헤더 → userId 추출
   - params/body/query → workspaceId 추출
   - userId + workspaceId → memberId 조회

2. requirePermission(resource, action) 가드
   - 인증 확인 (401)
   - 멤버십 확인 (403)
   - checkPermission() 호출

3. checkPermission() (캐싱 5분 TTL)
   - 멤버의 역할(Role) → 정책(Policy) → statements 수집
   - 멤버 직접 정책(Inline) → statements 수집
   - priority 내림차순 정렬
   - Deny 우선 원칙 적용
```

## Admin 판단 기준

```typescript
// isMemberAdmin() - iam.service.ts:927
역할 이름이 "Owner" 또는 "Admin"이면 Admin
```

## 프론트엔드 권한 조회 API

`getMemberPermissions(memberId, workspaceId)` 반환값:

| 필드 | 설명 |
|------|------|
| `roles` | `[{ id, name, priority }]` |
| `isAdmin` | Owner/Admin 역할 여부 |
| `permissions` | `[{ resource, action }]` 배열 |
| `tier` | 구독 등급 (trial, basic, pro, enterprise) |

**Admin인 경우**: `permissions: [{ resource: "*", action: "*" }]`

## TierBoundary (구독 등급 제한)

- 구독 등급별 최대 권한 범위 정의
- 최종 권한 = (Role 권한 + Inline 권한 - Deny) ∩ TierBoundary
- Admin은 TierBoundary 무시

## 액션 계층 구조

```
"*"      → 모든 액션
"manage" → list, read, create, update, delete
"read"   → list
```
