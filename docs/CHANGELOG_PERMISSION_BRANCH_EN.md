# feat/permission Branch Changelog

> Branch: `feat/permission`
> Date: 2025-12-12
> Total Commits: 3

---

## Commit Summary

| Commit | Description | Files Changed |
|--------|-------------|---------------|
| `c1d4b67` | Permission DB schema design | 13 files (+10,540 lines) |
| `0ddafa2` | AWS IAM-style permission system implementation | 38 files (+12,580 lines, -149 lines) |
| `8a0786b` | Onboarding session storage → DB migration & Company Setting integration | 71 files (+14,608 lines, -1,662 lines) |

---

## 1. Permission DB Schema Design (`c1d4b67`)

### New Documentation
- `docs/PERMISSION_LEVEL_ACCESS_POLICY.md` - Level-based access policy definition
- `docs/PERMISSION_SYSTEM_DESIGN.md` - DB design document
- `docs/PERMISSION_SYSTEM_ERD.puml` - ERD diagram
- `docs/PERMISSION_WORKSPACE_VS_MEMBER.md` - Workspace vs Member permission comparison

### New DB Schema (Drizzle)

#### Billing Tables
| Table | Description |
|-------|-------------|
| `billing_customers` | User ↔ External payment customer mapping |
| `billing_products` | Product definition (tier mapping) |
| `billing_plans` | Pricing plans (price, interval, trial period) |
| `subscriptions` | Workspace-level subscription management |

#### IAM Tables
| Table | Description |
|-------|-------------|
| `iam_policies` | Policy definitions (system/workspace) |
| `iam_policy_statements` | Allow/Deny specifications (resources, actions, conditions) |
| `iam_workspace_roles` | Workspace roles (Owner, Admin, Editor, Viewer) |
| `iam_role_policies` | Role ↔ Policy association |
| `iam_member_roles` | Member ↔ Role assignment |
| `iam_member_policies` | Member direct policies (inline) |
| `iam_tier_boundaries` | Tier-based Permission Boundaries |
| `iam_audit_logs` | Audit logs |

#### New Enum Types
```sql
-- Subscription tiers
subscription_tier_enum: 'trial' | 'basic' | 'pro' | 'enterprise'

-- Subscription status
subscription_status_enum: 'trialing' | 'active' | 'canceled' | 'incomplete' | ...

-- Plan types
plan_type_enum: 'one_time' | 'recurring'
plan_interval_enum: 'day' | 'week' | 'month' | 'year'

-- Policy effect
policy_effect_enum: 'allow' | 'deny'
```

#### Existing Table Modifications
- Added `is_super_admin` column to `users` table
- Added `subscription_tier`, `subscription_status` columns to `workspaces` table

---

## 2. AWS IAM-style Permission System Implementation (`0ddafa2`)

### Backend (Elysia Server)

#### New Services
- `elysia-server/src/services/iam.service.ts` - IAM core logic
  - Policy CRUD
  - Role CRUD
  - Member role/policy management
  - Permission evaluation logic
- `elysia-server/src/services/billing.service.ts` - Billing service
  - Customer, product, plan, subscription management

#### New Routes
- `elysia-server/src/routes/iam.routes.ts` (766 lines)
  - `GET/POST /policies` - Policy management
  - `GET/POST /roles` - Role management
  - `POST /members/:memberId/roles` - Member role assignment
  - `POST /members/:memberId/policies` - Member policy assignment
  - `GET /audit-logs` - Audit log retrieval
  - `GET /tier-boundaries` - Tier boundary retrieval
- `elysia-server/src/routes/billing.routes.ts` (529 lines)
  - Customer, product, plan, subscription CRUD APIs

#### New Plugins
- `elysia-server/src/plugins/iam-auth.plugin.ts` - IAM authentication middleware

#### Seed Data
- `elysia-server/src/db/seed-iam.ts` - Tier boundary policy seeds

### Frontend (Admin)

#### New Pages
| Route | File | Description |
|-------|------|-------------|
| `/iam/policies` | `PoliciesPage.tsx` | Policy management |
| `/iam/policies/new` | `PolicyForm.tsx` | Policy create/edit |
| `/iam/roles` | `RolesPage.tsx` | Role management |
| `/iam/roles/new` | `RoleForm.tsx` | Role create/edit |
| `/iam/audit-logs` | `AuditLogsPage.tsx` | Audit logs |
| `/iam/tier-boundaries` | `TierBoundariesPage.tsx` | Tier boundaries |
| `/billing/customers` | `CustomersPage.tsx` | Billing customers |
| `/billing/products` | `ProductsPage.tsx` | Product management |
| `/billing/plans` | `PlansPage.tsx` | Plan management |
| `/billing/subscriptions` | `SubscriptionsPage.tsx` | Subscription management |

#### New API Hooks
- `admin/src/lib/api/hooks/iam.ts` - IAM API React Query Hooks
- `admin/src/lib/api/hooks/billing.ts` - Billing API Hooks

#### New API Services
- `admin/src/lib/api/services/iam.ts` - IAM API client
- `admin/src/lib/api/services/billing.ts` - Billing API client

#### New Type Definitions
- `admin/src/lib/api/types/iam.ts` - IAM-related types
- `admin/src/lib/api/types/billing.ts` - Billing-related types

#### UI Components
- `admin/src/components/ui/data-filters.tsx` - Data filter component
- `admin/src/components/ui/data-table.tsx` - Data table component
- `admin/src/pages/workspaces/MemberIamSection.tsx` - Member IAM section

#### Documentation
- `admin/docs/IAM_PERMISSION_SYSTEM.md` - IAM system documentation

---

## 3. Onboarding DB Migration & Company Setting Integration (`8a0786b`)

### Key Changes

