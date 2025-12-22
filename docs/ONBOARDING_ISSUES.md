# 온보딩 시스템 이슈 목록

> 최종 업데이트: 2025-12-22
> 상태: 🔴 Critical | 🟡 High | 🟢 Medium | ✅ Resolved

---

## 이슈 요약

| 우선순위 | 총 개수 | 해결됨 |
|----------|---------|--------|
| 🔴 Critical | 4 | 0 |
| 🟡 High | 6 | 0 |
| 🟢 Medium | 10 | 0 |
| **합계** | **20** | **0** |

---

## 🔴 Critical Issues (즉시 수정 필요)

### C-01: JWT 인증 보안 취약점

| 항목 | 내용 |
|------|------|
| **상태** | 🔴 Open |
| **영역** | Backend / Security |
| **파일** | `elysia-server/src/services/auth.service.ts` |
| **설명** | JWT가 암호화 서명 없이 Base64 인코딩만 사용. 토큰 위조 가능. |
| **현재 코드** | `Buffer.from(JSON.stringify(payload)).toString('base64')` |
| **해결 방법** | jsonwebtoken 라이브러리로 HS256/RS256 서명 적용 |
| **예상 작업량** | 2-4시간 |

---

### C-02: 외래키 제약조건 누락

| 항목 | 내용 |
|------|------|
| **상태** | 🔴 Open |
| **영역** | Database |
| **파일** | `elysia-server/src/db/schema/onboarding.ts` |
| **설명** | `onboarding_progress` 테이블의 3개 필드에 FK 없음 |

**누락된 FK:**

| 필드 | 참조 테이블 | 위험 |
|------|------------|------|
| `customerGroupId` | `customer_groups.id` | 그룹 삭제 시 orphan 발생 |
| `generatedSequenceId` | `sequences.id` | 시퀀스 삭제 시 orphan 발생 |
| `selectedLeadIds` | `leads.id` (JSONB) | 관계형 무결성 없음 |

**해결 방법:**
```sql
ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_customer_group
    FOREIGN KEY (customer_group_id)
    REFERENCES customer_groups(id) ON DELETE SET NULL;

ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_generated_sequence
    FOREIGN KEY (generated_sequence_id)
    REFERENCES sequences(id) ON DELETE SET NULL;
```

| **예상 작업량** | 1-2시간 (마이그레이션 포함) |

---

### C-03: Trial 데이터 3중 복제

| 항목 | 내용 |
|------|------|
| **상태** | 🔴 Open |
| **영역** | Database / Architecture |
| **설명** | Trial 관련 날짜가 3곳에 중복 저장되어 동기화 문제 발생 가능 |

**중복 위치:**

| 위치 | 필드 |
|------|------|
| `users` | `trialStartDate`, `trialEndDate`, `isTrialActive` |
| `subscriptions` | `trialStart`, `trialEnd` |
| `billingPlans` | `trialDays` |

**해결 방법:**
1. `subscriptions` 테이블을 단일 진실 소스로 지정
2. `users` 테이블의 trial 필드 제거 또는 deprecated 마킹
3. View 생성으로 기존 쿼리 호환성 유지

| **예상 작업량** | 4-6시간 |

---

### C-04: 트랜잭션 없는 다중 테이블 업데이트

| 항목 | 내용 |
|------|------|
| **상태** | 🔴 Open |
| **영역** | Backend |
| **파일** | `elysia-server/src/services/onboarding.service.ts` |
| **함수** | `saveSurveyData()` |
| **설명** | Survey 저장과 Sales Strategy 연결이 트랜잭션 없이 순차 실행 |
| **위험** | Sales Strategy 연결 실패 시 불완전 상태 발생 |

**해결 방법:**
```typescript
await db.transaction(async (tx) => {
  await tx.update(onboardingProgress)...
  await salesStrategyService.findOrCreateAndLink(tx, ...)
})
```

| **예상 작업량** | 1-2시간 |

---

## 🟡 High Priority Issues

### H-01: 온보딩 상태/스텝 불일치 가능

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Database |
| **파일** | `elysia-server/src/db/schema/onboarding.ts` |
| **설명** | `status`와 `currentStep` 필드가 분리되어 불일치 가능 |
| **예시** | `status = 'lead_search'` 인데 `currentStep = 1` |

**해결 방법:**
```sql
ALTER TABLE onboarding_progress
  ADD CONSTRAINT check_status_step_match
  CHECK (
    (status = 'not_started' AND current_step = 0) OR
    (status = 'survey_completed' AND current_step >= 1) OR
    ...
  );
```

| **예상 작업량** | 1시간 |

---

### H-02: SSE 연결 재시도 로직 부재

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Frontend |
| **파일** | `admin/src/lib/api/hooks/onboarding.ts` |
| **설명** | SSE 스트림 실패 시 자동 재연결 없음 |
| **해결 방법** | Exponential backoff 재연결 구현 |
| **예상 작업량** | 2-3시간 |

---

### H-03: 설문 데이터 이중 저장

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Database |
| **설명** | 동일 설문 데이터가 2곳에 중복 저장 |

**중복 위치:**

| 위치 | 필드 |
|------|------|
| `users` | `onboardingSurvey` (JSONB) |
| `onboarding_progress` | `surveyData` (JSONB) |

| **해결 방법** | `onboarding_progress`로 통합 |
| **예상 작업량** | 2-3시간 |

---

