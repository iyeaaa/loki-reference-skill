# 권한 관리 시스템 DB 설계

> AWS IAM 스타일 + 구독 연동

## ERD

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BILLING                                    │
├─────────────────────────────────────────────────────────────────────┤
│  billing_customers ──┐                                               │
│  billing_products ───┼── billing_plans ── subscriptions ──┐         │
└─────────────────────────────────────────────────────────────│───────┘
                                                              │
┌─────────────────────────────────────────────────────────────│───────┐
│                         CORE ENTITIES                       │       │
├─────────────────────────────────────────────────────────────│───────┤
│  users ◀── workspace_members ──▶ workspaces ◀───────────────┘       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────│──────────────────────────────────────────┐
│                     IAM PERMISSIONS                                  │
├──────────────────────────│──────────────────────────────────────────┤
│                          ▼                                           │
│  iam_member_roles ──▶ iam_workspace_roles ◀── iam_role_policies     │
│  iam_member_policies ─────────────────────────────┐                  │
│                                                   ▼                  │
│  iam_tier_boundaries ──▶ iam_policies ◀── iam_policy_statements     │
│  iam_audit_logs                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 테이블 요약

| 카테고리 | 테이블 | 설명 |
|----------|--------|------|
| Billing | `billing_customers` | 사용자 ↔ 결제 고객 매핑 |
| | `billing_products` | 상품 (tier 매핑) |
| | `billing_plans` | 요금제 (가격/주기) |
| | `subscriptions` | 워크스페이스 단위 구독 |
| IAM | `iam_policies` | 정책 정의 |
| | `iam_policy_statements` | Allow/Deny 명세 |
| | `iam_workspace_roles` | 워크스페이스 역할 |
| | `iam_role_policies` | 역할 ↔ 정책 |
| | `iam_member_roles` | 멤버 ↔ 역할 |
| | `iam_member_policies` | 멤버 직접 정책 |
| | `iam_tier_boundaries` | 등급별 최대 권한 |
| | `iam_audit_logs` | 감사 로그 |

---

## DDL

### Enums

```sql
-- 구독 등급
CREATE TYPE subscription_tier_enum AS ENUM ('trial', 'basic', 'pro', 'enterprise');

-- 구독 상태
CREATE TYPE subscription_status_enum AS ENUM (
  'trialing', 'active', 'canceled', 'incomplete',
  'incomplete_expired', 'past_due', 'unpaid', 'paused'
);

-- 요금제 타입
CREATE TYPE plan_type_enum AS ENUM ('one_time', 'recurring');
CREATE TYPE plan_interval_enum AS ENUM ('day', 'week', 'month', 'year');

-- 정책 효과
CREATE TYPE policy_effect_enum AS ENUM ('allow', 'deny');
```

### Billing Tables

```sql
-- 사용자 ↔ 결제 고객 매핑
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  external_customer_id VARCHAR(255) NOT NULL UNIQUE,  -- 외부 결제 시스템 고객 ID
  email VARCHAR(255),
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_customers_user_id_idx ON billing_customers(user_id);
CREATE INDEX billing_customers_external_id_idx ON billing_customers(external_customer_id);

-- 상품
CREATE TABLE billing_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_product_id VARCHAR(255) UNIQUE,  -- 외부 결제 시스템 상품 ID (nullable)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tier subscription_tier_enum,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_products_tier_idx ON billing_products(tier);
CREATE INDEX billing_products_active_idx ON billing_products(is_active);

-- 요금제
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES billing_products(id) ON DELETE CASCADE,
  external_plan_id VARCHAR(255) UNIQUE,  -- 외부 결제 시스템 가격/플랜 ID (nullable)
  name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW',
  amount BIGINT NOT NULL,  -- 금액 (최소 단위, 예: 원)
  plan_type plan_type_enum NOT NULL DEFAULT 'recurring',
  billing_interval plan_interval_enum DEFAULT 'month',
  interval_count INTEGER DEFAULT 1,
  trial_days INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_plans_product_id_idx ON billing_plans(product_id);
CREATE INDEX billing_plans_active_idx ON billing_plans(is_active);

-- 구독 (워크스페이스 단위)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES billing_customers(id),
  plan_id UUID REFERENCES billing_plans(id),
  external_subscription_id VARCHAR(255) UNIQUE,  -- 외부 결제 시스템 구독 ID (nullable)
  status subscription_status_enum NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_workspace_id_idx ON subscriptions(workspace_id);
CREATE INDEX subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX subscriptions_status_idx ON subscriptions(status);
CREATE INDEX subscriptions_period_end_idx ON subscriptions(current_period_end);
```

