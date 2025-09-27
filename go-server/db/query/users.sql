-- ====================================
-- User Management SQL Queries
-- ====================================

-- ====================================
-- BASIC CRUD OPERATIONS
-- ====================================

-- name: GetUser :one
SELECT 
    u.id,
    u.username,
    u.email,
    u.password_hash,
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
        (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', l.id::text,
                'code', l.code,
                'name', l.name,
                'native_name', l.native_name,
                'is_active', l.is_active
            ) ORDER BY l.name
        )
        FROM user_edit_languages uel
        INNER JOIN languages l ON uel.language_id = l.id
        WHERE uel.user_id = u.id),
        '[]'::json
    ) as edit_languages,
    COALESCE(
        (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', l.id::text,
                'code', l.code,
                'name', l.name,
                'native_name', l.native_name,
                'is_active', l.is_active
            ) ORDER BY l.name
        )
        FROM user_review_languages url
        INNER JOIN languages l ON url.language_id = l.id
        WHERE url.user_id = u.id),
        '[]'::json
    ) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
WHERE u.id = $1;

-- name: CreateUser :one
INSERT INTO users (
    username,
    email,
    password_hash,
    user_role,
    is_active,
    department_id,
    employee_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id, username, email, user_role, is_active, department_id, employee_id, created_at, updated_at;

-- name: UpdateUser :one
UPDATE users 
SET 
    username = $2,
    email = $3,
    user_role = $4,
    is_active = $5,
    department_id = $6,
    employee_id = $7,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, username, email, user_role, is_active, department_id, employee_id, created_at, updated_at;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- ====================================
-- QUERY AND SEARCH OPERATIONS
-- ====================================

-- name: ListUsers :many
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
        (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', l.id::text,
                'code', l.code,
                'name', l.name,
                'native_name', l.native_name,
                'is_active', l.is_active
            ) ORDER BY l.name
        )
        FROM user_edit_languages uel
        INNER JOIN languages l ON uel.language_id = l.id
        WHERE uel.user_id = u.id),
        '[]'::json
    ) as edit_languages,
    COALESCE(
        (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', l.id::text,
                'code', l.code,
                'name', l.name,
                'native_name', l.native_name,
                'is_active', l.is_active
            ) ORDER BY l.name
        )
        FROM user_review_languages url
        INNER JOIN languages l ON url.language_id = l.id
        WHERE url.user_id = u.id),
        '[]'::json
    ) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
ORDER BY u.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListUsersWithFilters :many
WITH user_edit_langs AS (
    SELECT 
        uel.user_id,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', l.id::text,
                    'code', l.code,
                    'name', l.name,
                    'native_name', l.native_name,
                    'is_active', l.is_active
                ) ORDER BY l.name
            ) FILTER (WHERE l.id IS NOT NULL),
            '[]'::json
        ) as edit_languages
    FROM users u
    LEFT JOIN user_edit_languages uel ON u.id = uel.user_id
    LEFT JOIN languages l ON uel.language_id = l.id
    GROUP BY uel.user_id
),
user_review_langs AS (
    SELECT 
        url.user_id,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', l.id::text,
                    'code', l.code,
                    'name', l.name,
                    'native_name', l.native_name,
                    'is_active', l.is_active
                ) ORDER BY l.name
            ) FILTER (WHERE l.id IS NOT NULL),
            '[]'::json
        ) as review_languages
    FROM users u
    LEFT JOIN user_review_languages url ON u.id = url.user_id
    LEFT JOIN languages l ON url.language_id = l.id
    GROUP BY url.user_id
)
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
    COALESCE(uel.edit_languages, '[]'::json) as edit_languages,
    COALESCE(url.review_languages, '[]'::json) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
