# 삭제된 유저 데이터 정리 계획

> 작성일: 2025-12-22
> 대상: is_active = false 인 유저 14명 및 관련 데이터

## 1. 삭제 대상 유저 목록 (14명)

| # | User ID | Email (익명화) | Username | 생성일 | Workspace ID | Workspace Name |
|---|---------|---------------|----------|--------|--------------|----------------|
| 1 | `bc62f354-c0be-420e-9e9e-ae4c707b6be2` | deleted_1765984497024_bc62f354@deleted.local | deleted_user_1765984497024 | 2025-12-17 15:11 | `bc4649bd-d9eb-41a7-bc5b-98736ca420f6` | vikyw의 워크스페이스 |
| 2 | `700ba72e-da64-4351-beb4-cbf7ce0c98a9` | deleted_1765984265856_700ba72e@deleted.local | deleted_user_1765984265856 | 2025-12-17 09:01 | - | - |
| 3 | `ce73ac59-51c6-43e5-9858-d4b14ec1b473` | deleted_1765941811915_ce73ac59@deleted.local | deleted_user_1765941811915 | 2025-12-17 03:20 | `dad4475d-a835-4949-9aa5-5adc3064ca16` | yamiseohyeon의 워크스페이스 |
| 4 | `5e4853a3-a9a0-4bc1-8d8d-dba374b5649d` | deleted_1765941629913_5e4853a3@deleted.local | deleted_user_1765941629913 | 2025-12-17 03:12 | `54de4ccd-4bdf-49cd-90b3-03405fb5d497` | yamiseohyeon의 워크스페이스 |
| 5 | `1138a37a-70e9-4c67-a3e1-4a800ad3fd5f` | deleted_1765941076966_1138a37a@deleted.local | deleted_user_1765941076966 | 2025-12-17 03:10 | - | - |
| 6 | `74ce239f-8cb7-415a-a51b-65a2f9962f47` | deleted_1765940302328_74ce239f@deleted.local | deleted_user_1765940302328 | 2025-12-17 02:49 | - | - |
| 7 | `97661de7-d394-4878-ac34-624ea38bc2a7` | deleted_1765939386992_97661de7@deleted.local | deleted_user_1765939386992 | 2025-12-17 02:39 | `5cd20c4f-2ad3-4916-9262-fbb708ec49b3` | SeoHyeon Cho의 워크스페이스 |
| 8 | `3943dc3f-026d-4a84-8217-f91ddd38e629` | deleted_1765937728331_3943dc3f@deleted.local | deleted_user_1765937728331 | 2025-12-17 02:10 | `465c41da-4da0-44c1-8849-85af7a4d7f2a` | SeoHyeon Cho의 워크스페이스 |
| 9 | `005d5622-d792-4b18-95d1-defe0380cb89` | deleted_1765937184287_005d5622@deleted.local | deleted_user_1765937184287 | 2025-12-17 01:38 | `8d294354-118f-464a-9f9e-d4aeb3737ff4` | SeoHyeon Cho의 워크스페이스 |
| 10 | `904146c0-5fbf-467f-9d6b-7f31e49c091a` | deleted_1765962032341_904146c0@deleted.local | deleted_user_1765962032341 | 2025-12-16 08:14 | - | - |
| 11 | `407d8d35-e4f0-4224-b76b-01edd44373df` | deleted_1765955145066_407d8d35@deleted.local | deleted_user_1765955145066 | 2025-12-16 05:27 | `a7eaf609-24ab-4b74-ab24-5867ee58cbe1` | 이철희의 워크스페이스 |
| 12 | `7363a691-969c-4b64-ac74-a3a126f16a49` | deleted_1765877331062_7363a691@deleted.local | deleted_user_1765877331062 | 2025-12-12 10:20 | - | - |
| 13 | `a086fb38-ddf1-49e4-b3ff-79cc474669a3` | deleted_1765874677230_a086fb38@deleted.local | deleted_user_1765874677230 | 2025-12-12 07:40 | - | - |
| 14 | `8853895c-dfae-4f0d-b9f7-145da91231ec` | deleted_1765936070625_8853895c@deleted.local | deleted_user_1765936070625 | 2025-10-15 00:22 | - | - |

### 요약
- **전체 삭제 대상 유저**: 14명
- **워크스페이스 보유 유저**: 7명
- **워크스페이스 없는 유저**: 7명 (이미 워크스페이스 삭제됨 또는 생성 전 삭제)

---

## 2. 삭제 대상 데이터 요약

### 2.1 워크스페이스 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| workspaces | 7 | 삭제된 유저가 소유한 워크스페이스 |
| workspace_members | 0 | 워크스페이스 멤버 (이미 삭제됨) |
| workspace_products | 0 | |
| workspace_sales_strategies | 14 | |

