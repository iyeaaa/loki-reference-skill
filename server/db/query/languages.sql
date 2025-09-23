-- ====================================
-- Language Management SQL Queries
-- ====================================

-- name: GetLanguage :one
SELECT 
    id,
    code,
    name,
    native_name,
    is_active,
    created_at,
    updated_at
FROM languages
WHERE id = $1;

-- name: GetLanguageByCode :one
SELECT 
    id,
    code,
    name,
    native_name,
    is_active,
    created_at,
    updated_at
FROM languages
WHERE code = $1;

-- name: ListLanguages :many
SELECT 
    id,
    code,
    name,
    native_name,
    is_active,
    created_at,
    updated_at
FROM languages
ORDER BY name ASC;

-- name: ListActiveLanguages :many
SELECT 
    id,
    code,
    name,
    native_name,
    is_active,
    created_at,
    updated_at
FROM languages
WHERE is_active = true
ORDER BY name ASC;

-- name: CreateLanguage :one
INSERT INTO languages (
    code,
    name,
    native_name,
    is_active
) VALUES (
    $1, $2, $3, $4
)
RETURNING id, code, name, native_name, is_active, created_at, updated_at;

-- name: UpdateLanguage :one
UPDATE languages 
SET 
    code = $2,
    name = $3,
    native_name = $4,
    is_active = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, code, name, native_name, is_active, created_at, updated_at;

-- name: DeleteLanguage :exec
DELETE FROM languages WHERE id = $1;

-- name: CountLanguages :one
SELECT COUNT(*) FROM languages;

-- name: CountActiveLanguages :one
SELECT COUNT(*) FROM languages WHERE is_active = true;