LEFT JOIN user_edit_langs uel ON u.id = uel.user_id
LEFT JOIN user_review_langs url ON u.id = url.user_id
WHERE 
    (sqlc.narg('role')::user_role_enum IS NULL OR u.user_role = sqlc.narg('role')::user_role_enum)
    AND (sqlc.narg('is_active')::boolean IS NULL OR u.is_active = sqlc.narg('is_active')::boolean)
    AND (sqlc.narg('search')::text IS NULL OR u.email ILIKE '%' || sqlc.narg('search')::text || '%' OR u.username ILIKE '%' || sqlc.narg('search')::text || '%' OR u.employee_id ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY u.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListUsersWithMultiFilters :many
WITH user_edit_langs AS (
    SELECT 
        uel.user_id,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', l.id::text,
                    'code', l.code,
                    'name', l.name,
                    'native_name', l.native_name,
                    'is_active', l.is_active
                ) ORDER BY l.name
            ) FILTER (WHERE l.id IS NOT NULL),
            '[]'::json
        ) as edit_languages
    FROM users u
    LEFT JOIN user_edit_languages uel ON u.id = uel.user_id
    LEFT JOIN languages l ON uel.language_id = l.id
    GROUP BY uel.user_id
),
user_review_langs AS (
    SELECT 
        url.user_id,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', l.id::text,
                    'code', l.code,
                    'name', l.name,
                    'native_name', l.native_name,
                    'is_active', l.is_active
                ) ORDER BY l.name
            ) FILTER (WHERE l.id IS NOT NULL),
            '[]'::json
        ) as review_languages
    FROM users u
    LEFT JOIN user_review_languages url ON u.id = url.user_id
    LEFT JOIN languages l ON url.language_id = l.id
    GROUP BY url.user_id
)
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
    COALESCE(uel.edit_languages, '[]'::json) as edit_languages,
    COALESCE(url.review_languages, '[]'::json) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
LEFT JOIN user_edit_langs uel ON u.id = uel.user_id
LEFT JOIN user_review_langs url ON u.id = url.user_id
WHERE 
    (NULLIF($3, '')::text IS NULL OR u.user_role = ANY(string_to_array($3, ',')::user_role_enum[]))
    AND (NULLIF($4, '')::text IS NULL OR u.is_active = ANY(string_to_array($4, ',')::boolean[]))
    AND (NULLIF($5, '')::text IS NULL OR u.department_id = ANY(string_to_array($5, ',')::uuid[]))
    AND (NULLIF($6, '')::text IS NULL OR u.email ILIKE '%' || $6 || '%' OR u.username ILIKE '%' || $6 || '%' OR u.employee_id ILIKE '%' || $6 || '%')
ORDER BY u.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetUserByEmail :one
SELECT 
    u.id,
    u.username,
    u.email,
    u.password_hash,
    u.user_role,
    u.is_active,
    u.department_id,
    u.employee_id,
    u.created_at,
    u.updated_at,
    u.last_login_at,
    d.name as department_name,
    d.code as department_code
FROM users u
INNER JOIN departments d ON u.department_id = d.id
WHERE u.email = $1;

-- name: GetAssignableUsers :many
SELECT 
    u.id,
    u.username,
    u.email,
    u.user_role,
    u.is_active,
    u.department_id,
    u.employee_id,
    d.name as department_name,
    d.code as department_code
FROM users u
INNER JOIN departments d ON u.department_id = d.id
WHERE 
    u.is_active = true
    AND u.user_role IN ('admin', 'internal_reviewer', 'external_reviewer')
ORDER BY u.username;

-- ====================================
-- STATISTICS AND UTILITY QUERIES
-- ====================================