### H-04: 타임존 하드코딩

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Backend |
| **파일** | `elysia-server/src/services/onboarding-worker.service.ts` |
| **코드** | `const KST_OFFSET_MS = 9 * 60 * 60 * 1000` |
| **해결 방법** | date-fns-tz 또는 moment-timezone 사용 |
| **예상 작업량** | 1-2시간 |

---

### H-05: Email Account 생성 Race Condition

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Backend |
| **파일** | `elysia-server/src/routes/nylas.routes.ts` |
| **설명** | TRIAL_PREVIEW 계정이 Nylas callback에 의해 삭제되는 race condition |
| **현재 workaround** | 존재 체크 + 없으면 생성 |
| **해결 방법** | DB 제약조건 또는 retry with exponential backoff |
| **예상 작업량** | 2-3시간 |

---

### H-06: Audit Trail 부재

| 항목 | 내용 |
|------|------|
| **상태** | 🟡 Open |
| **영역** | Database |
| **설명** | 온보딩 상태 변경 이력 테이블 없음. 디버깅 및 고객 지원 어려움. |

**해결 방법:**
```typescript
export const onboardingProgressHistory = pgTable("onboarding_progress_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  onboardingProgressId: uuid("onboarding_progress_id").notNull(),
  previousStatus: onboardingStatusEnum("previous_status"),
  newStatus: onboardingStatusEnum("new_status"),
  previousStep: integer("previous_step"),
  newStep: integer("new_step"),
  changedBy: uuid("changed_by"),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

| **예상 작업량** | 3-4시간 |

---

## 🟢 Medium Priority Issues

### M-01: Auto-save 경쟁 조건

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | `admin/src/pages/app/CompanyInformation.tsx` |
| **설명** | useEffect 의존성 배열이 복잡하여 다중 API 호출 가능 |
| **예상 작업량** | 1-2시간 |

---

### M-02: Discovery Job 실패 시 진행 허용

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | `admin/src/pages/app/components/StepCompanyInfo.tsx:311-314` |
| **설명** | Job 실패해도 다음 단계로 진행 허용 (리드 없이) |
| **예상 작업량** | 30분 |

---

### M-03: Error Boundary 부재

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | 온보딩 Step 컴포넌트 |
| **설명** | SSE 치명적 실패 시 fallback UI 없음 |
| **예상 작업량** | 1-2시간 |

---

### M-04: Rate Limiting 미적용

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Backend |
| **파일** | `elysia-server/src/routes/onboarding.routes.ts` |
| **설명** | 온보딩 API에 rate limiting 없음 |
| **예상 작업량** | 1-2시간 |

---

### M-05: Magic Numbers

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Backend |
| **파일** | `elysia-server/src/services/onboarding-worker.service.ts` |
| **설명** | `TARGET_LEADS = 20`, `MAX_SEARCH_ITERATIONS = 2` 등 하드코딩 |
| **예상 작업량** | 30분 |

---

### M-06: 인덱스 누락

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Database |
| **설명** | 분석 쿼리에 필요한 인덱스 부재 |

**추가 필요 인덱스:**
```sql
CREATE INDEX idx_onboarding_completed_at ON onboarding_progress(completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX idx_users_onboarding_completed ON users(onboarding_completed_at DESC)
  WHERE onboarding_completed_at IS NOT NULL;
CREATE INDEX idx_subscriptions_primary ON subscriptions(workspace_id)
  WHERE is_primary = true;
```

| **예상 작업량** | 30분 |

---

### M-07: Checkpoint 데이터 DB 미저장

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Backend |
| **파일** | BullMQ Worker |
| **설명** | Checkpoint가 Redis job.data에만 저장 (재시작 시 손실 가능) |
| **예상 작업량** | 2-3시간 |

---

### M-08: 불완전한 폼 검증 피드백

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | `admin/src/pages/app/components/StepCompanyInfo.tsx:407-412` |
| **설명** | companyName/Description만 하이라이트, select 필드는 미표시 |
| **예상 작업량** | 1시간 |

---

### M-09: Privacy Policy URL 하드코딩

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | `admin/src/pages/TrialResultPage.tsx:268` |
| **설명** | `https://rinda.ai/privacy-policy` 하드코딩 |
| **예상 작업량** | 10분 |

---

### M-10: 네트워크 연결 체크 없음

| 항목 | 내용 |
|------|------|
| **상태** | 🟢 Open |
| **영역** | Frontend |
| **파일** | `admin/src/pages/app/components/StepLeadGeneration/index.tsx:157` |
| **설명** | SSE 시작 전 네트워크 연결 확인 없음 |
| **예상 작업량** | 30분 |

---

## 작업 우선순위 로드맵

### Phase 1: 즉시 (1-2일)

- [ ] C-01: JWT 서명 적용
- [ ] C-02: FK 제약조건 추가
- [ ] C-03: Trial 데이터 단일화 설계
- [ ] C-04: 트랜잭션 래핑

### Phase 2: 1주 내

- [ ] H-01: CHECK 제약조건 추가
- [ ] H-02: SSE 재연결 로직
- [ ] H-06: Audit History 테이블

### Phase 3: 2주 내

- [ ] H-03: 설문 데이터 통합
- [ ] H-04: 타임존 라이브러리
- [ ] H-05: Race condition 해결
- [ ] M-03: Error Boundary
- [ ] M-04: Rate Limiting

### Phase 4: 백로그

- [ ] M-01 ~ M-10: 나머지 Medium 이슈

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-22 | 초기 이슈 목록 작성 (20개 이슈 식별) |
