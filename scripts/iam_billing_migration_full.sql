--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2 (Debian 17.2-1.pgdg120+1)
-- Dumped by pg_dump version 17.2 (Debian 17.2-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('a086fb38-ddf1-49e4-b3ff-79cc474669a3', '이철희', 'cjfgml3@gmail.com', '$2b$10$jrnkA7blrSUTyqQhgZ3gP.rzyVsefUqvCa0MhC8CLH8YIJfjJVqqq', 'admin', true, NULL, NULL, '2025-12-12 07:40:08.410357+00', '2025-12-12 07:40:09.79+00', '2025-12-12 07:40:09.79+00', 'local', NULL, NULL, '2025-12-12 07:40:08.409+00', '2025-12-19 07:40:08.409+00', true, false, NULL, 0, NULL);
INSERT INTO public.users VALUES ('b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', '이철희', 'wks0968@gmail.com', NULL, 'admin', true, NULL, NULL, '2025-12-12 09:45:05.469075+00', '2025-12-12 09:45:05.469075+00', '2025-12-12 09:45:05.465+00', 'google', '107154993693766735325', 'https://lh3.googleusercontent.com/a/ACg8ocKTROIgGkgUdzo4NqFqhum6cIZDeoLuncHobWAMnZlNCmppxkxr=s96-c', '2025-12-12 09:45:05.465+00', '2025-12-19 09:45:05.465+00', true, false, '{"lang": "ko", "target": "b2b", "country": "jp", "industry": "manufacturing", "experience": "none", "completedAt": "2025-12-12T09:45:05.465Z"}', 1, NULL);


--
-- Data for Name: billing_customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.billing_customers VALUES ('d650ff6d-fae4-4924-8087-7e7234f666f5', 'b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', 'internal_b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', 'wks0968@gmail.com', '이철희', '{}', '2025-12-12 09:45:05.519971+00', '2025-12-12 09:45:05.519971+00');


--
-- Data for Name: billing_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.billing_products VALUES ('00000000-0000-0000-0001-000000000001', NULL, '체험판', '7일 무료 체험. 기본 기능 제한적 이용 가능.', 'trial', '["대시보드 (제한적)", "인박스 (5회 열람)", "설정 (개인정보만)"]', true, 1, '{"level": 1, "paywall": true, "viewLimit": 5}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_products VALUES ('00000000-0000-0000-0001-000000000002', NULL, 'Basic', '소규모 비즈니스를 위한 기본 플랜. 관리자 대행 서비스 포함.', 'basic', '["대시보드", "인박스 (무제한)", "설정", "관리자 대행 서비스"]', true, 2, '{"level": 2, "managedService": true}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_products VALUES ('00000000-0000-0000-0001-000000000003', NULL, 'Pro', '직접 캠페인을 운영하는 고객을 위한 프로 플랜.', 'pro', '["대시보드", "고객 탐색", "고객 관리", "캠페인", "인박스", "설정"]', true, 3, '{"level": 3, "selfServing": true}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_products VALUES ('00000000-0000-0000-0001-000000000004', NULL, 'Enterprise', '대규모 조직을 위한 엔터프라이즈 플랜. AI 기능 포함.', 'enterprise', '["대시보드", "고객 탐색", "고객 관리", "캠페인", "인박스", "Rinda GPT", "설정"]', true, 4, '{"level": 4, "aiFeatures": true, "customSupport": true}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');


--
-- Data for Name: billing_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', NULL, '7일 무료 체험', '신규 가입 시 제공되는 7일 무료 체험', true, true, 'KRW', 0, 'one_time', NULL, NULL, 7, NULL, '{}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', NULL, 'Basic 월간', '월 30만원 정기 결제', true, true, 'KRW', 300000, 'recurring', 'month', 1, 0, NULL, '{}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000002', NULL, 'Basic 연간', '연 300만원 (월 25만원, 17% 할인)', true, false, 'KRW', 3000000, 'recurring', 'year', 1, 0, NULL, '{"discount": 17, "monthlyEquivalent": 250000}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000003', NULL, 'Pro 월간', '월 200만원 정기 결제', true, true, 'KRW', 2000000, 'recurring', 'month', 1, 0, NULL, '{}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000003', NULL, 'Pro 연간', '연 2000만원 (월 약 166만원, 17% 할인)', true, false, 'KRW', 20000000, 'recurring', 'year', 1, 0, NULL, '{"discount": 17, "monthlyEquivalent": 1666667}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.billing_plans VALUES ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000004', NULL, 'Enterprise', '맞춤형 가격 (영업팀 문의)', true, true, 'KRW', 0, 'recurring', 'month', 1, 0, NULL, '{"contactSales": true, "customPricing": true}', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');


--
-- Data for Name: workspaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.workspaces VALUES ('427cb6a4-8a1b-42ed-8292-6200e24934e1', '이철희의 워크스페이스', '기본 워크스페이스', 'b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', '2025-12-12 09:45:05.473465+00', '2025-12-12 09:45:05.473465+00', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'trial', 'trialing', NULL, NULL);


--
-- Data for Name: iam_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: iam_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000001', NULL, 'TierBoundary:Trial', '체험판(Level 1) 등급의 최대 허용 권한. 대시보드 제한적, 인박스 5회 열람.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000002', NULL, 'TierBoundary:Basic', 'Basic(Level 2) 등급의 최대 허용 권한. 대시보드, 인박스 무제한.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000003', NULL, 'TierBoundary:Pro', 'Pro(Level 3) 등급의 최대 허용 권한. 고객 탐색, 고객 관리, 캠페인 포함.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000004', NULL, 'TierBoundary:Enterprise', 'Enterprise(Level 4) 등급의 최대 허용 권한. Rinda GPT 포함 전체 기능.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000010', NULL, 'WorkspaceOwner', '워크스페이스 소유자 권한. 모든 리소스에 대한 전체 권한.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000011', NULL, 'WorkspaceAdmin', '워크스페이스 관리자 권한. 멤버 관리 및 설정 변경 가능.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000012', NULL, 'WorkspaceMember', '워크스페이스 멤버 권한. 기본 업무 수행 가능.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000013', NULL, 'WorkspaceViewer', '워크스페이스 뷰어 권한. 읽기 전용.', 1, true, true, NULL, '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_policies VALUES ('00000000-0000-0000-0003-000000000020', NULL, 'SystemAdmin', '시스템 관리자(Level 5) 권한. 모든 워크스페이스와 사용자 관리 가능.', 1, true, true, NULL, '2025-12-12 03:08:40.30972+00', '2025-12-12 03:08:40.30972+00');


--
-- Data for Name: workspace_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.workspace_members VALUES ('d9247bae-dd0c-4289-9459-3c3e584ad0f1', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', 'owner', NULL, '2025-12-12 09:45:05.505921+00', NULL, 'active');


--
-- Data for Name: iam_member_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: iam_workspace_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_workspace_roles VALUES ('423b01e1-def2-4ce9-b72b-fcad7d098a5e', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'Owner', '워크스페이스 소유자. 모든 리소스에 대한 전체 권한을 가집니다.', false, true, 100, NULL, '2025-12-12 09:45:05.478278+00', '2025-12-12 09:45:05.478278+00');
INSERT INTO public.iam_workspace_roles VALUES ('2efedc2e-3143-4c4d-98b5-6451fed76b2b', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'Admin', '워크스페이스 관리자. 멤버 관리 및 대부분의 설정 변경이 가능합니다.', false, true, 80, NULL, '2025-12-12 09:45:05.490198+00', '2025-12-12 09:45:05.490198+00');
INSERT INTO public.iam_workspace_roles VALUES ('cedbcff3-d508-4074-96af-e850dc2d0598', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'Member', '일반 멤버. 기본적인 업무 수행이 가능하며, 자신의 리소스를 관리할 수 있습니다.', true, true, 50, NULL, '2025-12-12 09:45:05.494486+00', '2025-12-12 09:45:05.494486+00');
INSERT INTO public.iam_workspace_roles VALUES ('5dab9261-57c3-45b5-bd4c-17ec70dd3b39', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'Viewer', '읽기 전용 멤버. 모든 리소스를 조회할 수 있지만 수정은 불가합니다.', false, true, 10, NULL, '2025-12-12 09:45:05.50276+00', '2025-12-12 09:45:05.50276+00');


--
-- Data for Name: iam_member_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_member_roles VALUES ('0dbad949-8992-47ea-8fe8-e74f3deaa034', 'd9247bae-dd0c-4289-9459-3c3e584ad0f1', '423b01e1-def2-4ce9-b72b-fcad7d098a5e', NULL, '2025-12-12 09:45:05.511205+00');


--
-- Data for Name: iam_policy_statements; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_policy_statements VALUES ('6acb2398-4017-4183-9d89-0da4b31490e3', '00000000-0000-0000-0003-000000000001', 'TrialDashboard', 'allow', '{dashboard}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('e5f28cf2-eada-484d-94f1-c3a91468766b', '00000000-0000-0000-0003-000000000001', 'TrialInbox', 'allow', '{emails}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('1f7efd46-e00a-470d-a840-0edc27dc8b61', '00000000-0000-0000-0003-000000000001', 'TrialSettings', 'allow', '{settings,settings:profile,settings:workspace,email-templates}', '{read,update}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('f5787df0-5788-40ac-8be2-8f7286e72b79', '00000000-0000-0000-0003-000000000001', 'TrialDenyAnalytics', 'deny', '{analytics}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('a29f48d5-4e13-452c-850d-c0c2b83ac81b', '00000000-0000-0000-0003-000000000001', 'TrialDenyProFeatures', 'deny', '{leads:discovery,leads,leads:*,customer-groups,sequences,sequences:*}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('951856fb-9371-4c14-8236-950045afeafd', '00000000-0000-0000-0003-000000000001', 'TrialDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('5bd7564b-9c2e-4408-ab4c-5f25717a4e0d', '00000000-0000-0000-0003-000000000002', 'BasicDashboard', 'allow', '{dashboard,analytics}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('6cf074be-9028-4bd4-844a-8a8cb42956ff', '00000000-0000-0000-0003-000000000002', 'BasicInbox', 'allow', '{emails,emails:*}', '{read,list,update}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('00db0648-cfe1-4dc7-9078-20588f2cdb8f', '00000000-0000-0000-0003-000000000002', 'BasicSettings', 'allow', '{settings,settings:*}', '{read,update}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('7b1061b3-9fdc-42c6-9b09-92a3aa5a5f5f', '00000000-0000-0000-0003-000000000002', 'BasicDenyProFeatures', 'deny', '{leads:discovery,leads,leads:*,customer-groups,sequences,sequences:*}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('0f37798a-5675-417d-b342-92a55eb2d791', '00000000-0000-0000-0003-000000000002', 'BasicDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('acf3b2c4-0ec9-4c7b-8114-2c4a9bdc0c09', '00000000-0000-0000-0003-000000000003', 'ProDashboard', 'allow', '{dashboard,analytics}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('5a65cdc5-558b-4f4a-8ea0-b17e587d4baf', '00000000-0000-0000-0003-000000000003', 'ProLeadDiscovery', 'allow', '{leads:discovery}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('3438d2c6-f1d1-40d1-800c-ba7e112f65f7', '00000000-0000-0000-0003-000000000003', 'ProLeads', 'allow', '{leads,leads:*,customer-groups,customer-groups:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('ebde4f66-5b1c-4693-8569-1f98ecabca17', '00000000-0000-0000-0003-000000000003', 'ProSequences', 'allow', '{sequences,sequences:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('cb377d9f-1a5c-4a84-9ce0-8f63a01f1ec4', '00000000-0000-0000-0003-000000000003', 'ProEmails', 'allow', '{emails,emails:*,email-templates,email-accounts,bulk-email}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('107b2d01-db58-4076-b65f-0b13f9105504', '00000000-0000-0000-0003-000000000003', 'ProSettings', 'allow', '{settings,settings:*,workspaces:members}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('3efddaac-1d35-488c-8190-9f085231307c', '00000000-0000-0000-0003-000000000003', 'ProDenyChatbot', 'deny', '{ai:chatbot,ai:search}', '{*}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('6852331c-3164-4068-838a-fe9227d48be8', '00000000-0000-0000-0003-000000000004', 'EnterpriseDashboard', 'allow', '{dashboard,analytics}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('8bf57efb-bb9c-4e50-a544-11b450bf6665', '00000000-0000-0000-0003-000000000004', 'EnterpriseLeadDiscovery', 'allow', '{leads:discovery}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('2b1e991b-220b-4cf4-95e4-0e152793116f', '00000000-0000-0000-0003-000000000004', 'EnterpriseLeads', 'allow', '{leads,leads:*,customer-groups,customer-groups:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('a38104b5-2e7c-4ab1-8d3b-3c8c42b8d578', '00000000-0000-0000-0003-000000000004', 'EnterpriseSequences', 'allow', '{sequences,sequences:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('80ae0a14-6111-4b8c-8407-45ff999579ac', '00000000-0000-0000-0003-000000000004', 'EnterpriseEmails', 'allow', '{emails,emails:*,email-templates,email-accounts,bulk-email}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('ebd21235-5119-48e4-a586-5982d4f1f789', '00000000-0000-0000-0003-000000000004', 'EnterpriseChatbot', 'allow', '{ai:chatbot,ai:search}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('eb9cfbfa-5252-40d3-98e6-b21b7128d3cc', '00000000-0000-0000-0003-000000000004', 'EnterpriseSettings', 'allow', '{settings,settings:*,workspaces:members}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('65a146da-539f-4b6d-a02f-e51ef40bf649', '00000000-0000-0000-0003-000000000010', 'OwnerFullAccess', 'allow', '{*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('25de5831-49b0-47bc-93cb-0d970407c838', '00000000-0000-0000-0003-000000000011', 'AdminManageResources', 'allow', '{dashboard,analytics,leads:discovery,leads,leads:*,customer-groups,customer-groups:*,sequences,sequences:*,emails,emails:*,email-templates,email-accounts,bulk-email,ai:chatbot,ai:search,settings,settings:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('2e44aa45-f02f-45b1-a080-9cf9a1544624', '00000000-0000-0000-0003-000000000011', 'AdminManageMembers', 'allow', '{workspaces:members}', '{list,read,create,update,invite}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('6eb7250f-fa31-4497-8131-9f2646521324', '00000000-0000-0000-0003-000000000011', 'AdminDenyDeleteWorkspace', 'deny', '{workspaces}', '{delete}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('8068f63c-5cfc-41d5-ba9e-ac6f14b4e9a3', '00000000-0000-0000-0003-000000000012', 'MemberReadDashboard', 'allow', '{dashboard,analytics}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('2b7c7bdc-4781-4cb1-8fb7-b5cc3d35270c', '00000000-0000-0000-0003-000000000012', 'MemberReadLeadDiscovery', 'allow', '{leads:discovery}', '{read,list,execute}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('b50a5b5d-059d-4c25-b7a6-44701b08d246', '00000000-0000-0000-0003-000000000012', 'MemberReadLeads', 'allow', '{leads,customer-groups}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('3c8028d3-048b-435f-831d-85789a2f79d6', '00000000-0000-0000-0003-000000000012', 'MemberManageOwnLeads', 'allow', '{leads:own}', '{create,update,delete}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('319f86e9-bcc6-4190-aa84-70d26526e5ba', '00000000-0000-0000-0003-000000000012', 'MemberReadSequences', 'allow', '{sequences}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('bb25a2a0-79dd-4e62-a8c4-6e614a4126ea', '00000000-0000-0000-0003-000000000012', 'MemberManageOwnSequences', 'allow', '{sequences:own}', '{create,update,delete,execute}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('fde4ec82-8f2d-414c-b51d-2e90ba6af774', '00000000-0000-0000-0003-000000000012', 'MemberReadEmails', 'allow', '{emails}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('e8006717-5568-4996-8119-18cb0769d708', '00000000-0000-0000-0003-000000000012', 'MemberManageOwnEmails', 'allow', '{emails:own}', '{create,update,delete,send}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('6f5a225b-1b1f-435b-9ef7-0ca9f8992a89', '00000000-0000-0000-0003-000000000012', 'MemberUseChatbot', 'allow', '{ai:chatbot}', '{read,execute}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('e52686cb-da01-4aae-940a-83d7665580a9', '00000000-0000-0000-0003-000000000012', 'MemberSettings', 'allow', '{settings,settings:profile,settings:workspace,email-templates}', '{read,update}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('263dfe04-59ca-4971-85c0-c67de91fc504', '00000000-0000-0000-0003-000000000012', 'MemberDenyAdmin', 'deny', '{workspaces:members,settings:workspace}', '{create,update,delete,invite}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('9f93958d-b1a3-42e5-9273-67bb33b2560c', '00000000-0000-0000-0003-000000000013', 'ViewerReadAll', 'allow', '{dashboard,analytics,leads:discovery,leads,customer-groups,sequences,emails,settings}', '{read,list}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('3f86115e-93a3-44a3-bed4-6d970adb10a2', '00000000-0000-0000-0003-000000000013', 'ViewerDenyWrite', 'deny', '{*}', '{create,update,delete,execute,send,import,export,invite}', '{}', 200, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('074c5ff6-a79e-4052-8f31-a7d6723f83e2', '00000000-0000-0000-0003-000000000020', 'SystemAdminFullAccess', 'allow', '{*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('1418ec55-3b2a-41e9-a87f-bf096683e913', '00000000-0000-0000-0003-000000000020', 'SystemAdminIAM', 'allow', '{iam:policies,iam:roles,iam:members,iam:audit}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');
INSERT INTO public.iam_policy_statements VALUES ('9b8d0559-50fb-4bbe-a41f-b5229aa47736', '00000000-0000-0000-0003-000000000020', 'SystemAdminBilling', 'allow', '{billing,billing:*}', '{*}', '{}', 100, '2025-12-12 09:39:19.219804+00');


--
-- Data for Name: iam_role_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_role_policies VALUES ('fb340a0f-4ac5-4d76-b2e1-a070b7b7fa53', '423b01e1-def2-4ce9-b72b-fcad7d098a5e', '00000000-0000-0000-0003-000000000010', NULL, '2025-12-12 09:45:05.48509+00');
INSERT INTO public.iam_role_policies VALUES ('0a6a6682-08ec-4398-926c-218db8296be8', '2efedc2e-3143-4c4d-98b5-6451fed76b2b', '00000000-0000-0000-0003-000000000011', NULL, '2025-12-12 09:45:05.491793+00');
INSERT INTO public.iam_role_policies VALUES ('ebe533bd-e13a-49c9-8607-678c9b09e158', 'cedbcff3-d508-4074-96af-e850dc2d0598', '00000000-0000-0000-0003-000000000012', NULL, '2025-12-12 09:45:05.495664+00');
INSERT INTO public.iam_role_policies VALUES ('55cc5ba6-72ba-44e8-a8ef-40b485ff2510', '5dab9261-57c3-45b5-bd4c-17ec70dd3b39', '00000000-0000-0000-0003-000000000013', NULL, '2025-12-12 09:45:05.504154+00');


--
-- Data for Name: iam_tier_boundaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_tier_boundaries VALUES ('00000000-0000-0000-0005-000000000001', 'trial', '00000000-0000-0000-0003-000000000001', '체험판(Level 1): 대시보드 제한, 인박스 5회 열람, Paywall 적용', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_tier_boundaries VALUES ('00000000-0000-0000-0005-000000000002', 'basic', '00000000-0000-0000-0003-000000000002', 'Basic(Level 2): 대시보드, 인박스 무제한, 관리자 대행 서비스', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_tier_boundaries VALUES ('00000000-0000-0000-0005-000000000003', 'pro', '00000000-0000-0000-0003-000000000003', 'Pro(Level 3): 고객 탐색, 고객 관리, 캠페인 - 셀프 서빙', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');
INSERT INTO public.iam_tier_boundaries VALUES ('00000000-0000-0000-0005-000000000004', 'enterprise', '00000000-0000-0000-0003-000000000004', 'Enterprise(Level 4): Rinda GPT 포함 전체 기능', '2025-12-12 02:55:28.508949+00', '2025-12-12 02:55:28.508949+00');


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscriptions VALUES ('3a11190b-2286-4b61-b495-1d28bc48053e', '427cb6a4-8a1b-42ed-8292-6200e24934e1', 'd650ff6d-fae4-4924-8087-7e7234f666f5', '00000000-0000-0000-0002-000000000004', NULL, 'active', true, 1, false, '2025-12-12 09:45:05.524+00', '2025-12-19 09:45:05.524+00', '2025-12-12 09:45:05.524+00', '2025-12-19 09:45:05.524+00', NULL, NULL, NULL, '{}', '2025-12-12 09:45:05.525496+00', '2025-12-12 10:09:48.244+00');


--
-- Data for Name: subscription_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_history VALUES ('6fce28b5-fde5-4598-9502-c60266a3bbe7', '3a11190b-2286-4b61-b495-1d28bc48053e', NULL, '00000000-0000-0000-0002-000000000001', NULL, 'trialing', 'created', '워크스페이스 생성 시 자동 Trial 구독', NULL, '2025-12-12 09:45:05.527714+00');
INSERT INTO public.subscription_history VALUES ('286a5257-056c-4153-abaa-b05beb5aab8b', '3a11190b-2286-4b61-b495-1d28bc48053e', '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0002-000000000002', 'trialing', 'active', 'plan_changed', NULL, NULL, '2025-12-12 09:50:54.447359+00');
INSERT INTO public.subscription_history VALUES ('844b239f-aec2-4e39-8e0f-606278d1930e', '3a11190b-2286-4b61-b495-1d28bc48053e', '00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0002-000000000004', 'active', 'active', 'plan_changed', NULL, NULL, '2025-12-12 09:51:45.288273+00');
INSERT INTO public.subscription_history VALUES ('203c20e5-258a-40b5-b092-2edbc1dd560f', '3a11190b-2286-4b61-b495-1d28bc48053e', '00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0002-000000000006', 'active', 'active', 'plan_changed', NULL, NULL, '2025-12-12 09:53:07.623641+00');
INSERT INTO public.subscription_history VALUES ('f25a7feb-635c-43c8-8975-b3cb0fe50bf1', '3a11190b-2286-4b61-b495-1d28bc48053e', '00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0002-000000000004', 'active', 'active', 'plan_changed', NULL, NULL, '2025-12-12 10:09:48.252439+00');


--
-- PostgreSQL database dump complete
--