-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: CountUsersWithFilters :one
SELECT COUNT(*) 
FROM users u
WHERE 
    (sqlc.narg('role')::user_role_enum IS NULL OR u.user_role = sqlc.narg('role')::user_role_enum)
    AND (sqlc.narg('is_active')::boolean IS NULL OR u.is_active = sqlc.narg('is_active')::boolean)
    AND (sqlc.narg('search')::text IS NULL OR u.email ILIKE '%' || sqlc.narg('search')::text || '%' OR u.username ILIKE '%' || sqlc.narg('search')::text || '%' OR u.employee_id ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: CountUsersWithMultiFilters :one
SELECT COUNT(*) 
FROM users u
WHERE 
    (NULLIF($1, '')::text IS NULL OR u.user_role = ANY(string_to_array($1, ',')::user_role_enum[]))
    AND (NULLIF($2, '')::text IS NULL OR u.is_active = ANY(string_to_array($2, ',')::boolean[]))
    AND (NULLIF($3, '')::text IS NULL OR u.department_id = ANY(string_to_array($3, ',')::uuid[]))
    AND (NULLIF($4, '')::text IS NULL OR u.email ILIKE '%' || $4 || '%' OR u.username ILIKE '%' || $4 || '%' OR u.employee_id ILIKE '%' || $4 || '%');

-- name: CheckAccountExists :one
SELECT EXISTS(SELECT 1 FROM users WHERE email = $1);

-- ====================================
-- AUTHENTICATION AND PASSWORD QUERIES
-- ====================================

-- name: UpdateUserPassword :one
UPDATE users 
SET 
    password_hash = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, username, email, user_role, is_active;

-- name: CreateOrUpdateGoogleUser :one
INSERT INTO users (
    username,
    email,
    user_role,
    is_active,
    department_id,
    employee_id,
    last_login_at
) VALUES (
    $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
)
ON CONFLICT (email) 
DO UPDATE SET
    last_login_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, username, email, user_role, is_active, department_id, employee_id, created_at, updated_at, last_login_at;

-- ====================================
-- USER LANGUAGE PERMISSIONS QUERIES
-- ====================================

-- name: GetUserWithEditLanguages :one
SELECT 
    u.id,
    u.username,
    u.email,
    u.user_role,
    u.is_active,
    u.department_id,
    u.employee_id,
    d.name as department_name,
    ARRAY_AGG(DISTINCT l_edit.code) FILTER (WHERE l_edit.code IS NOT NULL) as edit_languages,
    ARRAY_AGG(DISTINCT l_review.code) FILTER (WHERE l_review.code IS NOT NULL) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
LEFT JOIN user_edit_languages uel ON u.id = uel.user_id
LEFT JOIN languages l_edit ON uel.language_id = l_edit.id AND l_edit.is_active = true
LEFT JOIN user_review_languages url ON u.id = url.user_id
LEFT JOIN languages l_review ON url.language_id = l_review.id AND l_review.is_active = true
WHERE u.id = $1
GROUP BY u.id, u.username, u.email, u.user_role, u.is_active, u.department_id, u.employee_id, d.name;

-- name: GetUsersWithLanguagePermissions :many
SELECT 
    u.id,
    u.username,
    u.email,
    u.user_role,
    u.is_active,
    u.department_id,
    u.employee_id,
    d.name as department_name,
    ARRAY_AGG(DISTINCT l_edit.code) FILTER (WHERE l_edit.code IS NOT NULL) as edit_languages,
    ARRAY_AGG(DISTINCT l_review.code) FILTER (WHERE l_review.code IS NOT NULL) as review_languages
FROM users u
INNER JOIN departments d ON u.department_id = d.id
LEFT JOIN user_edit_languages uel ON u.id = uel.user_id
LEFT JOIN languages l_edit ON uel.language_id = l_edit.id AND l_edit.is_active = true
LEFT JOIN user_review_languages url ON u.id = url.user_id
LEFT JOIN languages l_review ON url.language_id = l_review.id AND l_review.is_active = true
WHERE u.is_active = true
GROUP BY u.id, u.username, u.email, u.user_role, u.is_active, u.department_id, u.employee_id, d.name
ORDER BY u.username
LIMIT $1 OFFSET $2;

-- ====================================
-- UPDATE LAST LOGIN
-- ====================================

-- name: UpdateLastLogin :exec
UPDATE users 
SET 
    last_login_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;