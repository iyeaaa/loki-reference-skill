# 메뉴별 파일 구조

## 프론트엔드 (admin/src)

### 인증 (Authentication)
- pages/LoginPage.tsx
- components/ProtectedRoute.tsx

### 대시보드 (Dashboard)
- pages/UnifiedDashboardPage.tsx
- pages/dashboard/

### 리드 관리 (Leads)
- pages/leads/LeadsPage.tsx
- pages/leads/LeadsTableWithPagination.tsx
- pages/leads/LeadForm.tsx
- pages/leads/SequenceLaunchModal.tsx
- pages/leads/CreateGroupModal.tsx
- pages/leads/BulkActionModal.tsx
- pages/leads/LeadGroupManagementModal.tsx
- pages/leads/filters/

### 리드 발굴 (Lead Discovery)
- pages/lead-discovery/LeadDiscoveryPage.tsx
- pages/lead-discovery/ChatRoom.tsx
- pages/lead-discovery/CustomerTable.tsx
- pages/lead-discovery/store.ts
- pages/lead-discovery/AnalysisPanel.tsx
- pages/lead-discovery/components/
- pages/lead-discovery/constants/
- pages/lead-discovery/types/
- pages/lead-discovery/utils/

### 리드 임포트 (Lead Import)
- pages/lead-import/

### 캠페인/시퀀스 (Sequences)
- pages/sequences/SequencesPage.tsx
- pages/sequences/CreateCampaignPage.tsx
- pages/sequences/CreateCampaignStep1.tsx
- pages/sequences/CreateCampaignStep2.tsx
- pages/sequences/CreateCampaignStep3.tsx
- pages/sequences/SequenceEditPage.tsx
- pages/sequences/SequenceForm.tsx
- pages/sequences/SequenceStepForm.tsx
- pages/sequences/SequenceStepList.tsx
- pages/sequences/SequenceEnrollmentsTable.tsx
- pages/sequences/CampaignCardView.tsx
- pages/sequences/CampaignOverview.tsx
- pages/sequences/designer/

### 이메일 회신 (Email Replies)
- pages/email-replies/EmailRepliesPage.tsx
- pages/email-replies/RepliesTableWithPagination.tsx
- pages/email-replies/RepliedEmailsTableWithPagination.tsx
- pages/email-replies/RepliedEmailsList.tsx
- pages/email-replies/ThreadDetailPanel.tsx
- pages/email-replies/MessageDetailView.tsx
- pages/email-replies/EmailBody.tsx
- pages/email-replies/EmailRepliesBulkActionModal.tsx
- pages/email-replies/EmailReplyDetailsDialog.tsx
- pages/email-replies/InlineComposeBox.tsx
- pages/email-replies/EmailReplyFilters.tsx
- pages/email-replies/CategoryFilter.tsx
- pages/email-replies/IntentBadge.tsx
- pages/email-replies/IntentSelector.tsx

### 이메일 템플릿 (Email Templates)
- pages/email-templates/EmailTemplatesPage.tsx
- pages/email-templates/EmailTemplatesTableWithPagination.tsx
- pages/email-templates/EmailTemplateForm.tsx
- pages/email-templates/BulkActionModal.tsx

### 이메일 계정 (Email Accounts)
- pages/email-accounts/

### 온보딩 (Onboarding)
- pages/onboarding/index.tsx
- pages/onboarding/types.ts
- pages/onboarding/components/

### IAM (권한 관리)
- pages/iam/RolesPage.tsx
- pages/iam/PoliciesPage.tsx
- pages/iam/AuditLogsPage.tsx
- pages/iam/TierBoundariesPage.tsx
- pages/iam/PolicyForm.tsx
- pages/iam/RoleForm.tsx

### 설정 (Settings)
- pages/settings/settings.tsx
- pages/settings/WorkspaceSettings.tsx
- pages/settings/EmailSignatureManagement.tsx
- pages/settings/OpenAIApiKeyManagement.tsx
- pages/settings/UnipileEmailTest.tsx
- pages/settings/NylasEmailTest.tsx
- pages/settings/WebDataExtraction.tsx

### 활동 로그 (Activity Logs)
- pages/activity-logs/

### 결제 (Billing)
- pages/billing/

### 사용자 관리 (Users)
- pages/users/

### 워크스페이스 (Workspaces)
- pages/workspaces/

### 고객 그룹 (Customer Groups)
- pages/customer-groups/

### 검색 (Search)
- pages/bigquery-search/
- pages/gemini-search/

### CSV 대량 이메일 (Bulk Email CSV)
- pages/bulk-email-csv/

### 웹셋 (Websets)
- pages/websets/

### 챗봇 컴포넌트 (Chatbot Components)
- components/chatbot/ChatInterface.tsx
- components/chatbot/MessageBubble.tsx
- components/chatbot/ChatSidebar.tsx
- components/chatbot/LeadUploadModal.tsx
- components/chatbot/LeadImportProgress.tsx
- components/chatbot/SequenceGeneratorModal.tsx
- components/chatbot/NodeProgressTracker.tsx
- components/chatbot/ThinkingIndicator.tsx
- components/chatbot/StreamingMessageContainer.tsx
- components/chatbot/ActionCards.tsx

### API 서비스 (lib/api/services/)
- activity-logs.ts
- auth.ts
- billing.ts
- chatbot.ts
- leads.ts
- sequences.ts
- emails.ts
- lead-discovery.ts
- onboarding.ts

---

## 백엔드 (elysia-server/src)

### 인증 (Authentication)
- routes/auth.routes.ts
- services/auth.service.ts
- services/oauth.service.ts

### 리드 관리 (Leads)
- routes/leads.routes.ts
- services/lead.service.ts

