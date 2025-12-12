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
-- Data for Name: billing_customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.billing_customers VALUES ('d650ff6d-fae4-4924-8087-7e7234f666f5', 'b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', 'internal_b8f5ab41-3eb2-41f3-a84b-6797cd18acbc', 'wks0968@gmail.com', '이철희', '{}', '2025-12-12 09:45:05.519971+00', '2025-12-12 09:45:05.519971+00');


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
-- Data for Name: iam_role_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.iam_role_policies VALUES ('fb340a0f-4ac5-4d76-b2e1-a070b7b7fa53', '423b01e1-def2-4ce9-b72b-fcad7d098a5e', '00000000-0000-0000-0003-000000000010', NULL, '2025-12-12 09:45:05.48509+00');
INSERT INTO public.iam_role_policies VALUES ('0a6a6682-08ec-4398-926c-218db8296be8', '2efedc2e-3143-4c4d-98b5-6451fed76b2b', '00000000-0000-0000-0003-000000000011', NULL, '2025-12-12 09:45:05.491793+00');
INSERT INTO public.iam_role_policies VALUES ('ebe533bd-e13a-49c9-8607-678c9b09e158', 'cedbcff3-d508-4074-96af-e850dc2d0598', '00000000-0000-0000-0003-000000000012', NULL, '2025-12-12 09:45:05.495664+00');
INSERT INTO public.iam_role_policies VALUES ('55cc5ba6-72ba-44e8-a8ef-40b485ff2510', '5dab9261-57c3-45b5-bd4c-17ec70dd3b39', '00000000-0000-0000-0003-000000000013', NULL, '2025-12-12 09:45:05.504154+00');


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