### IAM Tables

```sql
-- 정책 정의
CREATE TABLE iam_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = 시스템 정책
  name VARCHAR(100) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_managed BOOLEAN NOT NULL DEFAULT false,  -- 시스템 관리 정책
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX iam_policies_workspace_id_idx ON iam_policies(workspace_id);
CREATE INDEX iam_policies_name_idx ON iam_policies(workspace_id, name);
CREATE INDEX iam_policies_is_managed_idx ON iam_policies(is_managed);

-- 정책 명세서 (Allow/Deny)
CREATE TABLE iam_policy_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES iam_policies(id) ON DELETE CASCADE,
  sid VARCHAR(100),
  effect policy_effect_enum NOT NULL DEFAULT 'allow',
  resources TEXT[] NOT NULL,  -- ['leads', 'leads:*', 'sequences']
  actions TEXT[] NOT NULL,    -- ['read', 'create', '*']
  conditions JSONB DEFAULT '{}',  -- { "maxCount": 20, "ownOnly": true }
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX iam_policy_statements_policy_id_idx ON iam_policy_statements(policy_id);
CREATE INDEX iam_policy_statements_effect_idx ON iam_policy_statements(effect);

-- 워크스페이스 역할
CREATE TABLE iam_workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX iam_workspace_roles_workspace_id_idx ON iam_workspace_roles(workspace_id);
CREATE INDEX iam_workspace_roles_is_default_idx ON iam_workspace_roles(workspace_id, is_default);

-- 역할 ↔ 정책 연결
CREATE TABLE iam_role_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES iam_workspace_roles(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES iam_policies(id) ON DELETE CASCADE,
  attached_by UUID REFERENCES users(id),
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, policy_id)
);

CREATE INDEX iam_role_policies_role_id_idx ON iam_role_policies(role_id);
CREATE INDEX iam_role_policies_policy_id_idx ON iam_role_policies(policy_id);

-- 멤버 ↔ 역할 할당
CREATE TABLE iam_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES iam_workspace_roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, role_id)
);

CREATE INDEX iam_member_roles_member_id_idx ON iam_member_roles(member_id);
CREATE INDEX iam_member_roles_role_id_idx ON iam_member_roles(role_id);

-- 멤버 직접 정책 (인라인)
CREATE TABLE iam_member_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES iam_policies(id) ON DELETE CASCADE,
  attached_by UUID REFERENCES users(id),
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, policy_id)
);

CREATE INDEX iam_member_policies_member_id_idx ON iam_member_policies(member_id);
CREATE INDEX iam_member_policies_policy_id_idx ON iam_member_policies(policy_id);

-- 등급별 Permission Boundary
CREATE TABLE iam_tier_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier_enum NOT NULL UNIQUE,
  policy_id UUID NOT NULL REFERENCES iam_policies(id) ON DELETE RESTRICT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 감사 로그
CREATE TABLE iam_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  target_name VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX iam_audit_logs_workspace_id_idx ON iam_audit_logs(workspace_id);
CREATE INDEX iam_audit_logs_user_id_idx ON iam_audit_logs(user_id);
CREATE INDEX iam_audit_logs_action_idx ON iam_audit_logs(action);
CREATE INDEX iam_audit_logs_target_idx ON iam_audit_logs(target_type, target_id);
CREATE INDEX iam_audit_logs_created_at_idx ON iam_audit_logs(created_at);
```

### 기존 테이블 수정

