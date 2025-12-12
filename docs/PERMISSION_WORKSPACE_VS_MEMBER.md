# 워크스페이스 권한 vs 멤버 권한

## 권한 구조 계층

```
┌─────────────────────────────────────────────────────────┐
│  1. Tier Boundary (구독 등급 최대 권한)                    │
│     └─ 워크스페이스의 subscription_tier에 따라 결정         │
├─────────────────────────────────────────────────────────┤
│  2. Workspace Role (워크스페이스 역할)                     │
│     └─ iam_workspace_roles → iam_role_policies          │
├─────────────────────────────────────────────────────────┤
│  3. Member Role (멤버에게 할당된 역할)                     │
│     └─ iam_member_roles → iam_workspace_roles           │
├─────────────────────────────────────────────────────────┤
│  4. Member Policy (멤버 직접 정책)                        │
│     └─ iam_member_policies → iam_policies (인라인)       │
└─────────────────────────────────────────────────────────┘
```

---

## 1. 워크스페이스 권한 (Workspace-level)

### Tier Boundary

워크스페이스의 **구독 등급**에 따른 최대 허용 권한

```sql
-- 워크스페이스가 'trial' 등급이면
workspaces.subscription_tier = 'trial'

-- 해당 워크스페이스의 모든 멤버는 Trial Boundary를 넘을 수 없음
iam_tier_boundaries.tier = 'trial' → policy_id → iam_policy_statements
```

| 등급 | 제한 예시 |
|------|----------|
| Trial | 리드 20개, 성과지표 X, 캠페인 실행 X |
| Basic | 캠페인 생성은 Admin 대행만 |
| Pro | 셀프 서빙 가능 |
| Enterprise | Linda GPT 포함 전체 기능 |

### Workspace Role

워크스페이스 내에서 **정의된 역할**. 역할에 정책이 연결됨.

```sql
-- 워크스페이스에 역할 생성
iam_workspace_roles: { workspace_id, name: 'Editor', is_default: false }

-- 역할에 정책 연결
iam_role_policies: { role_id: 'Editor', policy_id: 'LeadFullAccess' }
```

**예시 역할:**
- `Owner`: 모든 권한 + 멤버 관리
- `Admin`: 대부분 권한 + 설정 변경
- `Editor`: 리드/시퀀스 CRUD
- `Viewer`: 읽기 전용

---

## 2. 멤버 권한 (Member-level)

### Member Role (역할 기반)

멤버에게 **워크스페이스 역할을 할당**

```sql
-- 멤버에게 역할 부여
iam_member_roles: { member_id: 'user123', role_id: 'Editor' }

-- 멤버는 Editor 역할의 모든 정책을 상속
```

**특징:**
- 한 멤버가 **여러 역할** 보유 가능
- 역할의 정책이 변경되면 해당 역할의 **모든 멤버에게 자동 적용**

### Member Policy (직접 정책)

멤버에게 **개별적으로 정책을 직접 연결**

```sql
-- 특정 멤버에게만 추가 권한 부여
iam_member_policies: { member_id: 'user123', policy_id: 'AnalyticsReadOnly' }
```

**사용 케이스:**
- 특정 멤버에게만 임시 권한 부여
- 역할에 포함되지 않는 예외적 권한
- 특정 멤버의 권한 제한 (Deny 정책)

---

## 비교표

| 구분 | Workspace Role | Member Role | Member Policy |
|------|----------------|-------------|---------------|
| **대상** | 역할 정의 | 멤버 ↔ 역할 연결 | 멤버 ↔ 정책 직접 연결 |
| **범위** | 워크스페이스 전체 | 개별 멤버 | 개별 멤버 |
| **재사용** | 여러 멤버에게 할당 가능 | - | 정책 자체는 재사용 가능 |
| **관리** | 역할 수정 → 전체 반영 | 멤버별 역할 추가/제거 | 멤버별 정책 추가/제거 |
| **용도** | 표준 권한 그룹 | 그룹 권한 할당 | 예외적/임시 권한 |

---

## 권한 평가 흐름

```
요청: user123이 leads:create 수행

1. Super Admin 체크
   └─ users.is_super_admin = true → 허용

2. 워크스페이스 멤버십 체크
   └─ workspace_members에 존재하는가?

3. Tier Boundary 체크 (워크스페이스 등급)
   └─ workspace.subscription_tier = 'trial'
   └─ TrialBoundary에서 leads:create 허용? (20개 제한)

4. Explicit Deny 체크
   └─ 멤버의 역할/직접정책 중 leads:create DENY 있는가?

5. Explicit Allow 체크
   └─ 멤버의 역할 정책에서 leads:create ALLOW?
   └─ 멤버의 직접 정책에서 leads:create ALLOW?

6. Default Deny
   └─ 위 모두 해당 없으면 거부
```

---

## 실제 예시

### 시나리오: Pro 등급 워크스페이스의 Editor 멤버

```
워크스페이스: Acme Corp (subscription_tier: 'pro')
멤버: user123
역할: Editor
직접 정책: AnalyticsDeny (성과 지표 접근 금지)
```

**권한 계산:**

1. Pro Boundary: 대부분 기능 허용, Linda GPT 제외
2. Editor 역할: leads/sequences CRUD 허용
3. 직접 정책: analytics:viewPerformance **DENY**

**결과:**

| 액션 | 허용 여부 | 이유 |
|------|----------|------|
| leads:create | ✅ | Editor 역할 허용 |
| leads:read | ✅ | Editor 역할 허용 |
| sequences:update | ✅ | Editor 역할 허용 |
| analytics:viewPerformance | ❌ | 직접 정책 Deny |
| linda_gpt:access | ❌ | Tier Boundary (Pro는 불가) |