### 2.2 리드 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| leads | 127 | 리드 메인 데이터 |
| lead_contacts | 28 | 리드 연락처 |
| lead_products | 0 | |
| lead_social_media | 0 | |
| lead_business_sectors | 0 | |
| lead_industry_types | 0 | |
| lead_product_categories | 0 | |

### 2.3 이메일 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| emails | 114 | 발송된 이메일 |
| email_events | 0 | 이메일 이벤트 |
| email_replies | 0 | 회신 이메일 |
| email_templates | 0 | |
| email_signatures | 0 | |

### 2.4 시퀀스 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| sequences | 7 | 이메일 시퀀스 |
| sequence_steps | 14 | 시퀀스 스텝 |
| sequence_enrollments | 0 | |
| sequence_step_executions | 0 | |

### 2.5 고객 그룹 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| customer_groups | 7 | 고객 그룹 |
| customer_group_members | 127 | 그룹 멤버십 |

### 2.6 IAM 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| iam_workspace_roles | 28 | 워크스페이스 역할 |
| iam_role_policies | 28 | 역할 정책 |
| iam_policies | 0 | |
| iam_policy_statements | 0 | |
| iam_member_roles | 0 | |
| iam_member_policies | 0 | |
| iam_audit_logs | 0 | |

### 2.7 유저 관련 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| users | 14 | 삭제된 유저 |
| billing_customers | 12 | 빌링 고객 |
| user_signature_preferences | 0 | |
| user_email_accounts | 3 | 이메일 계정 연동 |
| notifications | 0 | |

### 2.8 기타 데이터

| 테이블 | 삭제 대상 레코드 수 | 비고 |
|--------|---------------------|------|
| activity_logs (by user) | 48 | 유저별 활동 로그 |
| activity_logs (by workspace) | 40 | 워크스페이스별 활동 로그 |
| onboarding_progress | 7 | 온보딩 진행 상황 |
| subscriptions | 7 | 구독 정보 |
| chat_conversations | 0 | |
| chat_messages | 0 | |
| websets | 0 | |
| webset_rows | 0 | |
| openai_api_keys | 0 | |

---

## 3. 삭제 순서 (Foreign Key 의존성 고려)

삭제는 Foreign Key 제약조건으로 인해 다음 순서로 진행해야 합니다:

### Phase 1: 리드 하위 테이블
1. lead_contacts
2. lead_products
3. lead_social_media
4. lead_business_sectors
5. lead_industry_types
6. lead_product_categories

### Phase 2: 이메일 하위 테이블
7. email_events
8. email_replies

### Phase 3: 시퀀스 하위 테이블
9. sequence_step_executions
10. sequence_enrollments
11. sequence_steps

### Phase 4: 고객 그룹 하위 테이블
12. customer_group_members

### Phase 5: IAM 하위 테이블
13. iam_member_policies
14. iam_member_roles
15. iam_role_policies
16. iam_policy_statements

### Phase 6: 메인 테이블 (워크스페이스 종속)
17. leads
18. emails
19. sequences
20. customer_groups
21. chat_messages
22. chat_conversations
23. iam_policies
24. iam_workspace_roles
25. email_signatures
26. email_templates
27. user_email_accounts
28. openai_api_keys
29. onboarding_progress
30. activity_logs (by workspace)
31. subscriptions
32. workspace_products
33. workspace_sales_strategies
34. webset_rows
35. websets

### Phase 7: 워크스페이스 멤버 및 워크스페이스
36. workspace_members

### Phase 8: 유저 관련
37. billing_customers
38. user_signature_preferences
39. activity_logs (by user)
40. iam_audit_logs (by user)
41. workspaces
42. users

---

## 4. 총 삭제 레코드 수

| 카테고리 | 레코드 수 |
|---------|----------|
| 유저 | 14 |
| 워크스페이스 | 7 |
| 리드 데이터 | 155 |
| 이메일 데이터 | 114 |
| 시퀀스 데이터 | 21 |
| 고객 그룹 데이터 | 134 |
| IAM 데이터 | 56 |
| 기타 데이터 | 110+ |
| **총계** | **약 611+ 레코드** |

---

## 5. 삭제 실행 방법

```bash
# 스크립트 서버로 복사
scp scripts/delete-inactive-users-data.sql send:/tmp/

# Docker 컨테이너에서 실행
ssh send "docker exec -i send-grid-test-postgres-1 psql -U postgres -d postgres < /tmp/delete-inactive-users-data.sql"
```

## 6. 주의사항

1. **백업 필수**: 삭제 전 데이터베이스 백업을 권장합니다.
2. **트랜잭션 사용**: 모든 삭제는 단일 트랜잭션 내에서 실행됩니다 (ROLLBACK 가능).
3. **CASCADE 의존성**: Foreign Key ON DELETE CASCADE 설정이 있는 테이블은 자동 삭제될 수 있습니다.
4. **익명화 완료**: 삭제된 유저의 이메일/username은 이미 익명화 되어 있습니다.