```sql
-- users 테이블
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- workspaces 테이블
ALTER TABLE workspaces ADD COLUMN subscription_tier subscription_tier_enum DEFAULT 'trial';
ALTER TABLE workspaces ADD COLUMN subscription_status subscription_status_enum DEFAULT 'trialing';
```

---

## 시드 데이터 (등급별 Boundary)

```sql
-- Trial Boundary 정책
INSERT INTO iam_policies (id, name, description, is_managed) VALUES
  ('00000000-0000-0000-0000-000000000001', 'TrialBoundary', 'Trial 등급 최대 권한', true);

INSERT INTO iam_policy_statements (policy_id, effect, resources, actions, conditions) VALUES
  ('00000000-0000-0000-0000-000000000001', 'allow', '{leads}', '{read,create}', '{"maxCount": 20}'),
  ('00000000-0000-0000-0000-000000000001', 'allow', '{sequences}', '{read,create}', '{"draftOnly": true}'),
  ('00000000-0000-0000-0000-000000000001', 'deny', '{analytics:performance}', '{*}', '{}'),
  ('00000000-0000-0000-0000-000000000001', 'deny', '{campaigns}', '{execute}', '{}'),
  ('00000000-0000-0000-0000-000000000001', 'deny', '{linda_gpt}', '{*}', '{}');

INSERT INTO iam_tier_boundaries (tier, policy_id, description) VALUES
  ('trial', '00000000-0000-0000-0000-000000000001', 'Trial: 20리드, 성과지표 제한');

-- Basic Boundary 정책
INSERT INTO iam_policies (id, name, description, is_managed) VALUES
  ('00000000-0000-0000-0000-000000000002', 'BasicBoundary', 'Basic 등급 최대 권한', true);

INSERT INTO iam_policy_statements (policy_id, effect, resources, actions) VALUES
  ('00000000-0000-0000-0000-000000000002', 'allow', '{leads,leads:*}', '{*}'),
  ('00000000-0000-0000-0000-000000000002', 'allow', '{sequences}', '{read,create,update}'),
  ('00000000-0000-0000-0000-000000000002', 'allow', '{analytics,analytics:*}', '{read}'),
  ('00000000-0000-0000-0000-000000000002', 'deny', '{linda_gpt}', '{*}');

INSERT INTO iam_tier_boundaries (tier, policy_id, description) VALUES
  ('basic', '00000000-0000-0000-0000-000000000002', 'Basic: 캠페인 Admin 대행');

-- Pro Boundary 정책
INSERT INTO iam_policies (id, name, description, is_managed) VALUES
  ('00000000-0000-0000-0000-000000000003', 'ProBoundary', 'Pro 등급 최대 권한', true);

INSERT INTO iam_policy_statements (policy_id, effect, resources, actions) VALUES
  ('00000000-0000-0000-0000-000000000003', 'allow', '{leads,sequences,campaigns,analytics,email_templates}', '{*}'),
  ('00000000-0000-0000-0000-000000000003', 'deny', '{linda_gpt}', '{*}');

INSERT INTO iam_tier_boundaries (tier, policy_id, description) VALUES
  ('pro', '00000000-0000-0000-0000-000000000003', 'Pro: 셀프서빙');

-- Enterprise Boundary 정책
INSERT INTO iam_policies (id, name, description, is_managed) VALUES
  ('00000000-0000-0000-0000-000000000004', 'EnterpriseBoundary', 'Enterprise 등급 최대 권한', true);

INSERT INTO iam_policy_statements (policy_id, effect, resources, actions) VALUES
  ('00000000-0000-0000-0000-000000000004', 'allow', '{*}', '{*}'),
  ('00000000-0000-0000-0000-000000000004', 'allow', '{linda_gpt}', '{access,execute}');

INSERT INTO iam_tier_boundaries (tier, policy_id, description) VALUES
  ('enterprise', '00000000-0000-0000-0000-000000000004', 'Enterprise: Linda GPT 포함');
```

---

## 권한 평가 순서

```
1. Super Admin → 전체 허용
2. 워크스페이스 멤버십 체크
3. Tier Boundary 체크 (등급별 최대 권한)
4. Explicit Deny → 거부
5. Explicit Allow → 허용
6. Default → 거부
```