#### Session Storage → DB Migration
- Migrated onboarding data from browser Session Storage to database
- Created new `onboarding` table

### Backend

#### New Schema
- `elysia-server/src/db/schema/onboarding.ts` - Onboarding table

#### New Services
- `elysia-server/src/services/onboarding.service.ts` - Onboarding service
  - Session save/retrieve/update
  - Step-by-step data management

#### New Routes
- `elysia-server/src/routes/onboarding.routes.ts`
  - `GET /sessions/:sessionId` - Get session
  - `POST /sessions` - Create session
  - `PUT /sessions/:sessionId` - Update session
  - `PUT /sessions/:sessionId/step/:step` - Update step

#### New Plugins
- `elysia-server/src/plugins/activity-logger.plugin.ts` - Activity logging plugin
- `elysia-server/src/plugins/permission-guard.plugin.ts` - Permission guard plugin

#### IAM Resource Constants
- `elysia-server/src/constants/iam-resources.ts` - Resource/action constants

### Frontend

#### Permission System (New)
New permission management module: `admin/src/lib/permission/`

| File | Description |
|------|-------------|
| `PermissionProvider.tsx` | Permission Context Provider |
| `RouteGuard.tsx` | Route protection component |
| `components.tsx` | Permission-based UI components |
| `constants.ts` | Permission constants |
| `hooks.ts` | Permission-related hooks |
| `types.ts` | Permission type definitions |
| `utils.ts` | Permission utilities |
| `index.ts` | Module exports |

#### New Pages
| Route | File | Description |
|-------|------|-------------|
| `/activity-logs` | `ActivityLogsPage.tsx` | Activity logs page |
| - | `ActivityLogsFilters.tsx` | Activity log filters |
| - | `ActivityLogsTableWithPagination.tsx` | Activity log table |

#### New API Hooks
- `admin/src/lib/api/hooks/onboarding.ts` - Onboarding API Hooks

#### New API Services
- `admin/src/lib/api/services/onboarding.ts` - Onboarding API client

#### Modified Components
- `admin/src/components/AppSidebar.tsx` - Permission-based menu filtering
- `admin/src/components/ProtectedRoute.tsx` - Added permission check logic
- `admin/src/pages/settings.tsx` - Company Setting integration
- `admin/src/router/index.tsx` - New routes added

#### Onboarding Step Component Updates
- `StepCompanyInfo.tsx` - DB integration
- `StepConfirmation.tsx` - DB integration
- `StepEmailGeneration.tsx` - DB integration
- `StepLeadSearch.tsx` - DB integration

#### Locale Additions
- `admin/locales/settings.csv` - Settings page i18n
- `admin/locales/sidebar.csv` - Sidebar i18n

#### Deleted Files
- `admin/src/layouts/AppLayout.tsx` (-200 lines)
- `admin/src/pages/workspaces/WorkspaceCompanyInfo.tsx` (-340 lines)

---

## Permission Evaluation Order

```
1. Super Admin → Allow all
2. Workspace membership check
3. Tier Boundary check (tier-based maximum permissions)
4. Explicit Deny → Deny
5. Explicit Allow → Allow
6. Default → Deny
```

---

## Tier-based Feature Restrictions

| Tier | Restrictions |
|------|--------------|
| Trial | 20 leads max, No analytics, No campaign execution, No Linda GPT |
| Basic | No Linda GPT, Campaign managed by Admin |
| Pro | No Linda GPT, Self-serving available |
| Enterprise | All features (including Linda GPT) |

---

## Migration

### DB Migration Files
- `elysia-server/drizzle/0033_lively_warbound.sql` - Billing/IAM tables
- `elysia-server/drizzle/0034_gorgeous_karma.sql` - Onboarding table

### How to Run
```bash
cd elysia-server
bun run db:migrate
bun run db:seed-iam  # IAM seed data
```

---

## Key File Structure

```
elysia-server/
├── src/
│   ├── db/schema/
│   │   ├── billing.ts          # Billing schema
│   │   ├── iam.ts              # IAM schema
│   │   ├── onboarding.ts       # Onboarding schema
│   │   └── enums.ts            # Enum definitions
│   ├── services/
│   │   ├── iam.service.ts      # IAM service
│   │   ├── billing.service.ts  # Billing service
│   │   └── onboarding.service.ts
│   ├── routes/
│   │   ├── iam.routes.ts       # IAM API
│   │   ├── billing.routes.ts   # Billing API
│   │   └── onboarding.routes.ts
│   ├── plugins/
│   │   ├── iam-auth.plugin.ts
│   │   ├── activity-logger.plugin.ts
│   │   └── permission-guard.plugin.ts
│   └── constants/
│       └── iam-resources.ts

admin/
├── src/
│   ├── lib/
│   │   ├── permission/         # Permission system module
│   │   │   ├── PermissionProvider.tsx
│   │   │   ├── RouteGuard.tsx
│   │   │   ├── hooks.ts
│   │   │   └── ...
│   │   └── api/
│   │       ├── hooks/
│   │       │   ├── iam.ts
│   │       │   ├── billing.ts
│   │       │   └── onboarding.ts
│   │       ├── services/
│   │       │   ├── iam.ts
│   │       │   ├── billing.ts
│   │       │   └── onboarding.ts
│   │       └── types/
│   │           ├── iam.ts
│   │           └── billing.ts
│   └── pages/
│       ├── iam/                # IAM management pages
│       ├── billing/            # Billing management pages
│       └── activity-logs/      # Activity logs page

docs/
├── PERMISSION_SYSTEM_DESIGN.md
├── PERMISSION_LEVEL_ACCESS_POLICY.md
├── PERMISSION_WORKSPACE_VS_MEMBER.md
└── PERMISSION_SYSTEM_ERD.puml
```

---

*Last updated: 2025-12-12*