### 리드 임포트 (Lead Import)
- routes/lead-import.routes.ts
- services/lead-import.service.ts

### 리드 보강 (Lead Enrichment)
- routes/lead-enrichment.routes.ts
- services/lead-enrichment.service.ts

### 리드 발굴 (Lead Discovery)
- routes/lead-discovery.routes.ts

### 캠페인/시퀀스 (Sequences)
- routes/sequences.routes.ts
- services/sequence.service.ts
- services/campaign-generation.service.ts
- services/campaign-generator.service.ts

### 워크플로우 실행 (Workflow Execution)
- routes/workflow-execution.routes.ts
- routes/workflow-emails.routes.ts
- services/workflow-execution.service.ts
- services/workflow-email.service.ts
- services/workflow-validation.service.ts

### 이메일 (Emails)
- routes/emails.routes.ts
- services/email.service.ts

### 이메일 계정 (Email Accounts)
- routes/email-accounts.routes.ts
- services/email-account.service.ts

### 이메일 템플릿 (Email Templates)
- routes/email-templates.routes.ts
- services/email-template.service.ts

### 이메일 서명 (Email Signatures)
- routes/email-signatures.routes.ts

### 이메일 회신 (Email Replies)
- routes/email-replies.routes.ts
- services/email-replies.service.ts

### 웹훅 (Webhooks)
- routes/webhook.routes.ts
- services/webhook.service.ts

### Nylas 통합
- routes/nylas.routes.ts
- services/nylas.service.ts

### Unipile 통합
- routes/unipile.routes.ts
- services/unipile.service.ts

### AI 기능 (AI)
- routes/ai.routes.ts
- services/ai-template-generation.service.ts
- services/ai-classification.service.ts
- services/ai-workflow-email.service.ts

### 챗봇 (Chatbot)
- routes/chatbot.routes.ts

### 웹 데이터 추출 (Web Extraction)
- routes/web-extraction.routes.ts
- services/web-extraction.service.ts

### BigQuery 검색
- routes/bigquery-search.routes.ts
- services/bigquery-search.service.ts

### Gemini 검색
- routes/gemini-file-search.routes.ts
- services/gemini-file-search.service.ts

### 대시보드 (Dashboard)
- routes/dashboard.routes.ts
- services/dashboard.service.ts

### 활동 로그 (Activity Logs)
- routes/activity-logs.routes.ts
- services/activity-log.service.ts

### 작업 로그 (Job Logs)
- routes/job-logs.routes.ts
- services/job-log.service.ts

### 알림 (Notifications)
- routes/notification.routes.ts
- services/notification.service.ts

### 사용자 관리 (Users)
- routes/users.routes.ts
- services/user.service.ts

### 워크스페이스 (Workspaces)
- routes/workspaces.routes.ts
- services/workspace.service.ts

### 고객 그룹 (Customer Groups)
- routes/customer-groups.routes.ts
- services/customer-group.service.ts

### 부서 (Departments)
- routes/departments.routes.ts
- services/department.service.ts

### 세일즈 전략 (Sales Strategies)
- routes/sales-strategies.routes.ts
- services/sales-strategy.service.ts

### IAM (권한 관리)
- routes/iam.routes.ts
- services/iam.service.ts

### OpenAI API 키
- routes/openai-api-keys.routes.ts
- services/openai-api-key.service.ts

### 온보딩 (Onboarding)
- routes/onboarding.routes.ts
- services/onboarding.service.ts
- services/onboarding-worker.service.ts

### 결제 (Billing)
- routes/billing.routes.ts
- services/billing.service.ts

### 헬스체크 (Health)
- routes/health.routes.ts

### 외부 서비스 통합
- services/hunterio-lead-search.service.ts
- services/hunterio-domain-search.service.ts
- services/hunterio-query-generator.service.ts
- services/perplexity-search.service.ts
- services/google-drive.service.ts
- services/redis-cache.service.ts

---

## AI 워크플로우 (shared/mastra/)

### 워크플로우 (workflows/)
- email-generation/
- email-reply-generation/
- sequence-email-generation/
- steps-generation/
- web-company-enrichment-single.workflow.ts
- web-company-search-single.workflow.ts
- run-webset.workflow.ts
- web-search/
- enrich-data.workflow.ts
- validate-criteria.workflow.ts
- search-company.workflow.ts

### 에이전트 (agents/)
- steps-agent/
- sequence-email-agent/
- structured-extraction-agent.ts

### 도구 (tools/)
- jina-reader/
- jina-search/
- web-reader-agent/
- google-search/
- google-map/
- email-judge/
- steps-judge/
- reasoning/
- db-search-company.ts
- db-enrich-company.ts
- postgres-query.ts

---

## 데이터베이스 스키마 (db/schema/)

- activity-logs.ts
- billing.ts
- chat-conversations.ts
- customer-groups.ts
- email-accounts.ts
- email-signatures.ts
- email-templates.ts
- emails.ts
- enums.ts
- iam.ts
- job-logs.ts
- lead-details.ts
- leads.ts
- notifications.ts
- onboarding.ts
- openai-api-keys.ts
- sales-strategies.ts
- sequences.ts
- user-signature-preferences.ts
- users.ts
- websets.ts
- workflow-emails.ts
- workflow-executions.ts
- workspace-products.ts
- workspaces.ts

---

## 플러그인 (plugins/)

- error-handler.plugin.ts
- activity-logger.plugin.ts
- iam-auth.plugin.ts
- response-transformer.plugin.ts
- permission-guard.plugin.ts
- http-logger.plugin.ts
- rate-limit.plugin.ts
- request-id.plugin.ts
