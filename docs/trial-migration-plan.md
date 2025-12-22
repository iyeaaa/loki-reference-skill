# Trial 필드 마이그레이션 계획서

## 1. 현황 분석 (2024-12-22)

### 1.1 데이터베이스 현황

| 항목 | 수량 | 비고 |
|------|------|------|
| 총 유저 | 58명 | - |
| 삭제된 유저 | 14명 | `@deleted.local` 이메일 |
| 활성 유저 | 44명 | - |
| 총 워크스페이스 | 58개 | - |
| 총 구독 | 22개 | **36개 누락** |
| trialing 상태 구독 | 22개 | - |
| 만료된 trial | 3개 | subscriptions 기준 |

### 1.2 데이터 불일치 발견

```
┌─────────────────────────────────────────────────────────────┐
│                    데이터 불일치 현황                        │
├─────────────────────────────────────────────────────────────┤
│ 문제 1: Trial 유저인데 워크스페이스 없음                    │
│   - 7명 (6명 삭제된 유저, 1명 실제 유저)                    │
│                                                             │
│ 문제 2: 워크스페이스는 있지만 구독 없음                     │
│   - 36개 워크스페이스 (활성 유저 소유)                      │
│                                                             │
│ 문제 3: Trial 유저 + 워크스페이스 O + 구독 X               │
│   - 3명 (soodata20, csh13080, zalatanback2)                │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 문제의 원인

1. **구독 생성 로직 누락**: 과거에 workspace 생성 시 subscription 생성 로직이 없었음
2. **마이그레이션 미실행**: billing 시스템 도입 후 기존 워크스페이스에 대한 마이그레이션 미실행

---

## 2. 변경 사항 요약

### 2.1 스키마 변경

**Before:**
```sql
-- users 테이블
trial_start_date TIMESTAMP WITH TIME ZONE
trial_end_date TIMESTAMP WITH TIME ZONE
is_trial_active BOOLEAN DEFAULT false
```

**After:**
```sql
-- users 테이블에서 위 필드 제거
-- trial 정보는 subscriptions 테이블에서 관리
subscriptions.status = 'trialing'
subscriptions.trial_start
subscriptions.trial_end
```

### 2.2 백엔드 변경

| 파일 | 변경 내용 |
|------|----------|
| `db/schema/users.ts` | trial 필드 3개 제거 |
| `services/user.service.ts` | `checkTrialStatus` → workspace 구독 기반으로 재작성 |
| `routes/auth.routes.ts` | `AuthUser` 타입에서 trial 필드 제거 |

### 2.3 프론트엔드 변경

| 파일 | 변경 내용 |
|------|----------|
| `lib/api/types/auth.ts` | `trialStatus` 필드 nullable 수정 |
| `lib/auth-provider.tsx` | `User` 타입 수정 |
| `pages/NewTrialPage.tsx` | null 체크 추가 |

---

## 3. 마이그레이션 실행 계획

### 3.1 사전 작업 (필수)

**Step 1: 누락된 구독 생성**

```sql
-- 구독이 없는 워크스페이스에 trial 구독 생성
-- 먼저 trial 요금제 ID 확인
SELECT id, trial_days FROM billing_plans
WHERE product_id IN (SELECT id FROM billing_products WHERE tier = 'trial')
AND is_active = true AND is_default = true;

-- billing_customer가 없는 유저에게 생성
INSERT INTO billing_customers (user_id, external_customer_id, email, name)
SELECT
  u.id,
  'internal_' || u.id,
  u.email,
  u.username
FROM users u
LEFT JOIN billing_customers bc ON bc.user_id = u.id
WHERE bc.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';

-- 구독 생성 (36개 워크스페이스)
INSERT INTO subscriptions (
  workspace_id, customer_id, plan_id, status, is_primary, quantity,
  trial_start, trial_end, current_period_start, current_period_end
)
SELECT
  w.id,
  bc.id,
  (SELECT id FROM billing_plans WHERE is_default = true LIMIT 1),
  'trialing',
  true,
  1,
  COALESCE(u.trial_start_date, NOW()),
  COALESCE(u.trial_end_date, NOW() + INTERVAL '30 days'),
  COALESCE(u.trial_start_date, NOW()),
  COALESCE(u.trial_end_date, NOW() + INTERVAL '30 days')
