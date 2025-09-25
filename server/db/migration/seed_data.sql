-- ====================================
-- Seed Data for Hana Lang Connect
-- ====================================

-- Insert Departments (그린다에이아이 조직 구조)
INSERT INTO "public"."departments" (id, name, code, description, is_active) VALUES
-- 그린다에이아이 부서
('550e8400-e29b-41d4-a716-446655440001'::uuid, '커뮤니케이션팀', 'COMM001', '대내외 커뮤니케이션 및 마케팅 전략 수립', true),
('550e8400-e29b-41d4-a716-446655440002'::uuid, '프로덕트팀', 'PROD001', '제품 기획, 개발 및 운영 관리', true),
('550e8400-e29b-41d4-a716-446655440003'::uuid, 'SDR팀', 'SDR001', '영업 개발 및 신규 고객 발굴', true),
('550e8400-e29b-41d4-a716-446655440004'::uuid, '경영지원팀', 'MGMT001', '인사, 재무, 총무 등 경영 전반 지원', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Insert Languages
INSERT INTO "public"."languages" (code, name, native_name, is_active) VALUES
('ko', '한국어', '한국어', true),
('en', '영어', 'English', true),
('zh', '중국어', '中文', true),
('th', '태국어', 'ไทย', true),
('si', '스리랑카어', 'සිංහල', true),
('my', '미얀마어', 'မြန်မာဘာသာ', true),
('vi', '베트남어', 'Tiếng Việt', true),
('tl', '필리핀어(타갈로그어)', 'Tagalog', true),
('mn', '몽골어', 'Монгол хэл', true),
('id', '인도네시아어', 'Bahasa Indonesia', true),
('km', '캄보디아어(크메르어)', 'ភាសាខ្មែរ', true),
('ja', '일본어', '日本語', true),
('bn', '방글라데시어(벵골어)', 'বাংলা', true),
('ne', '네팔어', 'नेपाली', true),
('ru', '러시아어', 'Русский', true),
('uz', '우즈베키스탄어', 'Oʻzbek tili', true)
ON CONFLICT (code) DO NOTHING;
