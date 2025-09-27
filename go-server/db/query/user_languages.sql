-- ====================================
-- User Language Permission SQL Queries
-- ====================================

-- ====================================
-- USER EDIT LANGUAGES
-- ====================================

-- name: GetUserEditLanguages :many
SELECT 
    l.id,
    l.code,
    l.name,
    l.native_name,
    l.is_active
FROM user_edit_languages uel
INNER JOIN languages l ON uel.language_id = l.id
WHERE uel.user_id = $1
ORDER BY l.name;

-- name: SetUserEditLanguages :exec
DELETE FROM user_edit_languages WHERE user_id = $1;

-- name: AddUserEditLanguage :exec
INSERT INTO user_edit_languages (user_id, language_id)
SELECT $1, l.id
FROM languages l
WHERE l.code = $2
ON CONFLICT (user_id, language_id) DO NOTHING;

-- name: RemoveUserEditLanguage :exec
DELETE FROM user_edit_languages 
WHERE user_id = $1 
AND language_id = (SELECT id FROM languages WHERE code = $2);

-- name: RemoveAllUserEditLanguages :exec
DELETE FROM user_edit_languages WHERE user_id = $1;

-- ====================================
-- USER REVIEW LANGUAGES
-- ====================================

-- name: GetUserReviewLanguages :many
SELECT 
    l.id,
    l.code,
    l.name,
    l.native_name,
    l.is_active
FROM user_review_languages url
INNER JOIN languages l ON url.language_id = l.id
WHERE url.user_id = $1
ORDER BY l.name;

-- name: SetUserReviewLanguages :exec
DELETE FROM user_review_languages WHERE user_id = $1;

-- name: AddUserReviewLanguage :exec
INSERT INTO user_review_languages (user_id, language_id)
SELECT $1, l.id
FROM languages l
WHERE l.code = $2
ON CONFLICT (user_id, language_id) DO NOTHING;

-- name: RemoveUserReviewLanguage :exec
DELETE FROM user_review_languages 
WHERE user_id = $1 
AND language_id = (SELECT id FROM languages WHERE code = $2);

-- name: RemoveAllUserReviewLanguages :exec
DELETE FROM user_review_languages WHERE user_id = $1;

-- ====================================
-- COMBINED QUERIES
-- ====================================

-- name: GetUserWithLanguages :one
SELECT 
    u.id,
    u.username,
    u.email,
    u.user_role,
    u.is_active,
    u.department_id,
    u.employee_id,
    u.created_at,
    u.updated_at,
    u.last_login_at,
    d.name as department_name,
    d.code as department_code,
    COALESCE(
        ARRAY_AGG(DISTINCT el.code) FILTER (WHERE el.code IS NOT NULL), 
        ARRAY[]::text[]
    ) as edit_language_codes,
    COALESCE(
        ARRAY_AGG(DISTINCT rl.code) FILTER (WHERE rl.code IS NOT NULL), 
        ARRAY[]::text[]
    ) as review_language_codes
FROM users u
INNER JOIN departments d ON u.department_id = d.id
LEFT JOIN user_edit_languages uel ON u.id = uel.user_id
LEFT JOIN languages el ON uel.language_id = el.id
LEFT JOIN user_review_languages url ON u.id = url.user_id
LEFT JOIN languages rl ON url.language_id = rl.id
WHERE u.id = $1
GROUP BY u.id, u.username, u.email, u.user_role, u.is_active, 
         u.department_id, u.employee_id, u.created_at, u.updated_at, 
         u.last_login_at, d.name, d.code;