FROM workspaces w
JOIN users u ON u.id = w.owner_id
JOIN billing_customers bc ON bc.user_id = u.id
LEFT JOIN subscriptions s ON s.workspace_id = w.id
WHERE s.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';
```

**Step 2: 데이터 검증**

```sql
-- 모든 활성 워크스페이스에 구독이 있는지 확인
SELECT COUNT(*) as missing_subscriptions
FROM workspaces w
JOIN users u ON u.id = w.owner_id
LEFT JOIN subscriptions s ON s.workspace_id = w.id
WHERE s.id IS NULL
AND u.email NOT LIKE '%@deleted.local%';
-- 결과가 0이어야 함
```

### 3.2 마이그레이션 실행

**Step 3: 스키마 마이그레이션**

```sql
-- 인덱스 제거
DROP INDEX IF EXISTS users_trial_active_idx;

-- trial 필드 제거
ALTER TABLE users DROP COLUMN IF EXISTS trial_start_date;
ALTER TABLE users DROP COLUMN IF EXISTS trial_end_date;
ALTER TABLE users DROP COLUMN IF EXISTS is_trial_active;
```

### 3.3 배포 순서

1. **DB 사전 작업** (Step 1, 2)
   - 누락된 billing_customers 생성
   - 누락된 subscriptions 생성
   - 데이터 검증

2. **백엔드 배포** (elysia-server)
   - 코드 변경사항 배포
   - 새 로그인부터 workspace 구독 기반 trial 상태 사용

3. **프론트엔드 배포** (admin)
   - 타입 변경사항 배포

4. **DB 스키마 마이그레이션** (Step 3)
   - users 테이블에서 trial 필드 제거

---

## 4. 롤백 계획

### 4.1 스키마 롤백

```sql
-- 필드 복구
ALTER TABLE users ADD COLUMN trial_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN trial_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN is_trial_active BOOLEAN DEFAULT false;

-- 인덱스 복구
CREATE INDEX users_trial_active_idx ON users(is_trial_active);

-- 데이터 복구 (subscriptions에서)
UPDATE users u
SET
  trial_start_date = s.trial_start,
  trial_end_date = s.trial_end,
  is_trial_active = (s.status = 'trialing')
FROM workspaces w
JOIN subscriptions s ON s.workspace_id = w.id AND s.is_primary = true
WHERE w.owner_id = u.id;
```

---

## 5. 위험 요소 및 대응

| 위험 | 영향도 | 대응 방안 |
|------|--------|----------|
| 구독 없는 워크스페이스 | 높음 | 사전에 누락된 구독 생성 |
| 로그인 실패 | 높음 | checkTrialStatus가 null 반환해도 정상 동작하도록 구현됨 |
| 기존 trial 정보 손실 | 중간 | 마이그레이션 전 users.trial_end_date를 subscriptions.trial_end로 복사 |

---

## 6. 확인 체크리스트

- [ ] 백업 완료 확인
- [ ] billing_customers 누락분 생성 완료
- [ ] subscriptions 누락분 생성 완료 (36개)
- [ ] 백엔드 배포 완료
- [ ] 프론트엔드 배포 완료
- [ ] 로그인 테스트 통과
- [ ] Trial 상태 표시 정상 확인
- [ ] DB 스키마 마이그레이션 완료

---

## 7. 영향받는 유저

### 7.1 구독 생성 필요 유저 (3명)

| 이메일 | 워크스페이스 |
|--------|-------------|
| soodata20@gmail.com | 수다쟁이의 워크스페이스 |
| csh13080@gmail.com | 조서현의 워크스페이스 |
| zalatanback2@gmail.com | محمد مجدى의 워크스페이스 |

### 7.2 무시 가능 유저 (삭제된 유저)

- `deleted_*@deleted.local` 이메일을 가진 14명의 유저는 무시

---

*작성일: 2024-12-22*
*작성자: Claude Code*
